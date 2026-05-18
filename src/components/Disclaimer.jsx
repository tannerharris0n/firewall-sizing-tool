import React from 'react';

export default function Disclaimer() {
  return (
    <footer className="sticky bottom-0 bg-slate-900 text-slate-300 text-xs py-3 px-6 border-t border-slate-800">
      <div className="max-w-7xl mx-auto leading-relaxed">
        Firewall Sizing Tool is an independent project and is not affiliated with, endorsed by,
        or sponsored by Fortinet, Inc. All product names, model numbers, and trademarks
        referenced are the property of their respective owners. Sizing recommendations are
        estimates based on publicly available product specifications and general assumptions
        about typical usage. Always validate with a qualified sales engineer before purchasing.
        The views and opinions expressed in this tool are those of the author and do not
        represent any employer.
      </div>
    </footer>
  );
}
