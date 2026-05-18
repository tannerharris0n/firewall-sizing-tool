export const DEFAULT_DEVICES_PER_USER = 3;
export const DEFAULT_HEADROOM_PCT = 40;
export const PEAK_FACTOR = 1.5;
export const AVG_TUNNEL_BANDWIDTH_MBPS = 10;
export const DEFAULT_MIN_MARGIN = 1.5;

export const IOT_HEAVY_VERTICALS = ['Manufacturing / OT', 'Healthcare (with imaging)'];

export const SESSION_PER_USER_BASE = 100;
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
