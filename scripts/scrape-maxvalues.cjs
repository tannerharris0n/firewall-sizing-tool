#!/usr/bin/env node
/*
 * Scrape the Fortinet "Maximum Values Table" for a pinned FortiOS version and
 * write a compact data file used by the config table-capacity checker.
 *
 * Source (public): https://docs.fortinet.com/max-value-table
 *   - POST /max-value-table/version/hardware_models  (product_family, version)
 *   - POST /max-value-table/find-max-value           (product_family, software_version, hardware_models=CSV)
 *
 * Output: public/maxvalues/fortigate-<version>.json  (lazy-fetched by the app)
 *   { meta, models: [{code,name}], tables: { "<table>": { "<code>": [inst,vdom,global] } } }
 * Only tables with at least one non-zero limit are kept.
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require(path.join(__dirname, '..', 'node_modules', 'puppeteer'));

const VERSION = process.argv[2] || '8.0.0';
const FAMILY = 'fortigate';
const ORIGIN = 'https://docs.fortinet.com';
const CHUNK = 12;

async function postForm(page, urlPath, params) {
  return page.evaluate(
    async (u, body) => {
      const res = await fetch(u, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body,
      });
      return { status: res.status, text: await res.text() };
    },
    urlPath,
    new URLSearchParams(params).toString()
  );
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
  );
  // Establish session/cookies on the real page so the API accepts our fetches.
  await page.goto(`${ORIGIN}/max-value-table?family=${FAMILY}&version=${VERSION}`, {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });

  // 1. Model list for this version.
  const modelsResp = await postForm(page, '/max-value-table/version/hardware_models', {
    product_family: FAMILY,
    software_version: VERSION,
  });
  const models = JSON.parse(modelsResp.text).result; // [{name, value}]
  console.log(`models for ${VERSION}: ${models.length}`);

  // 2. find-max-value in chunks, merge.
  const tables = {}; // table -> code -> [inst, vdom, global]
  const codes = models.map((m) => m.value);
  for (let i = 0; i < codes.length; i += CHUNK) {
    const chunk = codes.slice(i, i + CHUNK);
    const resp = await postForm(page, '/max-value-table/find-max-value', {
      product_family: FAMILY,
      software_version: VERSION,
      hardware_models: chunk.join(','),
    });
    const result = JSON.parse(resp.text).result || {};
    for (const [table, perModel] of Object.entries(result)) {
      for (const [code, lim] of Object.entries(perModel)) {
        const trip = [
          parseInt(lim.instance_limit, 10) || 0,
          parseInt(lim.vdom_limit, 10) || 0,
          parseInt(lim.global_limit, 10) || 0,
        ];
        if (trip[0] === 0 && trip[1] === 0 && trip[2] === 0) continue;
        (tables[table] ||= {})[code] = trip;
      }
    }
    console.log(`  chunk ${i / CHUNK + 1}: ${chunk.join(',')} (${Object.keys(tables).length} tables so far)`);
  }

  await browser.close();

  const out = {
    meta: {
      family: FAMILY,
      version: VERSION,
      source: `${ORIGIN}/max-value-table?family=${FAMILY}&version=${VERSION}`,
      note: 'Hard-coded maximum values from Fortinet\'s Maximum Values Table. Limits are [instance, per-vdom, global]; 0 = not applicable/unlimited at that scope. Not a promise of performance.',
    },
    models: models.map((m) => ({ code: m.value, name: m.name })),
    tables,
  };

  const outDir = path.join(__dirname, '..', 'public', 'maxvalues');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `fortigate-${VERSION}.json`);
  fs.writeFileSync(outFile, JSON.stringify(out));
  const kb = (fs.statSync(outFile).size / 1024).toFixed(0);
  console.log(`wrote ${outFile} — ${Object.keys(tables).length} tables, ${models.length} models, ${kb} KB`);
})();
