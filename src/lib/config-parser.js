/*
 * Minimal FortiGate config (.conf) parser for table-capacity checking.
 *
 * It walks the `config ... end` / `edit ... next` block structure and counts how
 * many objects (`edit` entries) live in each config table, keyed the same way the
 * Fortinet Maximum Values Table keys them: the block's own tokens joined with "."
 * (e.g. `config firewall policy` -> "firewall.policy", `config webfilter profile`
 * -> "webfilter.profile").
 *
 * Key decisions:
 *  - An `edit` is attributed to its IMMEDIATELY enclosing `config` block only, so
 *    sub-object configs nested inside an edit (e.g. `config ftgd-wf` inside a
 *    webfilter profile) don't inflate the parent's count. Those sub-blocks get
 *    their own keys which simply won't match a top-level Max-Values table, so they
 *    fall out of the comparison.
 *  - Counts ACCUMULATE across the whole file, so multi-VDOM configs (where
 *    `config firewall policy` recurs under each `config vdom` / `edit <vdom>`) sum
 *    to the box-wide total — the right number to compare against the global limit.
 */

function tokenize(line) {
  // Split on whitespace but keep quoted strings intact (edit "name with spaces").
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(line)) !== null) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

export function parseConfig(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { counts: {}, totalObjects: 0, vdomCount: 0, hostname: null, sectionsSeen: 0, lineCount: 0 };
  }

  const lines = text.split(/\r?\n/);
  const counts = Object.create(null);
  const stack = []; // frames: { key, count }
  let vdomCount = 0;
  let hostname = null;
  let inGlobalSystem = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line[0] === '#') continue;
    const tokens = tokenize(line);
    const head = tokens[0];

    if (head === 'config') {
      const parts = tokens.slice(1);
      const key = parts.join('.');
      stack.push({ key, count: 0 });
      if (key === 'vdom') {
        // each `edit <vdom>` under `config vdom` is a vdom; counted via its frame below
      }
      inGlobalSystem = key === 'system.global';
    } else if (head === 'edit') {
      const top = stack[stack.length - 1];
      if (top) {
        top.count += 1;
        if (top.key === 'vdom') vdomCount += 1;
      }
    } else if (head === 'end') {
      const frame = stack.pop();
      if (frame && frame.key !== 'vdom') {
        counts[frame.key] = (counts[frame.key] || 0) + frame.count;
      }
      inGlobalSystem = false;
    } else if (head === 'set' && inGlobalSystem && tokens[1] === 'hostname') {
      hostname = tokens[2] || null;
    }
    // `next` closes an edit; edits aren't stack frames, so nothing to do.
  }

  let totalObjects = 0;
  for (const k in counts) totalObjects += counts[k];

  return {
    counts,
    totalObjects,
    vdomCount,
    hostname,
    sectionsSeen: Object.keys(counts).length,
    lineCount: lines.length,
  };
}

export default parseConfig;
