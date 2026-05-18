import React, { useState } from 'react';

export default function CalculationBreakdown({ calculations }) {
  const [open, setOpen] = useState(true);
  if (!calculations) return null;
  const steps = calculations.steps || [];

  return (
    <section className="bg-white rounded-lg shadow-sm border border-slate-200">
      <header
        className="flex items-center justify-between px-5 py-3 cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <h2 className="text-sm font-semibold tracking-wide text-slate-700 uppercase">
          Calculation breakdown
        </h2>
        <span className="text-xs text-slate-400">{open ? 'Hide' : 'Show'}</span>
      </header>
      {open ? (
        <div className="px-5 pb-5">
          <pre className="bg-slate-900 text-slate-100 rounded-md p-4 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">
{steps.join('\n')}
          </pre>
          {calculations.marginMultiplier > 0 ? (
            <div className="mt-3 text-xs text-slate-500">
              Margin {calculations.marginMultiplier.toFixed(2)}x over target. A multiplier of
              1.5x or higher generally gives comfortable runway.
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
