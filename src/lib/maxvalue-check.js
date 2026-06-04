/*
 * Compare parsed config object counts against a target model's hard-coded maximum
 * values (from the scraped Fortinet Maximum Values Table).
 *
 * Limit triplet is [instance, per-vdom, global]; 0 means "not applicable / not
 * limited at that scope". The device-wide cap we compare a whole-config total
 * against is the global limit when present, else the per-vdom limit, else instance.
 */

export function effectiveMax(trip) {
  if (!Array.isArray(trip)) return 0;
  const [inst, vdom, global] = trip;
  if (global > 0) return global;
  if (vdom > 0) return vdom;
  return inst || 0;
}

// Prettify a table key for display: "webfilter.profile" -> "webfilter › profile".
export function prettyTable(key) {
  return key.replace(/:/g, ' › ').replace(/\./g, ' › ');
}

/**
 * @param {Record<string, number>} counts  table -> used count (from parseConfig)
 * @param {string} modelCode                target model code (e.g. "121G")
 * @param {object} data                     scraped max-values data
 * @returns {{rows: Array, summary: object}}
 */
export function checkCapacity(counts, modelCode, data) {
  const tables = (data && data.tables) || {};
  const rows = [];

  let unrecognized = 0;
  for (const table of Object.keys(counts)) {
    const used = counts[table];
    if (!used) continue;
    const perModel = tables[table];

    // Not a real Max-Values table (e.g. a sub-object config nested inside an edit
    // like `ftgd-wf` or `app-category`) — skip it rather than show noise.
    if (!perModel) {
      unrecognized += 1;
      continue;
    }
    const trip = perModel[modelCode];
    if (!trip) {
      // Real table, but this model has no published limit (often = unlimited at all
      // scopes). Surface as informational rather than a hard pass/fail.
      rows.push({ table, used, max: null, vdomLimit: null, status: 'unknown' });
      continue;
    }
    const max = effectiveMax(trip);
    const vdomLimit = trip[1] || 0;
    const status = max === 0 ? 'unknown' : used <= max ? 'ok' : 'fail';
    const headroom = max > 0 ? max - used : null;
    rows.push({ table, used, max: max || null, vdomLimit, status, headroom });
  }

  // Sort: failures first (worst overflow first), then tight OK (least headroom), then unknown.
  const rank = { fail: 0, ok: 1, unknown: 2 };
  rows.sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    if (a.status === 'fail') return b.used / b.max - a.used / a.max;
    if (a.status === 'ok') return (a.headroom ?? Infinity) - (b.headroom ?? Infinity);
    return b.used - a.used;
  });

  const summary = {
    fail: rows.filter((r) => r.status === 'fail').length,
    ok: rows.filter((r) => r.status === 'ok').length,
    unknown: rows.filter((r) => r.status === 'unknown').length,
    unrecognized,
    total: rows.length,
  };
  return { rows, summary };
}

export function modelName(data, code) {
  const m = (data?.models || []).find((x) => x.code === code);
  return m ? m.name : code;
}

export default checkCapacity;
