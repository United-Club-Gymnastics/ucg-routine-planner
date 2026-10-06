import * as store from './store.js';
import {
  DISCIPLINES,
  applyExample,
  DISC_IDS,
  DECADES,
  DECADE_LABELS,
  blankSkill,
  blankTT,
  copyRoutines,
  entryName,
  eventInfo,
  eventSpec,
  fmt,
  hasContent,
  levelInfo,
  newEntry,
  normalizeEntry,
  scoreEntry,
} from './model.js';
import { findSkill, searchSkills, wagSkillAllowed } from './skill-search.js';
import { EXAMPLES } from './data/examples.js';
import { VAULTS as MAG_VAULTS } from './data/mag-vaults.js';
import * as mag from './scoring/mag.js';
import { MAG_MASTERS_VAULTS, OTHER_VAULT } from './scoring/mag.js';
import { mastersValue, vaultAgeBonus } from './scoring/masters.js';
import { INFINITY_VAULT_LIST, WAG_MASTERS_VAULTS, WAG_OTHER_VAULT, WAG_WG_VAULTS, WG_TO_MASTERS, xcelVaults } from './scoring/wag.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const uid = () => store.newId();
const ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };
const MAX_ROWS = 20;

const app = $('#app');
const state = {
  user: null,
  athletes: [],
  athleteId: null,
  entryId: null,
  tab: readPref('rp-tabs', {}), // entryId -> event id
  showAdd: false,
  athOpen: false,
  athQuery: '',
};

function readPref(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function writePref(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

const athlete = () => state.athletes.find((a) => a.id === state.athleteId) || null;
const entry = () => {
  const a = athlete();
  return a?.entries.find((e) => e.id === state.entryId) || a?.entries[0] || null;
};
const currentEvent = (e = entry()) => {
  const evs = DISCIPLINES[e.disc].events;
  const t = state.tab[e.id];
  return evs.some((x) => x.id === t) ? t : evs[0].id;
};
const sortedAthletes = () =>
  [...state.athletes].sort((a, b) => (a.name || '~').localeCompare(b.name || '~', undefined, { sensitivity: 'base' }));

function normalizeAthlete(a) {
  let changed = false;
  if (!Array.isArray(a.entries) || a.entries.some((e) => !e || !DISCIPLINES[e.disc])) {
    a.entries = (Array.isArray(a.entries) ? a.entries : []).filter((e) => e && DISCIPLINES[e.disc]);
    changed = true;
  }
  for (const e of a.entries) if (normalizeEntry(e)) changed = true;
  return changed;
}

// ---- Saving ---------------------------------------------------------------

let saveTimer;
function setStatus(text, kind = '') {
  const el = $('#save-status');
  if (el) {
    el.textContent = text;
    el.dataset.kind = kind;
  }
}
function scheduleSave() {
  if (state.user?.guest) {
    setStatus('Not saved: sign in to keep this', 'guest');
    return;
  }
  setStatus('Saving…');
  clearTimeout(saveTimer);
  const a = athlete();
  saveTimer = setTimeout(async () => {
    try {
      await store.saveAthlete(a);
      setStatus('All changes saved', 'ok');
    } catch (err) {
      console.error(err);
      setStatus('Could not save. Check your connection.', 'error');
    }
  }, 600);
}

// ---- Header: user + athlete picker ------------------------------------------

function renderUserArea() {
  const area = $('#user-area');
  const u = state.user;
  if (!u || u.local) {
    area.innerHTML = '';
    return;
  }
  if (u.guest) {
    area.innerHTML = `<span class="user-name">Not signed in</span>
      <button class="topbar-link" type="button" data-signin>Sign in to save</button>`;
    return;
  }
  area.innerHTML = `
    ${u.photoURL ? `<img class="avatar" src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer" />` : ''}
    <span class="user-name">${esc(u.displayName || u.email)}</span>
    <button class="topbar-link" id="signout-btn" type="button">Sign out</button>`;
  $('#signout-btn').onclick = () => store.signOut();
}

const discChip = (e) =>
  `<span class="chip chip-${e.disc}">${esc(DISCIPLINES[e.disc].name)} · ${esc(levelInfo(e.disc, e.level)?.short || '')}</span>`;

function renderAthletePicker() {
  const host = $('#athlete-picker');
  if (!host) return;
  const a = athlete();
  if (!state.user) {
    host.innerHTML = '';
    return;
  }
  const q = state.athQuery.trim().toLowerCase();
  const list = sortedAthletes().filter((x) => !q || `${x.name} ${x.club}`.toLowerCase().includes(q));
  host.innerHTML = `
    <button type="button" class="ath-button" id="ath-button" aria-haspopup="listbox" aria-expanded="${state.athOpen}">
      <span class="ath-button-text">
        <span class="ath-count">Athlete · ${state.athletes.length}</span>
        <span class="ath-current">${esc(a ? a.name || 'Unnamed athlete' : 'No athletes yet')}</span>
      </span>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    <div class="ath-pop" ${state.athOpen ? '' : 'hidden'}>
      <div class="ath-search"><input id="ath-search" type="search" placeholder="Search name or club" aria-label="Search athletes" value="${esc(state.athQuery)}" autocomplete="off" /></div>
      <div class="ath-list" role="listbox" aria-label="Athletes">
        ${list
          .map(
            (x) => `<button type="button" role="option" class="ath-option${x.id === state.athleteId ? ' active' : ''}" data-ath="${esc(x.id)}" aria-selected="${x.id === state.athleteId}">
              <span class="ath-option-top"><span class="ath-option-name">${esc(x.name || 'Unnamed athlete')}</span><span class="ath-option-club">${esc(x.club || '')}</span></span>
              <span class="chips">${x.entries.map(discChip).join('')}</span>
            </button>`
          )
          .join('')}
        ${list.length ? '' : `<p class="ath-none">${state.athletes.length ? 'No athletes match.' : 'No athletes yet.'}</p>`}
      </div>
      <div class="ath-foot"><button type="button" class="btn btn-primary btn-sm btn-block" id="ath-add">Add athlete</button></div>
    </div>`;
  $('#ath-button').onclick = () => {
    state.athOpen = !state.athOpen;
    state.athQuery = '';
    renderAthletePicker();
    if (state.athOpen) $('#ath-search')?.focus();
  };
  const search = $('#ath-search');
  if (search) {
    search.oninput = () => {
      state.athQuery = search.value;
      const pos = search.selectionStart;
      renderAthletePicker();
      const s2 = $('#ath-search');
      s2.focus();
      s2.setSelectionRange(pos, pos);
    };
    search.onkeydown = (ev) => {
      if (ev.key === 'Escape') closeAthletePicker();
      if (ev.key === 'Enter') $('.ath-option')?.click();
    };
  }
  $$('[data-ath]', host).forEach((b) => (b.onclick = () => {
    selectAthlete(b.dataset.ath);
    closeAthletePicker();
  }));
  $('#ath-add').onclick = () => {
    closeAthletePicker();
    addAthlete();
  };
}
function closeAthletePicker() {
  if (!state.athOpen) return;
  state.athOpen = false;
  renderAthletePicker();
}
document.addEventListener('mousedown', (ev) => {
  if (state.athOpen && !ev.target.closest('#athlete-picker')) closeAthletePicker();
});

function selectAthlete(id) {
  state.athleteId = id;
  state.entryId = athlete()?.entries[0]?.id || null;
  state.showAdd = !athlete()?.entries.length;
  writePref('rp-athlete', id);
  renderAll();
}

async function addAthlete() {
  const a = { id: uid(), name: '', club: athlete()?.club || '', entries: [], createdAt: Date.now() };
  state.athletes.push(a);
  state.athleteId = a.id;
  state.entryId = null;
  state.showAdd = true;
  renderAll();
  $('#f-name')?.focus();
  try {
    await store.saveAthlete(a);
  } catch (e) {
    console.error(e);
  }
}

async function removeAthlete() {
  const a = athlete();
  if (!a || !confirm(`Delete ${a.name || 'this athlete'} and all of their routines? This can't be undone.`)) return;
  await store.deleteAthlete(a.id);
  state.athletes = state.athletes.filter((x) => x.id !== a.id);
  const next = sortedAthletes()[0];
  state.athleteId = next?.id ?? null;
  state.entryId = next?.entries[0]?.id ?? null;
  renderAll();
}

// ---- Sign in ----------------------------------------------------------------

// Returns an error message, or '' when signed in (or the popup was closed).
async function signIn() {
  try {
    await store.signIn();
    return '';
  } catch (e) {
    if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') return '';
    console.error(e);
    return `Sign-in failed: ${e?.message || e}`;
  }
}

function renderSignIn() {
  app.innerHTML = '';
  app.appendChild($('#signin-tpl').content.cloneNode(true));
  $('#signin-btn').onclick = async () => {
    const err = $('#signin-error');
    err.hidden = true;
    const msg = await signIn();
    err.textContent = msg;
    err.hidden = !msg;
  };
  $('#guest-btn').onclick = () => onUser(GUEST);
}

// "Sign in to save" buttons in the top bar and the guest banner.
document.addEventListener('click', async (ev) => {
  if (!ev.target.closest('[data-signin]')) return;
  const msg = await signIn();
  if (msg) alert(msg);
});

// Guests lose everything when the page closes: ask first.
const guestHasWork = () => state.user?.guest && state.athletes.some((a) => a.name || a.entries.some(hasContent));
window.addEventListener('beforeunload', (ev) => {
  if (!guestHasWork()) return;
  ev.preventDefault();
  ev.returnValue = '';
});

// ---- Main layout -------------------------------------------------------------

function renderAll() {
  renderAthletePicker();
  const a = athlete();
  if (!a) {
    app.innerHTML = `
      <section class="page-head"><div class="page-head-inner"><p class="eyebrow">WAG · MAG · T&amp;T</p><h1>Routine planner</h1></div></section>
      <div class="wrap"><div class="card empty-editor">
        <h2>Add your first athlete</h2>
        <p>Add an athlete, choose the levels they compete, and build each routine. Start values update as you type, and you can export filled-in UCG worksheets and competition cards.</p>
        <button class="btn btn-primary" type="button" id="empty-add">Add athlete</button>
      </div></div>`;
    $('#empty-add').onclick = addAthlete;
    return;
  }
  const e = entry();
  if (e) state.entryId = e.id;
  app.innerHTML = `
    <section class="page-head">
      <div class="page-head-inner">
        <p class="eyebrow">${esc(a.club || 'Routine planner')}</p>
        <h1 id="hero-name">${esc(a.name || 'New athlete')}</h1>
      </div>
    </section>
    <div class="wrap editor" id="editor">
      <div class="editor-head">
        <div class="fields">
          <label class="field grow"><span>Gymnast name</span>
            <input id="f-name" type="text" value="${esc(a.name)}" placeholder="Name" autocomplete="off" /></label>
          <label class="field"><span>Club</span>
            <input id="f-club" type="text" value="${esc(a.club)}" placeholder="Club / school" /></label>
        </div>
        <div class="editor-actions">
          <span id="save-status" class="save-status"${state.user?.guest ? ` data-kind="guest">Not saved: sign in to keep this` : '>'}</span>
          ${e ? `<button class="btn btn-primary" type="button" id="export-all">Export PDF</button>` : ''}
          <button class="btn btn-quiet" type="button" id="delete-athlete">Delete athlete</button>
        </div>
      </div>
      ${entriesRow(a, e)}
      ${state.showAdd || !e ? addLevelPanel(a) : ''}
      ${e ? entryBody(a, e) : ''}
    </div>`;
  bindEditor(a, e);
  if (e) updateComputed();
}

function entriesRow(a, cur) {
  return `
    <div class="entries" role="tablist" aria-label="Levels">
      <span class="label">Competes in</span>
      ${a.entries
        .map(
          (e) => `<button type="button" role="tab" class="entry-tab${cur && e.id === cur.id ? ' active' : ''}" data-entry="${esc(e.id)}" aria-selected="${cur && e.id === cur.id}">
            <span class="disc-badge disc-${e.disc}">${esc(DISCIPLINES[e.disc].name)}</span><span>${esc(levelInfo(e.disc, e.level)?.name || e.level)}</span>
          </button>`
        )
        .join('')}
      <button type="button" class="entry-add" id="toggle-add" aria-expanded="${state.showAdd}">${state.showAdd && a.entries.length ? 'Close' : '+ Add level'}</button>
    </div>`;
}

function addLevelPanel(a) {
  return `
    <section class="card add-panel">
      <h2 class="card-subtitle">Add a level</h2>
      <p class="muted">Add every level you might compete. If a meet doesn't offer your usual level, add the one it does; you can copy your routines over from a level you already have.</p>
      <div class="add-grid">
        ${DISC_IDS.map((d) => {
          const D = DISCIPLINES[d];
          return `<div class="add-col">
            <div class="add-col-head"><span class="disc-badge disc-${d} lg">${esc(D.name)}</span><span class="muted">${esc(D.full)}</span></div>
            ${D.levels
              .map((l) => {
                const mine = a.entries.find((e) => e.disc === d && e.level === l.id);
                return `<button type="button" class="level-option${mine ? ' mine' : ''}" data-add="${d}:${l.id}">
                  <span>${esc(l.name)}</span>${mine ? '<span class="pill pill-navy">Added</span>' : ''}
                </button>`;
              })
              .join('')}
          </div>`;
        }).join('')}
      </div>
    </section>`;
}

function entryBody(a, e) {
  const D = DISCIPLINES[e.disc];
  const L = levelInfo(e.disc, e.level);
  const ev = currentEvent(e);
  return `
    <section class="card level-bar">
      <span class="disc-badge disc-${e.disc} xl">${esc(D.name)}</span>
      <div class="level-bar-text">
        <div class="level-name">${esc(L.name)}</div>
        <div class="muted">${esc(D.full)}</div>
      </div>
      ${L.masters ? `<label class="field inline"><span>Age decade</span>
        <select id="f-decade">${DECADES.map((d) => `<option value="${d}"${d === e.decade ? ' selected' : ''}>${DECADE_LABELS[d]}</option>`).join('')}</select></label>` : ''}
      ${a.entries.length > 1 ? `<button type="button" class="btn btn-quiet btn-sm" id="remove-entry">Remove this level</button>` : ''}
    </section>
    ${startPanel(a, e)}
    <div class="summary" id="summary" role="tablist" aria-label="Events"></div>
    ${D.events.map((x) => eventCard(e, x, x.id === ev)).join('')}`;
}

// Offered while a level is empty: copy from another level in the discipline,
// or fill every event with example routines.
function startPanel(a, e) {
  if (hasContent(e)) return '';
  const sources = a.entries.filter((x) => x.id !== e.id && x.disc === e.disc && hasContent(x));
  const examples = EXAMPLES.filter((x) => x.disc === e.disc && x.level === e.level);
  if (!sources.length && !examples.length) return '';
  return `
    <section class="card start-panel">
      <div class="start-text">
        <h2 class="card-subtitle">Start from something?</h2>
        <p class="muted">${sources.length ? `Copy every event from another ${esc(DISCIPLINES[e.disc].name)} level; values and start values are recalculated for ${esc(levelInfo(e.disc, e.level).name)}. ` : ''}${examples.length ? 'Or fill each event with an example routine, then edit it. Each event also has an Examples menu.' : ''}</p>
      </div>
      <div class="start-actions">
        ${sources.length > 1 ? `<label class="field inline"><span>Copy from</span><select id="copy-src">${sources.map((s) => `<option value="${esc(s.id)}">${esc(levelInfo(s.disc, s.level).name)}</option>`).join('')}</select></label>` : ''}
        ${sources.length ? `<button type="button" class="btn btn-primary btn-sm" id="copy-run" data-src="${esc(sources[0].id)}">${sources.length > 1 ? 'Copy routines' : `Copy from ${esc(levelInfo(sources[0].disc, sources[0].level).name)}`}</button>` : ''}
        ${examples.length ? `<button type="button" class="btn btn-ghost btn-sm" id="examples-all">Use example routines</button>` : ''}
      </div>
    </section>`;
}

const ICON_GRIP = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></svg>`;
const ICON_LINK = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>`;
const ICON_X = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
const ICON_CHEVRON = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;

// ---- Event cards ---------------------------------------------------------------

function eventCard(e, ev, visible) {
  const spec = eventSpec(e, ev.id);
  const examples = EXAMPLES.filter((x) => x.disc === e.disc && x.level === e.level && x.event === ev.id);
  return `
    <article class="card event-card" data-event-card="${ev.id}" id="panel-${ev.id}" role="tabpanel" aria-labelledby="tab-${ev.id}" ${visible ? '' : 'hidden'}>
      <header class="card-head">
        <h2 class="card-title">${esc(ev.label)}</h2>
        <div class="card-head-right">
          ${examples.length ? `<label class="examples-menu"><span class="sr-only">Insert an example routine</span>
            <select data-example="${ev.id}"><option value="">Examples…</option>${examples.map((x) => `<option value="${esc(x.id)}">${esc(x.title)}</option>`).join('')}</select></label>` : ''}
          <span class="sv-pill" data-sv="${ev.id}"></span>
          ${ev.kind !== 'vault' || ['infinity', 'xcel'].includes(spec.family) ? `<button class="btn btn-ghost btn-sm" type="button" data-export="${ev.id}">Export PDF</button>` : ''}
        </div>
      </header>
      ${ev.kind === 'vault' ? vaultBody(e, ev, spec) : ev.kind === 'passes' ? passesBody(e, ev) : routineBody(e, ev, spec)}
      ${spec.sr ? srList(e, ev, spec) : ''}
      ${spec.options.map((o) => optionControl(e, ev.id, o)).join('')}
      <div class="event-foot">
        ${spec.legend.length ? `<ul class="cg-list">${spec.legend.map((g) => `<li data-cg="${g.key}"><span class="cg-badge">${g.roman}</span><span>${esc(g.label)}</span></li>`).join('')}</ul>` : ''}
        <dl class="totals" data-totals="${ev.id}"></dl>
        <div class="foot-notes" data-notes="${ev.id}"></div>
      </div>
    </article>`;
}

function routineHelp(e, ev, spec) {
  if (spec.columns === 'dd') return 'List the routine in order. Search the T&T skill list (it fills in the FIG shorthand and DD), or type your own skill and its DD.';
  if (spec.family === 'xcel') return `List the routine in order. Search the Xcel skill list (it fills in the value), or type your own skill and pick its value. The planner checks the value parts and restricted skills for ${esc(levelInfo(e.disc, e.level).name)}, and you tick the special requirements below. An element earns credit at most twice, the second time only in a different connection${spec.links ? `: mark connected skills with <span class="grip-inline">${ICON_LINK}</span> between rows` : ''}.`;
  const max = spec.maxCounting;
  const more = e.disc === 'mag' ? ', with at most 4 from one element group' : '';
  return `List the whole routine in order, and drag <span class="grip-inline">${ICON_GRIP}</span> to reorder. <strong>Each skill counts only once</strong>. Your ${max} highest-value skills count toward difficulty${more}. Counting skills are highlighted; repeats and non-counting skills are shaded gray and flagged.`;
}

function routineBody(e, ev, spec) {
  const rows = e.routines[ev.id];
  return `
    <p class="routine-help">${routineHelp(e, ev, spec)}</p>
    ${ev.synchro ? `<label class="field inline partner"><span>Synchro partner</span><input type="text" data-partner="${ev.id}" value="${esc(e.options?.[ev.id]?.partner || '')}" placeholder="Partner's name" /></label>` : ''}
    <div class="skill-table" data-routine="${ev.id}">${rowsMarkup(e, ev, spec, rows, null)}</div>
    <div class="routine-actions">
      <button class="btn btn-ghost btn-sm" type="button" data-add-skill="${ev.id}">Add skill</button>
      <span class="routine-count" data-calc="count"></span>
    </div>`;
}

function passesBody(e, ev) {
  const spec = eventSpec(e, ev.id);
  return `
    <p class="routine-help">${ev.id === 'dmt' ? 'Two passes of two skills: a mounter or spotter, then a dismount. A mounter is done from the angled bed onto the flat bed; a spotter comes after a straight jump onto the flat bed, taking off and landing there. A skill repeated in the same position gets no difficulty.' : 'Two passes. Search the T&T skill list or type your own skill and its DD.'}</p>
    ${[0, 1]
      .map(
        (p) => `<div class="pass" data-pass-block="${p}">
          <div class="pass-head"><h3>Pass ${p + 1}</h3>${ev.id === 'dmt' ? startSelect(e, p) : ''}<span class="pass-dd" data-pass-dd="${p}"></span></div>
          <div class="skill-table" data-routine="${ev.id}" data-pass="${p}">${rowsMarkup(e, ev, spec, e.passes[ev.id][p].skills, p)}</div>
          ${ev.id === 'tu' ? `<div class="routine-actions"><button class="btn btn-ghost btn-sm" type="button" data-add-skill="${ev.id}" data-pass="${p}">Add skill</button></div>` : ''}
        </div>`
      )
      .join('')}`;
}

// Double mini: the first skill of a pass is a mounter or a spotter. A repeat only
// loses its difficulty in the same position.
function startSelect(e, p) {
  const v = e.passes.dmt[p].start || 'mounter';
  return `<label class="pass-start"><span class="sr-only">Pass ${p + 1} first skill</span>
    <select data-start="${p}">${['mounter', 'spotter'].map((x) => `<option value="${x}"${x === v ? ' selected' : ''}>${x === 'mounter' ? 'Mounter' : 'Spotter'} first</option>`).join('')}</select></label>`;
}

function headCells(spec) {
  if (spec.columns === 'dd') return `<span class="col-num">#</span><span class="col-name">Skill</span><span class="col-letter">Shorthand</span><span class="col-eg">DD</span><span></span>`;
  if (spec.columns === 'xcel') return `<span class="col-num">#</span><span class="col-name">Skill</span><span class="col-letter">Value</span><span class="col-value">VP</span><span></span>`;
  return `<span class="col-num">#</span><span class="col-name">Skill</span><span class="col-letter">Diff.</span><span class="col-eg">Element group</span><span class="col-value">Value</span><span class="col-bonus">EG bonus</span><span></span>`;
}

function rowsMarkup(e, ev, spec, rows, pass) {
  const cls = spec.columns === 'dd' ? ' dd' : spec.columns === 'xcel' ? ' xcel' : '';
  return `<div class="skill-row skill-head${cls}" aria-hidden="true">${headCells(spec)}</div>${rows.map((s, i) => skillRow(e, ev, spec, i, s, pass)).join('')}`;
}

function skillRow(e, ev, spec, i, s, pass) {
  const label = `${pass != null ? `Pass ${pass + 1} skill` : 'Skill'} ${i + 1}`;
  const data = `data-ev="${ev.id}" data-idx="${i}"${pass != null ? ` data-pass="${pass}"` : ''}`;
  const dd = spec.columns === 'dd';
  const cls = dd ? ' dd' : spec.columns === 'xcel' ? ' xcel' : '';
  const combo = `
    <span class="col-name skill-combo">
      <input class="skill-input" type="text" placeholder="Search or type a skill" aria-label="${label} name"
        role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="skill-pop" autocomplete="off"
        ${data} data-field="name" value="${esc(s.name)}" />
      <span class="src-badge" data-calc="src"></span>
      <button type="button" class="combo-toggle" ${data} data-combo tabindex="-1" aria-label="Show ${label} skill list">${ICON_CHEVRON}</button>
    </span>`;
  const handle = `<span class="col-num">
      <button type="button" class="drag-handle" ${data} data-drag aria-label="Move ${label}. Drag, or use the up and down arrow keys." title="Drag to reorder">${ICON_GRIP}</button>
      <span class="num">${i + 1}</span></span>`;
  const remove = `<button type="button" class="remove-skill" ${data} data-remove aria-label="Remove ${label}" title="Remove skill">${ICON_X}</button>`;
  if (dd) {
    return `<div class="skill-row${cls}" data-row="${i}">${handle}${combo}
      <input class="col-letter" type="text" aria-label="${label} shorthand" ${data} data-field="notation" value="${esc(s.notation)}" placeholder="Shorthand" />
      <input class="col-eg" type="number" inputmode="decimal" step="0.1" min="0" aria-label="${label} DD" ${data} data-field="dd" value="${esc(s.dd)}" placeholder="DD" />
      ${remove}<span class="row-flag" data-calc="flag"></span></div>`;
  }
  const letters = `<select class="col-letter" aria-label="${label} difficulty" ${data} data-field="letter">
      <option value="">–</option>${spec.letters.map((l) => `<option${l === s.letter ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  if (spec.columns === 'xcel') {
    // Beam / floor: connected to the next skill (sits on the line between the two rows).
    const link = spec.links
      ? `<button type="button" class="link-toggle" ${data} data-link aria-pressed="${!!s.link}" aria-label="${label} connected to the next skill" title="${s.link ? 'Connected to the next skill (click to separate)' : 'Not connected to the next skill (click to connect)'}">${ICON_LINK}</button>`
      : '';
    return `<div class="skill-row${cls}${s.link ? ' linked' : ''}" data-row="${i}">${handle}${combo}${letters}
      <span class="col-value calc" data-calc="value"></span>${remove}<span class="row-flag" data-calc="flag"></span>${link}</div>`;
  }
  const eg = spec.groups
    ? `<select class="col-eg" aria-label="${label} element group" ${data} data-field="eg">
        <option value="">EG –</option>${spec.groups.map((g) => `<option value="${g.value}"${String(g.value) === String(s.eg) ? ' selected' : ''}>${esc(g.label)}</option>`).join('')}</select>`
    : '<span class="col-eg"></span>';
  return `<div class="skill-row${cls}" data-row="${i}">${handle}${combo}${letters}${eg}
    <span class="col-value calc" data-calc="value"></span><span class="col-bonus calc" data-calc="bonus"></span>
    ${remove}<span class="row-flag" data-calc="flag"></span></div>`;
}

function srList(e, ev, spec) {
  const met = e.options?.[ev.id]?.sr || [];
  return `
    <fieldset class="sr-list">
      <legend>Special requirements <span class="muted">(−0.50 each one missing)</span></legend>
      ${spec.sr.map((t, i) => `<label class="sr-item"><input type="checkbox" data-sr="${ev.id}" data-sr-idx="${i}"${met[i] ? ' checked' : ''} /><span><strong>SR ${i + 1}.</strong> ${esc(t)}</span></label>`).join('')}
    </fieldset>`;
}

function optionControl(e, evId, o) {
  const v = e.options?.[evId]?.[o.id];
  const data = `data-option="${evId}" data-opt="${o.id}"`;
  let control;
  if (o.kind === 'count') {
    control = `<select ${data} aria-label="${esc(o.label)}">${Array.from({ length: o.max + 1 }, (_, n) => `<option value="${n}"${Number(v || 0) === n ? ' selected' : ''}>${o.id === 'bonus' ? `+${(n / 10).toFixed(1)}` : n}</option>`).join('')}</select>`;
  } else if (o.kind === 'mushroom') {
    control = `<select ${data} aria-label="${esc(o.label)}">${Array.from({ length: 11 }, (_, n) => {
      const x = n / 10;
      return `<option value="${x}"${Number(v || 0) === x ? ' selected' : ''}>+${x.toFixed(1)}</option>`;
    }).join('')}</select>`;
  } else {
    control = `<input type="checkbox" ${data}${v ? ' checked' : ''} />`;
  }
  const leading = o.kind === 'check';
  return `
    <label class="event-bonus${o.deduction ? ' requirement' : ''}" data-option-row="${evId}:${o.id}">
      ${leading ? control : ''}
      <span class="event-bonus-text"><strong>${esc(o.label)}</strong><span data-help>${esc(o.help)}</span></span>
      ${leading ? '' : control}
      <span class="event-bonus-value calc" data-calc="opt-${o.id}"></span>
    </label>`;
}

function vaultBody(e, ev) {
  const fam = levelInfo(e.disc, e.level).family;
  let control = '';
  if (fam === 'mag') {
    const groups = {};
    for (const v of MAG_VAULTS) (groups[v.eg] ||= []).push(v);
    const opts = Object.entries(groups)
      .map(([eg, list]) => `<optgroup label="${eg ? `WG element group ${esc(eg)}` : 'UCG Code of Points'}">${list
        .map((v) => {
          const banned = e.level === 'dev' && v.flipping;
          const dv = e.level === 'adv' ? v.adv : v.value;
          const name = `${v.src === 'WG' ? `${v.id} · ` : ''}${v.name}${v.eponym ? ` (${v.eponym})` : ''}`;
          return `<option value="${esc(v.id)}"${v.id === String(e.vault) ? ' selected' : ''}>${esc(name)} — ${banned ? 'not allowed' : fmt(dv)}</option>`;
        })
        .join('')}</optgroup>`)
      .join('');
    const masters = e.level === 'masters'
      ? `<option value="other"${e.vault === 'other' ? ' selected' : ''}>${esc(OTHER_VAULT.name)} — 0.0</option>
         <optgroup label="UCG Masters vaults">${MAG_MASTERS_VAULTS.map((v) => `<option value="${esc(v.id)}"${v.id === e.vault ? ' selected' : ''}>${esc(v.name)} — ${fmt(v.value)}</option>`).join('')}</optgroup>`
      : '';
    control = `<select id="f-vault"><option value="">— No vault —</option>${masters}${opts}</select>`;
  } else if (fam === 'infinity') {
    const groups = {};
    for (const v of INFINITY_VAULT_LIST) (groups[v.entry] ||= []).push(v);
    control = `<select id="f-vault"><option value="">— No vault —</option>${Object.entries(groups)
      .map(([g, list]) => `<optgroup label="${esc(g)}">${list.map((v) => `<option value="${esc(v.name)}"${v.name === e.vault ? ' selected' : ''}>${esc(v.name)} (${fmt(v.dv)})</option>`).join('')}</optgroup>`)
      .join('')}</select>`;
  } else if (fam === 'xcel') {
    const opt = (v) => `<option value="${esc(v.id)}"${v.id === e.vault ? ' selected' : ''}>${esc(v.label)} — ${fmt(v.sv)}</option>`;
    const list = xcelVaults(e.level);
    const l910 = list.filter((v) => v.l910);
    control = `<select id="f-vault"><option value="">— No vault —</option>${
      l910.length
        ? `<optgroup label="Xcel Sapphire vault chart">${list.filter((v) => !v.l910).map(opt).join('')}</optgroup><optgroup label="USAG Level 9/10 vaults (10.0 at UCG Sapphire)">${l910.map(opt).join('')}</optgroup>`
        : list.map(opt).join('')
    }</select>`;
  } else if (fam === 'wagMasters') {
    const opt = (v) => `<option value="${esc(v.id)}"${v.id === e.vault ? ' selected' : ''}>${esc(v.src === 'WG' ? `${v.id} · ` : '')}${esc(v.name)}${v.eponym ? ` (${esc(v.eponym)})` : ''} — ${fmt(v.value)}</option>`;
    const groups = {};
    for (const v of WAG_WG_VAULTS) (groups[v.eg] ||= []).push(v);
    control = `<select id="f-vault"><option value="">— No vault —</option>${opt(WAG_OTHER_VAULT)}
      <optgroup label="UCG Masters vaults">${WAG_MASTERS_VAULTS.map(opt).join('')}</optgroup>
      ${Object.entries(groups).map(([g, list]) => `<optgroup label="WG vault group ${esc(g)}">${list.map(opt).join('')}</optgroup>`).join('')}</select>`;
  }
  return `
    <div class="vault-body">
      <label class="field grow"><span>Select your vault</span>${control}</label>
      <dl class="vault-info" id="vault-info"></dl>
    </div>
    ${fam === 'xcel' && e.level === 'gold' ? optionControl(e, 'vt', { id: 'altBoard', kind: 'check', label: 'Alternative springboard (mini-trampoline)', help: '9.5 start value if used' }) : ''}
    ${levelInfo(e.disc, e.level).masters ? `<p class="routine-help">Your decade's age bonus is added to the vault's value. A vault that isn't in the WG or UCG Code of Points is worth 0.0 plus the age bonus.</p>` : ''}`;
}

// ---- Binding ---------------------------------------------------------------

function bindEditor(a, e) {
  const name = $('#f-name');
  name.oninput = () => {
    a.name = name.value;
    $('#hero-name').textContent = a.name || 'New athlete';
    renderAthletePicker();
    scheduleSave();
  };
  $('#f-club').oninput = (ev) => {
    a.club = ev.target.value;
    renderAthletePicker();
    scheduleSave();
  };
  $('#delete-athlete').onclick = removeAthlete;
  $('#toggle-add').onclick = () => {
    state.showAdd = !state.showAdd;
    renderAll();
  };
  $$('[data-entry]').forEach((b) => (b.onclick = () => {
    state.entryId = b.dataset.entry;
    state.showAdd = false;
    renderAll();
  }));
  $$('[data-add]').forEach((b) => (b.onclick = () => {
    const [d, l] = b.dataset.add.split(':');
    const have = a.entries.find((x) => x.disc === d && x.level === l);
    if (have) state.entryId = have.id;
    else {
      const ne = newEntry(uid(), d, l);
      a.entries.push(ne);
      state.entryId = ne.id;
      scheduleSave();
    }
    state.showAdd = false;
    renderAll();
  }));
  if (!e) return;

  $('#export-all').onclick = (ev) => runExport(ev.currentTarget, DISCIPLINES[e.disc].events.map((x) => x.id));
  $('#remove-entry')?.addEventListener('click', () => {
    if (hasContent(e) && !confirm(`Remove ${entryName(e)} and its routines?`)) return;
    a.entries = a.entries.filter((x) => x.id !== e.id);
    state.entryId = a.entries[0]?.id || null;
    scheduleSave();
    renderAll();
  });
  $('#f-decade')?.addEventListener('change', (ev) => {
    e.decade = ev.target.value;
    scheduleSave();
    updateComputed();
  });
  const copySrc = $('#copy-src');
  if (copySrc) copySrc.onchange = () => ($('#copy-run').dataset.src = copySrc.value);
  $('#copy-run')?.addEventListener('click', (ev) => {
    const src = a.entries.find((x) => x.id === ev.currentTarget.dataset.src);
    if (!src) return;
    copyRoutines(src, e);
    scheduleSave();
    renderAll();
  });
  $('#examples-all')?.addEventListener('click', () => {
    for (const x of DISCIPLINES[e.disc].events) {
      const ex = EXAMPLES.find((y) => y.disc === e.disc && y.level === e.level && y.event === x.id);
      if (ex) applyExample(e, ex);
    }
    scheduleSave();
    renderAll();
  });

  const ed = $('#editor');
  ed.oninput = onInput;
  ed.onchange = onChange;
  ed.onclick = onClick;
  ed.onkeydown = onKey;
  ed.onpointerdown = onPointerDown;
  ed.onmousedown = (ev) => ev.target.closest('[data-combo]') && ev.preventDefault();
  ed.onfocusout = (ev) => ev.target === picker.input && closePicker();
  $$('[data-export]').forEach((b) => (b.onclick = () => runExport(b, [b.dataset.export])));
}

function rowsOf(e, evId, pass) {
  return pass == null || pass === '' ? e.routines[evId] : e.passes[evId][Number(pass)].skills;
}

function onInput(ev) {
  const t = ev.target;
  const e = entry();
  if (t.dataset.option) {
    const opts = ((e.options ||= {})[t.dataset.option] ||= {});
    opts[t.dataset.opt] = t.type === 'checkbox' ? t.checked : Number(t.value);
  } else if (t.dataset.sr) {
    const opts = ((e.options ||= {})[t.dataset.sr] ||= {});
    const sr = [...(opts.sr || [])];
    sr[Number(t.dataset.srIdx)] = t.checked;
    opts.sr = sr;
  } else if (t.dataset.partner) {
    ((e.options ||= {})[t.dataset.partner] ||= {}).partner = t.value;
  } else if (t.dataset.ev && t.dataset.field) {
    const row = rowsOf(e, t.dataset.ev, t.dataset.pass)[Number(t.dataset.idx)];
    row[t.dataset.field] = t.dataset.field === 'dd' ? (t.value === '' ? '' : Number(t.value)) : t.value;
    if (['letter', 'eg', 'dd'].includes(t.dataset.field)) delete row.fromList; // chosen by hand: filters the list
    // A skill from the list has its own value and group: changing them means a different skill.
    if (['letter', 'eg'].includes(t.dataset.field) && row.skillId) return clearListedSkill(t, row);
    if (t.dataset.field === 'name') {
      if (row.skillId && findSkill(row.skillId)?.label !== t.value) delete row.skillId;
      openPicker(t, t.value);
    }
  } else return;
  updateComputed();
  scheduleSave();
}

// The value or group of a skill picked from the list was changed: clear the skill and
// open the list, narrowed to skills with the new values, so the gymnast picks the right one.
function clearListedSkill(t, row) {
  const e = entry();
  const evId = t.dataset.ev;
  const pass = t.dataset.pass;
  const idx = Number(t.dataset.idx);
  row.name = '';
  delete row.skillId;
  delete row.fromList;
  if (e.disc === 'tt') row.notation = '';
  renderRows(evId, pass, { row: idx, part: 'name' });
  const input = $(`[data-routine="${evId}"]${pass != null && pass !== '' ? `[data-pass="${pass}"]` : ''} [data-row="${idx}"] .skill-input`);
  if (input) {
    picker.notice = 'Skill cleared because its value changed. Please select a new skill.';
    openPicker(input, '');
  }
  scheduleSave();
}

function onChange(ev) {
  const t = ev.target;
  const e = entry();
  // T&T: a new DD for a skill from the list (checked once the number is entered, not per keystroke).
  if (t.dataset.field === 'dd' && t.dataset.ev) {
    const row = rowsOf(e, t.dataset.ev, t.dataset.pass)[Number(t.dataset.idx)];
    const listed = row?.skillId && findSkill(row.skillId);
    if (listed && Number(listed.dd) !== Number(row.dd)) return clearListedSkill(t, row);
  }
  if (t.id === 'f-vault') {
    e.vault = t.value;
    updateComputed();
    scheduleSave();
  } else if (t.dataset.start) {
    e.passes.dmt[Number(t.dataset.start)].start = t.value;
    updateComputed();
    scheduleSave();
  } else if (t.dataset.example) {
    const ex = EXAMPLES.find((x) => x.id === t.value);
    t.value = '';
    if (!ex) return;
    const hasSkills = ex.event === 'vt' ? !!e.vault : rowsFilled(e, ex.event);
    if (hasSkills && !confirm(`Replace this ${eventInfo(e.disc, ex.event).label.toLowerCase()} routine with “${ex.title}”?`)) return;
    applyExample(e, ex);
    scheduleSave();
    renderAll();
  }
}

function rowsFilled(e, evId) {
  const ev = eventInfo(e.disc, evId);
  if (ev.kind === 'passes') return e.passes[evId].some((p) => p.skills.some((s) => s.name || s.notation));
  return (e.routines[evId] || []).some((s) => s.name || s.letter || s.notation);
}

function onClick(ev) {
  const e = entry();
  const toggle = ev.target.closest('[data-combo]');
  if (toggle) {
    const input = $('.skill-input', toggle.closest('.skill-combo'));
    if (picker.input === input) closePicker();
    else {
      input.focus();
      openPicker(input, '');
    }
    return;
  }
  const add = ev.target.closest('[data-add-skill]');
  if (add) {
    const evId = add.dataset.addSkill;
    const list = rowsOf(e, evId, add.dataset.pass);
    if (list.length >= MAX_ROWS) return;
    list.push(e.disc === 'tt' ? blankTT() : blankSkill());
    renderRows(evId, add.dataset.pass, { row: list.length - 1, part: 'name' });
    scheduleSave();
    return;
  }
  const link = ev.target.closest('[data-link]');
  if (link) {
    const row = rowsOf(e, link.dataset.ev, link.dataset.pass)[Number(link.dataset.idx)];
    row.link = !row.link;
    link.setAttribute('aria-pressed', row.link);
    link.title = row.link ? 'Connected to the next skill (click to separate)' : 'Not connected to the next skill (click to connect)';
    link.closest('.skill-row').classList.toggle('linked', row.link);
    updateComputed();
    scheduleSave();
    return;
  }
  const remove = ev.target.closest('[data-remove]');
  if (remove) {
    const list = rowsOf(e, remove.dataset.ev, remove.dataset.pass);
    const i = Number(remove.dataset.idx);
    list.splice(i, 1);
    normalizeEntry(e);
    renderRows(remove.dataset.ev, remove.dataset.pass, { row: Math.min(i, list.length - 1), part: 'name' });
    scheduleSave();
  }
}

// Re-draw one routine (after add / remove / reorder / pick) and focus a row.
function renderRows(evId, pass, focus) {
  const e = entry();
  const ev = eventInfo(e.disc, evId);
  const spec = eventSpec(e, evId);
  closePicker();
  const sel = `[data-routine="${evId}"]${pass != null && pass !== '' ? `[data-pass="${pass}"]` : ''}`;
  $(sel).innerHTML = rowsMarkup(e, ev, spec, rowsOf(e, evId, pass), pass != null && pass !== '' ? Number(pass) : null);
  updateComputed();
  if (focus) {
    const row = $(`${sel} [data-row="${focus.row}"]`);
    $(focus.part === 'handle' ? '.drag-handle' : '.skill-input', row)?.focus();
  }
}

function moveSkill(evId, pass, from, to, focusPart) {
  const list = rowsOf(entry(), evId, pass);
  if (to < 0 || to >= list.length || to === from) return;
  const [s] = list.splice(from, 1);
  list.splice(to, 0, s);
  renderRows(evId, pass, { row: to, part: focusPart });
  scheduleSave();
}

function onKey(ev) {
  if (ev.target.classList.contains('skill-input')) return onPickerKey(ev);
  const h = ev.target.closest('.drag-handle');
  if (!h || (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown')) return;
  ev.preventDefault();
  const from = Number(h.dataset.idx);
  moveSkill(h.dataset.ev, h.dataset.pass, from, from + (ev.key === 'ArrowUp' ? -1 : 1), 'handle');
}

// Drag to reorder: pointer events, so it works with a mouse and on touch screens.
function onPointerDown(ev) {
  const handle = ev.target.closest('.drag-handle');
  if (!handle || ev.button > 0) return;
  ev.preventDefault();
  const evId = handle.dataset.ev;
  const pass = handle.dataset.pass;
  const from = Number(handle.dataset.idx);
  const container = handle.closest('.skill-table');
  const rows = $$('.skill-row[data-row]', container);
  const dragged = rows[from];
  const others = rows.filter((r) => r !== dragged);
  const mids = others.map((r) => {
    const b = r.getBoundingClientRect();
    return b.top + scrollY + b.height / 2;
  });
  const startY = ev.clientY + scrollY;
  let to = from;
  // While dragging, the other rows slide aside to open a gap where the skill will
  // land, and every row's number shows its new position.
  const nums = rows.map((r) => $('.num', r));
  const next = rows[from + 1] || rows[from - 1];
  const gap = next ? Math.abs(next.getBoundingClientRect().top - dragged.getBoundingClientRect().top) - dragged.offsetHeight : 0;
  const step = dragged.offsetHeight + Math.max(0, gap);
  dragged.classList.add('dragging');
  container.classList.add('reordering');
  const move = (m) => {
    if (m.clientY < 90) scrollBy(0, -12);
    else if (m.clientY > innerHeight - 60) scrollBy(0, 12);
    const y = m.clientY + scrollY;
    dragged.style.transform = `translateY(${y - startY}px)`;
    const t = mids.filter((mid) => mid < y).length;
    if (t === to) return;
    to = t;
    rows.forEach((r, k) => {
      if (r === dragged) return void (nums[k].textContent = to + 1);
      const shift = k > from && k <= to ? -1 : k < from && k >= to ? 1 : 0;
      r.style.transform = shift ? `translateY(${shift * step}px)` : '';
      nums[k].textContent = k + shift + 1;
    });
  };
  const end = (ev) => {
    removeEventListener('pointermove', move);
    removeEventListener('pointerup', end);
    removeEventListener('pointercancel', end);
    container.classList.remove('reordering');
    rows.forEach((r, k) => {
      r.style.transform = '';
      nums[k].textContent = k + 1;
    });
    dragged.classList.remove('dragging');
    if (ev.type === 'pointerup' && to !== from) moveSkill(evId, pass, from, to, 'handle');
  };
  addEventListener('pointermove', move);
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);
}

// ---- Score explanations (the (i) next to each score component) ---------------------
// Brief, like the notes on the MAG start value worksheets.

const ICON_INFO = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r="0.6" fill="currentColor"/></svg>`;
const infoButton = (label, tip) => `<button type="button" class="info-tip" data-tip="${esc(tip)}" aria-label="About ${esc(label)}: ${esc(tip)}">${ICON_INFO}</button>`;

function scoreTip(e, ev, label) {
  const L = levelInfo(e.disc, e.level);
  const fam = L.family;
  const lvl = e.level;
  const decade = e.decade ? `${DECADE_LABELS[e.decade]} ` : '';
  if (e.disc === 'tt') {
    if (label === 'Total DD') return ev.kind === 'passes' ? 'Both passes added together.' : 'The DD of every skill added together. A repeated skill earns no DD.';
    if (/^Pass \d DD$/.test(label)) return 'The DD of the skills in this pass. A skill repeated in the same position earns none.';
  }
  if (ev.kind === 'vault') {
    if (label === 'Execution') return 'Every vault starts from 10.0 for execution.';
    if (label === 'D score') return "The vault's difficulty value from the vault table.";
    if (label === 'Age bonus') return `Masters: added by age decade (${decade}gymnasts get +${fmt(vaultAgeBonus(e.disc, e.decade))}).`;
    if (label === 'Start value') return fam === 'xcel' ? "From the Xcel vault chart for this level." : 'Execution + D score' + (L.masters ? ' + age bonus.' : '.');
    return '';
  }
  const tips = {
    Execution: 'Every routine starts from 10.0 for execution.',
    'Start value': 'The sum of the parts to the left.',
  };
  if (fam === 'mag') {
    const max = mag.LEVELS[lvl].maxSkills;
    Object.assign(tips, {
      Difficulty: L.masters
        ? `Your 6 highest-value skills, valued for ${decade}gymnasts (an A is worth ${fmt(mastersValue('A', e.decade))}).`
        : `Your ${max} highest-value skills: A 0.1, B 0.2, C 0.3 and so on. At most 4 count from one element group.`,
      'EG bonus': {
        dev: '+0.5 for each element group with a counting skill, up to 3 groups (+1.5).',
        int: 'EG I: +0.5. EG II-IV: +0.5 with a B or higher, +0.3 with an A.',
        adv: 'EG I: +0.5. Other groups: +0.5 for D or higher, +0.4 for C, +0.3 for A or B. The dismount group is worth the dismount\'s value (max 0.5).',
        masters: "+0.5 for each group I-III with a skill at your decade's level. The dismount group is worth the dismount's value.",
      }[lvl],
      'Other bonus': 'Connection and event bonuses, from the options below.',
      [`Short of ${mag.MIN_SKILLS}`]: `-${fmt(mag.LEVELS[lvl].shortDeduction)} for each skill fewer than ${mag.MIN_SKILLS}.`,
      'Start value': mag.LEVELS[lvl].cap ? `The sum of the parts to the left, capped at ${fmt(mag.LEVELS[lvl].cap)} (the cap applies before the short-routine deduction).` : tips['Start value'],
    });
  } else if (fam === 'infinity') {
    Object.assign(tips, {
      Difficulty: 'Your 8 highest-value skills: A 0.1, B 0.3, C 0.5, D 0.7, E 0.9.',
      'EG bonus': '+0.3 for each condensed group (I-IV) with a B or higher skill, counting or not.',
      'Apparatus bonus': 'One-time +0.3 event bonus, from the option below.',
      'Short of 6': '-1.0 for each skill fewer than 6.',
    });
  } else if (fam === 'wagMasters') {
    Object.assign(tips, {
      Difficulty: `Your 6 highest-value skills, valued for ${decade}gymnasts (an A is worth ${fmt(mastersValue('A', e.decade))}).`,
      'EG bonus': "+0.5 for each condensed group (I-IV) with a skill at your decade's level, counting or not (max +2.0).",
      'Short of 6': '-1.0 for each skill fewer than 6.',
    });
  } else if (fam === 'xcel') {
    Object.assign(tips, {
      Start: lvl === 'sapphire' ? 'Sapphire starts from 9.6, plus up to 0.4 bonus.' : 'Every routine starts from 10.0.',
      Bonus: 'Sapphire: up to +0.4 connection or difficulty bonus, from the option below.',
      'Missing SRs': '-0.50 for each special requirement not ticked.',
      'Missing VPs': 'Each required value part not covered costs its value: A 0.1, B 0.3, C 0.5. A higher skill can fill a lower value part.',
      Restricted: "-0.50 for each skill above this level's allowed difficulty (it earns no value part).",
    });
  }
  return tips[label] || '';
}

// One floating bubble: hover or focus shows it; a tap toggles it (phones).
const tipEl = document.createElement('div');
tipEl.className = 'tip-bubble';
tipEl.setAttribute('role', 'tooltip');
tipEl.hidden = true;
document.body.appendChild(tipEl);
let tipFor = null;
function showTip(btn) {
  tipFor = btn;
  tipEl.textContent = btn.dataset.tip;
  tipEl.hidden = false;
  const r = btn.getBoundingClientRect();
  const w = Math.min(260, innerWidth - 16);
  tipEl.style.maxWidth = `${w}px`;
  const left = Math.min(Math.max(8, r.left + r.width / 2 - tipEl.offsetWidth / 2), innerWidth - tipEl.offsetWidth - 8);
  const above = r.top - tipEl.offsetHeight - 8;
  tipEl.style.left = `${left}px`;
  tipEl.style.top = `${above > 8 ? above : r.bottom + 8}px`;
}
function hideTip() {
  tipFor = null;
  tipEl.hidden = true;
}
document.addEventListener('mouseover', (ev) => {
  const b = ev.target.closest('[data-tip]');
  if (b && b !== tipFor) showTip(b);
  else if (!b && tipFor && matchMedia('(hover: hover)').matches) hideTip();
});
document.addEventListener('focusin', (ev) => ev.target.matches?.('[data-tip]') && showTip(ev.target));
document.addEventListener('focusout', (ev) => ev.target === tipFor && hideTip());
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-tip]');
  if (b) {
    if (tipFor === b && !matchMedia('(hover: hover)').matches) hideTip();
    else showTip(b);
  } else if (tipFor) hideTip();
});
addEventListener('scroll', () => tipFor && hideTip(), true);

// ---- Skill picker --------------------------------------------------------------
// Typing in a skill name (or clicking its arrow) opens a list of skills for the
// apparatus; picking one fills in the name and its value / EG (or shorthand / DD).
// Anything else typed is kept as a custom skill with values set by hand.

const picker = { el: null, input: null, items: [], active: -1 };
const SRC_LABEL = { UCG: 'UCG Code of Points', WG: 'World Gymnastics Code of Points', USAG: 'USAG Xcel / Development Program values' };

function pickerEl() {
  if (!picker.el) {
    const el = document.createElement('div');
    el.id = 'skill-pop';
    el.className = 'skill-pop';
    el.setAttribute('role', 'listbox');
    el.setAttribute('aria-label', 'Skills');
    el.hidden = true;
    el.addEventListener('mousedown', (e) => e.preventDefault());
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-show-all]')) {
        picker.showAll = true;
        openPicker(picker.input, picker.input.value);
        return;
      }
      const o = e.target.closest('[data-skill]');
      if (o) pickSkill(Number(o.dataset.skill));
    });
    document.body.appendChild(el);
    addEventListener('resize', placePicker);
    addEventListener('scroll', placePicker, true);
    // Phones: the on-screen keyboard shrinks the visible area (the visual viewport).
    window.visualViewport?.addEventListener('resize', () => {
      makeRoom();
      placePicker();
    });
    window.visualViewport?.addEventListener('scroll', placePicker);
    picker.el = el;
  }
  return picker.el;
}

const searchApp = (e, evId) => (e.disc === 'tt' && evId === 'sy' ? 'tr' : evId);

// A difficulty, element group or DD the gymnast chose by hand (not filled in by
// picking a skill) narrows the list to skills that match it.
function presetFilter(e, input) {
  const evId = input.dataset.ev;
  const row = rowsOf(e, evId, input.dataset.pass)[Number(input.dataset.idx)];
  if (!row || row.fromList) return null;
  const fam = levelInfo(e.disc, e.level).family;
  const tests = [];
  const labels = [];
  if (e.disc === 'tt') {
    if (row.dd !== '' && row.dd != null) {
      tests.push((s) => Number(s.dd) === Number(row.dd));
      labels.push(`DD ${fmt(row.dd)}`);
    }
  } else {
    if (row.letter) {
      tests.push((s) => s.value === row.letter);
      labels.push(row.letter === 'ME' ? 'Masters Element' : row.letter);
    }
    if (row.eg) {
      const eg = String(row.eg);
      if (fam === 'mag') tests.push((s) => String(s.eg) === eg);
      else if (fam === 'infinity') tests.push((s) => String(s.group) === eg);
      else if (fam === 'wagMasters') tests.push((s) => String(WG_TO_MASTERS[evId]?.[s.group]) === eg);
      if (fam !== 'xcel') labels.push(fam === 'infinity' ? `group ${eg}` : `EG ${ROMAN[eg] || eg}`);
    }
  }
  return tests.length ? { test: (s) => tests.every((t) => t(s)), label: labels.join(' · ') } : null;
}

function openPicker(input, query) {
  const e = entry();
  const el = pickerEl();
  if (picker.input !== input) {
    picker.showAll = false;
    picker.input = input;
    makeRoom();
  }
  const fam = levelInfo(e.disc, e.level).family;
  const all = searchSkills(e.disc, searchApp(e, input.dataset.ev), query).filter((s) => e.disc !== 'wag' || wagSkillAllowed(fam, e.level, s));
  const filter = presetFilter(e, input);
  picker.filter = filter && !picker.showAll ? filter : null;
  picker.hidden = picker.filter ? all.length - all.filter(picker.filter.test).length : 0;
  picker.items = picker.filter ? all.filter(picker.filter.test) : all;
  picker.active = query && picker.items.length ? 0 : -1;
  input.setAttribute('aria-expanded', 'true');
  renderPicker(query);
  el.hidden = false;
  el.scrollTop = 0;
  placePicker();
}

// Close the skill list on a click anywhere outside it and its own skill box.
document.addEventListener('pointerdown', (ev) => {
  if (!picker.input || picker.el.contains(ev.target) || picker.input.closest('.skill-combo').contains(ev.target)) return;
  closePicker();
});

function closePicker() {
  if (!picker.input) return;
  picker.el.hidden = true;
  picker.input.setAttribute('aria-expanded', 'false');
  picker.input.removeAttribute('aria-activedescendant');
  picker.input = null;
  picker.showAll = false;
  picker.notice = '';
}

function renderPicker(query) {
  const e = entry();
  const spec = eventSpec(e, picker.input.dataset.ev);
  const html = [];
  if (picker.notice) html.push(`<div class="pop-notice" role="status">${esc(picker.notice)}</div>`);
  if (picker.filter) {
    html.push(`<div class="pop-filter" role="presentation"><span>Only ${esc(picker.filter.label)} skills${picker.hidden ? ` (${picker.hidden} hidden)` : ''}</span><button type="button" class="pop-filter-btn" data-show-all>Show all</button></div>`);
  }
  let lastHead;
  picker.items.forEach((s, i) => {
    const head = e.disc === 'tt' ? null : e.disc === 'mag' ? (s.eg ? `EG ${ROMAN[s.eg]} · ${spec.groups?.[s.eg - 1]?.label.replace(/^[IV]+\. /, '') || ''}` : 'No element group (no EG bonus)') : s.group ? (s.src === 'WG' ? `WG group ${s.group}` : `Group ${s.group}${s.groupName ? ` · ${s.groupName}` : ''}`) : 'Skills';
    if (!query && head && head !== lastHead) {
      html.push(`<div class="pop-head" role="presentation">${esc(head)}</div>`);
      lastHead = head;
    }
    const meta = e.disc === 'tt' ? `${esc(s.notation || '')} · ${fmt(s.dd)}` : `${esc(s.value)}${s.eg ? ` · EG ${ROMAN[s.eg]}` : s.group ? ` · G${s.group}` : ''}`;
    html.push(`
      <div class="pop-opt${i === picker.active ? ' active' : ''}" role="option" id="pop-opt-${i}" data-skill="${i}" aria-selected="${i === picker.active}"${s.note ? ` title="Note: ${esc(s.note)}"` : ''}>
        <span class="src-badge ${s.src.toLowerCase()}">${s.src}</span>
        <span class="pop-name">${esc(s.name)}${s.eponym ? ` <span class="pop-eponym">(${esc(s.eponym)})</span>` : ''}</span>
        <span class="pop-meta">${meta}</span>
      </div>`);
  });
  const srcs = [...new Set(picker.items.map((s) => s.src))];
  html.push(
    picker.items.length
      ? `<div class="pop-foot">${srcs.map((s) => `<span class="src-badge ${s.toLowerCase()}">${s}</span> ${SRC_LABEL[s] || s}`).join(' ')}. Not listed? Type your own name and set the ${e.disc === 'tt' ? 'shorthand and DD' : 'value'} yourself.</div>`
      : `<div class="pop-empty">No listed skills match. That's fine: keep your own name and set the values yourself.</div>`
  );
  picker.el.innerHTML = html.join('');
  setActive(picker.active);
}

function setActive(i) {
  picker.active = i;
  $$('.pop-opt', picker.el).forEach((o) => {
    const on = Number(o.dataset.skill) === i;
    o.classList.toggle('active', on);
    o.setAttribute('aria-selected', on);
    if (on) o.scrollIntoView({ block: 'nearest' });
  });
  if (i >= 0) picker.input.setAttribute('aria-activedescendant', `pop-opt-${i}`);
  else picker.input.removeAttribute('aria-activedescendant');
}

// The part of the page the gymnast can actually see: on a phone the on-screen keyboard
// covers the bottom (window.visualViewport), and the sticky header covers the top.
function visibleArea() {
  const vv = window.visualViewport;
  const top = Math.max(vv ? vv.offsetTop : 0, $('.site-header')?.getBoundingClientRect().bottom || 0);
  const bottom = vv ? vv.offsetTop + vv.height : innerHeight;
  return { top, bottom };
}
const isPhone = () => matchMedia('(max-width: 640px), (pointer: coarse)').matches;

// Phones: scroll the skill box up under the header so the list fits below it, above
// the keyboard (the usual pattern for a search box with suggestions on mobile).
function makeRoom() {
  if (!picker.input || !isPhone()) return;
  const r = picker.input.getBoundingClientRect();
  const { top, bottom } = visibleArea();
  if (bottom - r.bottom < 260) window.scrollBy({ top: r.top - top - 8 });
}

function placePicker() {
  if (!picker.input) return;
  const r = picker.input.getBoundingClientRect();
  const { top, bottom } = visibleArea();
  if (r.bottom < top || r.top > bottom) return closePicker();
  const w = Math.min(Math.max(r.width + 60, 440), innerWidth - 16);
  const left = Math.min(Math.max(8, r.left), innerWidth - w - 8);
  const below = bottom - r.bottom - 8;
  const above = r.top - top - 8;
  // Below the box unless there's clearly more room above (never on phones: there the box is moved up instead).
  const up = !isPhone() && below < 240 && above > below;
  const maxHeight = Math.max(120, Math.min(380, up ? above : below));
  Object.assign(picker.el.style, { left: `${left}px`, width: `${w}px`, maxHeight: `${maxHeight}px`, bottom: '' });
  picker.el.style.top = up ? `${Math.max(top, r.top - 4 - Math.min(picker.el.scrollHeight, maxHeight))}px` : `${r.bottom + 4}px`;
}

function pickSkill(i) {
  const s = picker.items[i];
  const input = picker.input;
  if (!s || !input) return;
  const e = entry();
  const evId = input.dataset.ev;
  const pass = input.dataset.pass;
  const row = rowsOf(e, evId, pass)[Number(input.dataset.idx)];
  const fam = levelInfo(e.disc, e.level).family;
  row.name = s.label;
  row.skillId = s.id;
  row.fromList = true; // its values came from the list, so they don't filter it next time
  if (e.disc === 'tt') Object.assign(row, { notation: s.notation || '', dd: s.dd });
  else {
    const letters = eventSpec(e, evId).letters;
    if (letters.includes(s.value)) row.letter = s.value;
    if (fam === 'mag') row.eg = s.eg ? String(s.eg) : '';
    if (fam === 'infinity') row.eg = s.group ? String(s.group) : '';
    if (fam === 'wagMasters') row.eg = s.group && WG_TO_MASTERS[evId]?.[s.group] ? String(WG_TO_MASTERS[evId][s.group]) : '';
  }
  closePicker();
  renderRows(evId, pass, { row: Number(input.dataset.idx), part: 'name' });
  scheduleSave();
}

function onPickerKey(ev) {
  const input = ev.target;
  const open = picker.input === input;
  const n = picker.items.length;
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    ev.preventDefault();
    if (!open) return openPicker(input, '');
    if (!n) return;
    const d = ev.key === 'ArrowDown' ? 1 : -1;
    setActive(picker.active < 0 ? (d > 0 ? 0 : n - 1) : (picker.active + d + n) % n);
  } else if (ev.key === 'Enter' && open && picker.active >= 0) {
    ev.preventDefault();
    pickSkill(picker.active);
  } else if (ev.key === 'Escape' && open) {
    ev.preventDefault();
    closePicker();
  } else if (ev.key === 'Tab') closePicker();
}

// ---- Live values ---------------------------------------------------------------

const signed = (n) => (n == null ? '—' : n < 0 ? `−${fmt(-n)}` : fmt(n));

function flagFor(it, spec) {
  if (it.status === 'repeat') {
    const n = it.repeatOf + 1;
    if (it.repeatWhy === 'connection') return ['Same connection', `Same element and same connection as skill ${n}: the second time only earns value-part credit in a different connection (a different skill before or after it, or on floor a different pass)`];
    if (it.repeatWhy === 'third') return ['Third time', 'An element earns value-part credit at most twice in a routine'];
    if (it.repeatWhy === 'pass') return ['Same pass', `This pass repeats the one with skill ${n}: flight elements with hand support only earn credit again in a different pass`];
    return [`Repeat of Skill ${n}`, `Repeat of skill ${n}: each element only earns value-part credit once`];
  }
  if (it.status === 'restricted') return ['Restricted', 'Above this level’s allowed difficulty: −0.50, and no value part credit'];
  if (it.flag === 'over') return ['Check level', 'This skill is outside what this level allows'];
  if (it.status !== 'noncounting') return ['', ''];
  if (it.reason === 'eg') return ['Over 4 in EG', 'Only 4 skills from one element group count, so this one adds no difficulty'];
  if (it.reason === 'sr') return ['Over 3 EG II/III', 'Only 3 EG II or III skills count before a B or higher EG I skill'];
  if (it.reason === 'egOnly') return ['EG credit only', 'Not one of your counting skills, but it earns its element group bonus'];
  if (it.reason === 'extraVp') return ['Extra', 'Not needed for this level’s value parts'];
  if (it.reason === 'noValue') return ['', ''];
  return [`Not in top ${spec.maxCounting}`, `Not in your top ${spec.maxCounting}, so it doesn't count toward difficulty`];
}

function updateRows(container, items, spec, list) {
  for (const it of items) {
    const rowEl = $(`[data-row="${it.idx}"]`, container);
    if (!rowEl) continue;
    const repeat = it.status === 'repeat';
    const gray = repeat || it.status === 'noncounting' || it.status === 'restricted';
    rowEl.classList.toggle('is-counting', it.status === 'counting' && it.flag !== 'over');
    rowEl.classList.toggle('is-blank', it.status === 'blank');
    rowEl.classList.toggle('is-repeat', repeat || it.status === 'restricted' || it.flag === 'over');
    rowEl.classList.toggle('non-counting', gray && !repeat && it.status !== 'restricted');
    rowEl.classList.toggle('has-bonus', !!it.bonus);
    const v = $('[data-calc="value"]', rowEl);
    if (v) v.textContent = repeat || !it.letter ? '' : spec.columns === 'xcel' ? (it.vp ? `${it.vp} VP` : fmt(it.value)) : fmt(it.value);
    const b = $('[data-calc="bonus"]', rowEl);
    if (b) b.textContent = it.bonus ? `+${fmt(it.bonus)}` : '';
    const [text, title] = flagFor(it, spec);
    const flagEl = $('[data-calc="flag"]', rowEl);
    flagEl.textContent = text;
    flagEl.title = title;
    rowEl.classList.toggle('flagged', !!text);
    const row = list[it.idx];
    const src = findSkill(row?.skillId)?.src || (it.name ? 'Custom' : '');
    const badge = $('[data-calc="src"]', rowEl);
    badge.textContent = src;
    badge.className = `src-badge ${src.toLowerCase()}`;
    badge.title = src === 'Custom' ? 'Not from the skill list: values are set by hand' : '';
    $('.skill-input', rowEl).title = it.name;
  }
}

function updateComputed() {
  const a = athlete();
  const e = entry();
  if (!a || !e) return;
  const D = DISCIPLINES[e.disc];
  const score = scoreEntry(e);
  const cur = currentEvent(e);

  for (const ev of D.events) {
    const card = $(`[data-event-card="${ev.id}"]`);
    if (!card) continue;
    const r = score.events[ev.id];
    const spec = eventSpec(e, ev.id);
    $(`[data-sv="${ev.id}"]`).textContent = r.sv == null ? '—' : e.disc === 'tt' ? `DD ${fmt(r.sv)}` : fmt(r.sv);

    if (ev.kind === 'vault') {
      const v = r.vault;
      $('#vault-info', card).innerHTML = v
        ? [v.src ? `<div><dt>Source</dt><dd><span class="src-badge ${String(v.src).toLowerCase()}">${esc(v.src)}</span></dd></div>` : '',
          v.eg ? `<div><dt>Element group</dt><dd>${esc(v.eg)}</dd></div>` : '',
          v.dv != null ? `<div><dt>D score</dt><dd>${fmt(v.dv)}</dd></div>` : '',
          v.ageBonus != null ? `<div><dt>Age bonus</dt><dd>+${fmt(v.ageBonus)}</dd></div>` : ''].join('')
        : '';
    } else if (ev.kind === 'passes') {
      r.passes.forEach((items, p) => {
        updateRows($(`[data-routine="${ev.id}"][data-pass="${p}"]`, card), items, spec, e.passes[ev.id][p].skills);
        $(`[data-pass-dd="${p}"]`, card).textContent = `DD ${fmt(r.sums[p])}`;
      });
    } else {
      updateRows($(`[data-routine="${ev.id}"]`, card), r.items, spec, e.routines[ev.id]);
      const counting = r.items.filter((it) => it.status === 'counting').length;
      const listed = r.items.filter((it) => it.status !== 'blank').length;
      const count = $('[data-calc="count"]', card);
      if (count) count.textContent = spec.columns === 'dd' ? `${listed} skill${listed === 1 ? '' : 's'} listed` : spec.maxCounting ? `${counting} of ${spec.maxCounting} counting · ${listed} listed` : `${listed} listed`;
      $(`[data-add-skill="${ev.id}"]`, card).hidden = e.routines[ev.id].length >= MAX_ROWS;
    }

    for (const o of spec.options) {
      const row = $(`[data-option-row="${ev.id}:${o.id}"]`, card);
      const el = $(`[data-calc="opt-${o.id}"]`, card);
      if (!row || !el) continue;
      // Met by a skill in the routine (rings swing to handstand, floor double flips):
      // tick it and say which skill.
      const met = o.detect ? r.detected?.[o.id] : null;
      if (o.detect) {
        const box = $(`[data-opt="${o.id}"]`, row);
        box.checked = !!met || !!e.options?.[ev.id]?.[o.id];
        // Not disabled (that greys it out): ticking is ignored while a listed skill meets it.
        if (met) box.setAttribute('aria-disabled', 'true');
        else box.removeAttribute('aria-disabled');
        $('[data-help]', row).textContent = met ? `${o.deduction ? 'Met' : `+${fmt(o.value)}, earned`} by ${met.replace(/\.+$/, '')}.` : o.help;
      }
      if (o.deduction) {
        const missing = !met && !e.options?.[ev.id]?.[o.id];
        el.textContent = missing ? `−${fmt(o.value)}` : '';
        row.classList.toggle('on', !missing);
        row.classList.toggle('missing', missing && r.sv != null);
        continue;
      }
      const got = r.optionValues?.[o.id] || 0;
      el.textContent = got ? `+${fmt(got)}` : '';
      row.classList.toggle('on', !!got);
    }
    const vrow = $(`[data-option-row="vt:altBoard"]`, card);
    if (vrow) vrow.classList.toggle('on', !!e.options?.vt?.altBoard);

    $$('.cg-list li', card).forEach((li) => li.classList.toggle('earned', (r.earnedGroups || []).includes(Number(li.dataset.cg))));
    const totals = r.totals || [];
    $(`[data-totals="${ev.id}"]`, card).innerHTML = totals
      .map(([label, value], i) => {
        const tip = scoreTip(e, ev, label);
        return `<div class="${i === totals.length - 1 ? 'grand' : ''}"><dt>${esc(label)}${tip ? infoButton(label, tip) : ''}</dt><dd>${i === totals.length - 1 ? fmt(value) : signed(value)}</dd></div>`;
      })
      .join('');
    const notes = [...(r.notes || []), ...(r.warnings || [])];
    $(`[data-notes="${ev.id}"]`, card).innerHTML = notes.length ? `<ul>${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : '';
  }

  $('#summary').innerHTML =
    D.events
      .map((ev) => {
        const sv = score.events[ev.id].sv;
        const on = ev.id === cur;
        return `<button type="button" class="stat stat-tab${on ? ' active' : ''}" role="tab" id="tab-${ev.id}" data-tab="${ev.id}"
          aria-selected="${on}" aria-controls="panel-${ev.id}" tabindex="${on ? 0 : -1}">
          <span>${esc(ev.short)}</span><strong>${sv == null ? '—' : fmt(sv)}</strong></button>`;
      })
      .join('') + (score.allAround == null ? '' : `<div class="stat stat-aa"><span>All-Around</span><strong>${fmt(score.allAround)}</strong></div>`);
  $('#summary').dataset.count = D.events.length + (score.allAround == null ? 0 : 1);
  $('#summary').onclick = (ev) => {
    const t = ev.target.closest('[data-tab]');
    if (t) selectTab(t.dataset.tab);
  };
  $('#summary').onkeydown = onTabKey;
}

function selectTab(tab, focus = false) {
  const e = entry();
  state.tab[e.id] = tab;
  writePref('rp-tabs', state.tab);
  closePicker();
  $$('[data-event-card]').forEach((c) => (c.hidden = c.dataset.eventCard !== tab));
  updateComputed();
  if (focus) $(`#tab-${tab}`)?.focus();
}

function onTabKey(ev) {
  const e = entry();
  const ids = DISCIPLINES[e.disc].events.map((x) => x.id);
  const i = ids.indexOf(currentEvent(e));
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: ids.length - 1 }[ev.key];
  if (next == null || !ev.target.closest('[role="tab"]')) return;
  ev.preventDefault();
  selectTab(ids[(next + ids.length) % ids.length], true);
}

async function runExport(button, events) {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Building PDF…';
  try {
    const { exportEntryPdf, downloadPdf } = await import('./pdf.js');
    const a = athlete();
    const e = entry();
    downloadPdf(await exportEntryPdf(a, e, events), a, e, events);
  } catch (err) {
    console.error(err);
    alert(`Could not create the PDF: ${err?.message || err}`);
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

// ---- Boot -----------------------------------------------------------------

const GUEST = { uid: 'guest', displayName: 'Guest', guest: true };

async function onUser(user) {
  // Signing in after trying the planner as a guest: keep what they made.
  const carry = state.user?.guest && user && !user.guest ? state.athletes.filter((a) => a.name || a.entries.length) : [];
  const carriedId = carry.length ? state.athleteId : null;
  state.user = user;
  renderUserArea();
  $('#guest-banner').hidden = !user?.guest;
  if (!user) {
    state.athletes = [];
    renderAthletePicker();
    renderSignIn();
    return;
  }
  $('#local-banner').hidden = !user.local;
  if (user.guest) {
    state.athletes = [];
    state.athleteId = null;
    state.entryId = null;
    renderAll();
    return;
  }
  app.innerHTML = `<p class="loading">Loading athletes…</p>`;
  try {
    state.athletes = await store.listAthletes();
    for (const a of state.athletes) if (normalizeAthlete(a)) store.saveAthlete(a).catch(console.error);
    for (const a of carry) {
      state.athletes = state.athletes.filter((x) => x.id !== a.id);
      state.athletes.push(a);
      await store.saveAthlete(a);
    }
  } catch (e) {
    console.error(e);
    app.innerHTML = `<p class="error">Could not load athletes: ${esc(e?.message || e)}</p>`;
    return;
  }
  const remembered = carriedId || readPref('rp-athlete', null);
  const first = state.athletes.find((a) => a.id === remembered) || sortedAthletes()[0];
  state.athleteId = first?.id ?? null;
  state.entryId = first?.entries[0]?.id ?? null;
  state.showAdd = !!first && !first.entries.length;
  renderAll();
}

store.init(onUser).catch((e) => {
  console.error(e);
  app.innerHTML = `<p class="error">Could not start the app: ${esc(e?.message || e)}</p>`;
});
