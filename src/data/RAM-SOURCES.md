# FortiGate system memory (RAM) — sources & provenance

Fortinet **does not publish system RAM** in its FortiGate datasheets or Hardware
QuickStart Guides — those cover throughput, ports, and physical install only.
The `ramGB` figures in `fortigate-models.json` are therefore sourced from
**public, OS-reported memory** (`get hardware status` / `diagnose hardware sysinfo
memory` output captured on shipping units) and the Fortinet community forum.

Each model carries:

- `ramGB` — installed physical RAM in GB (`null` when no reliable public figure exists).
- `ramConfidence` — `high` (OS-reported, often cross-confirmed), `medium` (single
  source or known revision variation), or `low` (no figure; `ramGB` is null).
- `ramNote` — caveats (revision variation, per-module chassis RAM, etc.).

The UI renders a `~` prefix on any non-`high` figure to signal it's an estimate.

## Primary sources

- **yurisk.info FortiGate hardware table** — continuously-updated table of real-device
  `get hardware status` output. Primary source for most appliances.
  https://yurisk.info/2021/03/14/Fortigate-Firewalls-Hardware-CPU-model-and-number-Memory-size-datasheet-table/
- **Fortinet community forum** — model-specific `get hardware status` posts; used to
  confirm the 70F/100F/200F and for the 6000F per-FPC figures.
  https://community.fortinet.com/t5/FortiGate/Technical-Tip-Information-on-FortiGate-6000F-series-Gen1-and/ta-p/191608

## Known caveats

- **100F / 120G**: hardware-revision dependent (rev 1 vs rev 2 ship different RAM).
- **200G**: single public source.
- **4400F**: inferred from the 4401F DC variant (same hardware).
- **6001F / 6300F / 6500F**: figure is **per FPC** (Gen1 32 GB / Gen2 64 GB); the system
  total scales with the number of active/licensed FPCs.
- **400G, 700G, 3000G, 3500F, 3500G, 3800G, 7081F, 7121F**: no reliable public RAM
  figure found — left `null` rather than guessed. The 7081F/7121F are chassis whose
  RAM lives on FPM-7620F processor modules and is not publicly published.

Verify any specific figure against the unit's own `get hardware status` before relying
on it for capacity planning.
