const express = require('express');
const router = express.Router();

let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (err) {
  puppeteer = null;
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatGbps(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  return n.toFixed(2) + ' Gbps';
}

function renderModelBlock(label, model, accent) {
  if (!model) {
    return `<div class="model"><h3>${escapeHtml(label)}</h3><p>No suitable model found in the database.</p></div>`;
  }
  return `
    <div class="model" style="border-left:4px solid ${accent};">
      <h3>${escapeHtml(label)}: ${escapeHtml(model.model || 'Unknown')}</h3>
      <table>
        <tr><td>Tier</td><td>${escapeHtml(model.tier || '—')}</td></tr>
        <tr><td>Threat Protection</td><td>${formatGbps(model.threatProtectionGbps)}</td></tr>
        <tr><td>NGFW</td><td>${formatGbps(model.ngfwGbps)}</td></tr>
        <tr><td>IPsec VPN</td><td>${formatGbps(model.ipsecVpnGbps)}</td></tr>
        <tr><td>SSL Inspection</td><td>${formatGbps(model.sslInspectionGbps)}</td></tr>
        <tr><td>Interfaces</td><td>${escapeHtml(model.interfaces || '—')}</td></tr>
        <tr><td>Form factor</td><td>${escapeHtml(model.formFactor || '—')}</td></tr>
        <tr><td>Use case</td><td>${escapeHtml(model.useCase || '—')}</td></tr>
      </table>
    </div>
  `;
}

function renderInputsTable(inputs) {
  const rows = Object.entries(inputs || {}).map(([k, v]) => {
    let display = v;
    if (Array.isArray(v)) display = v.join(', ') || 'none';
    if (typeof v === 'boolean') display = v ? 'Yes' : 'No';
    if (v === '' || v === null || v === undefined) display = '—';
    return `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(display)}</td></tr>`;
  });
  return `<table>${rows.join('')}</table>`;
}

function renderCalculations(calculations) {
  if (!calculations || !Array.isArray(calculations.steps)) return '';
  const lines = calculations.steps.map((s) => escapeHtml(s)).join('\n');
  return `<pre>${lines}</pre>`;
}

function renderWarnings(warnings) {
  if (!Array.isArray(warnings) || warnings.length === 0) return '';
  const items = warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('');
  return `<div class="warnings"><h3>Notes &amp; warnings</h3><ul>${items}</ul></div>`;
}

function buildHtml({ inputs, recommendation, calculations, warnings }) {
  const generated = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const rec = recommendation || {};
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Firewall Sizing Tool Report</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; padding: 32px; }
  h1 { font-size: 24px; margin: 0 0 4px 0; }
  h2 { font-size: 18px; margin: 24px 0 8px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  h3 { font-size: 14px; margin: 0 0 8px 0; }
  .subtitle { color: #64748b; font-size: 12px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 8px 0; }
  td { padding: 4px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  td:first-child { color: #64748b; width: 35%; }
  pre { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; font-size: 11px; white-space: pre-wrap; }
  .model { padding: 12px 16px; margin: 8px 0; background: #f8fafc; border-radius: 6px; }
  .warnings { background: #fffbeb; border: 1px solid #fde68a; padding: 12px 16px; border-radius: 6px; }
  .warnings li { font-size: 12px; }
  .disclaimer { font-size: 10px; color: #64748b; margin-top: 32px; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  .meta { font-size: 10px; color: #94a3b8; margin-top: 8px; }
</style>
</head>
<body>
  <h1>Firewall Sizing Tool</h1>
  <div class="subtitle">FortiGate sizing recommendations based on user count and environment characteristics</div>

  <h2>Inputs</h2>
  ${renderInputsTable(inputs)}

  <h2>Recommendation</h2>
  ${renderModelBlock('Recommended', rec.recommended, '#10b981')}
  ${renderModelBlock('Step down (tight fit)', rec.alternativeDown, '#f59e0b')}
  ${renderModelBlock('Step up (extra headroom)', rec.alternativeUp, '#4f46e5')}

  <h2>Calculation breakdown</h2>
  ${renderCalculations(calculations || rec.calculations)}

  ${renderWarnings(warnings || rec.warnings)}

  <div class="disclaimer">
    Firewall Sizing Tool is an independent project and is not affiliated with, endorsed by, or sponsored by Fortinet, Inc.
    All product names, model numbers, and trademarks referenced are the property of their respective owners.
    Sizing recommendations are estimates based on publicly available product specifications and general assumptions about typical usage.
    Always validate with a qualified sales engineer before purchasing.
    The views and opinions expressed in this tool are those of the author and do not represent any employer.
  </div>
  <div class="meta">Generated ${escapeHtml(generated)}</div>
</body>
</html>`;
}

router.post('/', async (req, res) => {
  if (!puppeteer) {
    return res
      .status(503)
      .json({ error: 'PDF generation is unavailable: puppeteer is not installed in this environment.' });
  }

  const { inputs, recommendation, calculations, warnings } = req.body || {};
  if (!recommendation) {
    return res.status(400).json({ error: 'Missing "recommendation" in request body.' });
  }

  const html = buildHtml({ inputs, recommendation, calculations, warnings });

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const buffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="firewall-sizing.pdf"');
    res.send(buffer);
  } catch (err) {
    console.error('PDF generation failed:', err);
    res.status(500).json({ error: 'Failed to generate PDF: ' + (err.message || 'unknown error') });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
  }
});

module.exports = router;
