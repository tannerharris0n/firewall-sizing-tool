import React, { useState } from 'react';

const FEATURES = [
  'SD-WAN',
  'SSL Deep Inspection',
  'IPS',
  'Application Control',
  'Antivirus',
  'Sandboxing',
  'ZTNA'
];

function Section({ title, children, defaultOpen = true, collapsible = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="bg-white rounded-lg shadow-sm border border-slate-200 mb-4">
      <header
        className={
          'flex items-center justify-between px-5 py-4 border-b border-slate-100 ' +
          (collapsible ? 'cursor-pointer select-none' : '')
        }
        onClick={collapsible ? () => setOpen(!open) : undefined}
      >
        <h2 className="text-sm font-semibold tracking-wide text-slate-700 uppercase">
          {title}
        </h2>
        {collapsible ? (
          <span className="text-xs text-slate-400">{open ? 'Hide' : 'Show'}</span>
        ) : null}
      </header>
      {open ? <div className="px-5 py-5 space-y-4">{children}</div> : null}
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-slate-500 mt-1">{hint}</span> : null}
    </label>
  );
}

function NumberInput({ value, onChange, min, max, step }) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step ?? 1}
      onChange={(e) => {
        const v = e.target.value === '' ? '' : Number(e.target.value);
        onChange(v);
      }}
      className="w-full px-3 py-2 rounded-md border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm"
    />
  );
}

function Slider({ value, onChange, min, max, step }) {
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step ?? 1}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full"
    />
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <span
        className={
          'relative inline-block w-10 h-6 rounded-full transition-colors ' +
          (checked ? 'bg-indigo-600' : 'bg-slate-300')
        }
        onClick={() => onChange(!checked)}
      >
        <span
          className={
            'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ' +
            (checked ? 'translate-x-4' : '')
          }
        />
      </span>
      {label ? <span className="text-sm text-slate-700">{label}</span> : null}
    </label>
  );
}

export default function InputForm({ inputs, onChange, verticalPresets }) {
  const update = (patch) => onChange({ ...inputs, ...patch });

  const toggleFeature = (name) => {
    const has = inputs.features.includes(name);
    const next = has
      ? inputs.features.filter((f) => f !== name)
      : [...inputs.features, name];
    update({ features: next });
  };

  const handleVerticalChange = (e) => {
    const name = e.target.value;
    const preset = verticalPresets.find((p) => p.name === name);
    update({
      vertical: name,
      bandwidthPerDeviceMbps: preset ? preset.bandwidthPerDeviceMbps : inputs.bandwidthPerDeviceMbps
    });
  };

  const verticalNote = (verticalPresets.find((p) => p.name === inputs.vertical) || {}).notes;

  return (
    <div>
      <Section title="Environment">
        <Field label={`Users: ${inputs.users}`}>
          <div className="flex items-center gap-3">
            <NumberInput
              value={inputs.users}
              onChange={(v) => update({ users: v === '' ? 0 : v })}
              min={5}
              max={10000}
            />
            <div className="flex-1">
              <Slider
                value={inputs.users || 5}
                onChange={(v) => update({ users: v })}
                min={5}
                max={10000}
                step={5}
              />
            </div>
          </div>
        </Field>

        <Field
          label="Devices per user"
          hint="Laptop, phone, tablet, IoT. Default 3."
        >
          <NumberInput
            value={inputs.devicesPerUser}
            onChange={(v) => update({ devicesPerUser: v === '' ? 1 : v })}
            min={1}
            max={10}
          />
        </Field>

        <Field
          label="Industry vertical"
          hint={verticalNote}
        >
          <select
            value={inputs.vertical}
            onChange={handleVerticalChange}
            className="w-full px-3 py-2 rounded-md border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm bg-white"
          >
            {verticalPresets.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name} ({p.bandwidthPerDeviceMbps} Mbps/device)
              </option>
            ))}
          </select>
        </Field>

        <Field label="Number of sites">
          <NumberInput
            value={inputs.sites}
            onChange={(v) => update({ sites: v === '' ? 1 : v })}
            min={1}
            max={5000}
          />
        </Field>
      </Section>

      <Section title="Requirements">
        <Field label="Security features">
          <div className="grid grid-cols-2 gap-2">
            {FEATURES.map((f) => {
              const checked = inputs.features.includes(f);
              return (
                <label
                  key={f}
                  className={
                    'flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm ' +
                    (checked
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                      : 'border-slate-200 hover:bg-slate-50')
                  }
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleFeature(f)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  {f}
                </label>
              );
            })}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Site-to-site VPN tunnels">
            <NumberInput
              value={inputs.vpnTunnels}
              onChange={(v) => update({ vpnTunnels: v === '' ? 0 : v })}
              min={0}
              max={10000}
            />
          </Field>
          <Field label="Concurrent SSL VPN users">
            <NumberInput
              value={inputs.sslVpnUsers}
              onChange={(v) => update({ sslVpnUsers: v === '' ? 0 : v })}
              min={0}
              max={10000}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4 items-end">
          <Field label="Internet bandwidth (Mbps)">
            <NumberInput
              value={inputs.internetBandwidthMbps}
              onChange={(v) => update({ internetBandwidthMbps: v === '' ? 0 : v })}
              min={1}
              max={1000000}
            />
          </Field>
          <Field label="HA pair required">
            <div className="pt-1">
              <Toggle
                checked={inputs.haRequired}
                onChange={(v) => update({ haRequired: v })}
                label={inputs.haRequired ? 'Yes (two units)' : 'No (single unit)'}
              />
            </div>
          </Field>
        </div>

        <Field label="Show companion product suggestions">
          <Toggle
            checked={inputs.showCompanionProducts}
            onChange={(v) => update({ showCompanionProducts: v })}
            label={inputs.showCompanionProducts ? 'Showing' : 'Hidden'}
          />
        </Field>
      </Section>

      <Section title="Advanced" defaultOpen={false} collapsible>
        <Field
          label={`Headroom: ${inputs.headroomPct}%`}
          hint="Extra capacity for growth. 40% covers about 5 years of typical growth."
        >
          <Slider
            value={inputs.headroomPct}
            onChange={(v) => update({ headroomPct: v })}
            min={20}
            max={100}
            step={5}
          />
        </Field>
        <Field
          label={`Peak factor: ${inputs.peakFactor.toFixed(1)}x`}
          hint="Multiplier applied to average bandwidth to estimate peak load."
        >
          <Slider
            value={inputs.peakFactor}
            onChange={(v) => update({ peakFactor: v })}
            min={1.0}
            max={3.0}
            step={0.1}
          />
        </Field>
      </Section>
    </div>
  );
}
