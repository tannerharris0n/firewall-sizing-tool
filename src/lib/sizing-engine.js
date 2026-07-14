import {
  AVG_DIALUP_USER_MBPS,
  AVG_TUNNEL_BANDWIDTH_MBPS,
  CONCURRENT_SESSIONS_PER_USER,
  DEFAULT_SESSION_UTILIZATION_PCT,
  DEFAULT_THROUGHPUT_UTILIZATION_PCT,
  FEATURE_METRIC_PRIORITY,
  IOT_HEAVY_VERTICALS,
  NEW_SESSIONS_PER_USER,
  PORT_TYPES,
  SESSION_PER_DEVICE_IOT
} from './constants.js';

function round(n, digits = 2) {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

function gbpsToMbps(gbps) {
  return (Number(gbps) || 0) * 1000;
}

function isGSeries(model) {
  return typeof model.model === 'string' && /G$/.test(model.model.trim());
}

function pickMetricForFeatures(features) {
  const selected = new Set(Array.isArray(features) ? features : []);
  for (const entry of FEATURE_METRIC_PRIORITY) {
    if (selected.has(entry.feature)) return entry;
  }
  // No inspection features selected: size on Threat Protection throughput, not
  // raw firewallGbps. Raw L3/L4 firewall throughput is a large-packet best-case
  // datasheet number — every box clears it for an unrealistic range of loads,
  // which freezes the recommendation. Threat Protection is the realistic floor.
  return { feature: null, metric: 'threatProtectionGbps', label: 'Threat Protection throughput' };
}

export function calculateRecommendation(inputs, models, comparisonModel) {
  const users = Math.max(1, Number(inputs.users) || 0);
  const devicesPerUser = Math.max(1, Number(inputs.devicesPerUser) || 1);
  const bandwidthPerDeviceMbps = Math.max(0, Number(inputs.bandwidthPerDeviceMbps) || 0);
  const peakFactor = Math.max(0.1, Number(inputs.peakFactor) || 1);
  const headroomPct = Math.max(0, Number(inputs.headroomPct) || 0);

  const requiredTPMbps = users * devicesPerUser * bandwidthPerDeviceMbps * peakFactor;
  const headroomMultiplier = 1 + headroomPct / 100;
  const calculatedTargetMbps = requiredTPMbps * headroomMultiplier;
  const internetMbps = Math.max(0, Number(inputs.internetBandwidthMbps) || 0);
  // The firewall must handle the full internet pipe regardless of calculated
  // user load — anything below the pipe size will throttle the user's WAN.
  const targetTPMbps = Math.max(calculatedTargetMbps, internetMbps);
  const targetDrivenBy = internetMbps > calculatedTargetMbps ? 'internet' : 'calculated';
  const minMargin = Math.max(1, Number(inputs.minMargin) || 1);
  const minAcceptableMbps = targetTPMbps * minMargin;

  // Which throughput metric must the model clear? Depends on selected features.
  const metricChoice = pickMetricForFeatures(inputs.features);

  // --- Rule of thumb: session requirements and datasheet derates ---------------
  // Requirements scale with users; a device's usable capacity is a fraction of its
  // datasheet rating (10% of sessions, 50% of throughput) because datasheet numbers
  // are best-case lab figures.
  const throughputUtilization =
    Math.min(100, Math.max(1, Number(inputs.throughputUtilizationPct) || DEFAULT_THROUGHPUT_UTILIZATION_PCT)) / 100;
  const sessionUtilization =
    Math.min(100, Math.max(1, Number(inputs.sessionUtilizationPct) || DEFAULT_SESSION_UTILIZATION_PCT)) / 100;

  const isIotHeavy = IOT_HEAVY_VERTICALS.includes(inputs.vertical);
  // IoT-heavy verticals add per-device sessions on top of the per-user baseline —
  // the cameras, sensors and imaging gear each hold their own sessions.
  const iotConcurrentSessions = isIotHeavy ? users * devicesPerUser * SESSION_PER_DEVICE_IOT : 0;
  const requiredConcurrentSessions = users * CONCURRENT_SESSIONS_PER_USER + iotConcurrentSessions;
  const requiredNewSessionsPerSec = users * NEW_SESSIONS_PER_USER;

  // Multisite drives an IPsec tunnel floor. User can override upward via vpnTunnels.
  const sites = Math.max(1, Number(inputs.sites) || 1);
  const userVpnTunnels = Math.max(0, Number(inputs.vpnTunnels) || 0);
  const effectiveTunnels = Math.max(userVpnTunnels, sites - 1);
  const ipsecDialupUsers = Math.max(0, Number(inputs.ipsecDialupUsers) || 0);
  const ipsecLoadMbps =
    effectiveTunnels * AVG_TUNNEL_BANDWIDTH_MBPS + ipsecDialupUsers * AVG_DIALUP_USER_MBPS;

  // Exclude models with a 0/missing value for the active metric. A 0 means
  // "not rated for this metric" (e.g. chassis platforms have no fixed firewall
  // throughput), not "zero capacity" — letting it through sorts it to the front
  // of the list and pollutes the recommendation's step-down/step-up neighbors.
  const validModels = (models || [])
    .filter((m) => typeof m[metricChoice.metric] === 'number' && m[metricChoice.metric] > 0)
    .slice()
    .sort((a, b) => (a[metricChoice.metric] || 0) - (b[metricChoice.metric] || 0));

  function modelMetricMbps(m) {
    return gbpsToMbps(m[metricChoice.metric]);
  }
  // Usable capacity per the rule of thumb: only a fraction of the datasheet rating
  // is planned against.
  function usableMetricMbps(m) {
    return modelMetricMbps(m) * throughputUtilization;
  }
  function usableConcurrentSessions(m) {
    return (Number(m.concurrentSessions) || 0) * sessionUtilization;
  }
  function usableNewSessionsPerSec(m) {
    return (Number(m.newSessionsPerSec) || 0) * sessionUtilization;
  }
  function modelIpsecMbps(m) {
    return gbpsToMbps(m.ipsecVpnGbps);
  }

  // Eligibility: usable throughput clears the target, usable session capacity clears
  // the per-user session requirements, and IPsec capacity covers the tunnel load.
  function throughputOk(m) {
    return usableMetricMbps(m) >= minAcceptableMbps;
  }
  function concurrentOk(m) {
    // A 0 means "not rated in the data", not "no capacity" — don't reject on a blank.
    return !m.concurrentSessions || usableConcurrentSessions(m) >= requiredConcurrentSessions;
  }
  function newSessionsOk(m) {
    return !m.newSessionsPerSec || usableNewSessionsPerSec(m) >= requiredNewSessionsPerSec;
  }
  function ipsecOk(m) {
    // If the model has an IPsec rating, it must be enough. If the rating is 0 in the
    // data, we have no number to compare — let it through and warn later.
    if (ipsecLoadMbps <= 0 || !m.ipsecVpnGbps) return true;
    return modelIpsecMbps(m) >= ipsecLoadMbps;
  }

  const eligible = validModels.filter(
    (m) => throughputOk(m) && concurrentOk(m) && newSessionsOk(m) && ipsecOk(m)
  );

  // Prefer G-series over F-series among eligible.
  const eligibleG = eligible.filter(isGSeries);
  const recommended = eligibleG[0] || eligible[0] || null;
  const preferredGOverSmallerF =
    recommended && isGSeries(recommended) && eligible[0] && eligible[0].model !== recommended.model;

  let alternativeDown = null;
  let alternativeUp = null;
  if (recommended) {
    const recIndex = validModels.findIndex((m) => m.model === recommended.model);
    if (recIndex > 0) alternativeDown = validModels[recIndex - 1];
    if (recIndex >= 0 && recIndex < validModels.length - 1) {
      alternativeUp = validModels[recIndex + 1];
    }
  }

  const warnings = [];
  const databaseUnpopulated = validModels.every(
    (m) => !m[metricChoice.metric] || m[metricChoice.metric] === 0
  );
  if (databaseUnpopulated) {
    warnings.push(
      'The FortiGate model database has not been populated yet. All throughput values are zero — recommendation is a placeholder.'
    );
  }

  if (!recommended && !databaseUnpopulated) {
    const wouldFitWithoutMargin = validModels.some((m) => usableMetricMbps(m) >= targetTPMbps);
    const throughputCandidates = validModels.filter(throughputOk);
    if (minMargin > 1 && wouldFitWithoutMargin) {
      warnings.push(
        `No model clears the minimum margin of ${minMargin.toFixed(2)}x over target. Lower the minimum margin in Advanced to see picks that meet target without the extra safety factor.`
      );
    } else if (throughputCandidates.length && !throughputCandidates.some(concurrentOk)) {
      warnings.push(
        `Models clear the ${metricChoice.label} target but none has the session capacity for ${requiredConcurrentSessions.toLocaleString()} concurrent sessions at ${Math.round(sessionUtilization * 100)}% of datasheet. Session capacity, not bandwidth, is the constraint here.`
      );
    } else if (throughputCandidates.length && !throughputCandidates.some(newSessionsOk)) {
      warnings.push(
        `Models clear the ${metricChoice.label} target but none sustains ${requiredNewSessionsPerSec.toLocaleString()} new sessions/sec at ${Math.round(sessionUtilization * 100)}% of datasheet. New-session rate, not bandwidth, is the constraint here.`
      );
    } else if (throughputCandidates.length && ipsecLoadMbps > 0) {
      warnings.push(
        `Models clear the ${metricChoice.label} target but none has enough IPsec VPN capacity for ${round(ipsecLoadMbps)} Mbps of tunnel load.`
      );
    } else {
      warnings.push(
        `No model meets the ${metricChoice.label} target at ${Math.round(throughputUtilization * 100)}% of datasheet throughput. Consider chassis-class platforms or splitting traffic across multiple firewalls.`
      );
    }
  }

  // IPsec capacity check on the recommended model (info / warning).
  if (recommended && ipsecLoadMbps > 0) {
    const recIpsec = modelIpsecMbps(recommended);
    if (recIpsec === 0) {
      warnings.push(
        `${recommended.model} has no IPsec VPN throughput in the database — IPsec load (${round(ipsecLoadMbps)} Mbps) couldn't be verified. Confirm against the datasheet.`
      );
    } else if (recIpsec < ipsecLoadMbps) {
      warnings.push(
        `IPsec load (${round(ipsecLoadMbps)} Mbps from ${effectiveTunnels} site tunnels + ${ipsecDialupUsers} dialup users) exceeds ${recommended.model}'s ${recIpsec} Mbps IPsec capacity.`
      );
    }
  }

  // Dialup users are checked against the model's client-to-gateway tunnel ceiling,
  // which is a hard limit independent of IPsec bandwidth.
  if (recommended && ipsecDialupUsers > 0 && recommended.maxClientVpnTunnels > 0) {
    if (ipsecDialupUsers > recommended.maxClientVpnTunnels) {
      warnings.push(
        `${ipsecDialupUsers.toLocaleString()} dialup users exceeds ${recommended.model}'s ceiling of ${recommended.maxClientVpnTunnels.toLocaleString()} client-to-gateway IPsec tunnels. Step up, or terminate remote access on a separate concentrator.`
      );
    }
  }

  if (isIotHeavy && recommended) {
    warnings.push(
      `Vertical "${inputs.vertical}" is session-heavy, so the concurrent-session requirement includes ${SESSION_PER_DEVICE_IOT} sessions per device on top of the ${CONCURRENT_SESSIONS_PER_USER}/user baseline (${requiredConcurrentSessions.toLocaleString()} total). Validate against real session counts from the existing firewall where possible.`
    );
  }

  if (inputs.haRequired) {
    warnings.push(
      'HA pair requested: order two identical units. Active-passive HA does not increase throughput; active-active scales only some workloads. Confirm with a sales engineer.'
    );
  }

  if (internetMbps > calculatedTargetMbps * 3 && calculatedTargetMbps > 0) {
    warnings.push(
      `Internet pipe (${internetMbps} Mbps) is much larger than the calculated user load (${round(calculatedTargetMbps)} Mbps with headroom). Sizing was driven by the pipe; either the user/bandwidth inputs underestimate real usage, or the pipe is oversized for the user count.`
    );
  }

  if (recommended && inputs.portRequirements && typeof inputs.portRequirements === 'object') {
    const have = recommended.portCounts || {};
    const shortfalls = [];
    PORT_TYPES.forEach(({ key, label }) => {
      const need = Math.max(0, Number(inputs.portRequirements[key]) || 0);
      if (need > 0) {
        const got = Number(have[key]) || 0;
        if (got < need) {
          shortfalls.push(`${label}: need ${need}, ${recommended.model} has ${got}`);
        }
      }
    });
    if (shortfalls.length) {
      warnings.push(
        'Interface shortfall on the recommended model — ' + shortfalls.join('; ') +
        '. Consider stepping up, adding a separate switch for access ports, or running a FortiSwitch stack behind the firewall.'
      );
    }
  }

  const recMetricMbps = recommended ? modelMetricMbps(recommended) : 0;
  const recUsableMbps = recommended ? usableMetricMbps(recommended) : 0;
  // Margin is measured on usable (derated) capacity, not the datasheet headline.
  const margin = recUsableMbps > 0 ? recUsableMbps / Math.max(targetTPMbps, 1) : 0;

  const throughputPct = Math.round(throughputUtilization * 100);
  const sessionPct = Math.round(sessionUtilization * 100);

  // Which requirement was actually binding? The pick is the smallest model that
  // clears all of them, so the binding one is whatever the next model down fails.
  const recIndexInValid = recommended
    ? validModels.findIndex((m) => m.model === recommended.model)
    : -1;
  const nextSmaller = recIndexInValid > 0 ? validModels[recIndexInValid - 1] : null;
  let bindingConstraint = null;
  if (recommended && nextSmaller) {
    if (!throughputOk(nextSmaller)) bindingConstraint = 'throughput';
    else if (!concurrentOk(nextSmaller)) bindingConstraint = 'concurrentSessions';
    else if (!newSessionsOk(nextSmaller)) bindingConstraint = 'newSessions';
    else if (!ipsecOk(nextSmaller)) bindingConstraint = 'ipsec';
  }

  const featureSummary = metricChoice.feature
    ? `${metricChoice.label} (because "${metricChoice.feature}" is selected)`
    : `${metricChoice.label} (no inspection features selected)`;

  const calculations = {
    users,
    devicesPerUser,
    bandwidthPerDeviceMbps,
    peakFactor,
    headroomPct,
    requiredTPMbps: round(requiredTPMbps),
    targetTPMbps: round(targetTPMbps),
    recommendedThroughputMbps: round(recMetricMbps),
    recommendedUsableMbps: round(recUsableMbps),
    marginMultiplier: round(margin, 2),
    minMargin,
    minAcceptableMbps: round(minAcceptableMbps),
    targetDrivenBy,
    internetMbps,
    calculatedTargetMbps: round(calculatedTargetMbps),
    metric: metricChoice.metric,
    metricLabel: metricChoice.label,
    triggeringFeature: metricChoice.feature,
    effectiveTunnels,
    ipsecDialupUsers,
    ipsecLoadMbps: round(ipsecLoadMbps),
    sites,
    throughputUtilizationPct: throughputPct,
    sessionUtilizationPct: sessionPct,
    requiredConcurrentSessions,
    requiredNewSessionsPerSec,
    iotConcurrentSessions,
    recommendedConcurrentSessions: recommended ? Number(recommended.concurrentSessions) || 0 : 0,
    recommendedNewSessionsPerSec: recommended ? Number(recommended.newSessionsPerSec) || 0 : 0,
    recommendedUsableConcurrentSessions: recommended
      ? Math.round(usableConcurrentSessions(recommended))
      : 0,
    recommendedUsableNewSessionsPerSec: recommended
      ? Math.round(usableNewSessionsPerSec(recommended))
      : 0,
    bindingConstraint,
    steps: [
      `${users} users x ${devicesPerUser} devices x ${bandwidthPerDeviceMbps} Mbps x ${peakFactor} peak factor = ${round(requiredTPMbps)} Mbps required`,
      `${round(requiredTPMbps)} Mbps x ${headroomMultiplier.toFixed(2)} (${headroomPct}% headroom) = ${round(calculatedTargetMbps)} Mbps calculated target`,
      internetMbps > 0
        ? (targetDrivenBy === 'internet'
            ? `Internet pipe (${internetMbps} Mbps) exceeds calculated load — pipe size becomes the target (${round(targetTPMbps)} Mbps)`
            : `Internet pipe is ${internetMbps} Mbps (below calculated load — calculated target stands at ${round(targetTPMbps)} Mbps)`)
        : `No internet bandwidth entered — calculated target stands at ${round(targetTPMbps)} Mbps`,
      `Sizing metric: ${featureSummary}`,
      `Sessions required: ${users} users x ${NEW_SESSIONS_PER_USER}/user = ${requiredNewSessionsPerSec.toLocaleString()} new sessions/sec; ${users} x ${CONCURRENT_SESSIONS_PER_USER}/user${iotConcurrentSessions > 0 ? ` + ${iotConcurrentSessions.toLocaleString()} IoT device sessions` : ''} = ${requiredConcurrentSessions.toLocaleString()} concurrent sessions`,
      `Rule of thumb derate: a model is planned at ${throughputPct}% of its datasheet throughput and ${sessionPct}% of its datasheet session capacity`,
      minMargin > 1
        ? `${round(targetTPMbps)} Mbps x ${minMargin.toFixed(2)} (extra min margin) = ${round(minAcceptableMbps)} Mbps of usable throughput required`
        : `No extra margin applied (the ${throughputPct}% derate is the safety factor)`,
      ipsecLoadMbps > 0
        ? `IPsec load: ${effectiveTunnels} site-to-site tunnels x ${AVG_TUNNEL_BANDWIDTH_MBPS} Mbps + ${ipsecDialupUsers} dialup users x ${AVG_DIALUP_USER_MBPS} Mbps = ${round(ipsecLoadMbps)} Mbps required of model's IPsec capacity`
        : `No IPsec load (no site-to-site tunnels or dialup users)`,
      recommended
        ? `${recommended.model}: ${recMetricMbps} Mbps ${metricChoice.label} x ${throughputPct}% = ${round(recUsableMbps)} Mbps usable (${round(margin, 2)}x over target)`
        : `No model in the database clears the ${round(minAcceptableMbps)} Mbps usable bar.`,
      ...(recommended
        ? [
            `${recommended.model}: ${(Number(recommended.newSessionsPerSec) || 0).toLocaleString()} new sessions/sec x ${sessionPct}% = ${Math.round(usableNewSessionsPerSec(recommended)).toLocaleString()} usable (need ${requiredNewSessionsPerSec.toLocaleString()}); ${(Number(recommended.concurrentSessions) || 0).toLocaleString()} concurrent x ${sessionPct}% = ${Math.round(usableConcurrentSessions(recommended)).toLocaleString()} usable (need ${requiredConcurrentSessions.toLocaleString()})`
          ]
        : []),
      ...(bindingConstraint && nextSmaller
        ? [
            `Binding constraint: ${
              bindingConstraint === 'throughput'
                ? metricChoice.label
                : bindingConstraint === 'concurrentSessions'
                ? 'concurrent sessions'
                : bindingConstraint === 'newSessions'
                ? 'new sessions/sec'
                : 'IPsec VPN capacity'
            } — the next model down (${nextSmaller.model}) fails on it`
          ]
        : []),
      ...(preferredGOverSmallerF
        ? [`Preferred ${recommended.model} (G-series) over the smaller-but-eligible ${eligible[0].model} (F-series)`]
        : [])
    ]
  };

  // Comparison-only evaluation of the customer's current model. This NEVER enters the
  // recommendation pool — legacy/EOL boxes are not sizing candidates. We only score the
  // user-selected current model against the same target/metric so an SE can show where
  // it lands versus the recommended replacement.
  let comparison = null;
  if (comparisonModel && typeof comparisonModel === 'object') {
    const metricMbps = modelMetricMbps(comparisonModel);
    const usableMbps = usableMetricMbps(comparisonModel);
    const metricRated = typeof comparisonModel[metricChoice.metric] === 'number' && comparisonModel[metricChoice.metric] > 0;
    const marginMultiplier = metricRated ? usableMbps / Math.max(targetTPMbps, 1) : 0;
    const ipsecMbps = modelIpsecMbps(comparisonModel);
    comparison = {
      model: comparisonModel,
      metric: metricChoice.metric,
      metricLabel: metricChoice.label,
      metricMbps: round(metricMbps),
      usableMbps: round(usableMbps),
      metricRated,
      marginMultiplier: round(marginMultiplier, 2),
      deltaPct: metricRated ? Math.round((marginMultiplier - 1) * 100) : null,
      clearsTarget: metricRated && usableMbps >= targetTPMbps,
      clearsMinMargin: metricRated && usableMbps >= minAcceptableMbps,
      clearsSessions: concurrentOk(comparisonModel) && newSessionsOk(comparisonModel),
      usableConcurrentSessions: Math.round(usableConcurrentSessions(comparisonModel)),
      usableNewSessionsPerSec: Math.round(usableNewSessionsPerSec(comparisonModel)),
      requiredConcurrentSessions,
      requiredNewSessionsPerSec,
      targetTPMbps: round(targetTPMbps),
      ipsecRated: comparisonModel.ipsecVpnGbps > 0,
      ipsecMbps: round(ipsecMbps),
      ipsecOk: ipsecOk(comparisonModel),
      ipsecLoadMbps: round(ipsecLoadMbps)
    };
  }

  return {
    recommended,
    alternativeDown,
    alternativeUp,
    calculations,
    warnings,
    comparison
  };
}
