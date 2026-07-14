export const DEFAULT_DEVICES_PER_USER = 3;
export const DEFAULT_HEADROOM_PCT = 40;
export const PEAK_FACTOR = 1.5;
export const AVG_TUNNEL_BANDWIDTH_MBPS = 10;
export const AVG_DIALUP_USER_MBPS = 2;

// Fortinet SE "rule of thumb" sizing (see /Rule of Thumb). Requirements are
// derived per user; datasheet capacity is then derated before a model is
// allowed to clear them.
//
//   Requirements   10 new sessions/sec per user, 100 concurrent sessions per user
//   Capability     usable session capacity  = 10% of the datasheet number
//                  usable throughput        = 50% of the datasheet number
//
// Worked example from the deck: 5000 users needs 50k new sessions/sec and 500k
// concurrent. An FG-401F rates 500k new sessions (10% = 50k, just clears) and
// 7.8M concurrent (10% = 780k, clears) but only 9 Gbps Threat Protection
// (50% = 4.5 Gbps), so it fails a 10 Gbps requirement. An FG-901G rates 30 Gbps
// TP (50% = 15 Gbps) and clears.
export const NEW_SESSIONS_PER_USER = 10;
export const CONCURRENT_SESSIONS_PER_USER = 100;
export const DEFAULT_THROUGHPUT_UTILIZATION_PCT = 50;
export const DEFAULT_SESSION_UTILIZATION_PCT = 10;

// The rule-of-thumb derate above is the safety factor, so no extra margin is
// stacked on top by default. The slider stays available for a deliberate
// belt-and-braces pick.
export const DEFAULT_MIN_MARGIN = 1.0;

// Map inspection features to the FortiGate throughput metric they constrain.
// The engine picks the most-restrictive metric across selected features.
// Ordering matters: first match wins, so the slowest path is listed first.
// IPS sits below Application Control because NGFW (firewall + IPS + app control)
// is the tighter of the two whenever both are on.
export const FEATURE_METRIC_PRIORITY = [
  { feature: 'SSL Deep Inspection', metric: 'sslInspectionGbps', label: 'SSL Inspection throughput' },
  { feature: 'Sandboxing',          metric: 'threatProtectionGbps', label: 'Threat Protection throughput' },
  { feature: 'Antivirus',           metric: 'threatProtectionGbps', label: 'Threat Protection throughput' },
  { feature: 'Application Control', metric: 'ngfwGbps', label: 'NGFW throughput' },
  { feature: 'IPS',                 metric: 'ipsGbps', label: 'IPS throughput' }
];

export const IOT_HEAVY_VERTICALS = ['Manufacturing / OT', 'Healthcare (with imaging)'];

export const SESSION_PER_DEVICE_IOT = 50;

export const AP_RATIO_OFFICE = 25;
export const AP_RATIO_HIGH_DENSITY = 15;

export const HIGH_DENSITY_VERTICALS = [
  'Education K-12',
  'Higher Education',
  'Hospitality (with guest WiFi)'
];

export const PORT_TYPES = [
  { key: 'copper',  label: 'Copper (RJ45)',  hint: 'Any speed: 1G / 2.5G / 5G / 10G over RJ45' },
  { key: 'sfp',     label: 'SFP (1G fiber)', hint: '1 Gbps optical' },
  { key: 'sfpPlus', label: 'SFP+ (10G)',     hint: '10 Gbps optical' },
  { key: 'sfp28',   label: 'SFP28 (25G)',    hint: '25 Gbps optical' },
  { key: 'sfp56',   label: 'SFP56 (50G)',    hint: '50 Gbps optical' },
  { key: 'qsfp40',  label: 'QSFP+ (40G)',    hint: '40 Gbps QSFP+' },
  { key: 'qsfp100', label: 'QSFP28 (100G)',  hint: '100 Gbps QSFP28' },
  { key: 'qsfp56',  label: 'QSFP56 (200G)',  hint: '200 Gbps QSFP56' },
  { key: 'qsfp400', label: 'QSFP-DD (400G)', hint: '400 Gbps QSFP-DD' }
];
