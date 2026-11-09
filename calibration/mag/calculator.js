// The MAG judging calculator: the counting skills in the order performed (value and element group,
// connections), the level's bonuses and requirements, the stick bonus, neutral and execution
// deductions, and the score. Shared by judge practice (calibration/mag/) and the stand-alone
// calculator (calculator/mag/), so the two look and score alike.
import { APPARATUS, LEVELS, LETTERS, ROMAN, VAULTS, bonusOptions, devBanned, findVault, neutralOptions, offeredAt, requirements, scoreEntry,
  COP_URL, EVENT_NAME, LEVEL_NOTE, LEVEL_TABS, f1, levelRules, stickBonus } from './rules.js';

// The rules (no DOM) are rules.js; these are re-exported for the pages that import them from here.
export { COP_URL, EVENT_NAME, EVENT_SHORT, LEVEL_TABS, ROMAN, f1, levelRules, stickBonus } from './rules.js';
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** The rules panel: the level, then its rules for the apparatus. */
export function rulesHtml(level, event) {
  const name = Object.fromEntries(LEVEL_TABS)[level];
  return `<p class="cp-rules-head"><b class="cp-display">${esc(name)}</b> <span>${esc(LEVEL_NOTE[level])} · ${esc(EVENT_NAME[event])}</span></p>
    <dl class="cp-rules">${levelRules(level, event).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${[v].flat().map(esc).join('<br>')}</dd>`).join('')}</dl>
    <p class="cp-rules-foot">Skill values and element groups: <a href="${COP_URL}" target="_blank" rel="noopener">UCG MAG Code of Points ↗</a></p>`;
}

/**
 * The stick bonus for a stuck landing: by level and, on the other apparatus, the dismount's value
 * (Advanced: +0.1 for a B, +0.2 for C or higher) or, on vault, whether it flips.
 * { value, why } — `why` explains it next to the checkbox.
 */

const ICON_LINK = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>';
const ICON_PLUS = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const linkInner = (on) => (on ? `${ICON_LINK}<span>Connected</span>` : `${ICON_PLUS}<span>Connect</span>`);

// The calculator's cards, from the counting skills to the score.
export const CALC_HTML = `
  <div class="cp-card cp-nonvault">
    <div class="cp-card-head">
      <h2 class="cp-display">Counting skills</h2>
      <span class="cp-chip" id="cp-count"></span>
    </div>
    <div class="cp-skills-hint" id="cp-skills-hint"></div>
    <div id="cp-skills"></div>
    <p class="cp-eg-line" id="cp-eg-line"></p>
  </div>

  <div class="cp-card cp-vault-only" id="cp-vault-card">
    <h2 class="cp-display">Vault</h2>
    <p class="cp-hint">From the MAG vault table, at this level's values.</p>
    <label class="cp-sr" for="cp-vault">Vault</label>
    <select id="cp-vault"></select>
  </div>

  <div class="cp-card" id="cp-bonus-card">
    <h2 class="cp-display">Bonus</h2>
    <div id="cp-bonus" class="cp-checks"></div>
  </div>

  <div class="cp-card">
    <h2 class="cp-display">Neutral deductions</h2>
    <div id="cp-missing" class="cp-checks"></div>
    <div id="cp-neutral" class="cp-checks"></div>
    <label class="cp-field cp-live" id="cp-nd-row">Other neutral deductions <input type="number" id="cp-nd" min="0" step="0.1" placeholder="0.0" inputmode="decimal" /><span class="cp-key" hidden></span></label>
  </div>

  <div class="cp-card">
    <h2 class="cp-display">Execution</h2>
    <label class="cp-field cp-live" id="cp-e-row">Total execution deductions <input type="number" id="cp-e" min="0" step="0.1" placeholder="0.0" inputmode="decimal" /><span class="cp-key" hidden></span></label>
  </div>

  <div class="cp-score cp-score-mag" aria-live="polite">
    <div><span class="cp-subhead">D-score</span><b class="cp-display" id="cp-d">0.0</b></div>
    <div><span class="cp-subhead">Start value</span><b class="cp-display" id="cp-sv">—</b><small id="cp-short"></small></div>
    <div><span class="cp-subhead">Neutral</span><b class="cp-display" id="cp-ndv">0.0</b></div>
    <div><span class="cp-subhead">Execution</span><b class="cp-display" id="cp-ev">0.0</b></div>
    <div class="cp-final"><span class="cp-subhead">Final</span><b class="cp-display" id="cp-final">—</b></div>
  </div>`;

/**
 * The calculator inside `form` (its fields go in `fields`; `root` gets the is-vault class). Call
 * open(level, event) to set it up for a routine; onChange runs after every edit, once scored.
 */
export function createCalculator({ form, fields, root, onChange = () => {} }) {
  fields.innerHTML = CALC_HTML;
  const $ = (id) => form.querySelector(`#${id}`);
  let current = null; // { level, event }
  const rowCount = () => LEVELS[current.level].maxSkills;
  // Floor and high bar have connection bonuses: a toggle between two skills connects them.
  const linkable = () => bonusOptions(current.event, current.level).some((o) => o.connect);

  function renderSkills({ event, level }) {
    const groups = APPARATUS[event].groups;
    const links = linkable();
    $('cp-skills').classList.toggle('is-linkable', links);
    $('cp-skills').innerHTML = Array.from({ length: rowCount() }, (_, i) => `
      <fieldset class="cp-skill" data-row="${i}">
        <legend class="cp-sr">Skill ${i + 1}</legend>
        <span class="cp-skill-n">${i + 1}</span>
        <span class="cp-seg cp-seg-value" role="radiogroup" aria-label="Skill ${i + 1} value">
          ${LETTERS.map((l) => `<label title="${l === 'Sub-A' ? 'Sub-A: recognized, worth 0.0, no element group' : `${l}`}"><input type="radio" name="v${i}" value="${l}"><span>${l === 'Sub-A' ? 'Sub' : l}</span></label>`).join('')}
        </span>
        <span class="cp-seg cp-seg-eg" role="radiogroup" aria-label="Skill ${i + 1} element group">
          <label title="No element group"><input type="radio" name="g${i}" value="0"><span>–</span></label>
          ${[1, 2, 3, 4].map((g) => `<label title="EG ${ROMAN[g]}: ${esc(groups[g])}"><input type="radio" name="g${i}" value="${g}"><span>${ROMAN[g]}</span></label>`).join('')}
        </span>
        <button type="button" class="cp-clear" data-clear="${i}" aria-label="Clear skill ${i + 1}" title="Clear">×</button>
        ${links && i < rowCount() - 1 ? `<button type="button" class="cp-link" data-link="${i}" aria-pressed="false" aria-label="Skill ${i + 1} connected to skill ${i + 2}" hidden>${linkInner(false)}</button>` : ''}
      </fieldset>`).join('');
    // Developmental counts its 6 highest, the dismount among them or not.
    const order = level === 'dev' ? '<b>In the order performed</b>: only the 6 highest-valued skills.'
      : `<b>In the order performed, the dismount last</b>${event === 'fx' ? ' (on floor, the last acrobatic skill)' : ''}: only the dismount and the ${rowCount() - 1} highest-valued others.`;
    const connect = links ? `<li>Connected skills: tap <b>Connect</b> between them for the ${event === 'hb' ? 'C + C' : 'connection'} bonus.</li>` : '';
    $('cp-skills-hint').innerHTML = `
      <ul class="cp-steps">
        <li>${order}</li>
        <li>For each, its value, then its element group (– for none).</li>
        ${connect}
      </ul>
      <ul class="cp-groups" aria-label="Element groups">${[1, 2, 3, 4].map((g) => `<li><b>${ROMAN[g]}</b> ${esc(groups[g])}</li>`).join('')}</ul>`;
  }

  function renderOptions({ event, level }) {
    const opts = event === 'vt' ? [] : bonusOptions(event, level);
    const stick = event !== 'ph';
    $('cp-bonus-card').hidden = !opts.length && !stick;
    $('cp-bonus').innerHTML = opts.map((o) => {
      if (o.kind === 'check') return `<label class="cp-check" data-opt="${o.id}"><input type="checkbox" data-bonus="${o.id}"><span>${esc(o.label)} <small>+${f1(o.value)}</small></span><span class="cp-key" hidden></span></label>`;
      // Connection bonuses come from the connected skills above.
      if (o.connect) return `<div class="cp-check cp-check-auto" data-opt="${o.id}"><span>${esc(o.label)} <small>+${f1(o.value)} each, from the connected skills</small></span><output data-auto="${o.id}">—</output><span class="cp-key" hidden></span></div>`;
      return `<label class="cp-check cp-check-num" data-opt="${o.id}"><span>${esc(o.label)} <small>${o.kind === 'mushroom' ? 'value, max +1.0' : `+${f1(o.value)} each, how many`}</small></span><input type="number" min="0" step="${o.kind === 'mushroom' ? 0.1 : 1}" placeholder="0" inputmode="decimal" data-bonus="${o.id}"><span class="cp-key" hidden></span></label>`;
    }).join('')
      + (stick ? `<label class="cp-check" data-opt="stick"><input type="checkbox" id="cp-stick"><span>Stuck landing <small id="cp-stick-why"></small></span><span class="cp-key" hidden></span></label>` : '');
    const reqs = event === 'vt' ? [] : requirements(event, level);
    $('cp-neutral').innerHTML = neutralOptions(event, level).map((o) => {
      if (o.kind === 'check') return `<label class="cp-check" data-nd="${o.id}"><input type="checkbox" data-neutral="${o.id}"><span>${esc(o.label)} <small>−${f1(o.value)}</small></span></label>`;
      if (o.kind === 'pick') return `<label class="cp-check cp-check-num" data-nd="${o.id}"><span>${esc(o.label)}</span><select data-neutral="${o.id}"><option value="">No</option>${o.steps.map(([v, l]) => `<option value="${v}">${esc(l)} −${f1(v)}</option>`).join('')}</select></label>`;
      return `<label class="cp-check cp-check-num" data-nd="${o.id}"><span>${esc(o.label)} <small>−${f1(o.value)} each, how many</small></span><input type="number" min="0" step="1" placeholder="0" inputmode="numeric" data-neutral="${o.id}"></label>`;
    }).join('');
    $('cp-missing').innerHTML = reqs.map((o) => `<label class="cp-check" data-req="${o.id}"><input type="checkbox" data-missing="${o.id}"><span>Missing: ${esc(o.label.replace(/^Routine includes a /, '').replace(/^./, (c) => c.toUpperCase()))} <small>−${f1(o.value)}</small></span><span class="cp-key" hidden></span></label>`).join('');
  }

  function renderVaults({ level }) {
    const list = VAULTS.filter((v) => offeredAt(level, v)).sort((a, b) => String(a.id).localeCompare(String(b.id), 'en', { numeric: true }));
    const dv = (v) => (level === 'adv' ? v.adv : v.value);
    $('cp-vault').innerHTML = '<option value="">Choose the vault…</option>' + list.map((v) => {
      const banned = level === 'dev' && devBanned(v);
      return `<option value="${esc(v.id)}">${/^\d/.test(v.id) ? `${esc(v.id)} ` : ''}${esc(v.name)}${v.eponym ? ` (${esc(v.eponym)})` : ''} · ${banned ? 'banned at Developmental' : f1(dv(v))}</option>`;
    }).join('');
  }

  const links = () => form.querySelectorAll('[data-link]');
  /** The stick bonus a stuck landing earns now: from the last skill entered, or the vault. */
  function stickNow() {
    const filled = [...$('cp-skills').querySelectorAll('.cp-skill')].map((_, i) => form.querySelector(`input[name="v${i}"]:checked`)?.value).filter(Boolean);
    const vault = current.event === 'vt' && $('cp-vault').value ? findVault($('cp-vault').value, current.level) : null;
    return stickBonus(current.level, current.event, { dismount: filled.at(-1) || '', vault });
  }

  const entry = () => ({
    skills: Array.from({ length: rowCount() }, (_, i) => ({
      letter: form.querySelector(`input[name="v${i}"]:checked`)?.value || '',
      eg: Number(form.querySelector(`input[name="g${i}"]:checked`)?.value || 0),
      link: form.querySelector(`[data-link="${i}"]`)?.getAttribute('aria-pressed') === 'true',
    })),
    bonus: Object.fromEntries([...$('cp-bonus').querySelectorAll('[data-bonus]')].map((i) => [i.dataset.bonus, i.type === 'checkbox' ? i.checked : i.value])),
    stick: $('cp-stick')?.checked ? stickNow().value : 0,
    missing: Object.fromEntries([...$('cp-missing').querySelectorAll('[data-missing]')].map((i) => [i.dataset.missing, i.checked])),
    neutral: Object.fromEntries([...$('cp-neutral').querySelectorAll('[data-neutral]')].map((i) => [i.dataset.neutral, i.type === 'checkbox' ? i.checked : i.value])),
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
      e.skills.forEach((s, i) => form.querySelectorAll(`input[name="g${i}"]`).forEach((g) => {
        g.disabled = s.letter === 'Sub-A';
        if (g.disabled) g.checked = false;
      }));
      // A connection needs a skill on both sides.
      links().forEach((b) => {
        const i = Number(b.dataset.link);
        b.hidden = !(e.skills[i].letter && e.skills[i + 1].letter);
        b.closest('.cp-skill').classList.toggle('is-linked', !b.hidden && e.skills[i].link);
        $('cp-skills').querySelector(`[data-row="${i + 1}"]`).classList.toggle('is-linked-after', !b.hidden && e.skills[i].link);
      });
      const eg = mine.score.egBonus;
      $('cp-eg-line').innerHTML = Object.keys(eg).length
        ? `Element group bonus: ${Object.entries(eg).map(([g, v]) => `<b>${ROMAN[g]}</b> +${f1(v)}`).join(' · ')} = <b>+${f1(mine.score.egTotal)}</b>`
        : 'Element group bonus: none yet.';
      form.querySelectorAll('[data-auto]').forEach((o) => {
        const v = mine.score.optionValues[o.dataset.auto] || 0;
        o.textContent = v ? `+${f1(v)}` : '—';
      });
    }
    if ($('cp-stick')) {
      const s = stickNow();
      $('cp-stick-why').textContent = s.why;
    }
    $('cp-d').textContent = f1(mine.d);
    $('cp-sv').textContent = mine.filled ? f1(mine.sv) : '—';
    const short = mine.score?.shortDeduction;
    $('cp-short').textContent = mine.filled && short ? `−${f1(short)} short routine` : '';
    $('cp-ndv').textContent = mine.nd ? `−${f1(mine.nd)}` : '0.0';
    $('cp-ev').textContent = mine.e ? `−${f1(mine.e)}` : '0.0';
    $('cp-final').textContent = mine.filled ? f1(mine.final) : '—';
    onChange(mine);
  }

  function setLink(b, on) {
    b.setAttribute('aria-pressed', on);
    b.innerHTML = linkInner(on);
    b.title = on ? `Connected to the next skill (tap to separate)` : `Not connected to the next skill (tap to connect)`;
  }

  function reset() {
    form.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach((i) => (i.checked = false));
    form.querySelectorAll('input[type="number"]').forEach((i) => (i.value = ''));
    links().forEach((b) => setLink(b, false));
    form.querySelectorAll('select').forEach((i) => (i.value = ''));
  }

  /** Set the calculator up, empty, for a level and an apparatus. */
  function open(level, event) {
    current = { level, event };
    root.classList.toggle('is-vault', event === 'vt');
    if (event === 'vt') renderVaults(current);
    else renderSkills(current);
    renderOptions(current);
    reset();
    update();
  }

  $('cp-skills').addEventListener('click', (e) => {
    const link = e.target.closest('[data-link]');
    if (link) {
      setLink(link, link.getAttribute('aria-pressed') !== 'true');
      update();
      return;
    }
    const b = e.target.closest('[data-clear]');
    if (!b) return;
    const i = Number(b.dataset.clear);
    $('cp-skills').querySelectorAll(`[data-row="${i}"] input`).forEach((x) => (x.checked = false));
    // A cleared skill is connected to nothing.
    [i - 1, i].forEach((k) => form.querySelector(`[data-link="${k}"]`) && setLink(form.querySelector(`[data-link="${k}"]`), false));
    update();
  });
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', (e) => e.preventDefault());

  return { open, entry, update, reset };
}
