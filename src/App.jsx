import React, { useEffect, useMemo, useState } from 'react';
import InputForm from './components/InputForm.jsx';
import ResultsPanel from './components/ResultsPanel.jsx';
import Disclaimer from './components/Disclaimer.jsx';
import { calculateRecommendation } from './lib/sizing-engine.js';
import { decodeStateFromUrl, encodeStateToUrl } from './lib/url-state.js';
import {
  DEFAULT_DEVICES_PER_USER,
  DEFAULT_HEADROOM_PCT,
  DEFAULT_MIN_MARGIN,
  PEAK_FACTOR
} from './lib/constants.js';
import models from './data/fortigate-models.json';
import verticalPresets from './data/vertical-presets.json';

const DEFAULT_VERTICAL = 'Standard Office';

function getDefaultInputs() {
  const preset = verticalPresets.find((p) => p.name === DEFAULT_VERTICAL) || verticalPresets[0];
  return {
    users: 50,
    devicesPerUser: DEFAULT_DEVICES_PER_USER,
    vertical: preset ? preset.name : '',
    bandwidthPerDeviceMbps: preset ? preset.bandwidthPerDeviceMbps : 1.0,
    sites: 1,
    features: [],
    vpnTunnels: 0,
    ipsecDialupUsers: 0,
    haRequired: false,
    internetBandwidthMbps: 1000,
    headroomPct: DEFAULT_HEADROOM_PCT,
    peakFactor: PEAK_FACTOR,
    minMargin: DEFAULT_MIN_MARGIN,
    showCompanionProducts: false,
    portRequirements: {
      copper: 0,
      sfp: 0,
      sfpPlus: 0,
      sfp28: 0,
      sfp56: 0,
      qsfp40: 0,
      qsfp100: 0,
      qsfp56: 0,
      qsfp400: 0
    }
  };
}

export default function App() {
  const [inputs, setInputs] = useState(() => {
    const restored = typeof window !== 'undefined' ? decodeStateFromUrl() : null;
    if (restored && typeof restored === 'object') {
      return { ...getDefaultInputs(), ...restored };
    }
    return getDefaultInputs();
  });

  useEffect(() => {
    encodeStateToUrl(inputs);
  }, [inputs]);

  const recommendation = useMemo(
    () => calculateRecommendation(inputs, models),
    [inputs]
  );

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-lg">
              FW
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Firewall Sizing Tool</h1>
              <p className="text-sm text-slate-500">
                FortiGate sizing recommendations based on user count and environment characteristics
              </p>
            </div>
          </div>
          <a
            href="https://github.com/tannerharris0n/firewall-sizing-tool"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-3 py-2 rounded-md transition-colors"
            aria-label="View source on GitHub"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5"
              aria-hidden="true"
            >
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.9-.39.98 0 1.97.13 2.9.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56C20.22 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
            </svg>
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <InputForm
              inputs={inputs}
              onChange={setInputs}
              verticalPresets={verticalPresets}
            />
          </div>
          <div className="lg:sticky lg:top-6 lg:self-start">
            <ResultsPanel inputs={inputs} recommendation={recommendation} />
          </div>
        </div>
      </main>

      <Disclaimer />
    </div>
  );
}
