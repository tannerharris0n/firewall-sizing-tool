import React, { useEffect, useMemo, useRef, useState } from 'react';
import { parseConfig } from '../lib/config-parser.js';
import { checkCapacity, prettyTable, modelName } from '../lib/maxvalue-check.js';

const DATA_URL = '/maxvalues/fortigate-8.0.0.json';

function StatusPill({ status }) {
  const map = {
    fail: 'bg-rose-100 text-rose-800',
    ok: 'bg-emerald-100 text-emerald-800',
    unknown: 'bg-slate-100 text-slate-600',
  };
  const label = { fail: 'Exceeds', ok: 'Fits', unknown: 'No limit' };
  return (
    <span className={'inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ' + (map[status] || map.unknown)}>
      {label[status] || status}
    </span>
  );
}

function ModelResult({ data, code, counts }) {
  const { rows, summary } = useMemo(() => checkCapacity(counts, code, data), [counts, code, data]);
  const fits = summary.fail === 0;

  return (
    <div className="rounded-lg border-2 bg-white shadow-sm overflow-hidden border-slate-200">
      <div
        className={
          'px-5 py-4 flex items-center justify-between gap-3 ' +
          (fits ? 'bg-emerald-50' : 'bg-rose-50')
        }
      >
        <div>
          <div className="text-lg font-bold text-slate-900">{modelName(data, code)}</div>
          <div className="text-sm mt-0.5 font-medium">
            {fits ? (
              <span className="text-emerald-700">✓ Holds this config across all checked tables</span>
            ) : (
              <span className="text-rose-700">
                ✗ {summary.fail} table{summary.fail > 1 ? 's' : ''} exceed{summary.fail > 1 ? '' : 's'} this
                model's maximum
              </span>
            )}
          </div>
        </div>
        <div className="text-right text-xs text-slate-500 shrink-0">
          {summary.fail} exceed · {summary.ok} fit
          {summary.unknown ? ' · ' + summary.unknown + ' unlimited' : ''}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-4 text-sm text-slate-500">
          No recognized Max-Values tables found in this config.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
              <th className="px-5 py-2 font-medium">Table</th>
              <th className="px-3 py-2 font-medium text-right">In config</th>
              <th className="px-3 py-2 font-medium text-right">Model max</th>
              <th className="px-5 py-2 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.table}
                className={'border-b border-slate-100 ' + (r.status === 'fail' ? 'bg-rose-50/40' : '')}
              >
                <td className="px-5 py-2">
                  <span className="font-mono text-[12.5px] text-slate-800">{r.table}</span>
                  <span className="text-slate-400 text-xs ml-2 hidden sm:inline">{prettyTable(r.table)}</span>
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-900">{r.used.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-slate-700">
                  {r.max == null ? '—' : r.max.toLocaleString()}
                </td>
                <td className="px-5 py-2 text-right">
                  <StatusPill status={r.status} />
                  {r.status === 'ok' && r.headroom != null && r.max && r.headroom / r.max < 0.1 ? (
                    <span className="ml-2 text-[11px] text-amber-600">tight</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ModelPicker({ models, selected, onToggle }) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return models.slice(0, 40);
    return models.filter((m) => m.name.toLowerCase().includes(s) || m.code.toLowerCase().includes(s)).slice(0, 60);
  }, [q, models]);

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search target models (e.g. 121G, 100F)…"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <div className="mt-2 max-h-44 overflow-y-auto rounded-md border border-slate-200 divide-y divide-slate-100">
        {filtered.map((m) => {
          const on = selected.includes(m.code);
          return (
            <button
              key={m.code}
              type="button"
              onClick={() => onToggle(m.code)}
              className={
                'w-full text-left px-3 py-1.5 text-sm flex items-center justify-between hover:bg-slate-50 ' +
                (on ? 'bg-indigo-50' : '')
              }
            >
              <span className="text-slate-800">{m.name}</span>
              <span className="text-xs font-mono text-slate-400">{on ? '✓' : m.code}</span>
            </button>
          );
        })}
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-sm text-slate-400">No models match “{q}”.</div>
        ) : null}
      </div>
    </div>
  );
}

export default function TableCapacityCheck() {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [configText, setConfigText] = useState('');
  const [selected, setSelected] = useState([]);
  const fileRef = useRef(null);

  useEffect(() => {
    let alive = true;
    fetch(DATA_URL)
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setLoadError(e.message || 'Failed to load max-values data'));
    return () => {
      alive = false;
    };
  }, []);

  const parsed = useMemo(() => parseConfig(configText), [configText]);

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setConfigText(String(reader.result || ''));
    reader.readAsText(f);
  };

  const toggle = (code) =>
    setSelected((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  const hasConfig = parsed.totalObjects > 0;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold tracking-wide text-slate-700 uppercase mb-1">
          Config table-capacity check
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Paste a FortiGate config (or load a <code className="text-xs">.conf</code>) to count the objects it
          actually uses, then check whether a target model can hold them. Throughput says “upgrade,” but
          per-model <strong>maximum table sizes</strong> don’t always grow — e.g. a 100F allows 512{' '}
          <span className="font-mono text-xs">webfilter.profile</span> objects, a 121G only 32.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current && fileRef.current.click()}
            className="px-3 py-2 rounded-md bg-slate-200 text-slate-800 text-sm font-medium hover:bg-slate-300"
          >
            Load .conf file
          </button>
          <input ref={fileRef} type="file" accept=".conf,.txt,.cfg" onChange={onFile} className="hidden" />
          {configText ? (
            <button
              type="button"
              onClick={() => setConfigText('')}
              className="text-sm text-slate-500 hover:text-slate-800"
            >
              Clear
            </button>
          ) : null}
          <span className="text-xs text-slate-400">Parsed in your browser — nothing is uploaded.</span>
        </div>

        <textarea
          value={configText}
          onChange={(e) => setConfigText(e.target.value)}
          placeholder="config firewall policy&#10;    edit 1&#10;    next&#10;end&#10;config webfilter profile&#10;    edit &quot;default&quot;&#10;    next&#10;end"
          spellCheck={false}
          className="mt-3 w-full h-40 font-mono text-[12.5px] rounded-md border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        {hasConfig ? (
          <div className="mt-2 text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
            {parsed.hostname ? <span>Hostname: <strong className="text-slate-700">{parsed.hostname}</strong></span> : null}
            <span>{parsed.sectionsSeen} config tables</span>
            <span>{parsed.totalObjects.toLocaleString()} objects</span>
            {parsed.vdomCount ? <span>{parsed.vdomCount} VDOMs</span> : null}
          </div>
        ) : null}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold tracking-wide text-slate-700 uppercase mb-3">
          Target model(s)
        </h3>
        {loadError ? (
          <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-3">
            Couldn’t load the Maximum Values data ({loadError}).
          </div>
        ) : !data ? (
          <div className="text-sm text-slate-400">Loading Maximum Values Table…</div>
        ) : (
          <>
            {selected.length ? (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {selected.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggle(c)}
                    className="inline-flex items-center gap-1 text-xs font-medium bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full hover:bg-indigo-200"
                  >
                    {modelName(data, c)} <span className="text-indigo-400">✕</span>
                  </button>
                ))}
              </div>
            ) : null}
            <ModelPicker models={data.models} selected={selected} onToggle={toggle} />
            <div className="mt-2 text-xs text-slate-400">
              Data: Fortinet Maximum Values Table, FortiOS {data.meta?.version}.{' '}
              <a href={data.meta?.source} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                source ↗
              </a>
            </div>
          </>
        )}
      </div>

      {data && hasConfig && selected.length > 0 ? (
        <div className="space-y-4">
          {selected.map((c) => (
            <ModelResult key={c} data={data} code={c} counts={parsed.counts} />
          ))}
        </div>
      ) : data && !hasConfig ? (
        <div className="text-sm text-slate-400 px-1">Paste a config above to see results.</div>
      ) : data && selected.length === 0 ? (
        <div className="text-sm text-slate-400 px-1">Pick one or more target models to check against.</div>
      ) : null}
    </div>
  );
}
