// Judge practice for UCG Infinity: watch a calibration routine, enter its difficulty the way the
// judging calculator takes it, check it against the answer key, and see the routine laid out the
// way the planner scores it. Difficulty only: execution is judged as in Xcel Sapphire.
import { INFINITY_GROUPS, INFINITY_VALUES, INFINITY_VAULT_LIST } from '../../js/scoring/wag.js';
import { LETTERS, ROMAN, answerKey, compare, entryD } from './key.js';
import { ROUTINES } from './routines.js';

const $ = (id) => document.getElementById(id);
const EVENTS = [['vt', 'Vault'], ['ub', 'Bars'], ['bb', 'Beam'], ['fx', 'Floor']];
const EVENT_NAME = Object.fromEntries(EVENTS);
const f2 = (n) => (Math.round(n * 100) / 100).toFixed(2);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const shortName = (id) => id.replace(' (limited credit)', ' limited');

// ---- progress, kept on this device only --------------------------------------------------
const STORE = 'ucg-calibration-infinity';
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
let tab = 'bb';

// ---- routine picker ----------------------------------------------------------------------
function renderPicker() {
  $('cp-tabs').innerHTML = EVENTS.map(([id, name]) => {
    const list = ROUTINES.filter((r) => r.event === id);
    const done = list.filter((r) => progress[r.id]?.best === 'right').length;
    return `<button type="button" role="tab" aria-selected="${id === tab}" data-tab="${id}">${name} <small>${done}/${list.length}</small></button>`;
  }).join('');
  $('cp-chips').innerHTML = ROUTINES.filter((r) => r.event === tab).map((r) => {
    const state = progress[r.id]?.best || 'new';
    const mark = { right: '✓', off: '•', new: '' }[state];
    const title = { right: 'You got this one right', off: 'Tried, not right yet', new: 'Not tried yet' }[state];
    return `<button type="button" class="cp-routine is-${state}${current?.id === r.id ? ' is-current' : ''}" data-id="${esc(r.id)}" title="${title}">${esc(shortName(r.id))}<span aria-hidden="true">${mark}</span><span class="cp-sr">, ${title}</span></button>`;
  }).join('');
  const right = ROUTINES.filter((r) => progress[r.id]?.best === 'right').length;
  $('cp-progress').textContent = `${right} of ${ROUTINES.length} right`;
}
$('cp-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (b) {
    tab = b.dataset.tab;
    renderPicker();
  }
});
$('cp-chips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-id]');
  if (b) open(ROUTINES.find((r) => r.id === b.dataset.id));
});

// ---- the calculator: the judging calculator's difficulty inputs ---------------------------
$('cp-letters').innerHTML = LETTERS.map((l) => `
  <div class="cp-letter" data-letter="${l}">
    <span class="cp-letter-name"><b class="cp-display">${l}</b><small>${INFINITY_VALUES[l].toFixed(2)} each</small></span>
    <span class="cp-key" hidden></span>
    <span class="cp-stepper">
      <button type="button" data-step="-1" aria-label="One fewer ${l}">−</button>
      <input type="number" min="0" max="8" value="0" inputmode="numeric" aria-label="${l} skills">
      <button type="button" data-step="1" aria-label="One more ${l}">+</button>
    </span>
  </div>`).join('');
const letterInput = (l) => $('cp-letters').querySelector(`[data-letter="${l}"] input`);
const counts = () => Object.fromEntries(LETTERS.map((l) => [l, Math.max(0, Math.min(8, parseInt(letterInput(l).value, 10) || 0))]));
const total = (c) => LETTERS.reduce((t, l) => t + c[l], 0);

$('cp-letters').addEventListener('click', (e) => {
  const b = e.target.closest('[data-step]');
  if (!b) return;
  const input = b.closest('.cp-letter').querySelector('input');
  const step = Number(b.dataset.step);
  if (step > 0 && total(counts()) >= 8) return;
  input.value = Math.max(0, (parseInt(input.value, 10) || 0) + step);
  update();
});

{
  let html = '<option value="">Choose the vault…</option>';
  let entry = null;
  for (const v of INFINITY_VAULT_LIST) {
    if (v.entry !== entry) {
      html += `${entry ? '</optgroup>' : ''}<optgroup label="${esc(v.entry)}">`;
      entry = v.entry;
    }
    html += `<option value="${v.id}">${esc(v.usag)} ${esc(v.name)} (${v.dv.toFixed(1)})</option>`;
  }
  $('cp-vault').innerHTML = `${html}</optgroup>`;
}

function renderEvent(r) {
  document.body.classList.toggle('is-vault', r.event === 'vt');
  if (r.event === 'vt') return;
  const g = INFINITY_GROUPS[r.event];
  $('cp-egs').innerHTML = ROMAN.map((k) => `
    <label class="cp-check" data-eg="${k}">
      <input type="checkbox" value="${k}">
      <b class="cp-display">${k}</b>
      <span>${g.condensed[k].map((n) => `${esc(g.groups[n])} (${n})`).join(', ')}</span>
      <span class="cp-key" hidden></span>
    </label>`).join('');
  $('cp-ab-label').textContent = g.eventBonus;
}

const entry = () => ({
  counts: counts(),
  egs: new Set([...$('cp-egs').querySelectorAll('input:checked')].map((i) => i.value)),
  bonus: $('cp-ab').checked,
  vault: INFINITY_VAULT_LIST.find((v) => v.id === $('cp-vault').value) || null,
});

function update() {
  if (!current) return;
  const e = entry();
  const n = total(e.counts);
  $('cp-count').textContent = `${n} / 8 skills`;
  $('cp-count').className = `cp-chip${n === 8 ? ' is-full' : n < 6 ? ' is-short' : ''}`;
  const d = entryD(current.event, e);
  const short = current.event === 'vt' ? 0 : Math.max(0, 6 - n);
  const blank = current.event === 'vt' ? !e.vault : n === 0;
  $('cp-d').textContent = f2(d);
  $('cp-short').textContent = short && !blank ? `−${short.toFixed(1)} short routine` : '';
  $('cp-sv').textContent = blank ? '—' : f2(10 + d - short);
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
  LETTERS.forEach((l) => (letterInput(l).value = 0));
  $('cp-egs').querySelectorAll('input').forEach((i) => (i.checked = false));
  $('cp-ab').checked = false;
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
  el.classList.add(ok ? 'is-right' : 'is-wrong');
  const k = el.querySelector('.cp-key');
  if (k && !ok) {
    k.textContent = keyText;
    k.hidden = false;
  }
}

function check() {
  const key = answerKey(current);
  const res = compare(current, key, entry(), esc);
  if (current.event === 'vt') {
    mark($('cp-vault-card'), res.vault, '');
  } else {
    for (const l of LETTERS) mark($('cp-letters').querySelector(`[data-letter="${l}"]`), res.letters[l], `Key: ${key.counts[l]}`);
    for (const k of ROMAN) mark($('cp-egs').querySelector(`[data-eg="${k}"]`), res.groups[k], key.egs.has(k) ? 'Key: earned' : 'Key: not earned');
    mark($('cp-ab-row'), res.bonus, key.bonus ? 'Key: earned' : 'Key: not earned');
  }

  const p = progress[current.id] || { tries: 0 };
  p.tries += 1;
  if (p.best !== 'right') p.best = res.right ? 'right' : 'off';
  progress[current.id] = p;
  save();
  renderPicker();

  $('cp-result').innerHTML = `
    <div class="cp-verdict ${res.right ? 'is-right' : 'is-wrong'}">
      <span class="cp-display">${res.right ? 'Your D-score matches the key' : `Off by ${f2(Math.abs(res.d - res.keyD))}`}</span>
      <span>Your D ${f2(res.d)} · Key D ${f2(res.keyD)} · Start value ${key.sv.toFixed(1)}</span>
    </div>
    ${res.notes.length ? `<ul class="cp-notes">${res.notes.map((n) => `<li>${n}</li>`).join('')}</ul>` : ''}
    <div class="cp-actions">
      ${current.event === 'vt' ? '' : '<button type="button" class="cp-btn" id="cp-show">See the routine laid out</button>'}
      <button type="button" class="cp-btn" id="cp-next">Next routine →</button>
    </div>`;
  $('cp-result').hidden = false;
  checked = true;
  $('cp-show')?.addEventListener('click', () => showBreakdown(key));
  $('cp-next').addEventListener('click', next);
}
$('cp-check').addEventListener('click', check);

function next() {
  const i = ROUTINES.indexOf(current);
  const ahead = [...ROUTINES.slice(i + 1), ...ROUTINES.slice(0, i + 1)];
  const r = ahead.find((x) => progress[x.id]?.best !== 'right') || ahead[0];
  tab = r.event;
  open(r);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---- the routine laid out, the way the planner scores it ---------------------------------
const STATUS = {
  counting: ['Counts', 'One of the 8 highest-valued skills'],
  top: ['Not in top 8', 'Outside the 8 highest-valued skills, so it adds no difficulty'],
  egOnly: ['Group credit only', 'Not one of the counting skills, but it earns its element group bonus'],
};

function showBreakdown(key) {
  const r = current;
  const s = key.score;
  const rows = s.items.map((it, i) => {
    const src = key.rows[i];
    const kind = it.status === 'counting' ? 'counting' : STATUS[it.reason] ? it.reason : 'top';
    const [label, title] = STATUS[kind];
    return `<tr class="${kind === 'counting' ? '' : 'is-muted'}">
      <td class="cp-num">${i + 1}</td>
      <td>${esc(it.name)}${src.extra ? ' <span class="cp-tag">outside the top 8 on the sheet</span>' : ''}${src.note ? `<div class="cp-rownote">${esc(src.note)}</div>` : ''}</td>
      <td class="cp-nowrap"><span class="cp-val">${it.letter}</span> ${it.value.toFixed(1)}</td>
      <td>${esc(src.group)}</td>
      <td><span class="cp-status is-${kind}" title="${esc(title)}">${label}</span></td>
      <td class="cp-num">${it.bonus ? '+0.3' : ''}</td>
    </tr>`;
  }).join('');
  const parts = [['Execution', 10], ['Difficulty', s.difficulty], ['Group bonus', s.egTotal], ['Apparatus bonus', s.bonus], ['Short of 6', s.shortBy, true]];
  const agrees = Math.abs(s.sv - r.sv) < 0.05;
  $('cp-breakdown').innerHTML = `
    <div class="cp-card">
      <div class="cp-card-head">
        <h2 class="cp-display">${esc(r.id)}: ${EVENT_NAME[r.event]}, laid out</h2>
        <a class="cp-btn" href="../../?calibration=${encodeURIComponent(r.id)}">Open in Routine Planner ↗</a>
      </div>
      <table class="cp-table">
        <thead><tr><th>#</th><th>Skill</th><th>Value</th><th>Group</th><th>Credit</th><th>Bonus</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="cp-bonusline"><b>Apparatus bonus (${esc(INFINITY_GROUPS[r.event].eventBonus)}):</b> ${r.eventBonus ? '+0.3' : 'not earned'}. ${esc(r.eventBonusWhy)}.</p>
      ${r.notes.map((n) => `<p class="cp-hint">${esc(n)}</p>`).join('')}
      <div class="cp-sum">${parts.map(([l, v, minus], i) => `${i ? `<span>${minus ? '−' : '+'}</span>` : ''}<div><small>${l}</small><b>${v.toFixed(1)}</b></div>`).join('')}<span>=</span><div class="cp-sum-total"><small>Start value</small><b>${s.sv.toFixed(1)}</b></div></div>
      ${agrees ? '' : `<p class="cp-warn">The planner’s scoring gives ${s.sv.toFixed(1)}, but the answer key sheet says ${r.sv.toFixed(1)}.</p>`}
    </div>`;
  $('cp-breakdown').hidden = false;
  $('cp-breakdown').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---- open a routine ----------------------------------------------------------------------
function open(r) {
  current = r;
  $('cp-main').classList.toggle('is-portrait', r.portrait);
  $('cp-main').classList.toggle('is-landscape', !r.portrait);
  $('cp-video').src = `https://drive.google.com/file/d/${r.video}/preview`;
  $('cp-video-link').href = `https://drive.google.com/file/d/${r.video}/view`;
  $('cp-video-name').textContent = `${EVENT_NAME[r.event]} · ${r.id}`;
  $('cp-intro').textContent = r.intro;
  $('cp-intro').hidden = !r.intro;
  renderEvent(r);
  resetCalc();
  $('cp-breakdown').hidden = true;
  update();
  renderPicker();
  history.replaceState(null, '', `#${encodeURIComponent(r.id)}`);
}

const fromHash = () => ROUTINES.find((r) => r.id === decodeURIComponent(location.hash.slice(1)));
// A link to one routine (…/calibration/infinity/#FX_4), followed in this tab or on load.
addEventListener('hashchange', () => {
  const r = fromHash();
  if (r && r !== current) {
    tab = r.event;
    open(r);
  }
});

const first = fromHash() || ROUTINES.find((r) => r.event === 'bb');
tab = first.event;
open(first);
