import React, { useState } from 'react';

function buildReasons(inputs, recommendation) {
  const rec = recommendation.recommended;
  const c = recommendation.calculations || {};
  if (!rec) return [];

  const reasons = [];

  // What metric is the model being sized against
  reasons.push({
    kind: 'metric',
    title: `Sized against ${c.metricLabel || 'Threat Protection throughput'}`,
    body: c.triggeringFeature
      ? `"${c.triggeringFeature}" is the most demanding feature you selected, so the engine constrains the pick by the firewall's ${c.metricLabel}. ${rec.model} is rated ${c.recommendedThroughputMbps} Mbps on this metric, of which ${c.recommendedUsableMbps} Mbps is planned as usable.`
      : `No inspection features are selected. The engine uses ${c.metricLabel} as the constraint. If you turn on IPS, App Control, AV, or SSL Deep Inspection, the sizing metric tightens and a larger model may be needed.`
  });

  // Rule-of-thumb derate
  reasons.push({
    kind: 'derate',
    title: `Datasheet numbers derated to ${c.throughputUtilizationPct}% throughput / ${c.sessionUtilizationPct}% sessions`,
    body: `Datasheet figures are best-case lab results, so the Fortinet SE rule of thumb plans against a fraction of them. ${rec.model}'s ${c.recommendedThroughputMbps} Mbps becomes ${c.recommendedUsableMbps} Mbps usable against a ${c.targetTPMbps} Mbps target.`
  });

  // Session requirements
  reasons.push({
    kind: 'sessions',
    title: `Session capacity checked, not just bandwidth`,
    body: `At 10 new sessions and 100 concurrent sessions per user, ${c.users} users need ${Number(c.requiredNewSessionsPerSec).toLocaleString()} new sessions/sec and ${Number(c.requiredConcurrentSessions).toLocaleString()} concurrent sessions${c.iotConcurrentSessions > 0 ? ` (including ${Number(c.iotConcurrentSessions).toLocaleString()} extra sessions for IoT-heavy devices)` : ''}. ${rec.model} supplies ${Number(c.recommendedUsableNewSessionsPerSec).toLocaleString()} and ${Number(c.recommendedUsableConcurrentSessions).toLocaleString()} usable respectively.`
  });

  // Which requirement actually forced this size
  if (c.bindingConstraint) {
    const names = {
      throughput: c.metricLabel,
      concurrentSessions: 'concurrent session capacity',
      newSessions: 'new sessions/sec',
      ipsec: 'IPsec VPN capacity'
    };
    reasons.push({
      kind: 'binding',
      title: `${names[c.bindingConstraint] || c.bindingConstraint} is the binding constraint`,
      body: `Of all the requirements, this is the one that rules out the next model down. Relax it — fewer users, fewer features, a smaller pipe — and a smaller box becomes viable.`
    });
  }

  // Where the target came from
  if (c.targetDrivenBy === 'internet' && c.internetMbps > 0) {
    reasons.push({
      kind: 'internet',
      title: `Internet pipe drove the sizing (${c.internetMbps} Mbps)`,
      body: `Your calculated user load was only ${c.calculatedTargetMbps} Mbps with headroom, but the internet pipe is ${c.internetMbps} Mbps. The firewall has to handle the full pipe or it throttles the WAN — so the target became ${c.targetTPMbps} Mbps.`
    });
  } else if (c.internetMbps > 0) {
    reasons.push({
      kind: 'calc',
      title: `User load drove the sizing (${c.calculatedTargetMbps} Mbps with headroom)`,
      body: `${c.users} users × ${c.devicesPerUser} devices × ${c.bandwidthPerDeviceMbps} Mbps/device × ${c.peakFactor} peak = ${c.requiredTPMbps} Mbps baseline, plus ${c.headroomPct}% headroom = ${c.calculatedTargetMbps} Mbps. The ${c.internetMbps} Mbps internet pipe is below that, so calculated load won.`
    });
  } else {
    reasons.push({
      kind: 'calc',
      title: `User load drove the sizing (no internet bandwidth entered)`,
      body: `${c.users} users × ${c.devicesPerUser} devices × ${c.bandwidthPerDeviceMbps} Mbps/device × ${c.peakFactor} peak = ${c.requiredTPMbps} Mbps, plus ${c.headroomPct}% headroom = ${c.targetTPMbps} Mbps target.`
    });
  }

  // Minimum margin
  if (c.minMargin > 1) {
    reasons.push({
      kind: 'margin',
      title: `Extra minimum margin of ${c.minMargin.toFixed(2)}× applied`,
      body: `On top of the usable-throughput derate, the engine refuses any model whose usable throughput isn't at least ${c.minMargin.toFixed(2)}× the ${c.targetTPMbps} Mbps target. That's why a smaller-but-eligible model isn't recommended — it would land too close to peak load. ${rec.model} clears the bar by ${c.marginMultiplier}×.`
    });
  }

  // IPsec
  if (c.ipsecLoadMbps > 0) {
    const recIpsecMbps = (rec.ipsecVpnGbps || 0) * 1000;
    reasons.push({
      kind: 'ipsec',
      title: `IPsec capacity check`,
      body: `${c.effectiveTunnels} site-to-site tunnel${c.effectiveTunnels === 1 ? '' : 's'} + ${c.ipsecDialupUsers} dialup user${c.ipsecDialupUsers === 1 ? '' : 's'} estimates ${c.ipsecLoadMbps} Mbps of IPsec load. ${rec.model} ${recIpsecMbps > 0 ? `provides ${recIpsecMbps} Mbps IPsec capacity — ${recIpsecMbps >= c.ipsecLoadMbps ? 'comfortable fit' : 'BELOW the load, capacity warning issued'}` : `does not have an IPsec capacity number in the database — confirm from the datasheet`}.`
    });
  }

  // G-series preference
  if (c.steps && c.steps.some((s) => s.startsWith('Preferred'))) {
    const preferStep = c.steps.find((s) => s.startsWith('Preferred'));
    reasons.push({
      kind: 'series',
      title: `Preferred G-series over a smaller F-series option`,
      body: `${preferStep} The F-series option still meets the target but is older silicon. G-series gets longer support runway and better $/Gbps in most cases.`
    });
  }

  // Features
  const features = Array.isArray(inputs.features) ? inputs.features : [];
  if (features.length) {
    reasons.push({
      kind: 'features',
      title: `${features.length} security feature${features.length === 1 ? '' : 's'} selected`,
      body: `Enabled: ${features.join(', ')}. Each adds inspection load. If you toggle SSL Deep Inspection off, sizing relaxes significantly — the SSL inspection metric is typically 3-5× more demanding than NGFW throughput.`
    });
  }

  // HA
  if (inputs.haRequired) {
    reasons.push({
      kind: 'ha',
      title: 'HA pair requested',
      body: 'Active-passive HA does not multiply throughput. Both units in the pair handle the same recommendation. Active-active scales only stateless workloads.'
    });
  }

  // Interface check
  const portReqs = inputs.portRequirements || {};
  const hasPortReqs = Object.values(portReqs).some((v) => Number(v) > 0);
  if (hasPortReqs) {
    reasons.push({
      kind: 'ports',
      title: 'Interface requirements considered',
      body: `${rec.model} provides ${rec.interfaces || 'interfaces per datasheet'}. The engine flagged warnings above if any required port type was short.`
    });
  }

  return reasons;
}

export default function WhyThisModel({ inputs, recommendation }) {
  const [open, setOpen] = useState(false);
  if (!recommendation || !recommendation.recommended) return null;

  const reasons = buildReasons(inputs, recommendation);
  if (!reasons.length) return null;

  return (
    <section className="bg-white rounded-lg shadow-sm border border-slate-200">
      <header
        className="flex items-center justify-between px-5 py-3 cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <h2 className="text-sm font-semibold tracking-wide text-slate-700 uppercase">
          Why this model?
        </h2>
        <span className="text-xs text-slate-400">{open ? 'Hide' : 'Show'}</span>
      </header>
      {open ? (
        <div className="px-5 pb-5 space-y-3">
          <p className="text-xs text-slate-500 -mt-1">
            Plain-English explanation of which inputs drove the pick. No AI call.
          </p>
          <ul className="space-y-3">
            {reasons.map((r, i) => (
              <li key={i} className="border-l-2 border-indigo-200 pl-3">
                <div className="text-sm font-medium text-slate-900">{r.title}</div>
                <div className="text-sm text-slate-600 mt-0.5 leading-relaxed">{r.body}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
