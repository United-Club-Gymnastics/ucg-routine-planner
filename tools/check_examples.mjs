// Scores every example routine at its own level and lists the ones that break the level's rules.
// Run with: node tools/check_examples.mjs   (the build's exclusion list in build_data.py comes from this)
import { EXAMPLES } from '../js/data/examples.js';
import { applyExample, eventInfo, newEntry, scoreEvent } from '../js/model.js';

const OK = new Set(['counting', 'noncounting', 'blank', 'extra', 'ok', 'empty', undefined]);

export function problems(ex) {
  const e = newEntry('x', ex.disc, ex.level);
  const ev = eventInfo(e.disc, ex.event);
  if (ev.kind === 'vault') return [];
  applyExample(e, ex);
  const r = scoreEvent(e, ex.event);
  const out = [...(r.warnings || [])];
  if (r.shortBy) out.push(`short by ${r.shortBy} skills`);
  const items = r.items || (r.passes || []).flat();
  for (const it of items) if (!OK.has(it.status)) out.push(`${it.status}: ${it.name || it.skill?.name || ''}`);
  const all = ev.kind === 'passes' ? (ex.passes || []).flat() : ex.skills || [];
  for (const s of all) if (!s.name && !s.skillId) out.push(`unnamed skill ${s.notation || ''} ${s.dd ?? ''}`.trim());
  return out;
}

if (process.argv[1]?.endsWith('check_examples.mjs')) {
  let bad = 0;
  for (const ex of EXAMPLES) {
    const p = problems(ex);
    if (p.length) {
      bad++;
      console.log(`${ex.id}: ${p.join('; ')}`);
    }
  }
  console.log(`${bad} of ${EXAMPLES.length} examples break their level's rules`);
}
