import React, { useEffect, useMemo, useState } from 'react';
import InputForm from './components/InputForm.jsx';
import ResultsPanel from './components/ResultsPanel.jsx';
import Disclaimer from './components/Disclaimer.jsx';
import { calculateRecommendation } from './lib/sizing-engine.js';
import { decodeStateFromUrl, encodeStateToUrl } from './lib/url-state.js';
import {
  DEFAULT_DEVICES_PER_USER,
  DEFAULT_HEADROOM_PCT,
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
    sslVpnUsers: 0,
    haRequired: false,
    internetBandwidthMbps: 1000,
    headroomPct: DEFAULT_HEADROOM_PCT,
    peakFactor: PEAK_FACTOR,
    showCompanionProducts: false
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
        <div className="max-w-7xl mx-auto px-6 py-5">
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
