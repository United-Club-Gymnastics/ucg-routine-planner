// Judge practice for UCG MAG: watch a calibration routine, judge it the way the MAG judging calculator
// does (each counting skill's value and element group, bonuses, neutral and execution deductions),
// check it against the answer key, and see the routine laid out with every deduction the key takes.
import { APPARATUS, LEVELS, devBanned, offeredAt, skillKey } from '../../js/scoring/mag.js';
import { VAULTS } from '../../js/data/mag-vaults.js';
import { E_TOLERANCE, LETTERS, ROMAN, answerKey, bonusOptions, compare, requirements, scoreEntry } from './key.js';
import { ROUTINES } from './routines.js';

const $ = (id) => document.getElementById(id);
const LEVEL_TABS = [['dev', 'Developmental'], ['int', 'Intermediate'], ['adv', 'Advanced']];
const LEVEL_NAME = Object.fromEntries(LEVEL_TABS);
const EVENT_NAME = { fx: 'Floor', ph: 'Pommel Horse', sr: 'Rings', vt: 'Vault', pb: 'Parallel Bars', hb: 'High Bar' };
const EVENT_SHORT = { fx: 'Floor', ph: 'Pommel', sr: 'Rings', vt: 'Vault', pb: 'P-Bars', hb: 'High Bar' };
const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const routineName = (r) => `${LEVEL_NAME[r.level]} ${EVENT_NAME[r.event]}`;

// What each level counts, shown with the video (UCG MAG Rules Breakdown 2026-28).
const LEVEL_RULES = {
  dev: 'Developmental: the 6 highest-valued skills count. Each element group with an A or higher skill earns +0.5, but only 3 groups count (+1.5 at most). −0.5 per skill short of 6. Stuck dismount +0.1 (not pommel horse). Start value cap 12.3, bonuses included.',
  int: 'Intermediate: the dismount and the 7 highest-valued other skills count. EG I +0.5 for an A or higher; EG II–IV +0.3 for an A, +0.5 for a B or higher. −1.0 per skill short of 6. Stuck dismount +0.1 (vault: +0.2 for a flipping vault). Start value cap 13.1, bonuses included.',
  adv: 'Advanced (GymACT): the dismount and the 7 highest-valued other skills count. EG I +0.5; EG II–III +0.3 for an A or B, +0.4 for a C, +0.5 for a D or higher; the dismount group is worth the dismount’s value (max 0.5; floor has no dismount group). −1.0 per skill short of 6. Stuck dismount +0.1 for a B, +0.2 for a C or higher (vault: +0.2, flipping vaults only). No cap.',
};

// ---- progress, kept on this device only --------------------------------------------------
const STORE = 'ucg-calibration-mag';
const load = () => {
  try {
    return JSON.parse(localStorage.getItem(STORE)) || {};
  } catch {
    return {};
  }
};
let progress = load(); // { [routine id]: { tries, best: 'right' | 'off' } }
const save = () => {
  try {
    localStorage.setItem(STORE, JSON.stringify(progress));
  } catch {
    // private window or storage off: progress just isn't kept
  }
};

let current = null;
let checked = false;
let tab = 'dev';

// ---- routine picker: a level, then its apparatus -----------------------------------------
function renderPicker() {
  $('cp-tabs').innerHTML = LEVEL_TABS.map(([id, name]) => {
    const list = ROUTINES.filter((r) => r.level === id);
    const done = list.filter((r) => progress[r.id]?.best === 'right').length;
    return `<button type="button" role="tab" aria-selected="${id === tab}" data-tab="${id}">${name} <small>${done}/${list.length}</small></button>`;
  }).join('');
  $('cp-chips').innerHTML = ROUTINES.filter((r) => r.level === tab).map((r) => {
    const state = progress[r.id]?.best || 'new';
    const mark = { right: '✓', off: '•', new: '' }[state];
    const title = { right: 'You got this one right', off: 'Tried, not right yet', new: 'Not tried yet' }[state];
    return `<button type="button" class="cp-routine is-${state}${current?.id === r.id ? ' is-current' : ''}" data-id="${r.id}" title="${title}">${EVENT_SHORT[r.event]}<span aria-hidden="true">${mark}</span><span class="cp-sr">, ${title}</span></button>`;
  }).join('');
  const right = ROUTINES.filter((r) => progress[r.id]?.best === 'right').length;
  $('cp-progress').textContent = `${right} of ${ROUTINES.length} right`;
}
$('cp-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  tab = b.dataset.tab;
  // A level opens on the same apparatus.
  open(ROUTINES.find((r) => r.level === tab && r.event === current?.event) || ROUTINES.find((r) => r.level === tab));
});
$('cp-chips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-id]');
  if (b) open(ROUTINES.find((r) => r.id === b.dataset.id));
});

// ---- the calculator ----------------------------------------------------------------------
const rowCount = () => LEVELS[current.level].maxSkills;

function renderSkills(r) {
  const groups = APPARATUS[r.event].groups;
  $('cp-skills').innerHTML = Array.from({ length: rowCount() }, (_, i) => `
    <fieldset class="cp-skill" data-row="${i}">
      <legend class="cp-sr">Skill ${i + 1}</legend>
      <span class="cp-skill-n">${i + 1}</span>
      <span class="cp-seg cp-seg-value" role="radiogroup" aria-label="Skill ${i + 1} value">
        ${LETTERS.map((l) => `<label title="${l === 'Sub-A' ? 'Sub-A: recognised, worth 0.0, no element group' : `${l}`}"><input type="radio" name="v${i}" value="${l}"><span>${l === 'Sub-A' ? 'Sub' : l}</span></label>`).join('')}
      </span>
      <span class="cp-seg cp-seg-eg" role="radiogroup" aria-label="Skill ${i + 1} element group">
        <label title="No element group"><input type="radio" name="g${i}" value="0"><span>–</span></label>
        ${[1, 2, 3, 4].map((g) => `<label title="EG ${ROMAN[g]}: ${esc(groups[g])}"><input type="radio" name="g${i}" value="${g}"><span>${ROMAN[g]}</span></label>`).join('')}
      </span>
      <button type="button" class="cp-clear" data-clear="${i}" aria-label="Clear skill ${i + 1}" title="Clear">×</button>
    </fieldset>`).join('');
  const dismount = r.level === 'dev' ? '' : ' The dismount always counts (on floor, the last acrobatic element).';
  $('cp-skills-hint').innerHTML = `Enter each skill that counts: its value and element group (– for none).${dismount} Groups: ${[1, 2, 3, 4].map((g) => `<b>${ROMAN[g]}</b> ${esc(groups[g])}`).join(' · ')}.`;
}
$('cp-skills').addEventListener('click', (e) => {
  const b = e.target.closest('[data-clear]');
  if (!b) return;
  $('cp-skills').querySelectorAll(`[data-row="${b.dataset.clear}"] input`).forEach((i) => (i.checked = false));
  update();
});

function renderOptions(r) {
  const opts = r.event === 'vt' ? [] : bonusOptions(r.event, r.level);
  const stick = r.event !== 'ph';
  $('cp-bonus-card').hidden = !opts.length && !stick;
  $('cp-bonus').innerHTML = opts.map((o) => o.kind === 'check'
    ? `<label class="cp-check" data-opt="${o.id}"><input type="checkbox" data-bonus="${o.id}"><span>${esc(o.label)} <small>+${f1(o.value)}</small></span><span class="cp-key" hidden></span></label>`
    : `<label class="cp-check cp-check-num" data-opt="${o.id}"><span>${esc(o.label)} <small>${o.kind === 'mushroom' ? 'value, max +1.0' : `+${f1(o.value)} each, how many`}</small></span><input type="number" min="0" step="${o.kind === 'mushroom' ? 0.1 : 1}" placeholder="0" inputmode="decimal" data-bonus="${o.id}"><span class="cp-key" hidden></span></label>`).join('')
    + (stick ? `<label class="cp-check cp-check-num" data-opt="stick"><span>Stuck landing <small>stick bonus</small></span><select id="cp-stick"><option value="0">None</option><option value="0.1">+0.1</option><option value="0.2">+0.2</option></select><span class="cp-key" hidden></span></label>` : '');
  const reqs = r.event === 'vt' ? [] : requirements(r.event, r.level);
  $('cp-missing').innerHTML = reqs.map((o) => `<label class="cp-check" data-req="${o.id}"><input type="checkbox" data-missing="${o.id}"><span>Missing: ${esc(o.label.replace(/^Routine includes a /, '').replace(/^./, (c) => c.toUpperCase()))} <small>−${f1(o.value)}</small></span><span class="cp-key" hidden></span></label>`).join('');
}

function renderVaults(r) {
  const list = VAULTS.filter((v) => offeredAt(r.level, v)).sort((a, b) => String(a.id).localeCompare(String(b.id), 'en', { numeric: true }));
  const dv = (v) => (r.level === 'adv' ? v.adv : v.value);
  $('cp-vault').innerHTML = '<option value="">Choose the vault…</option>' + list.map((v) => {
    const banned = r.level === 'dev' && devBanned(v);
    return `<option value="${esc(v.id)}">${/^\d/.test(v.id) ? `${esc(v.id)} ` : ''}${esc(v.name)}${v.eponym ? ` (${esc(v.eponym)})` : ''} · ${banned ? 'banned at Developmental' : f1(dv(v))}</option>`;
  }).join('');
}

const entry = () => ({
  skills: Array.from({ length: rowCount() }, (_, i) => ({
    letter: $('cp-calc').querySelector(`input[name="v${i}"]:checked`)?.value || '',
    eg: Number($('cp-calc').querySelector(`input[name="g${i}"]:checked`)?.value || 0),
  })),
  bonus: Object.fromEntries([...$('cp-bonus').querySelectorAll('[data-bonus]')].map((i) => [i.dataset.bonus, i.type === 'checkbox' ? i.checked : i.value])),
  stick: Number($('cp-stick')?.value || 0),
  missing: Object.fromEntries([...$('cp-missing').querySelectorAll('[data-missing]')].map((i) => [i.dataset.missing, i.checked])),
  otherNd: $('cp-nd').value,
  e: $('cp-e').value,
  vault: $('cp-vault').value,
});

function update() {
  if (!current) return;
  const e = entry();
  const mine = scoreEntry(current, e);
  if (current.event !== 'vt') {
    const n = e.skills.filter((s) => s.letter).length;
    $('cp-count').textContent = `${n} / ${rowCount()} skills`;
    $('cp-count').className = `cp-chip${n === rowCount() ? ' is-full' : n < 6 ? ' is-short' : ''}`;
    // Sub-A has no element group.
    e.skills.forEach((s, i) => $('cp-skills').querySelectorAll(`input[name="g${i}"]`).forEach((g) => {
      g.disabled = s.letter === 'Sub-A';
      if (g.disabled) g.checked = false;
    }));
    const eg = mine.score.egBonus;
    $('cp-eg-line').innerHTML = Object.keys(eg).length
      ? `Element group bonus: ${Object.entries(eg).map(([g, v]) => `<b>${ROMAN[g]}</b> +${f1(v)}`).join(' · ')} = <b>+${f1(mine.score.egTotal)}</b>`
      : 'Element group bonus: none yet.';
  }
  $('cp-d').textContent = f1(mine.d);
  $('cp-sv').textContent = mine.filled ? f1(mine.sv) : '—';
  const short = mine.score?.shortDeduction;
  $('cp-short').textContent = mine.filled && short ? `−${f1(short)} short routine` : '';
  $('cp-ndv').textContent = mine.nd ? `−${f1(mine.nd)}` : '0.0';
  $('cp-ev').textContent = mine.e ? `−${f1(mine.e)}` : '0.0';
  $('cp-final').textContent = mine.filled ? f1(mine.final) : '—';
  if (checked) clearCheck(); // an edit after checking starts a new try
}
$('cp-calc').addEventListener('input', update);
$('cp-calc').addEventListener('change', update);
$('cp-calc').addEventListener('submit', (e) => e.preventDefault());
$('cp-reset').addEventListener('click', () => {
  resetCalc();
  update();
});

function resetCalc() {
  $('cp-calc').querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach((i) => (i.checked = false));
  $('cp-calc').querySelectorAll('input[type="number"]').forEach((i) => (i.value = ''));
  if ($('cp-stick')) $('cp-stick').value = '0';
  $('cp-vault').value = '';
  clearCheck();
}

// ---- "Did I get it right?" ---------------------------------------------------------------
function clearCheck() {
  checked = false;
  document.querySelectorAll('#cp-calc .is-right, #cp-calc .is-wrong').forEach((el) => el.classList.remove('is-right', 'is-wrong'));
  document.querySelectorAll('#cp-calc .cp-key').forEach((el) => (el.hidden = true));
  $('cp-result').hidden = true;
}

function mark(el, ok, keyText) {
  if (!el) return;
  el.classList.add(ok ? 'is-right' : 'is-wrong');
  const k = el.querySelector('.cp-key');
  if (k && !ok && keyText) {
    k.textContent = keyText;
    k.hidden = false;
  }
}

function check() {
  const r = current;
  const key = answerKey(r);
  const e = entry();
  const res = compare(r, key, e, esc);
  const mine = res.mine;

  if (r.event === 'vt') mark($('cp-vault-card'), e.vault === r.vault);
  else {
    const s = key.score;
    for (const o of bonusOptions(r.event, r.level)) {
      const k = s.optionValues[o.id] || 0;
      const v = e.bonus[o.id];
      const m = o.kind === 'check' ? (v ? o.value : 0) : o.kind === 'count' ? Math.min(Number(v) || 0, o.max) * o.value : Math.min(Number(v) || 0, 1);
      mark($('cp-bonus').querySelector(`[data-opt="${o.id}"]`), Math.abs(k - m) < 1e-9, k ? `Key: +${f1(k)}` : 'Key: none');
    }
    for (const o of requirements(r.event, r.level)) {
      const missing = key.ndItems.some((x) => x.rule === o.id);
      mark($('cp-missing').querySelector(`[data-req="${o.id}"]`), !!e.missing[o.id] === missing, missing ? 'Key: missing' : 'Key: met');
    }
  }
  if ($('cp-stick')) mark($('cp-bonus').querySelector('[data-opt="stick"]'), Math.abs(e.stick - r.stick) < 1e-9, r.stick ? `Key: +${f1(r.stick)}` : 'Key: none');
  const judgeNd = key.ndItems.filter((x) => !x.rule).reduce((t, x) => t + x.v, 0);
  mark($('cp-nd-row'), Math.abs((Number(e.otherNd) || 0) - judgeNd) < 1e-9, `Key: ${f1(judgeNd)}`);
  mark($('cp-e-row'), res.e, `Key: ${f1(key.e)}`);

  const p = progress[r.id] || { tries: 0 };
  p.tries += 1;
  if (p.best !== 'right') p.best = res.right ? 'right' : 'off';
  progress[r.id] = p;
  save();
  renderPicker();

  const line = (label, ok, yours, keys, extra = '') => `<li class="${ok ? 'is-right' : 'is-wrong'}"><span aria-hidden="true">${ok ? '✓' : '✗'}</span> <b>${label}</b> yours ${yours} · key ${keys}${extra}</li>`;
  $('cp-result').innerHTML = `
    <div class="cp-verdict ${res.right ? 'is-right' : 'is-wrong'}">
      <span class="cp-display">${res.right ? 'Your score matches the key' : 'Not quite: see below'}</span>
      <span>Final: yours ${f1(mine.final)} · key ${f1(key.final)}</span>
    </div>
    <ul class="cp-lines">
      ${line('Start value', res.sv, f1(mine.sv), f1(key.sv))}
      ${line('Neutral deductions', res.nd, f1(mine.nd), f1(key.nd))}
      ${line('Execution', res.e, f1(mine.e), f1(key.e), ` <small>(right within ${f1(E_TOLERANCE)})</small>`)}
    </ul>
    ${res.notes.length ? `<ul class="cp-notes">${res.notes.map((n) => `<li>${n}</li>`).join('')}</ul>` : ''}
    <div class="cp-actions">
      <button type="button" class="cp-btn" id="cp-show">See the routine laid out</button>
      <button type="button" class="cp-btn" id="cp-next">Next routine →</button>
    </div>`;
  $('cp-result').hidden = false;
  checked = true;
  $('cp-show').addEventListener('click', () => showBreakdown(key));
  $('cp-next').addEventListener('click', next);
}
$('cp-check').addEventListener('click', check);

function next() {
  const i = ROUTINES.indexOf(current);
  const ahead = [...ROUTINES.slice(i + 1), ...ROUTINES.slice(0, i + 1)];
  const r = ahead.find((x) => progress[x.id]?.best !== 'right') || ahead[0];
  open(r);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---- the routine laid out, with every deduction the key takes ------------------------------
const CREDIT = {
  counting: ['Counts', 'is-counting', 'One of the counting skills'],
  top: ['Not counting', 'is-top', 'Outside the counting skills, so it adds no difficulty'],
  eg: ['Over 4 in EG', 'is-top', 'Only 4 skills from one element group count'],
  sr: ['Not counting', 'is-top', 'Rings: only 3 strength (EG II/III) skills count before a B or higher EG I skill'],
  style: ['Not counting', 'is-top', 'High bar: at most two flights of each style count'],
  repeat: ['Repetition', 'is-nr', 'The same skill again: no credit, execution deductions still apply'],
  nr: ['Not recognised', 'is-nr', 'The judges didn’t credit it: see the comment'],
};
const dedCell = (ded, why) => (ded || why ? `${ded ? `<b>${esc(ded)}</b>` : ''}${ded && why ? ' · ' : ''}${esc(why || '')}` : '');

function showBreakdown(key) {
  const r = current;
  const planner = `<a class="cp-btn" href="../../?calibration=mag/${r.id}">Open in Routine Planner ↗</a>`;
  let body;
  let parts;
  if (r.event === 'vt') {
    const v = key.vault;
    body = `<table class="cp-table">
      <thead><tr><th>Vault</th><th>Value</th><th>Stick</th><th>Deductions</th></tr></thead>
      <tbody><tr><td>${esc(r.name)}<div class="cp-rownote">Vault table: ${esc(v.id)} ${esc(v.name)}</div></td><td class="cp-nowrap">${f1(v.dv)}</td><td>${r.stick ? `+${f1(r.stick)}` : '—'}</td><td>${dedCell(r.ded, r.why)}</td></tr></tbody>
    </table>`;
    parts = [['Execution', 10], ['Vault', v.dv], ['Stick', r.stick]];
  } else {
    const s = key.score;
    const rows = s.items.map((it, i) => {
      const src = r.rows[i];
      const kind = it.status === 'counting' ? 'counting' : it.status === 'repeat' ? 'repeat' : it.status === 'blank' ? 'nr' : it.reason;
      const [label, cls, title] = CREDIT[kind] || CREDIT.top;
      const listed = src.label && skillKey(src.label) !== skillKey(src.name) ? `<div class="cp-rownote">Skill list: ${esc(src.label)}</div>` : '';
      return `<tr class="${kind === 'counting' ? '' : 'is-muted'}">
        <td class="cp-num">${i + 1}</td>
        <td>${esc(src.name)}${listed}</td>
        <td class="cp-nowrap"><span class="cp-val">${esc(it.letter || '–')}</span>${it.letter ? ` ${f1(it.value)}` : ''}</td>
        <td>${src.eg ? ROMAN[src.eg] : '–'}</td>
        <td><span class="cp-status ${cls}" title="${esc(title)}">${label}</span></td>
        <td class="cp-num">${it.bonus ? `+${f1(it.bonus)}` : ''}</td>
        <td>${dedCell(src.ded, src.why)}</td>
      </tr>`;
    }).join('');
    const lines = r.lines.map((l) => `<tr class="cp-line"><td></td><td colspan="5">${esc(l.what)} <span class="cp-tag">${l.kind === 'neutral' ? 'neutral deduction' : 'execution'}</span></td><td><b>${f1(l.v)}</b>${l.why ? ` · ${esc(l.why)}` : ''}</td></tr>`).join('');
    body = `<table class="cp-table">
        <thead><tr><th>#</th><th>Skill</th><th>Value</th><th>EG</th><th>Credit</th><th>EG bonus</th><th>Deductions</th></tr></thead>
        <tbody>${rows}${lines}</tbody>
      </table>`;
    const earned = bonusOptions(r.event, r.level).filter((o) => s.optionValues[o.id]).map((o) => `${esc(o.label)} +${f1(s.optionValues[o.id])}${s.detected[o.id] ? ` (${esc(s.detected[o.id])})` : ''}`);
    if (r.stick) earned.push(`Stuck dismount +${f1(r.stick)}`);
    body += `<p class="cp-bonusline"><b>Bonus:</b> ${earned.length ? earned.join('; ') : 'none'}.</p>`;
    parts = [['Execution', 10], ['Difficulty', s.difficulty], ['EG bonus', s.egTotal], ['Bonus', s.bonus + r.stick], ['Short', s.shortDeduction, true]];
  }
  body += `<p class="cp-bonusline"><b>Neutral deductions:</b> ${key.ndItems.length ? key.ndItems.map((x) => `${esc(x.what)} −${f1(x.v)}`).join('; ') : 'none'}.</p>`;
  const capped = LEVELS[r.level].cap != null && key.sv === LEVELS[r.level].cap ? ' (cap)' : '';
  const sum = parts.map(([l, v, minus], i) => `${i ? `<span>${minus ? '−' : '+'}</span>` : ''}<div><small>${l}</small><b>${f1(v)}</b></div>`).join('')
    + `<span>=</span><div class="cp-sum-total"><small>Start value${capped}</small><b>${f1(key.sv)}</b></div>`
    + `<span>−</span><div><small>Neutral</small><b>${f1(key.nd)}</b></div><span>−</span><div><small>Execution</small><b>${f1(key.e)}</b></div>`
    + `<span>=</span><div class="cp-sum-total"><small>Final</small><b>${f1(key.final)}</b></div>`;
  $('cp-breakdown').innerHTML = `
    <div class="cp-card">
      <div class="cp-card-head">
        <h2 class="cp-display">${esc(routineName(r))}, laid out</h2>
        ${planner}
      </div>
      ${body}
      ${r.notes.map((n) => `<p class="cp-hint">${esc(n)}</p>`).join('')}
      <div class="cp-sum">${sum}</div>
    </div>`;
  $('cp-breakdown').hidden = false;
  $('cp-breakdown').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---- open a routine ----------------------------------------------------------------------
function open(r) {
  current = r;
  tab = r.level;
  document.body.classList.toggle('is-vault', r.event === 'vt');
  if (r.youtube) {
    $('cp-video').src = `https://www.youtube-nocookie.com/embed/${r.youtube}?rel=0`;
    $('cp-video-link').href = `https://www.youtube.com/watch?v=${r.youtube}`;
    $('cp-video-link').textContent = 'Watch on YouTube ↗';
  } else {
    $('cp-video').src = `https://drive.google.com/file/d/${r.drive}/preview`;
    $('cp-video-link').href = `https://drive.google.com/file/d/${r.drive}/view`;
    $('cp-video-link').textContent = 'Open in Drive ↗';
  }
  $('cp-video-name').textContent = routineName(r);
  $('cp-intro').textContent = LEVEL_RULES[r.level];
  if (r.event === 'vt') renderVaults(r);
  else renderSkills(r);
  renderOptions(r);
  resetCalc();
  $('cp-breakdown').hidden = true;
  update();
  renderPicker();
  history.replaceState(null, '', `#${r.id}`);
}

const fromHash = () => ROUTINES.find((r) => r.id === decodeURIComponent(location.hash.slice(1)));
// A link to one routine (…/calibration/mag/#adv-fx), followed in this tab or on load.
addEventListener('hashchange', () => {
  const r = fromHash();
  if (r && r !== current) open(r);
});

open(fromHash() || ROUTINES[0]);
