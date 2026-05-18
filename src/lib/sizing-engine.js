import {
  AVG_DIALUP_USER_MBPS,
  AVG_TUNNEL_BANDWIDTH_MBPS,
  FEATURE_METRIC_PRIORITY,
  IOT_HEAVY_VERTICALS,
  PORT_TYPES,
  SESSION_PER_USER_BASE,
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
  return { feature: null, metric: 'firewallGbps', label: 'Firewall throughput' };
}

export function calculateRecommendation(inputs, models) {
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

  // Multisite drives an IPsec tunnel floor. User can override upward via vpnTunnels.
  const sites = Math.max(1, Number(inputs.sites) || 1);
  const userVpnTunnels = Math.max(0, Number(inputs.vpnTunnels) || 0);
  const effectiveTunnels = Math.max(userVpnTunnels, sites - 1);
  const ipsecDialupUsers = Math.max(0, Number(inputs.ipsecDialupUsers) || 0);
  const ipsecLoadMbps =
    effectiveTunnels * AVG_TUNNEL_BANDWIDTH_MBPS + ipsecDialupUsers * AVG_DIALUP_USER_MBPS;

  const validModels = (models || [])
    .filter((m) => typeof m[metricChoice.metric] === 'number')
    .slice()
    .sort((a, b) => (a[metricChoice.metric] || 0) - (b[metricChoice.metric] || 0));

  function modelMetricMbps(m) {
    return gbpsToMbps(m[metricChoice.metric]);
  }
  function modelIpsecMbps(m) {
    return gbpsToMbps(m.ipsecVpnGbps);
  }

  // Eligibility: clears throughput floor AND IPsec floor (or has unknown IPsec capacity).
  const eligible = validModels.filter((m) => {
    if (modelMetricMbps(m) < minAcceptableMbps) return false;
    // If model has an IPsec rating, it must be enough. If rating is 0 in the data,
    // we don't have a number to compare — let it through but warn later.
    if (ipsecLoadMbps > 0 && m.ipsecVpnGbps > 0 && modelIpsecMbps(m) < ipsecLoadMbps) return false;
    return true;
  });

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
    const wouldFitWithoutMargin = validModels.some((m) => modelMetricMbps(m) >= targetTPMbps);
    if (minMargin > 1 && wouldFitWithoutMargin) {
      warnings.push(
        `No model clears the minimum margin of ${minMargin.toFixed(2)}x over target. Lower the minimum margin in Advanced to see picks that meet target without the safety factor.`
      );
    } else {
      warnings.push(
        `No model meets the ${metricChoice.label} target. Consider chassis-class platforms or splitting traffic across multiple firewalls.`
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

  const isIotHeavy = IOT_HEAVY_VERTICALS.includes(inputs.vertical);
  if (isIotHeavy) {
    const sessionEstimate =
      users * SESSION_PER_USER_BASE + users * devicesPerUser * SESSION_PER_DEVICE_IOT;
    if (recommended && recommended.concurrentSessions > 0 && sessionEstimate > recommended.concurrentSessions * 0.5) {
      warnings.push(
        `Vertical "${inputs.vertical}" is session-heavy. Estimated ${sessionEstimate.toLocaleString()} concurrent sessions is significant relative to the recommended model's capacity. Validate against datasheet session counts.`
      );
    } else if (recommended) {
      warnings.push(
        `Vertical "${inputs.vertical}" is session-heavy: validate concurrent and new-sessions-per-second figures, not just throughput.`
      );
    }
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
  const margin = recMetricMbps > 0 ? recMetricMbps / Math.max(targetTPMbps, 1) : 0;

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
    steps: [
      `${users} users x ${devicesPerUser} devices x ${bandwidthPerDeviceMbps} Mbps x ${peakFactor} peak factor = ${round(requiredTPMbps)} Mbps required`,
      `${round(requiredTPMbps)} Mbps x ${headroomMultiplier.toFixed(2)} (${headroomPct}% headroom) = ${round(calculatedTargetMbps)} Mbps calculated target`,
      internetMbps > 0
        ? (targetDrivenBy === 'internet'
            ? `Internet pipe (${internetMbps} Mbps) exceeds calculated load — pipe size becomes the target (${round(targetTPMbps)} Mbps)`
            : `Internet pipe is ${internetMbps} Mbps (below calculated load — calculated target stands at ${round(targetTPMbps)} Mbps)`)
        : `No internet bandwidth entered — calculated target stands at ${round(targetTPMbps)} Mbps`,
      `Sizing metric: ${featureSummary}`,
      minMargin > 1
        ? `${round(targetTPMbps)} Mbps x ${minMargin.toFixed(2)} (min margin) = ${round(minAcceptableMbps)} Mbps required of the chosen model`
        : `No minimum margin applied (target is the bar to clear)`,
      ipsecLoadMbps > 0
        ? `IPsec load: ${effectiveTunnels} site-to-site tunnels x ${AVG_TUNNEL_BANDWIDTH_MBPS} Mbps + ${ipsecDialupUsers} dialup users x ${AVG_DIALUP_USER_MBPS} Mbps = ${round(ipsecLoadMbps)} Mbps required of model's IPsec capacity`
        : `No IPsec load (no site-to-site tunnels or dialup users)`,
      recommended
        ? `${recommended.model} provides ${recMetricMbps} Mbps ${metricChoice.label} (${round(margin, 2)}x over target, ${round(recMetricMbps / Math.max(minAcceptableMbps, 1), 2)}x over min)`
        : `No model in the database clears the ${round(minAcceptableMbps)} Mbps bar.`,
      ...(preferredGOverSmallerF
        ? [`Preferred ${recommended.model} (G-series) over the smaller-but-eligible ${eligible[0].model} (F-series)`]
        : [])
    ]
  };

  return {
    recommended,
    alternativeDown,
    alternativeUp,
    calculations,
    warnings
  };
}
