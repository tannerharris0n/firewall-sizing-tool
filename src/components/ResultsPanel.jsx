import React, { useState } from 'react';
import ModelCard from './ModelCard.jsx';
import CalculationBreakdown from './CalculationBreakdown.jsx';
import CompanionProducts from './CompanionProducts.jsx';
import RationaleBlock from './RationaleBlock.jsx';
import WhyThisModel from './WhyThisModel.jsx';

function formatTextSummary(inputs, recommendation) {
  const rec = recommendation.recommended;
  const lines = [];
  lines.push('Firewall Sizing Tool — recommendation');
  lines.push('');
  lines.push(`Users: ${inputs.users}`);
  lines.push(`Devices per user: ${inputs.devicesPerUser}`);
  lines.push(`Vertical: ${inputs.vertical}`);
  lines.push(`Sites: ${inputs.sites}`);
  lines.push(`Features: ${(inputs.features || []).join(', ') || 'none'}`);
  lines.push(`VPN tunnels: ${inputs.vpnTunnels}`);
  lines.push(`IPsec dialup users: ${inputs.ipsecDialupUsers}`);
  lines.push(`HA: ${inputs.haRequired ? 'yes' : 'no'}`);
  lines.push('');
  if (rec) {
    lines.push(`Recommended: ${rec.model}`);
    lines.push(`  Threat Protection: ${rec.threatProtectionGbps} Gbps`);
    lines.push(`  NGFW: ${rec.ngfwGbps} Gbps`);
    lines.push(`  IPsec VPN: ${rec.ipsecVpnGbps} Gbps`);
  } else {
    lines.push('No suitable model found.');
  }
  if (recommendation.alternativeDown) {
    lines.push(`Step down: ${recommendation.alternativeDown.model} (tight fit)`);
  }
  if (recommendation.alternativeUp) {
    lines.push(`Step up: ${recommendation.alternativeUp.model} (more headroom)`);
  }
  lines.push('');
  lines.push('Math:');
  (recommendation.calculations.steps || []).forEach((s) => lines.push('  ' + s));
  if ((recommendation.warnings || []).length) {
    lines.push('');
    lines.push('Notes:');
    recommendation.warnings.forEach((w) => lines.push('  - ' + w));
  }
  return lines.join('\n');
}

export default function ResultsPanel({ inputs, recommendation }) {
  const [copied, setCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatTextSummary(inputs, recommendation));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (_) {}
  };

  const handlePdf = async () => {
    setPdfBusy(true);
    setPdfError(null);
    try {
      const res = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs,
          recommendation,
          calculations: recommendation.calculations,
          warnings: recommendation.warnings
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'PDF request failed with status ' + res.status);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'firewall-sizing.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setPdfError(err.message || 'PDF generation failed');
    } finally {
      setPdfBusy(false);
    }
  };

  const margin = recommendation.calculations.marginMultiplier;
  const warnings = recommendation.warnings || [];

  return (
    <div className="space-y-4">
      <ModelCard
        model={recommendation.recommended}
        label="Recommended"
        accent="border-emerald-500"
        highlight
        marginMultiplier={margin}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ModelCard
          model={recommendation.alternativeDown}
          label="Step down (tight fit)"
          accent="border-amber-400"
        />
        <ModelCard
          model={recommendation.alternativeUp}
          label="Step up (extra headroom)"
          accent="border-indigo-400"
        />
      </div>

      <CalculationBreakdown calculations={recommendation.calculations} />

      <WhyThisModel inputs={inputs} recommendation={recommendation} />

      {warnings.length ? (
        <section className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-4">
          <h2 className="text-sm font-semibold tracking-wide text-amber-900 uppercase mb-2">
            Notes &amp; warnings
          </h2>
          <ul className="space-y-1.5 text-sm text-amber-900 list-disc list-inside">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleCopy}
          className="px-3 py-2 rounded-md bg-slate-200 text-slate-800 text-sm font-medium hover:bg-slate-300"
        >
          {copied ? 'Copied!' : 'Copy as text'}
        </button>
        <button
          onClick={handlePdf}
          disabled={pdfBusy}
          className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {pdfBusy ? 'Generating PDF...' : 'Download PDF'}
        </button>
      </div>
      {pdfError ? (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-3">
          {pdfError}
        </div>
      ) : null}

      <RationaleBlock inputs={inputs} recommendation={recommendation} />

      <CompanionProducts inputs={inputs} />
    </div>
  );
}
