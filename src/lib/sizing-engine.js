import {
  AVG_TUNNEL_BANDWIDTH_MBPS,
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

export function calculateRecommendation(inputs, models) {
  const users = Math.max(1, Number(inputs.users) || 0);
  const devicesPerUser = Math.max(1, Number(inputs.devicesPerUser) || 1);
  const bandwidthPerDeviceMbps = Math.max(0, Number(inputs.bandwidthPerDeviceMbps) || 0);
  const peakFactor = Math.max(0.1, Number(inputs.peakFactor) || 1);
  const headroomPct = Math.max(0, Number(inputs.headroomPct) || 0);

  const requiredTPMbps = users * devicesPerUser * bandwidthPerDeviceMbps * peakFactor;
  const headroomMultiplier = 1 + headroomPct / 100;
  const targetTPMbps = requiredTPMbps * headroomMultiplier;
  const minMargin = Math.max(1, Number(inputs.minMargin) || 1);
  const minAcceptableMbps = targetTPMbps * minMargin;

  const validModels = (models || [])
    .filter((m) => typeof m.threatProtectionGbps === 'number')
    .slice()
    .sort((a, b) => a.threatProtectionGbps - b.threatProtectionGbps);

  const eligible = validModels.filter(
    (m) => gbpsToMbps(m.threatProtectionGbps) >= minAcceptableMbps
  );

  // Prefer G-series over F-series among eligible. If no G-series clears the
  // threshold, fall back to the smallest eligible model regardless of series.
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
    (m) => !m.threatProtectionGbps || m.threatProtectionGbps === 0
  );

  if (databaseUnpopulated) {
    warnings.push(
      'The FortiGate model database has not been populated yet. All throughput values are zero, so this recommendation is a placeholder. Edit src/data/fortigate-models.json with real datasheet values.'
    );
  }

  if (!recommended && !databaseUnpopulated) {
    if (minMargin > 1 && validModels.some((m) => gbpsToMbps(m.threatProtectionGbps) >= targetTPMbps)) {
      warnings.push(
        `No model clears the minimum margin of ${minMargin.toFixed(2)}x over target. Lower the minimum margin in Advanced to see picks that meet target without the safety factor.`
      );
    } else {
      warnings.push(
        'No model in the database meets the target Threat Protection throughput. Consider chassis-class platforms or splitting traffic across multiple firewalls.'
      );
    }
  }

  const vpnTunnels = Math.max(0, Number(inputs.vpnTunnels) || 0);
  if (recommended && vpnTunnels > 0) {
    const vpnDemandMbps = vpnTunnels * AVG_TUNNEL_BANDWIDTH_MBPS;
    const vpnCapacityMbps = gbpsToMbps(recommended.ipsecVpnGbps);
    if (vpnCapacityMbps > 0 && vpnDemandMbps > vpnCapacityMbps) {
      warnings.push(
        `IPsec VPN check: estimated ${vpnDemandMbps} Mbps from ${vpnTunnels} tunnels exceeds the recommended model's ${vpnCapacityMbps} Mbps IPsec VPN capacity. Consider a larger model or offload VPN to a dedicated platform.`
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

  if (Array.isArray(inputs.features) && inputs.features.includes('SSL Deep Inspection')) {
    if (recommended && recommended.sslInspectionGbps > 0) {
      const sslCapMbps = gbpsToMbps(recommended.sslInspectionGbps);
      if (targetTPMbps > sslCapMbps) {
        warnings.push(
          `SSL Deep Inspection capacity (${sslCapMbps} Mbps) is below the target throughput (${Math.round(targetTPMbps)} Mbps). Real-world inspected traffic will be capped.`
        );
      }
    }
  }

  const recTPMbps = recommended ? gbpsToMbps(recommended.threatProtectionGbps) : 0;
  const margin = recTPMbps > 0 ? recTPMbps / Math.max(targetTPMbps, 1) : 0;

  const calculations = {
    users,
    devicesPerUser,
    bandwidthPerDeviceMbps,
    peakFactor,
    headroomPct,
    requiredTPMbps: round(requiredTPMbps),
    targetTPMbps: round(targetTPMbps),
    recommendedTPMbps: round(recTPMbps),
    marginMultiplier: round(margin, 2),
    minMargin,
    minAcceptableMbps: round(minAcceptableMbps),
    steps: [
      `${users} users x ${devicesPerUser} devices x ${bandwidthPerDeviceMbps} Mbps x ${peakFactor} peak factor = ${round(requiredTPMbps)} Mbps required`,
      `${round(requiredTPMbps)} Mbps x ${headroomMultiplier.toFixed(2)} (${headroomPct}% headroom) = ${round(targetTPMbps)} Mbps target`,
      minMargin > 1
        ? `${round(targetTPMbps)} Mbps x ${minMargin.toFixed(2)} (min margin) = ${round(minAcceptableMbps)} Mbps required of the chosen model`
        : `No minimum margin applied (target is the bar to clear)`,
      recommended
        ? `${recommended.model} provides ${recTPMbps} Mbps Threat Protection (${round(margin, 2)}x over target, ${round(recTPMbps / Math.max(minAcceptableMbps, 1), 2)}x over min)`
        : `No model in the database clears the ${round(minAcceptableMbps)} Mbps bar. Consider lowering the minimum margin or splitting traffic across multiple firewalls.`,
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
