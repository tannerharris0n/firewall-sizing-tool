#!/usr/bin/env node
/*
 * One-shot: add ramGB / ramConfidence / ramNote to the FortiGate sizing model
 * databases. RAM is not published in Fortinet datasheets or QuickStart guides,
 * so figures are sourced from public OS-reported `get hardware status` dumps
 * (primarily yurisk.info) and the Fortinet community forum. Unverified models
 * are left null. See src/data/RAM-SOURCES.md for provenance.
 */
const fs = require('fs');
const path = require('path');

const RAM = {
  'FortiGate 30G': { gb: 2, c: 'high' },
  'FortiGate 40F': { gb: 2, c: 'high' },
  'FortiGate 50G': { gb: 2, c: 'high' },
  'FortiGate 60F': { gb: 2, c: 'high' },
  'FortiGate 70F': { gb: 4, c: 'high' },
  'FortiGate 70G': { gb: 4, c: 'medium' },
  'FortiGate 80F': { gb: 4, c: 'high' },
  'FortiGate 90G': { gb: 8, c: 'medium' },
  'FortiGate 100F': { gb: 4, c: 'medium', note: 'Hardware revision-dependent: rev 1 = 4 GB, rev 2 = 8 GB.' },
  'FortiGate 120G': { gb: 8, c: 'medium', note: 'Revision-dependent (~8 GB common).' },
  'FortiGate 200F': { gb: 8, c: 'high' },
  'FortiGate 200G': { gb: 24, c: 'medium', note: 'Single public source.' },
  'FortiGate 400F': { gb: 16, c: 'high' },
  'FortiGate 400G': { gb: null, c: 'low' },
  'FortiGate 600F': { gb: 16, c: 'high' },
  'FortiGate 700G': { gb: null, c: 'low' },
  'FortiGate 900G': { gb: 32, c: 'high' },
  'FortiGate 1000F': { gb: 16, c: 'high' },
  'FortiGate 1800F': { gb: 24, c: 'high' },
  'FortiGate 2600F': { gb: 48, c: 'high' },
  'FortiGate 3000F': { gb: 128, c: 'high' },
  'FortiGate 3000G': { gb: null, c: 'low' },
  'FortiGate 3200F': { gb: 128, c: 'high' },
  'FortiGate 3500F': { gb: null, c: 'low' },
  'FortiGate 3500G': { gb: null, c: 'low' },
  'FortiGate 3700F': { gb: 256, c: 'high' },
  'FortiGate 3800G': { gb: null, c: 'low' },
  'FortiGate 4200F': { gb: 384, c: 'high' },
  'FortiGate 4400F': { gb: 384, c: 'medium', note: 'Inferred from the 4401F DC variant (same hardware).' },
  'FortiGate 4800F': { gb: 512, c: 'high' },
  'FortiGate 6001F': { gb: 32, c: 'medium', note: 'Per FPC (Gen1 32 GB / Gen2 64 GB); system total scales with active FPCs.' },
  'FortiGate 6300F': { gb: 32, c: 'medium', note: 'Per FPC (Gen1 32 GB / Gen2 64 GB); 6 FPCs.' },
  'FortiGate 6500F': { gb: 32, c: 'medium', note: 'Per FPC (Gen1 32 GB / Gen2 64 GB); 10 FPCs.' },
  'FortiGate 7081F': { gb: null, c: 'low', note: 'Chassis — RAM is per FPM-7620F processor module; not publicly published.' },
  'FortiGate 7121F': { gb: null, c: 'low', note: 'Chassis — RAM is per FPM-7620F processor module; not publicly published.' },
};

function applyTo(file) {
  const p = path.join(__dirname, '..', 'src', 'data', file);
  const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
  let hit = 0;
  for (const m of arr) {
    const r = RAM[m.model];
    if (r) {
      m.ramGB = r.gb;
      m.ramConfidence = r.c;
      if (r.note) m.ramNote = r.note;
      else delete m.ramNote;
      hit++;
    } else {
      // Keep the schema consistent for models we have no figure for (e.g. EOL comparison units).
      if (!('ramGB' in m)) {
        m.ramGB = null;
        m.ramConfidence = 'low';
      }
    }
  }
  fs.writeFileSync(p, JSON.stringify(arr, null, 2) + '\n');
  console.log(`${file}: ${arr.length} models, ${hit} matched RAM figures`);
}

applyTo('fortigate-models.json');
applyTo('fortigate-comparison-models.json');
