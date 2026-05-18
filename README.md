# Firewall Sizing Tool

A user-friendly sizing tool for FortiGate firewalls. Answer questions about your environment in plain language and get a recommended model with the math behind it, two alternatives, and proposal-ready rationale.

## Why this exists

The official Fortinet Product Matrix is a spreadsheet of throughput numbers. The SE Toolkit calculator assumes you already know your required Threat Protection throughput. Neither helps a non-technical buyer who knows they have 75 users and a healthcare imaging workflow but has no idea what 2.4 Gbps NGFW throughput actually means for them.

WatchGuard nailed this with their product sizing tool by asking how many people use the network and what they do. This is the same idea applied to FortiGate.

## Important disclaimers

**Independence.** This is an independent project. It is not affiliated with, endorsed by, or sponsored by Fortinet, Inc. All FortiGate product names, model numbers, and trademarks referenced are the property of Fortinet, Inc. No internal Fortinet materials, partner-confidential pricing, or non-public specifications are used.

**Author affiliation and views.** The author works as a Fortinet Enterprise Sales Engineer in a separate professional capacity. This tool is a personal project built outside of that role using only publicly available product information. The views, opinions, and recommendation logic expressed here are those of the author alone and do not represent Fortinet, Inc. or any other employer.

**No warranty.** This tool is provided as-is, without warranty of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement. Recommendations are estimates only. Always validate sizing with a qualified sales engineer, an authorized Fortinet partner, or Fortinet directly before making a purchase decision.

**No liability.** In no event shall the author or contributors be liable for any claim, damages, or other liability arising from use of this tool or its outputs. Purchase decisions are the responsibility of the buyer.

**Data privacy.** This tool does not collect user data. All sizing calculations run in your browser. The optional PDF export and AI rationale features call your own configured backend; nothing is sent to third parties beyond the configured Anthropic API endpoint when the rationale feature is invoked.

## How it works

The sizing engine uses Threat Protection throughput as the primary sizing metric because it is the most representative real-world number for a FortiGate running a typical UTM stack. Firewall-only throughput is a vanity metric.

The math:

    required = users x devices_per_user x bandwidth_per_device x peak_factor
    target   = required x (1 + headroom_percentage)

The tool filters the FortiGate model database for models whose Threat Protection throughput meets or exceeds the target, sorts ascending, and recommends the smallest model that fits. Two alternatives surface alongside: one step down with caveats about being tight, one step up for more headroom.

Bandwidth-per-device defaults come from a vertical preset table. A standard office user is assumed to need around 1 Mbps per device. Healthcare with imaging assumes 3 Mbps. Manufacturing and OT assume 0.3 Mbps because session count typically matters more than bandwidth in those environments.

Devices per user defaults to 3 (laptop, phone, tablet). Peak factor defaults to 1.5x. Headroom defaults to 40% for five-year growth planning. All of these are user-adjustable in the Advanced section.

## Features

- User-count-driven sizing instead of throughput-first
- Industry presets (healthcare, manufacturing, education, hospitality, financial services, etc.)
- Feature requirement checkboxes (SD-WAN, SSL deep inspection, IPS, application control, antivirus, sandboxing, ZTNA)
- VPN sizing cross-check
- HA mode notes
- Companion product suggestions (FortiAP, FortiSwitch, FortiAnalyzer, FortiAuthenticator)
- Live calculation breakdown showing the math
- Shareable URL with all inputs encoded
- PDF export for proposals
- AI-generated rationale paragraph for proposal language
- Mobile responsive

## Stack

- Frontend: React 18, Vite, Tailwind CSS
- Backend: Node.js 20, Express (CommonJS)
- PDF rendering: Puppeteer
- AI rationale: Anthropic Claude API
- Deployment: Railway

## Local development

Requires Node.js 20 or higher.

    git clone https://github.com/YOUR_USERNAME/firewall-sizing-tool.git
    cd firewall-sizing-tool
    npm install
    cp .env.example .env
    npm run dev

Edit `.env` with your `ANTHROPIC_API_KEY` if you want the rationale feature. The tool works without it; the rationale button will just show a friendly error.

The dev server runs the Vite frontend at http://localhost:5173 with hot reload, and the Express backend at http://localhost:8080. The frontend proxies API requests to the backend.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| ANTHROPIC_API_KEY | No | Required only for AI rationale generation. Tool works without it. |
| PORT | No | Server port. Railway sets this automatically. Defaults to 8080. |

## Deployment (Railway)

1. Push the repo to GitHub
2. In Railway, create a new project from your GitHub repo
3. Set the `ANTHROPIC_API_KEY` environment variable (optional, only needed for AI rationale)
4. Railway will auto-detect the build via `nixpacks.toml`
5. Generate a public domain or attach your own

Railway runs `npm install`, then `npm run build`, then `node server.cjs`.

## Populating the FortiGate model database

The shipped `src/data/fortigate-models.json` contains placeholder entries with zero values. Before the tool produces meaningful recommendations, populate the actual throughput numbers from current Fortinet product datasheets.

For each model, fill in:

- `firewallGbps` - firewall throughput in Gbps
- `ngfwGbps` - NGFW throughput (firewall + application control + IPS)
- `threatProtectionGbps` - Threat Protection throughput (the primary sizing number)
- `ipsecVpnGbps` - IPsec VPN throughput
- `sslInspectionGbps` - SSL inspection throughput
- `concurrentSessions` - max concurrent sessions
- `newSessionsPerSec` - new sessions per second
- `interfaces` - human-readable interface summary (e.g. "16x GE RJ45, 4x SFP")
- `poeWatts` - total PoE budget if applicable, 0 if no PoE
- `formFactor` - desktop, 1U, 2U, or 3U
- `useCase` - short description of typical deployment

Use only publicly available datasheets from fortinet.com. Do not paste in partner-confidential pricing, NFR-only specifications, or pre-release model data.

## Customizing the sizing math

All defaults live in `src/lib/constants.js`. Vertical presets are in `src/data/vertical-presets.json`. To add a vertical, append an object with `name`, `bandwidthPerDeviceMbps`, and optional `notes`.

To change the recommendation strategy (for example, to prefer a more conservative sizing or to recommend the next size up by default), modify the sort and selection logic in `src/lib/sizing-engine.js`.

## Roadmap

Possible future additions:

- FortiAP model selection based on user density and band requirements
- FortiSwitch model selection based on PoE budget and port counts
- Saved scenarios with short-code URLs (would require Postgres)
- Side-by-side comparison of two scenarios (current vs. projected growth)
- Multi-site sizing with per-site model recommendations
- BOM export to CSV
- Integration with FortiCare warranty/support tier estimates

## Contributing

This is a personal project shared publicly for the benefit of the broader sysadmin and security community. Pull requests are not actively monitored. Feel free to fork and adapt for your own use.

## License

MIT License. See `LICENSE` file.

## Author

Tanner Harrison is a CISSP-certified Enterprise Sales Engineer at Fortinet covering the Pacific Northwest. This tool is a personal project built outside of that role. The views and opinions expressed here are those of the author alone and do not represent Fortinet, Inc. or any other employer.

GitHub: [@tannerharris0n](https://github.com/tannerharris0n)
Website: [tannerharrison.com](https://tannerharrison.com)
