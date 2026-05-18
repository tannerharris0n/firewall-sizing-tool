import React from 'react';
import {
  AP_RATIO_HIGH_DENSITY,
  AP_RATIO_OFFICE,
  HIGH_DENSITY_VERTICALS
} from '../lib/constants.js';

export default function CompanionProducts({ inputs }) {
  if (!inputs.showCompanionProducts) return null;

  const isHighDensity = HIGH_DENSITY_VERTICALS.includes(inputs.vertical);
  const apRatio = isHighDensity ? AP_RATIO_HIGH_DENSITY : AP_RATIO_OFFICE;
  const apCount = Math.max(1, Math.ceil(inputs.users / apRatio));

  // TODO: pick specific FortiAP model based on band requirements and PoE budget.
  // TODO: pick specific FortiSwitch model based on port count and PoE draw.
  const switchPorts = Math.max(8, Math.ceil(inputs.users * inputs.devicesPerUser * 0.4));

  const wantsLogging = (inputs.features || []).some((f) =>
    ['IPS', 'Sandboxing', 'SSL Deep Inspection', 'Application Control'].includes(f)
  );
  const wantsAuth =
    (inputs.features || []).includes('ZTNA') || (inputs.ipsecDialupUsers || 0) > 0;

  return (
    <section className="bg-white rounded-lg shadow-sm border border-slate-200 px-5 py-5">
      <h2 className="text-sm font-semibold tracking-wide text-slate-700 uppercase mb-3">
        Companion products (estimates)
      </h2>
      <ul className="space-y-2 text-sm text-slate-700">
        <li>
          <span className="font-medium text-slate-900">FortiAP:</span> approximately {apCount}{' '}
          access point{apCount === 1 ? '' : 's'} (
          {isHighDensity ? 'high-density' : 'office'} ratio: 1 AP per ~{apRatio} users)
        </li>
        <li>
          <span className="font-medium text-slate-900">FortiSwitch:</span> roughly {switchPorts}{' '}
          access ports needed across the deployment
        </li>
        {wantsLogging ? (
          <li>
            <span className="font-medium text-slate-900">FortiAnalyzer:</span> recommended for
            log retention and compliance reporting given the inspection features selected
          </li>
        ) : null}
        {wantsAuth ? (
          <li>
            <span className="font-medium text-slate-900">FortiAuthenticator:</span> recommended
            for centralized identity and MFA given {(inputs.features || []).includes('ZTNA')
              ? 'ZTNA'
              : 'remote IPsec dialup'}{' '}
            requirements
          </li>
        ) : null}
        {inputs.sites > 1 ? (
          <li>
            <span className="font-medium text-slate-900">FortiManager:</span> worth considering
            for centralized policy across {inputs.sites} sites
          </li>
        ) : null}
      </ul>
      <p className="text-xs text-slate-500 mt-3">
        Specific model selection (FortiAP-23JF vs 431F, FortiSwitch 124F vs 148F-POE, etc.) is
        not yet implemented. Validate counts and tier with a sales engineer.
      </p>
    </section>
  );
}
