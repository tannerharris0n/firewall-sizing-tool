const express = require('express');
const router = express.Router();

let Anthropic;
try {
  Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk');
} catch (err) {
  Anthropic = null;
}

const SYSTEM_PROMPT =
  'You write customer-facing proposal language for firewall recommendations. ' +
  'Style: confident, concrete, no AI tells (do not use the words delve, tapestry, robust, empower, unlock, navigate). ' +
  'No em dashes. Contractions are fine. Varied sentence length. No throat-clearing intros. ' +
  'Write for a non-technical decision-maker.';

function buildUserPrompt({ inputs, recommendation }) {
  const inp = inputs || {};
  const rec = recommendation || {};
  const recModel = rec.recommended || {};
  const warnings = Array.isArray(rec.warnings) ? rec.warnings : [];
  const features = Array.isArray(inp.features) ? inp.features : [];

  const lines = [];
  lines.push('Write proposal language for the following firewall sizing scenario.');
  lines.push('');
  lines.push('## Environment');
  lines.push(`Users: ${inp.users ?? '—'}`);
  lines.push(`Devices per user: ${inp.devicesPerUser ?? '—'}`);
  lines.push(`Industry vertical: ${inp.vertical ?? '—'}`);
  lines.push(`Number of sites: ${inp.sites ?? '—'}`);
  lines.push(`Internet bandwidth: ${inp.internetBandwidthMbps ?? '—'} Mbps`);
  lines.push('');
  lines.push('## Requirements');
  lines.push(`Features selected: ${features.length ? features.join(', ') : 'none'}`);
  lines.push(`Site-to-site VPN tunnels: ${inp.vpnTunnels ?? 0}`);
  lines.push(`Concurrent SSL VPN users: ${inp.sslVpnUsers ?? 0}`);
  lines.push(`HA pair required: ${inp.haRequired ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('## Recommended model');
  lines.push(`Model: ${recModel.model ?? '—'}`);
  lines.push(`Threat Protection: ${recModel.threatProtectionGbps ?? '—'} Gbps`);
  lines.push(`NGFW: ${recModel.ngfwGbps ?? '—'} Gbps`);
  lines.push(`IPsec VPN: ${recModel.ipsecVpnGbps ?? '—'} Gbps`);
  lines.push(`SSL Inspection: ${recModel.sslInspectionGbps ?? '—'} Gbps`);
  lines.push(`Interfaces: ${recModel.interfaces ?? '—'}`);
  lines.push(`Form factor: ${recModel.formFactor ?? '—'}`);
  lines.push('');
  if (warnings.length) {
    lines.push('## Warnings to address');
    warnings.forEach((w) => lines.push(`- ${w}`));
    lines.push('');
  }
  lines.push('Write two paragraphs explaining why this model fits the environment, including growth headroom.');
  lines.push('Then add a single-sentence callout for any warnings (skip the callout if there are none).');
  lines.push('No headings. No bullet lists. Plain paragraphs only.');

  return lines.join('\n');
}

router.post('/', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      error:
        'AI rationale is unavailable: ANTHROPIC_API_KEY is not configured on the server. Set it in your environment to enable this feature.'
    });
  }

  if (!Anthropic) {
    return res.status(503).json({
      error: 'AI rationale is unavailable: the @anthropic-ai/sdk package is not installed.'
    });
  }

  const { inputs, recommendation } = req.body || {};
  if (!recommendation) {
    return res.status(400).json({ error: 'Missing "recommendation" in request body.' });
  }

  try {
    const client = new Anthropic({ apiKey });
    const userPrompt = buildUserPrompt({ inputs, recommendation });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const text = (response.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    res.json({ rationale: text });
  } catch (err) {
    console.error('Rationale generation failed:', err);
    res.status(500).json({
      error: 'Failed to generate rationale: ' + (err.message || 'unknown error')
    });
  }
});

module.exports = router;
