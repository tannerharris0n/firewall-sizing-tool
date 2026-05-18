import React from 'react';
import { PORT_TYPES } from '../lib/constants.js';

function formatGbps(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  if (n === 0) return '—';
  return n.toFixed(2) + ' Gbps';
}

const TIER_COLORS = {
  desktop: 'bg-slate-100 text-slate-700',
  midrange: 'bg-sky-100 text-sky-800',
  enterprise: 'bg-indigo-100 text-indigo-800',
  datacenter: 'bg-violet-100 text-violet-800'
};

export default function ModelCard({
  model,
  label,
  accent = 'border-slate-200',
  highlight = false,
  marginMultiplier
}) {
  if (!model) {
    return (
      <div className={'rounded-lg border-2 p-5 bg-white ' + accent}>
        <div className="text-xs font-semibold tracking-wide uppercase text-slate-500 mb-1">
          {label}
        </div>
        <div className="text-sm text-slate-600">No suitable model available.</div>
      </div>
    );
  }

  const tierClass = TIER_COLORS[model.tier] || TIER_COLORS.desktop;
  const marginPct = marginMultiplier ? Math.round((marginMultiplier - 1) * 100) : null;
  const marginColor =
    marginMultiplier == null
      ? ''
      : marginMultiplier >= 2
      ? 'text-emerald-600'
      : marginMultiplier >= 1.25
      ? 'text-amber-600'
      : 'text-rose-600';

  return (
    <div
      className={
        'rounded-lg border-2 p-5 bg-white shadow-sm ' +
        accent +
        (highlight ? ' ring-2 ring-emerald-500 ring-offset-2' : '')
      }
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-xs font-semibold tracking-wide uppercase text-slate-500">
            {label}
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{model.model}</div>
        </div>
        <span className={'text-xs font-medium px-2 py-1 rounded-full ' + tierClass}>
          {model.tier}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mt-3">
        <div>
          <div className="text-xs text-slate-500">Threat Protection</div>
          <div className="font-medium text-slate-900">{formatGbps(model.threatProtectionGbps)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">NGFW</div>
          <div className="font-medium text-slate-900">{formatGbps(model.ngfwGbps)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">IPsec VPN</div>
          <div className="font-medium text-slate-900">{formatGbps(model.ipsecVpnGbps)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">SSL Inspection</div>
          <div className="font-medium text-slate-900">{formatGbps(model.sslInspectionGbps)}</div>
        </div>
      </div>

      {(model.interfaces || model.formFactor) && (
        <div className="mt-3 text-xs text-slate-600">
          {model.interfaces ? <div>{model.interfaces}</div> : null}
          {model.formFactor ? (
            <div className="text-slate-500">Form factor: {model.formFactor}</div>
          ) : null}
        </div>
      )}

      {model.portCounts ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {PORT_TYPES.map(({ key, label }) => {
            const n = Number(model.portCounts[key]) || 0;
            if (n === 0) return null;
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded"
                title={label}
              >
                <span className="font-bold text-slate-900">{n}</span>
                <span className="text-slate-500">{label.replace(/ \(.*\)/, '')}</span>
              </span>
            );
          })}
        </div>
      ) : null}

      {model.useCase ? (
        <div className="mt-3 text-sm text-slate-700 italic">{model.useCase}</div>
      ) : null}

      {marginMultiplier != null && marginMultiplier > 0 ? (
        <div className={'mt-4 text-sm font-medium ' + marginColor}>
          {marginPct >= 0 ? '+' : ''}
          {marginPct}% headroom over target ({marginMultiplier.toFixed(2)}x)
        </div>
      ) : null}
    </div>
  );
}
