import * as store from './store.js';
import { clearRevalueFlags } from './revalue.js';
import {
  DISCIPLINES,
  applyExample,
  DISC_IDS,
  DECADES,
  DECADE_LABELS,
  blankSkill,
  blankTT,
  copyEvent,
  copyRoutines,
  entryName,
  eventHasContent,
  eventInfo,
  eventSpec,
  fmt,
  hasContent,
  levelInfo,
  maxRows,
  newEntry,
  normalizeEntry,
  scoreEntry,
  scoreEvent,
} from './model.js';
import { EXAMPLES, closestSkill, disciplineLoaded, findSkill, loadDiscipline, magSkillAllowed, matchesQuery, searchSkills, wagSkillAllowed } from './skill-search.js';
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

const saveTimers = new Map(); // athlete id -> pending save (each athlete saves on its own)
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
  const a = athlete();
  if (!a) return;
  setStatus('Saving…');
  clearTimeout(saveTimers.get(a.id));
  saveTimers.set(a.id, setTimeout(() => saveNow(a), 600));
}
async function saveNow(a) {
  clearTimeout(saveTimers.get(a.id));
  saveTimers.delete(a.id);
  const failed = (err) => {
    console.error(err);
    setStatus('Could not save. Check your connection.', 'error');
  };
  try {
    const saved = await store.saveAthlete(a);
    ownSaves.set(a.id, saved.updatedAt);
    // An offer to load another device's copy is out of date once this one is saved over it.
    if ($('#remote-toast')?.dataset.athlete === a.id) $('#remote-toast').remove();
    if (saved.pending) {
      // No signal: kept on this phone, and sent when the connection is back.
      setStatus('Saved on this device · will sync when online', 'pending');
      saved.pending.then(() => setStatus('All changes saved', 'ok'), failed);
    } else setStatus('All changes saved', 'ok');
  } catch (err) {
    failed(err);
  }
}
// Send every waiting save now (the page is going to the background, or may be closed).
function flushSaves() {
  for (const id of [...saveTimers.keys()]) {
    const a = state.athletes.find((x) => x.id === id);
    if (a) saveNow(a);
    else {
      clearTimeout(saveTimers.get(id));
      saveTimers.delete(id);
    }
  }
}
addEventListener('pagehide', flushSaves);
document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushSaves());

// ---- Live updates from other devices ------------------------------------------------
// When the same athlete is edited on another phone, its changes arrive here. Other
// athletes update quietly; the one on screen updates only when nothing is being typed or
// saved, otherwise a prompt offers to load the latest (nothing is redrawn under the cursor).
const ownSaves = new Map(); // athlete id -> updatedAt of this device's last save
let stopWatching = () => {};
const typing = () => saveTimers.size > 0 || !!document.activeElement?.closest?.('#app input, #app select, #app textarea');

function applyRemote(changes) {
  let redraw = false;
  let picker = false;
  for (const { type, athlete: data } of changes) {
    if (type !== 'removed' && ownSaves.get(data.id) === data.updatedAt) continue; // this device's own save
    const i = state.athletes.findIndex((x) => x.id === data.id);
    if (type === 'removed') {
      if (i < 0) continue;
      state.athletes.splice(i, 1);
      if (data.id === state.athleteId) {
        const next = sortedAthletes()[0];
        state.athleteId = next?.id ?? null;
        state.entryId = next?.entries[0]?.id ?? null;
        redraw = true;
      } else picker = true;
      continue;
    }
    if (i >= 0 && state.athletes[i].updatedAt === data.updatedAt) continue; // already have this version
    normalizeAthlete(data);
    if (i < 0) {
      state.athletes.push(data);
      picker = true;
    } else if (data.id !== state.athleteId) {
      state.athletes[i] = data;
      picker = true;
    } else if (typing()) {
      offerRemote(data);
    } else {
      state.athletes[i] = data;
      if (!data.entries.some((x) => x.id === state.entryId)) state.entryId = data.entries[0]?.id ?? null;
      redraw = true;
    }
  }
  if (redraw) renderAll();
  else if (picker) renderAthletePicker();
}

function offerRemote(data) {
  showToast('remote-toast', `${data.name || 'This athlete'} was changed on another device.`, 'Load latest', () => {
    // Saved here since the offer, or about to be: this device's copy is the newer one now.
    if (saveTimers.has(data.id) || (ownSaves.get(data.id) || 0) > (data.updatedAt || 0)) return;
    const i = state.athletes.findIndex((x) => x.id === data.id);
    if (i >= 0) state.athletes[i] = data;
    if (!data.entries.some((x) => x.id === state.entryId)) state.entryId = data.entries[0]?.id ?? null;
    renderAll();
  });
  $('#remote-toast').dataset.athlete = data.id;
}

// A message at the bottom of the screen with one button (new version, remote change).
function showToast(id, text, label, onClick) {
  $(`#${id}`)?.remove();
  const el = document.createElement('div');
  el.id = id;
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${esc(text)}</span><button type="button" class="toast-btn">${esc(label)}</button>`;
  $('button', el).onclick = () => {
    el.remove();
    onClick();
  };
  document.body.appendChild(el);
}

// ---- Header: user + athlete picker ------------------------------------------

// The account button at the right of the header: who is signed in, feedback, sign in or out.
// Nothing on the sign-in screen.
function renderUserArea() {
  const area = $('#user-area');
  const u = state.user;
  if (!u) {
    area.innerHTML = '';
    return;
  }
  const initials = (u.displayName || u.email || '').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const face = u.guest || u.local || (!u.photoURL && !initials)
    ? ICON_PERSON
    : u.photoURL ? `<img class="avatar" src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer" />` : `<span>${esc(initials)}</span>`;
  const who = u.guest ? 'Not signed in: nothing is saved' : u.local ? 'Local mode: saved in this browser only' : esc(u.displayName || u.email);
  area.innerHTML = `
    ${u.guest ? '<button class="btn btn-ghost btn-sm header-signin" type="button" data-signin>Sign in to save</button>' : ''}
    <div class="menu-wrap">
      <button type="button" class="account-btn" data-menu="account-menu" aria-haspopup="menu" aria-expanded="false" aria-label="Account and feedback">${face}</button>
      <div class="menu" id="account-menu" role="menu" hidden>
        <p class="menu-who">${who}${u.email && !u.guest && !u.local && u.displayName ? `<span>${esc(u.email)}</span>` : ''}</p>
        <button type="button" role="menuitem" data-action="feedback">Send feedback</button>
        ${u.guest ? '<button type="button" role="menuitem" data-signin>Sign in with Google</button>' : ''}
        ${!u.guest && !u.local ? '<button type="button" role="menuitem" data-action="signout">Sign out</button>' : ''}
      </div>
    </div>`;
}

// The account menu: a button with data-menu opens the
// element with that id; a click anywhere else, or Escape, closes it.
function closeMenus(except) {
  $$('.menu').forEach((m) => {
    if (m === except) return;
    m.hidden = true;
    $(`[data-menu="${m.id}"]`)?.setAttribute('aria-expanded', 'false');
  });
}
document.addEventListener('click', (ev) => {
  const opener = ev.target.closest('[data-menu]');
  if (opener) {
    const menu = $(`#${opener.dataset.menu}`);
    closeMenus(menu);
    menu.hidden = !menu.hidden;
    opener.setAttribute('aria-expanded', String(!menu.hidden));
    if (!menu.hidden) $('[role="menuitem"]', menu)?.focus();
    return;
  }
  const item = ev.target.closest('.menu [role="menuitem"]');
  if (!ev.target.closest('.menu') || item) closeMenus();
  const action = item?.dataset.action;
  if (action === 'feedback') import('./feedback.js').then((m) => m.openFeedback(feedbackContext), reportError);
  else if (action === 'signout') store.signOut();
});
// iOS sends no click for a tap on something that isn't clickable, so outside taps use pointerdown.
document.addEventListener('pointerdown', (ev) => {
  if ($('.menu:not([hidden])') && !ev.target.closest('.menu, [data-menu]')) closeMenus();
});
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape' || !$('.menu:not([hidden])')) return;
  const open = $('.menu:not([hidden])');
  closeMenus();
  $(`[data-menu="${open.id}"]`)?.focus();
});

const discChip = (e) =>
  `<span class="chip chip-${e.disc}">${esc(DISCIPLINES[e.disc].name)} · ${esc(levelInfo(e.disc, e.level)?.short || '')}</span>`;

function athListMarkup() {
  // Accents don't matter: "emile" finds Émile.
  const fold = (t) => t.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const q = fold(state.athQuery.trim());
  const list = sortedAthletes().filter((x) => !q || fold(`${x.name} ${x.club}`).includes(q));
  return `${list
    .map(
      (x) => `<button type="button" role="option" class="ath-option${x.id === state.athleteId ? ' active' : ''}" data-ath="${esc(x.id)}" aria-selected="${x.id === state.athleteId}">
          <span class="ath-option-top"><span class="ath-option-name">${esc(x.name || 'Unnamed athlete')}</span><span class="ath-option-club">${esc(x.club || '')}</span></span>
          <span class="chips">${x.entries.map(discChip).join('')}</span>
        </button>`
    )
    .join('')}
    ${list.length ? '' : `<p class="ath-none">${state.athletes.length ? 'No athletes match.' : 'No athletes yet.'}</p>`}`;
}
function bindAthOptions(host) {
  $$('[data-ath]', host).forEach((b) => (b.onclick = () => {
    selectAthlete(b.dataset.ath);
    closeAthletePicker();
  }));
}

function renderAthletePicker() {
  const host = $('#athlete-picker');
  if (!host) return;
  const a = athlete();
  if (!state.user) {
    host.innerHTML = '';
    return;
  }
  host.innerHTML = `
    <button type="button" class="ath-button" id="ath-button" aria-haspopup="listbox" aria-expanded="${state.athOpen}" aria-label="Athlete: ${esc(a ? a.name || 'Unnamed athlete' : 'none yet')}. ${state.athletes.length} in all. Switch athlete">
      <span class="ath-current">${esc(a ? a.name || 'Unnamed athlete' : 'No athletes yet')}</span>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    <div class="ath-pop" ${state.athOpen ? '' : 'hidden'}>
      <div class="ath-search"><input id="ath-search" type="search" placeholder="Search name or club" aria-label="Search athletes" value="${esc(state.athQuery)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" /></div>
      <div class="ath-list" role="listbox" aria-label="Athletes">${athListMarkup()}</div>
      <div class="ath-foot"><button type="button" class="btn btn-primary btn-sm btn-block" id="ath-add">Add athlete</button>${canImport() ? '<button type="button" class="btn btn-ghost btn-sm btn-block" id="ath-import">Bring over UCG Infinity routines</button>' : ''}${a ? `<button type="button" class="ath-delete" id="delete-athlete">${ICON_TRASH}<span>Delete ${esc(a.name || 'this athlete')}</span></button>` : ''}</div>
    </div>`;
  $('#ath-button').onclick = () => {
    state.athOpen = !state.athOpen;
    state.athQuery = '';
    renderAthletePicker();
    // Phones: show the list first; the keyboard would cover it (tap the search box to type).
    if (state.athOpen && !isPhone()) $('#ath-search')?.focus();
  };
  const search = $('#ath-search');
  if (search) {
    search.oninput = () => {
      state.athQuery = search.value;
      $('.ath-list', host).innerHTML = athListMarkup();
      bindAthOptions(host);
    };
    search.onkeydown = (ev) => {
      if (ev.key === 'Escape') closeAthletePicker();
      if (ev.key === 'Enter') $('.ath-option')?.click();
    };
  }
  bindAthOptions(host);
  $('#delete-athlete')?.addEventListener('click', () => {
    closeAthletePicker();
    removeAthlete();
  });
  $('#ath-add').onclick = () => {
    closeAthletePicker();
    addAthlete();
  };
  if ($('#ath-import')) {
    $('#ath-import').onclick = () => {
      closeAthletePicker();
      openImport();
    };
  }
}

// ---- Bringing athletes over from the original UCG Infinity planner -------------------
// js/import-infinity.js reads the member's athletes there (one more Google sign-in) and
// converts them; here they pick which to bring over. Not for guests (nothing is saved).
const canImport = () => !!state.user && !state.user.guest;

// Arriving from the old planner's address (it sends people here with ?from=infinity): a
// bar across the top explains the move and how to bring athletes over. It stays until
// they've brought athletes over or close it.
if (new URLSearchParams(location.search).get('from') === 'infinity') {
  writePref('rp-from-infinity', true);
  const rest = location.search.slice(1).split('&').filter((p) => p !== 'from=infinity').join('&');
  history.replaceState(null, '', `${location.pathname}${rest ? `?${rest}` : ''}${location.hash}`);
}
function renderMoveBanner() {
  const el = $('#move-banner');
  const show = readPref('rp-from-infinity', false) && !readPref('rp-move-closed', false) && !state.athletes.some((a) => a.importedFrom);
  el.hidden = !show;
  if (!show) return;
  const intro = '<strong>The UCG Infinity planner has moved here, and grown.</strong> Same start values, now with every UCG level, skill search and offline use.';
  if (!state.user || state.user.guest) {
    el.innerHTML = `<span>${intro} To bring your athletes over: <strong>1.</strong> Sign in with Google, using the same account as in the old planner. <strong>2.</strong> Choose <strong>Bring over UCG Infinity routines</strong>.</span>
      <span class="banner-actions"><button type="button" class="banner-btn" data-signin>Sign in with Google</button></span>`;
    return;
  }
  el.innerHTML = `<span>${intro} Your athletes and routines are still in the old planner: bring them over here in a minute.</span>
    <span class="banner-actions"><button type="button" class="banner-btn" id="move-import">Bring over UCG Infinity routines</button><button type="button" class="banner-link" id="move-close">Close</button></span>`;
  $('#move-import').onclick = openImport;
  $('#move-close').onclick = () => {
    writePref('rp-move-closed', true);
    renderMoveBanner();
  };
}

function openImport() {
  $('#import-dialog')?.remove();
  const dlg = document.createElement('dialog');
  dlg.id = 'import-dialog';
  dlg.className = 'modal';
  dlg.setAttribute('aria-labelledby', 'import-title');
  document.body.appendChild(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  const mod = import('./import-infinity.js'); // loaded before the sign-in click
  const show = (body) => {
    dlg.innerHTML = `<div class="modal-body"><h2 id="import-title" class="card-subtitle">Bring over UCG Infinity routines</h2>${body}</div>`;
    $('[data-close]', dlg)?.addEventListener('click', () => dlg.close());
  };
  const summary = (o) =>
    [o.vault ? 'Vault' : '', ...['bars', 'beam', 'floor'].map((ev) => {
      const n = (o.routines?.[ev] || []).filter((x) => String(x?.name || '').trim() || x?.letter).length;
      return n ? `${ev[0].toUpperCase()}${ev.slice(1)} ${n}` : '';
    })].filter(Boolean).join(' · ') || 'No routines yet';

  const start = (note = '') => {
    show(`
      <p>Athletes from the original UCG Infinity planner (jzsharpe.github.io/ucg-infinity-sv) can come over here with their vault and routines. Sign in there with the same Google account you used, then pick which athletes to bring.</p>
      ${note ? `<p class="error" role="alert">${esc(note)}</p>` : ''}
      <div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="button" class="btn btn-primary" id="import-signin">Sign in to the old planner</button></div>`);
    $('#import-signin', dlg).onclick = async () => {
      try {
        const m = await mod;
        const { email, athletes } = await m.readOldAthletes(state.user.email);
        choose(m, email, athletes);
      } catch (err) {
        console.error(err);
        const code = err?.code || '';
        if (/popup-closed|cancelled-popup/.test(code)) return start();
        start(
          /popup-blocked/.test(code) ? 'The sign-in window was blocked. Allow pop-ups for this site, then try again.'
            : /unauthorized-domain/.test(code) ? 'The old planner does not allow sign-in from this address yet. Please let UCG know.'
              : `Could not read the old planner: ${err?.message || err}`
        );
      }
    };
  };

  const choose = (m, email, athletes) => {
    if (!athletes.length) return start(`No athletes found for ${email} in the old planner. Did you use a different Google account there?`);
    const have = new Set(state.athletes.map((a) => a.importedFrom).filter(Boolean));
    const done = (o) => have.has(m.importKey(o));
    show(`
      <p>Found ${athletes.length} athlete${athletes.length === 1 ? '' : 's'} for ${esc(email)}. Each comes in with a UCG Infinity level. Skills come over as typed, with their values and element groups, so start values stay the same.</p>
      <div class="import-list">${athletes.map((o, i) => `
        <label class="import-item${done(o) ? ' done' : ''}">
          <input type="checkbox" data-pick="${i}"${done(o) ? ' disabled' : ' checked'} />
          <span><strong>${esc(o.name || 'Unnamed athlete')}</strong>${o.club ? ` · ${esc(o.club)}` : ''}<span class="import-meta">${done(o) ? 'Already brought over' : esc(summary(o))}</span></span>
        </label>`).join('')}</div>
      <div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="button" class="btn btn-primary" id="import-run"></button></div>`);
    const run = $('#import-run', dlg);
    const sync = () => {
      const n = $$('[data-pick]:checked', dlg).length;
      run.disabled = !n;
      run.textContent = n ? `Bring over ${n} athlete${n === 1 ? '' : 's'}` : 'Nothing to bring over';
    };
    $$('[data-pick]', dlg).forEach((b) => (b.onchange = sync));
    sync();
    run.onclick = async () => {
      run.disabled = true;
      run.textContent = 'Bringing them over…';
      // Typed-in skills become the listed skill they clearly are (same value and group).
      await loadDiscipline('wag');
      const match = (ev, row) =>
        closestSkill('wag', ev, row.name, (s) => wagSkillAllowed('infinity', 'inf', s) && s.value === row.letter && (!row.eg || String(s.group) === row.eg));
      const picked = $$('[data-pick]:checked', dlg).map((b) => m.convertOldAthlete(athletes[Number(b.dataset.pick)], uid, match));
      for (const a of picked) {
        state.athletes.push(a);
        try {
          const saved = await store.saveAthlete(a);
          ownSaves.set(a.id, saved.updatedAt);
          a.updatedAt = saved.updatedAt;
        } catch (err) {
          console.error(err);
        }
      }
      dlg.close();
      if (!picked.length) return;
      selectAthlete(picked[0].id);
      renderMoveBanner();
      const rows = picked.flatMap((a) => Object.values(a.entries[0].routines).flat()).filter((r) => r.name);
      const matched = rows.filter((r) => r.matchedFrom).length;
      showToast('import-toast', `Brought over ${picked.length} athlete${picked.length === 1 ? '' : 's'}: ${matched} of ${rows.length} skills matched to the skill list.`, 'OK', () => {});
    };
  };

  start();
  dlg.showModal();
}
function closeAthletePicker() {
  if (!state.athOpen) return;
  state.athOpen = false;
  renderAthletePicker();
}
document.addEventListener('pointerdown', (ev) => {
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
  writePref('rp-athlete', a.id);
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
  clearTimeout(saveTimers.get(a.id)); // a late save would bring it back
  saveTimers.delete(a.id);
  // Off the screen straight away: with no signal the delete only confirms once the
  // connection is back, and waiting for that looked like nothing happened.
  state.athletes = state.athletes.filter((x) => x.id !== a.id);
  const next = sortedAthletes()[0];
  state.athleteId = next?.id ?? null;
  state.entryId = next?.entries[0]?.id ?? null;
  renderAll();
  try {
    await store.deleteAthlete(a.id);
  } catch (err) {
    console.error(err);
    setStatus(`Could not delete ${a.name || 'the athlete'}. Check your connection.`, 'error');
  }
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

// "Sign in to save" buttons in the header, the account menu and the guest banner.
document.addEventListener('click', async (ev) => {
  if (!ev.target.closest('[data-signin]')) return;
  const msg = await signIn();
  if (msg) alert(msg);
});

// Guests lose everything when the page closes: ask first.
const guestHasWork = () => state.user?.guest && state.athletes.some((a) => a.name || a.entries.some(hasContent));
let reloadConfirmed = false; // already asked (guestOkToReload): don't ask twice
window.addEventListener('beforeunload', (ev) => {
  if (!guestHasWork() || reloadConfirmed) return;
  ev.preventDefault();
  ev.returnValue = '';
});

// ---- Main layout -------------------------------------------------------------

function renderAll() {
  renderAthletePicker();
  const a = athlete();
  // The athlete's disciplines' skill lists load on demand; draw once they're here, so every
  // listed skill is recognised (badges, box numbers, and its id kept when saving).
  const missing = [...new Set((a?.entries || []).map((x) => x.disc))].filter((d) => !disciplineLoaded(d));
  if (missing.length) {
    app.innerHTML = `<p class="loading">Loading…</p>`;
    Promise.all(missing.map(loadDiscipline)).then(renderAll, (err) => {
      console.error(err);
      // Not a reload: that would lose a guest's routines (still in memory here).
      app.innerHTML = `<p class="error">Couldn't load the skill lists. Check your connection, then <button type="button" class="btn btn-ghost btn-sm" id="load-retry">Try again</button></p>`;
      $('#load-retry').onclick = renderAll;
    });
    return;
  }
  if (!a) {
    app.innerHTML = `
      <section class="empty-editor">
        <h1>Add your first athlete</h1>
        <p class="lead">Choose the levels they compete and build each routine. The start value updates as you type.</p>
        <div class="empty-actions">
          <button class="btn btn-primary" type="button" id="empty-add">Add athlete</button>
          ${canImport() ? '<button class="btn btn-ghost" type="button" id="empty-import">Import from UCG Infinity</button>' : ''}
        </div>
        <ol class="empty-steps">
          <li><span>1</span>Add an athlete</li>
          <li><span>2</span>Choose their levels</li>
          <li><span>3</span>Build routines, export worksheets</li>
        </ol>
      </section>`;
    $('#empty-add').onclick = addAthlete;
    if ($('#empty-import')) $('#empty-import').onclick = openImport;
    return;
  }
  const e = entry();
  if (e) state.entryId = e.id;
  // The athlete's name and club sit on a navy band; the name is the page's title.
  app.innerHTML = `
    <section class="athlete-band" aria-label="Athlete">
      <div class="band-inner">
        <div class="band-fields">
          <label class="band-name"><span class="sr-only">Gymnast name</span>
            <input id="f-name" type="text" value="${esc(a.name)}" placeholder="Athlete name" autocomplete="off" /></label>
          <label class="band-club"><span class="sr-only">Club or school</span>
            <input id="f-club" type="text" value="${esc(a.club)}" placeholder="Add club or school" /></label>
        </div>
        <div class="band-actions">
          <span id="save-status" class="save-status"${state.user?.guest ? ` data-kind="guest">Not saved: sign in to keep this` : '>'}</span>
          ${e ? `<button class="btn btn-accent" type="button" id="export-all">Export PDF</button>` : ''}
        </div>
      </div>
    </section>
    <div class="wrap editor" id="editor">
      ${entriesRow(a, e)}
      ${state.showAdd || !e ? addLevelPanel(a) : ''}
      ${e ? entryBody(a, e) : ''}
    </div>`;
  bindEditor(a, e);
  if (e) updateComputed();
}

function entriesRow(a, cur) {
  return `
    <div class="entries" role="tablist" aria-label="Levels this athlete competes">
      ${a.entries
        .map(
          (e) => `<span class="entry" role="presentation"><button type="button" role="tab" class="entry-tab${cur && e.id === cur.id ? ' active' : ''}" data-entry="${esc(e.id)}" aria-selected="${cur && e.id === cur.id}">
            <span class="disc-badge disc-${e.disc}">${esc(DISCIPLINES[e.disc].name)}</span><span>${esc(levelInfo(e.disc, e.level)?.name || e.level)}</span>
          </button><button type="button" class="entry-remove" data-remove-entry="${esc(e.id)}" aria-label="Remove ${esc(entryName(e))}" title="Remove this level">${ICON_X_SMALL}</button></span>`
        )
        .join('')}
      ${a.entries.length ? `<button type="button" class="entry-add" id="toggle-add" aria-expanded="${state.showAdd}">${state.showAdd ? 'Close' : `${ICON_PLUS}<span>Add level</span>`}</button>` : ''}
      ${cur && levelInfo(cur.disc, cur.level)?.masters ? `<label class="field inline decade"><span>Age decade</span>
        <select id="f-decade">${DECADES.map((d) => `<option value="${d}"${d === cur.decade ? ' selected' : ''}>${DECADE_LABELS[d]}</option>`).join('')}</select></label>` : ''}
    </div>`;
}

function addLevelPanel(a) {
  return `
    <section class="card add-panel">
      <h2 class="card-subtitle">Add a level</h2>
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
  const ev = currentEvent(e);
  return `
    ${startPanel(a, e)}${revaluedNotice(e)}${importNotice(e)}
    <div class="summary" id="summary" role="tablist" aria-label="Events"></div>
    ${D.events.map((x) => eventCard(a, e, x, x.id === ev)).join('')}
    <div class="sv-bar" id="sv-bar">
      <div class="sv-bar-text"><span id="sv-bar-label"></span><strong id="sv-bar-value"></strong></div>
      <button type="button" class="btn btn-ghost btn-sm" id="sv-breakdown" aria-haspopup="dialog">Breakdown</button>
    </div>`;
}

// Offered while a level is empty: copy from another level in the discipline,
// or fill every event with example routines.
// After copying from another level: what the re-valuing did, until dismissed.
function revaluedNotice(e) {
  const r = e.revalued;
  const s = r?.summary;
  if (!s) return '';
  const parts = [
    s.approximate && `${s.approximate} approximate (the value depends on the version performed)`,
    s.notCredited && `${s.notCredited} not credited at this level`,
    s.typed && `${s.typed} typed in by hand (check their values)`,
    { approx: 'the vault is the closest match (check it)', other: 'the vault counts as any other vault (0.0 + age bonus)', none: "the vault isn't allowed here (pick one)" }[s.vault],
  ].filter(Boolean);
  const from = levelInfo(e.disc, r.from)?.name || r.from;
  const what = r.event ? `${eventInfo(e.disc, r.event)?.label || r.event} ` : '';
  return `
    <section class="card revalue-notice" role="status">
      <p><strong>Copied ${esc(what)}from ${esc(from)} and re-valued for ${esc(levelInfo(e.disc, e.level).name)}.</strong>
        ${esc(([s.exact && `${s.exact} skill${s.exact === 1 ? '' : 's'} matched exactly`, ...parts].filter(Boolean).join('; ') || 'nothing needed changing').replace(/^./, (c) => c.toUpperCase()))}.${parts.length ? ' Those are flagged below.' : ''}</p>
      <button type="button" class="btn btn-ghost btn-sm" id="revalue-ok">OK</button>
    </section>`;
}

// Brought over from the original UCG Infinity planner: check the skills matched to the
// list once, then "Done" clears the notice and every "Matched" flag on the level (each
// flag also clears when its skill is edited or picked again).
function importNotice(e) {
  const r = e.imported;
  if (!r) return '';
  const left = Object.values(e.routines || {}).flat().filter((x) => x.matchedFrom).length;
  return `
    <section class="card revalue-notice" role="status">
      <p><strong>Brought over from the UCG Infinity planner.</strong>
        ${left ? `${left} skill${left === 1 ? ' was' : 's were'} matched to the skill list from the name typed there: they're flagged <em>Matched</em>, so check each is the skill performed (tap the flag to see the old name).` : 'All matched skills are checked.'}
        ${r.typed ? `${r.typed} kept as typed: click one to pick it from the list, already filtered to its value and group.` : ''}</p>
      <button type="button" class="btn btn-ghost btn-sm" id="import-done">${left ? 'Done checking' : 'OK'}</button>
    </section>`;
}

// The UCG sheets the T&T and WAG examples come from, opened where the level and event's
// routines are, so people can compare every example side by side. T&T has a tab per level
// and event; WAG a tab per level, with bars, beam and floor down it (the range is the
// event's heading).
const EXAMPLE_SHEETS = {
  tt: {
    url: 'https://docs.google.com/spreadsheets/d/1xV7YCE3GB7DZdBJOZO5wLKNPNlHSYkbz82dybMd0yu4/edit',
    at: {
      'nf-tr': 1435406756, 'nf-dmt': 1981485949, 'nf-tu': 191551846,
      'if-tr': 1276161485, 'if-dmt': 533484477, 'if-tu': 1541825099,
      'hf-tr': 794122378, 'hf-dmt': 2128556051, 'hf-tu': 413171885,
    },
  },
  wag: {
    url: 'https://docs.google.com/spreadsheets/d/1B9TjeFnU-cZYmuCcBaUs-OOpIXrxv66LHrqHYrb2Gsg/edit',
    at: {
      'silver-ub': '961199611&range=A1', 'silver-bb': '961199611&range=A16', 'silver-fx': '961199611&range=A31',
      'gold-ub': '0&range=A1', 'gold-bb': '0&range=A16', 'gold-fx': '0&range=A31',
      'plat-ub': '1843736686&range=A1', 'plat-bb': '1843736686&range=A16', 'plat-fx': '1843736686&range=A31',
      'diamond-ub': '994048238&range=A1', 'diamond-bb': '994048238&range=A21', 'diamond-fx': '994048238&range=A41',
      'sapphire-ub': '498742149&range=A1', 'sapphire-bb': '498742149&range=A25', 'sapphire-fx': '498742149&range=A46',
    },
  },
};
// The link to an event's examples, or '' where there's no sheet to show.
function exampleSheetUrl(e, event) {
  const sheet = EXAMPLE_SHEETS[e.disc];
  if (!sheet) return '';
  const at = sheet.at[`${e.level}-${event}`];
  return at != null ? `${sheet.url}#gid=${at}` : sheet.url;
}

// An example that, as written, earns everything its level asks for (no missing special
// requirement or value part, nothing restricted, not short): what "Use example routines"
// puts in. Some UCG examples fall short; they stay in each event's Examples menu.
function meetsRequirements(ex) {
  const t = newEntry('x', ex.disc, ex.level);
  applyExample(t, ex);
  const r = scoreEvent(t, ex.event);
  return !(r.srMissing || r.vpMissing || r.restricted || r.shortBy);
}

function startPanel(a, e) {
  if (hasContent(e)) return '';
  const sources = a.entries.filter((x) => x.id !== e.id && x.disc === e.disc && hasContent(x));
  const examples = EXAMPLES.filter((x) => x.disc === e.disc && x.level === e.level);
  if (!sources.length && !examples.length) return '';
  return `
    <section class="card start-panel">
      <div class="start-text">
        <h2 class="card-subtitle">Start from something?</h2>
        <p class="muted">${sources.length ? `Copy every event from another ${esc(DISCIPLINES[e.disc].name)} level; values and start values are recalculated for ${esc(levelInfo(e.disc, e.level).name)}. ` : ''}${examples.length ? 'Or fill each event with an example routine, then edit it. Each event also has an Examples menu.' : ''}${examples.length && exampleSheetUrl(e, examples[0].event) ? ` To compare them first, <a class="ext-link" href="${esc(exampleSheetUrl(e, examples[0].event))}" target="_blank" rel="noopener">browse all the ${esc(DISCIPLINES[e.disc].name)} examples in Google Sheets${ICON_EXT}</a>.` : ''}</p>
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
const ICON_EXT = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>`;
const ICON_PLUS = `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;
const ICON_X = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
const ICON_CHEVRON = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
const ICON_X_SMALL = `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
const ICON_PERSON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`;
const ICON_TRASH = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>`;
// "How is this scored?": the event's instructions, behind a ? beside its title.
const ICON_HELP = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`;
const helpButton = (label, text) => `<button type="button" class="help-tip" data-tip="${esc(text)}" data-tip-wide aria-label="How ${esc(label)} works: ${esc(text)}">${ICON_HELP}</button>`;
const plain = (html) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

// ---- Event cards ---------------------------------------------------------------

function eventCard(a, e, ev, visible) {
  const spec = eventSpec(e, ev.id);
  const examples = EXAMPLES.filter((x) => x.disc === e.disc && x.level === e.level && x.event === ev.id);
  // The athlete's other levels in the discipline with this event filled in: copy just this event.
  const sources = a.entries.filter((x) => x.id !== e.id && x.disc === e.disc && eventHasContent(x, ev.id));
  const levelOpts = sources.map((s) => `<option value="level:${esc(s.id)}">${esc(levelInfo(s.disc, s.level).name)}</option>`).join('');
  const exampleOpts = examples.map((x) => `<option value="${esc(x.id)}">${esc(x.title)}</option>`).join('');
  const help = ev.kind === 'vault' ? '' : plain(ev.kind === 'passes' ? passesHelp(ev) : routineHelp(e, ev, spec));
  return `
    <article class="card event-card" data-event-card="${ev.id}" id="panel-${ev.id}" role="tabpanel" aria-labelledby="tab-${ev.id}" ${visible ? '' : 'hidden'}>
      <header class="card-head">
        <div class="card-title-row"><h2 class="card-title">${esc(ev.label)}</h2>${help ? helpButton(ev.label.toLowerCase(), help) : ''}</div>
        <div class="card-head-right">
          ${examples.length && exampleSheetUrl(e, ev.id) ? `<a class="ext-link examples-sheet" href="${esc(exampleSheetUrl(e, ev.id))}" target="_blank" rel="noopener" title="See every ${esc(ev.label)} example side by side in Google Sheets">Compare all${ICON_EXT}</a>` : ''}
          ${examples.length || sources.length ? `<label class="examples-menu"><span class="sr-only">${sources.length ? `Copy this ${esc(ev.label.toLowerCase())} routine from another level${examples.length ? ' or an example' : ''}` : 'Insert an example routine'}</span>
            <select data-example="${ev.id}"><option value="">${sources.length ? 'Copy from…' : 'Examples…'}</option>${sources.length && examples.length ? `<optgroup label="Another level">${levelOpts}</optgroup><optgroup label="Examples">${exampleOpts}</optgroup>` : levelOpts + exampleOpts}</select></label>` : ''}
          <span class="sv-pill" data-sv="${ev.id}"></span>
          ${ev.kind !== 'vault' || ['infinity', 'xcel'].includes(spec.family) ? `<button class="btn btn-ghost btn-sm" type="button" data-export="${ev.id}">Export PDF</button>` : ''}
        </div>
      </header>
      ${ev.kind === 'vault' ? vaultBody(e, ev, spec) : ev.kind === 'passes' ? passesBody(e, ev) : routineBody(e, ev, spec)}
      ${spec.sr ? srList(e, ev, spec) : ''}
      ${spec.options.map((o) => optionControl(e, ev.id, o)).join('')}
      ${spec.legend.length ? cgSection(e, ev, spec) : ''}
      <div class="event-foot">
        <dl class="totals" data-totals="${ev.id}"></dl>
        <div class="foot-notes" data-notes="${ev.id}"></div>
      </div>
    </article>`;
}

// The groups the EG bonus counts (condensed I-IV at Infinity and WAG Masters), filled in
// when earned, each with what it adds; the card's header shows the total.
function cgSection(e, ev, spec) {
  const title = spec.family === 'mag' ? 'Element groups' : 'Condensed element groups';
  const tip = scoreTip(e, ev, 'EG bonus');
  return `
    <section class="cg-card" aria-label="${title}">
      <div class="cg-head"><h3 class="cg-title">${title}${tip ? infoButton(title, tip) : ''}</h3><span class="cg-total">EG bonus <strong data-cg-total></strong></span></div>
      <ul class="cg-list">${spec.legend.map((g) => `<li data-cg="${g.key}" title="${esc(`${g.roman}. ${g.label}`)}"><span class="cg-badge">${g.roman}</span><span class="cg-label">${esc(shortGroup(g.label))}</span><span class="cg-val" data-cg-val></span></li>`).join('')}</ul>
    </section>`;
}

// Group names short enough that the four fit on one line (the full name is the pill's title).
const SHORT_GROUPS = {
  'Non acrobatic elements': 'Non-acro', 'Forward acrobatic elements': 'Forward acro', 'Backward acrobatic elements': 'Backward acro',
  'Single saltos with at least one twist': 'Twisting saltos', 'Single leg swings and scissors': 'Single leg & scissors',
  'Circles, kehrs, russians, and flops': 'Circles & flops', 'Kips and swings': 'Kips & swings', 'Basket and long hang swings': 'Basket & long hang',
  'Casts, clear hip, stalder and pike circles': 'Casts & circles', 'Giant circles': 'Giants', 'Leaps, jumps and hops': 'Leaps & jumps',
  'Holds and acro (non-flight and flight)': 'Holds & acro', 'Mounts and dismounts': 'Mounts & dismounts', 'Hand support elements': 'Hand support',
  'Saltos forward, sideward and backward': 'Saltos',
  // UCG Infinity: the condensed groups, from the USAG groups they combine.
  'Mounts · Dismounts': 'Mounts & dismounts', 'Casts/Counterswings': 'Casts', 'Underswings/Clear Hips · Stalder Circles · Circle Swings/Hechts': 'Underswings & circles',
  'Giant Swings Backward · Giant Swings/Circles Fwd.': 'Giants', 'Leaps/Jumps/Hops · Turns': 'Leaps, jumps & turns', 'Waves · Holds/Stands · Rolls': 'Waves, holds & rolls',
  'Walkovers/Cartwheels etc. · Saltos': 'Walkovers & saltos', 'Handstands · Rolls · Walkovers/Cartwheels etc.': 'Handstands & walkovers',
  'Saltos Forward · Saltos Sideward/Arabians': 'Front & side saltos', 'Saltos Backward': 'Back saltos',
};
const shortGroup = (label) => SHORT_GROUPS[label] || label;

function routineHelp(e, ev, spec) {
  if (spec.columns === 'dd') return 'List the routine in order. Search the T&T skill list (it fills in the FIG shorthand and DD), or type your own skill and its DD.';
  if (spec.family === 'xcel') return `List the routine in order. Search the Xcel skill list (it fills in the value), or type your own skill and pick its value. To mark directly connected skills, tap <strong>Connect skills</strong>, then tap between two skills: connected skills are joined into one block. The planner checks the value parts${e.level === 'sapphire' ? '' : ' and restricted skills'} for ${esc(levelInfo(e.disc, e.level).name)}, ticks the special requirements the listed skills meet${e.level === 'sapphire' ? ' and works out the bonus' : ''}. An element earns credit at most twice, the second time only in a different connection.`;
  const max = spec.maxCounting;
  const more = e.disc === 'mag' ? ', with at most 4 from one element group' : '';
  return `List the whole routine in order, and drag the grip to reorder. <strong>Each skill counts only once</strong>. Your ${max} highest-value skills count toward difficulty${more}. Counting skills are highlighted; repeats and non-counting skills are shaded gray and flagged.${spec.links ? ' To mark connected skills, tap <strong>Connect skills</strong>, then tap between two skills.' : ''}`;
}

function routineBody(e, ev, spec) {
  const rows = e.routines[ev.id];
  return `
    ${ev.synchro ? `<label class="field inline partner"><span>Synchro partner</span><input type="text" data-partner="${ev.id}" value="${esc(e.options?.[ev.id]?.partner || '')}" placeholder="Partner's name" /></label>` : ''}
    <div class="skill-table${connecting.has(ev.id) ? ' connecting' : ''}" data-routine="${ev.id}">${rowsMarkup(e, ev, spec, rows, null)}</div>
    <div class="routine-actions">
      ${spec.links ? connectButton(ev.id) : ''}
      <button class="btn btn-ghost btn-sm" type="button" data-add-skill="${ev.id}">Add skill</button>
      <span class="routine-count" data-calc="count"></span>
      ${spec.links ? `<span class="connect-hint">${connecting.has(ev.id) ? 'Tap between two skills to connect or separate them.' : ''}</span>` : ''}
    </div>`;
}

// Connect mode (per event, not saved): the "Connect" / "Connected" pills show between rows
// only while it is on. Outside it, connected skills show as one joined block.
const connecting = new Set();

function connectButton(evId) {
  const on = connecting.has(evId);
  return `<button class="btn btn-ghost btn-sm connect-btn" type="button" data-connect-mode="${evId}" aria-pressed="${on}">${ICON_LINK}<span>${on ? 'Done connecting' : 'Connect skills'}</span></button>`;
}

const linkInner = (on) => (on ? `${ICON_LINK}<span>Connected</span>` : `${ICON_PLUS}<span>Connect</span>`);
const linkTitle = (on) => (on ? 'Connected to the next skill (tap to separate)' : 'Not connected to the next skill (tap to connect)');

function passesBody(e, ev) {
  const spec = eventSpec(e, ev.id);
  return `
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

const passesHelp = (ev) =>
  ev.id === 'dmt'
    ? 'Two passes of two skills: a mounter or spotter, then a dismount. A mounter is done from the angled bed onto the flat bed; a spotter comes after a straight jump onto the flat bed, taking off and landing there. A skill repeated in the same position gets no difficulty.'
    : 'Two passes. Search the T&T skill list or type your own skill and its DD.';

// Double mini: the first skill of a pass is a mounter or a spotter. A repeat only
// loses its difficulty in the same position.
function startSelect(e, p) {
  const v = e.passes.dmt[p].start || 'mounter';
  return `<label class="pass-start"><span class="sr-only">Pass ${p + 1} first skill</span>
    <select data-start="${p}">${['mounter', 'spotter'].map((x) => `<option value="${x}"${x === v ? ' selected' : ''}>${x === 'mounter' ? 'Mounter' : 'Spotter'} first</option>`).join('')}</select></label>`;
}

function headCells(spec) {
  if (spec.columns === 'dd') return `<span class="col-num">#</span><span class="col-name">Skill</span><span class="col-letter">Shorthand</span><span class="col-eg">DD</span><span></span>`;
  if (spec.columns === 'xcel') return `<span class="col-num">#</span><span class="col-name">Skill</span><span class="col-letter">Value</span><span class="col-eg">Element group</span><span class="col-value">VP${spec.vp ? infoButton('value parts', vpTip(spec.vp)) : ''}</span><span></span>`;
  return `<span class="col-num">#</span><span class="col-name">Skill</span><span class="col-letter">Diff.</span><span class="col-eg">Element group</span><span class="col-value">Value</span><span class="col-bonus">EG bonus</span><span></span>`;
}

// "Value parts needed: 1 C, 3 B, 4 A." A higher skill can fill a lower value part.
function vpTip(vp) {
  const n = {};
  for (const l of vp) n[l] = (n[l] || 0) + 1;
  return `Value parts needed: ${Object.entries(n).map(([l, c]) => `${c} ${l}`).join(', ')} (${vp.length} skills). A higher-value skill can fill a lower value part.`;
}

function rowsMarkup(e, ev, spec, rows, pass) {
  const cls = spec.columns === 'dd' ? ' dd' : spec.columns === 'xcel' ? ' xcel' : '';
  return `<div class="skill-row skill-head${cls}"${spec.vp ? '' : ' aria-hidden="true"'}>${headCells(spec)}</div>${rows.map((s, i) => skillRow(e, ev, spec, i, s, pass)).join('')}`;
}

function skillRow(e, ev, spec, i, s, pass) {
  const label = `${pass != null ? `Pass ${pass + 1} skill` : 'Skill'} ${i + 1}`;
  const data = `data-ev="${ev.id}" data-idx="${i}"${pass != null ? ` data-pass="${pass}"` : ''}`;
  const dd = spec.columns === 'dd';
  const cls = dd ? ' dd' : spec.columns === 'xcel' ? ' xcel' : '';
  const combo = `
    <span class="col-name skill-combo">
      <input class="skill-input" type="text" placeholder="Search or type a skill" aria-label="${label} name"
        role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="skill-pop" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
        ${data} data-field="name" value="${esc(s.name)}" />
      <span class="src-badge" data-calc="src"></span>
      <button type="button" class="combo-toggle" ${data} data-combo tabindex="-1" aria-label="Show ${label} skill list">${ICON_CHEVRON}</button>
    </span>`;
  const handle = `<span class="col-num">
      <button type="button" class="drag-handle" ${data} data-drag aria-label="Move ${label}. Drag, or use the up and down arrow keys." title="Drag to reorder">${ICON_GRIP}</button>
      <span class="num">${i + 1}</span></span>`;
  const remove = `<button type="button" class="remove-skill" ${data} data-remove aria-label="Remove ${label}" title="Remove skill">${ICON_X}</button>`;
  // Phones: the row folds to two lines (name, then its values) until tapped; tapped, it
  // opens its fields with Remove skill and Done.
  const summary = `<button type="button" class="row-summary" ${data} data-expand aria-label="Edit ${label}">
      <span class="sum-name" data-calc="sum-name"></span><span class="sum-meta" data-calc="sum-meta"></span></button>`;
  const edit = `<div class="row-edit">
      <button type="button" class="row-remove" ${data} data-remove>${ICON_TRASH}<span>Remove skill</span></button>
      <button type="button" class="btn btn-primary btn-sm" data-done>Done</button></div>`;
  const open = editing === rowKey(ev.id, pass, i) ? ' editing' : '';
  if (dd) {
    return `<div class="skill-row${cls}${open}" data-row="${i}">${handle}${summary}${combo}
      <input class="col-letter" type="text" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="${label} shorthand" ${data} data-field="notation" value="${esc(s.notation)}" placeholder="Shorthand" />
      <input class="col-eg" type="number" inputmode="decimal" step="0.1" min="0" aria-label="${label} DD" ${data} data-field="dd" value="${esc(s.dd)}" placeholder="DD" />
      ${remove}<span class="row-flag" data-calc="flag"></span>${edit}</div>`;
  }
  const letters = `<select class="col-letter" aria-label="${label} difficulty" ${data} data-field="letter">
      <option value="">–</option>${spec.letters.map((l) => `<option${l === s.letter ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  // Connected to the next skill (sits on the line between the two rows).
  const link = spec.links
    ? `<button type="button" class="link-toggle" ${data} data-link aria-pressed="${!!s.link}" aria-label="${label} connected to the next skill" title="${linkTitle(s.link)}">${linkInner(s.link)}</button>`
    : '';
  const eg = spec.groups
    ? `<select class="col-eg" aria-label="${label} element group" ${data} data-field="eg">
        <option value="">EG –</option>${spec.groups.map((g) => `<option value="${g.value}"${String(g.value) === String(s.eg) ? ' selected' : ''}>${esc(g.label)}</option>`).join('')}</select>`
    : '<span class="col-eg"></span>';
  if (spec.columns === 'xcel') {
    return `<div class="skill-row${cls}${open}${s.link ? ' linked' : ''}" data-row="${i}">${handle}${summary}${combo}${letters}${eg}
      <span class="col-value calc" data-calc="value"></span>${remove}<span class="row-flag" data-calc="flag"></span>${edit}${link}</div>`;
  }
  return `<div class="skill-row${cls}${open}${s.link ? ' linked' : ''}" data-row="${i}">${handle}${summary}${combo}${letters}${eg}
    <span class="col-value calc" data-calc="value"></span><span class="col-bonus calc" data-calc="bonus"></span>
    ${remove}<span class="row-flag" data-calc="flag"></span>${edit}${link}</div>`;
}

// The row open for editing on a phone ("event|pass|index"), or null.
let editing = null;
const rowKey = (evId, pass, i) => `${evId}|${pass ?? ''}|${i}`;
function setEditing(key) {
  editing = key;
  $$('.skill-row[data-row]').forEach((r) => {
    const i = $('[data-expand]', r);
    r.classList.toggle('editing', !!i && rowKey(i.dataset.ev, i.dataset.pass, Number(i.dataset.idx)) === key);
  });
}

// Ticked by updateComputed: met by a listed skill (and what it assumes), or ticked by hand.
function srList(e, ev, spec) {
  return `
    <fieldset class="sr-list">
      <legend>Special requirements <span class="muted">(−0.50 each one missing)</span></legend>
      <p class="sr-intro">Ticked when a listed skill meets one. Untick any the gymnast won't meet, or tick one met by a skill you typed in.</p>
      ${spec.sr.map((t, i) => `<label class="sr-item" data-sr-row="${ev.id}:${i}"><input type="checkbox" data-sr="${ev.id}" data-sr-idx="${i}" /><span class="sr-text"><span><strong>SR ${i + 1}.</strong> ${esc(t)}</span><span class="sr-how" data-sr-how></span></span></label>`).join('')}
    </fieldset>`;
}

// Under a special requirement: which skills meet it, and what that assumes.
function srHow(r, i, set) {
  const d = r.detectedSr?.[i];
  const names = d ? d.by.map((k) => r.items[k]?.name).filter(Boolean).join(' + ') : '';
  if (d && set === false) return `Unticked by you (the planner found ${names}).`;
  if (d) return `Met by ${names}${d.assumes ? `, assuming ${d.assumes}` : ''}.`;
  return r.sr?.[i] ? 'Ticked by you.' : '';
}

function optionControl(e, evId, o) {
  const v = e.options?.[evId]?.[o.id];
  const data = `data-option="${evId}" data-opt="${o.id}"`;
  let control;
  if (o.connect) {
    control = ''; // worked out from the linked skills
  } else if (o.kind === 'count') {
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
      <span class="event-bonus-text"><strong>${esc(o.label)}${o.tip ? infoButton(o.label, o.tip) : ''}</strong><span data-help>${esc(o.help)}</span></span>
      ${leading ? '' : control}
      <span class="event-bonus-value calc" data-calc="opt-${o.id}"></span>
    </label>`;
}

// The vaults a level offers, in list order: { id, name, meta (value), head (list heading) }.
function vaultChoices(e) {
  const fam = levelInfo(e.disc, e.level).family;
  const out = [];
  if (fam === 'mag') {
    if (e.level === 'masters') {
      out.push({ id: 'other', name: OTHER_VAULT.name, meta: '0.0', head: 'Other' });
      for (const v of MAG_MASTERS_VAULTS) out.push({ id: v.id, name: v.name, meta: fmt(v.value), head: 'UCG Masters vaults' });
    }
    for (const v of MAG_VAULTS) {
      const banned = e.level === 'dev' && v.flipping;
      out.push({
        id: v.id, name: `${v.src === 'WG' ? `${v.id} · ` : ''}${v.name}${v.eponym ? ` (${v.eponym})` : ''}`,
        meta: banned ? 'not allowed' : fmt(e.level === 'adv' ? v.adv : v.value), head: v.eg ? `WG element group ${v.eg}` : 'UCG Code of Points',
      });
    }
  } else if (fam === 'infinity') {
    for (const v of INFINITY_VAULT_LIST) out.push({ id: v.name, name: v.name, meta: fmt(v.dv), head: v.entry });
  } else if (fam === 'xcel') {
    const list = xcelVaults(e.level);
    const l910 = list.some((v) => v.l910);
    for (const v of list) out.push({ id: v.id, name: v.label, meta: fmt(v.sv), head: !l910 ? '' : v.l910 ? 'USAG Level 9/10 vaults (10.0 at UCG Sapphire)' : 'Xcel Sapphire vault chart' });
  } else if (fam === 'wagMasters') {
    const item = (v, head) => ({ id: v.id, name: `${v.src === 'WG' ? `${v.id} · ` : ''}${v.name}${v.eponym ? ` (${v.eponym})` : ''}`, meta: fmt(v.value), head });
    out.push(item(WAG_OTHER_VAULT, 'Other'));
    for (const v of WAG_MASTERS_VAULTS) out.push(item(v, 'UCG Masters vaults'));
    for (const v of WAG_WG_VAULTS) out.push(item(v, `WG vault group ${v.eg}`));
  }
  return out;
}
const vaultName = (e) => vaultChoices(e).find((v) => v.id === String(e.vault))?.name || '';
// Names coaches type for vaults the lists write in shorthand ("RO-FF; 1/1 Off" is a Yurchenko full).
const VAULT_WORDS = [
  [/\bRO-?FF\b|round-?off,? flic-?flac/i, 'yurchenko roundoff flicflac'],
  [/\bFHS\b|\b(Ft|Fr)\.? ?Hspr|front handspring|^handspring/i, 'front handspring'],
  [/\bHspr\b/i, 'handspring'],
  [/\b(Ft|Fr)\./, 'front'],
  [/\b1\/[24] On\b.*\b(tuck|pike|layout|salto)|tsuk/i, 'tsukahara'],
];
const vaultSearchText = (name) => [name, ...VAULT_WORDS.filter(([re]) => re.test(name)).map(([, w]) => w)].join(' ');

function vaultBody(e, ev) {
  const fam = levelInfo(e.disc, e.level).family;
  // Searched like the skills: type any words of the vault's name or number.
  const control = `
    <span class="skill-combo vault-combo">
      <input class="skill-input" id="f-vault" data-vault type="text" placeholder="Search vaults or pick from the list" aria-label="Vault"
        role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="skill-pop" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" value="${esc(vaultName(e))}" />
      <button type="button" class="combo-toggle" data-combo tabindex="-1" aria-label="Show the vault list">${ICON_CHEVRON}</button>
    </span>`;
  // After copying from another level: how the vault was carried over.
  const flag = {
    approx: "Copied from another level: the closest match in this level's vault list. Check it's the vault performed.",
    other: "Copied from another level: this vault isn't in the WG or UCG Masters lists, so it counts as any other vault (0.0 plus the age bonus).",
    none: "Copied from another level: that vault isn't allowed at this level, so pick one.",
  }[e.vaultFlag];
  return `
    ${flag ? `<p class="vault-flag" role="note">${esc(flag)}</p>` : ''}
    <div class="vault-body">
      <div class="field grow"><label for="f-vault">Select your vault</label>${control}</div>
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
    renderAthletePicker();
    scheduleSave();
  };
  $('#f-club').oninput = (ev) => {
    a.club = ev.target.value;
    renderAthletePicker();
    scheduleSave();
  };
  $('#toggle-add')?.addEventListener('click', () => {
    state.showAdd = !state.showAdd;
    renderAll();
  });
  $$('[data-remove-entry]').forEach((b) => (b.onclick = () => {
    const gone = a.entries.find((x) => x.id === b.dataset.removeEntry);
    if (!gone) return;
    const routines = hasContent(gone) ? ' Its routines will be deleted too.' : '';
    if (!confirm(`Are you sure you want to remove ${entryName(gone)} from ${a.name || 'this athlete'}?${routines}`)) return;
    a.entries = a.entries.filter((x) => x.id !== gone.id);
    if (state.entryId === gone.id) state.entryId = a.entries[0]?.id || null;
    state.showAdd = !a.entries.length;
    scheduleSave();
    renderAll();
  }));
  $$('[data-entry]').forEach((b) => (b.onclick = () => {
    state.entryId = b.dataset.entry;
    state.showAdd = false;
    renderAll();
  }));
  $$('[data-add]').forEach((b) => {
    const prefetch = () => loadDiscipline(b.dataset.add.split(':')[0]).catch(() => {});
    b.addEventListener('pointerenter', prefetch, { once: true });
    b.addEventListener('focus', prefetch, { once: true });
  });
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
  $('#f-decade')?.addEventListener('change', (ev) => {
    e.decade = ev.target.value;
    scheduleSave();
    updateComputed();
  });
  // Fetch ahead: the PDF code when Export is about to be used; the catalog with the copy panel.
  const warmPdf = () => import('./pdf.js').catch(() => {});
  $$('#export-all, [data-export]').forEach((b) => ['pointerenter', 'focus', 'touchstart'].forEach((ev) => b.addEventListener(ev, warmPdf, { once: true, passive: true })));
  if (($('#copy-run') || $('[data-example] option[value^="level:"]')) && e.disc !== 'tt') import(`./data/catalog-${e.disc}.js`).catch(() => {});
  const copySrc = $('#copy-src');
  if (copySrc) copySrc.onchange = () => ($('#copy-run').dataset.src = copySrc.value);
  $('#copy-run')?.addEventListener('click', async (ev) => {
    const button = ev.currentTarget;
    const src = a.entries.find((x) => x.id === button.dataset.src);
    if (!src) return;
    copyRoutines(src, e);
    button.disabled = true;
    await revalueCopy(src, e);
    scheduleSave();
    renderAll();
  });
  $('#import-done')?.addEventListener('click', () => {
    delete e.imported;
    for (const row of Object.values(e.routines || {}).flat()) delete row.matchedFrom;
    scheduleSave();
    renderAll();
  });
  $('#revalue-ok')?.addEventListener('click', () => {
    delete e.revalued.summary;
    scheduleSave();
    renderAll();
  });
  $('#examples-all')?.addEventListener('click', () => {
    for (const x of DISCIPLINES[e.disc].events) {
      const list = EXAMPLES.filter((y) => y.disc === e.disc && y.level === e.level && y.event === x.id);
      const ex = list.find(meetsRequirements) || list[0];
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
  // There's no onfocusout property, so this is a listener, added once per editor element.
  if (!ed.dataset.focusWired) {
    ed.dataset.focusWired = '1';
    ed.addEventListener('focusout', (ev) => {
      if (ev.target === picker.input) closePicker();
      if (ev.target.dataset?.vault != null) ev.target.value = vaultName(entry()); // typed but not picked
    });
  }
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
    // Kept only where it differs from what the skills meet, so it follows routine changes.
    const opts = ((e.options ||= {})[t.dataset.sr] ||= {});
    const i = Number(t.dataset.srIdx);
    const auto = !!scoreEvent(e, t.dataset.sr).detectedSr?.[i];
    const set = Array.from({ length: Math.max(i + 1, opts.srSet?.length || 0) }, (_, k) => opts.srSet?.[k] ?? null);
    set[i] = t.checked === auto ? null : t.checked;
    opts.srSet = set;
    if (opts.sr?.[i]) opts.sr = opts.sr.map((v, k) => (k === i ? false : v)); // a tick saved before detection
  } else if (t.dataset.vault != null) {
    openPicker(t, t.value); // the vault changes when one is picked
    return;
  } else if (t.dataset.partner) {
    ((e.options ||= {})[t.dataset.partner] ||= {}).partner = t.value;
  } else if (t.dataset.ev && t.dataset.field) {
    const row = rowsOf(e, t.dataset.ev, t.dataset.pass)[Number(t.dataset.idx)];
    row[t.dataset.field] = t.dataset.field === 'dd' ? (t.value === '' ? '' : Number(t.value)) : t.value;
    if (['letter', 'eg', 'dd'].includes(t.dataset.field)) delete row.fromList; // chosen by hand: filters the list
    clearRevalueFlags(row);
    // A skill from the list has its own value and group: changing them means a different skill.
    if (['letter', 'eg'].includes(t.dataset.field) && row.skillId) return clearListedSkill(t, row);
    if (t.dataset.field === 'name') {
      // Typing a different name makes it a typed-in skill (but never drop an id just because
      // its list isn't loaded).
      const listed = row.skillId && findSkill(row.skillId);
      if (listed && listed.label !== t.value) delete row.skillId;
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
  clearRevalueFlags(row);
  if (e.disc === 'tt') row.notation = '';
  // The box was already left (a DD's change fires on blur): clear the row where it is and
  // say so, rather than redrawing and pulling the cursor back from where it went.
  if (document.activeElement !== t) {
    const rowEl = t.closest('.skill-row');
    $('.skill-input', rowEl).value = '';
    const notation = $('[data-field="notation"]', rowEl);
    if (notation) notation.value = '';
    updateComputed();
    scheduleSave();
    showToast('cleared-toast', `Skill ${idx + 1} was cleared because its ${e.disc === 'tt' ? 'DD' : 'value'} changed.`, 'Pick a skill', () => {
      const input = $(`[data-routine="${evId}"]${pass != null && pass !== '' ? `[data-pass="${pass}"]` : ''} [data-row="${idx}"] .skill-input`);
      if (!input) return;
      input.focus();
      openPicker(input, '');
    });
    return;
  }
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
  if (t.dataset.start) {
    e.passes.dmt[Number(t.dataset.start)].start = t.value;
    updateComputed();
    scheduleSave();
  } else if (t.dataset.example && t.value.startsWith('level:')) {
    const evId = t.dataset.example;
    const src = athlete()?.entries.find((x) => x.id === t.value.slice(6));
    t.value = '';
    if (!src) return;
    const label = eventInfo(e.disc, evId).label.toLowerCase();
    if (eventHasContent(e, evId) && !confirm(`Replace this ${label} routine with the ${levelInfo(src.disc, src.level).name} ${label} routine?`)) return;
    t.disabled = true;
    copyEvent(src, e, evId);
    revalueCopy(src, e, [evId]).then(() => {
      scheduleSave();
      renderAll();
    });
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

// After copying from another level: another level's code values the skills differently,
// so re-value them with the skill catalog (all events, or just the ones copied).
async function revalueCopy(src, e, events = null) {
  if (e.disc === 'tt' || src.level === e.level) return;
  try {
    // The skill list must be there to look skills up (it is when the level is shown; be sure).
    const [{ revalueEntry }, { CATALOG }] = await Promise.all([import('./revalue.js'), import(`./data/catalog-${e.disc}.js`), loadDiscipline(e.disc)]);
    revalueEntry(e, src.level, CATALOG, src.vault, events);
  } catch (err) {
    console.error(err);
    if (isStale(err)) reportError(err);
    alert(`Copied, but the skills couldn't be re-valued for this level${isStale(err) ? '. Reload the planner (a new version is available), then copy again' : `: ${err?.message || err}`}.`);
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
  // Tapping or clicking the skill box itself opens its list too, not only the arrow.
  const box = ev.target.closest('.skill-input');
  if (box) {
    if (picker.input !== box) openPicker(box, '');
    return;
  }
  const expand = ev.target.closest('[data-expand]');
  if (expand) {
    if (dragJustEnded) return;
    setEditing(rowKey(expand.dataset.ev, expand.dataset.pass, Number(expand.dataset.idx)));
    const input = $('.skill-input', expand.closest('.skill-row'));
    input?.focus();
    if (input && !input.value) openPicker(input, ''); // a blank row: straight to the skill list
    return;
  }
  if (ev.target.closest('[data-done]')) {
    closePicker();
    setEditing(null);
    return;
  }
  const add = ev.target.closest('[data-add-skill]');
  if (add) {
    const evId = add.dataset.addSkill;
    const list = rowsOf(e, evId, add.dataset.pass);
    if (list.length >= maxRows(e, evId, add.dataset.pass, MAX_ROWS)) return;
    list.push(e.disc === 'tt' ? blankTT() : blankSkill());
    editing = rowKey(evId, add.dataset.pass, list.length - 1);
    renderRows(evId, add.dataset.pass, { row: list.length - 1, part: 'name' });
    const added = $(`[data-routine="${evId}"]${add.dataset.pass != null ? `[data-pass="${add.dataset.pass}"]` : ''} [data-row="${list.length - 1}"] .skill-input`);
    if (added) openPicker(added, '');
    scheduleSave();
    return;
  }
  const mode = ev.target.closest('[data-connect-mode]');
  if (mode) {
    const evId = mode.dataset.connectMode;
    const on = !connecting.has(evId);
    if (on) connecting.add(evId);
    else connecting.delete(evId);
    mode.setAttribute('aria-pressed', on);
    $('span', mode).textContent = on ? 'Done connecting' : 'Connect skills';
    $('.connect-hint', mode.parentElement).textContent = on ? 'Tap between two skills to connect or separate them.' : '';
    $(`[data-routine="${evId}"]`).classList.toggle('connecting', on);
    return;
  }
  const link = ev.target.closest('[data-link]');
  if (link) {
    const row = rowsOf(e, link.dataset.ev, link.dataset.pass)[Number(link.dataset.idx)];
    row.link = !row.link;
    link.setAttribute('aria-pressed', row.link);
    link.title = linkTitle(row.link);
    link.innerHTML = linkInner(row.link);
    link.closest('.skill-row').classList.toggle('linked', row.link);
    updateComputed();
    scheduleSave();
    return;
  }
  const remove = ev.target.closest('[data-remove]');
  if (remove) {
    const { ev: evId, pass } = remove.dataset;
    const list = rowsOf(e, evId, pass);
    const i = Number(remove.dataset.idx);
    const before = JSON.stringify(list);
    const [gone] = list.splice(i, 1);
    // The skill before it was connected to the removed one, not to the one now following.
    if (i > 0) list[i - 1].link = false;
    normalizeEntry(e);
    editing = null;
    renderRows(evId, pass, { row: Math.min(i, list.length - 1), part: isPhone() ? null : 'name' });
    scheduleSave();
    // Removed at once; Undo puts the routine back as it was (while the same level is open).
    if (gone && (gone.name || gone.letter || gone.notation)) {
      showToast('undo-toast', `Removed ${gone.name || 'a skill'}.`, 'Undo', () => {
        if (entry() !== e) return;
        list.splice(0, list.length, ...JSON.parse(before));
        renderRows(evId, pass, null);
        scheduleSave();
      });
      clearTimeout(undoTimer);
      undoTimer = setTimeout(() => $('#undo-toast')?.remove(), 8000);
    }
  }
}
let undoTimer;

// Re-draw one routine (after add / remove / reorder / pick) and focus a row.
function renderRows(evId, pass, focus) {
  const e = entry();
  const ev = eventInfo(e.disc, evId);
  const spec = eventSpec(e, evId);
  closePicker();
  const sel = `[data-routine="${evId}"]${pass != null && pass !== '' ? `[data-pass="${pass}"]` : ''}`;
  $(sel).innerHTML = rowsMarkup(e, ev, spec, rowsOf(e, evId, pass), pass != null && pass !== '' ? Number(pass) : null);
  updateComputed();
  if (focus?.part) {
    const row = $(`${sel} [data-row="${focus.row}"]`);
    $(focus.part === 'handle' ? '.drag-handle' : '.skill-input', row)?.focus();
  }
}

function moveSkill(evId, pass, from, to, focusPart) {
  const list = rowsOf(entry(), evId, pass);
  if (to < 0 || to >= list.length || to === from) return;
  // A moved skill leaves its connections behind: the one before it and its own both break,
  // and so does the one it lands after (it was connected to the skill now following).
  if (from > 0) list[from - 1].link = false;
  const [s] = list.splice(from, 1);
  s.link = false;
  list.splice(to, 0, s);
  if (to > 0) list[to - 1].link = false;
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

// Drag to reorder: pointer events, so it works with a mouse and on touch screens. The grip
// starts a drag at once; on a phone, so does a long press anywhere on a folded skill (a
// quick swipe still scrolls the page).
let dragJustEnded = false;
function onPointerDown(ev) {
  const handle = ev.target.closest('.drag-handle');
  if (handle && ev.button <= 0) {
    ev.preventDefault();
    return startDrag(handle, ev);
  }
  const summary = ev.target.closest('[data-expand]');
  if (!summary || ev.pointerType === 'mouse' || summary.closest('.is-blank')) return;
  const x0 = ev.clientX;
  const y0 = ev.clientY;
  const cancel = () => {
    clearTimeout(timer);
    removeEventListener('pointermove', moved);
    removeEventListener('pointerup', cancel);
    removeEventListener('pointercancel', cancel);
  };
  const moved = (m) => Math.hypot(m.clientX - x0, m.clientY - y0) > 8 && cancel();
  const timer = setTimeout(() => {
    cancel();
    navigator.vibrate?.(10);
    startDrag(summary, ev);
  }, 450);
  addEventListener('pointermove', moved);
  addEventListener('pointerup', cancel);
  addEventListener('pointercancel', cancel);
}

function startDrag(handle, ev) {
  const evId = handle.dataset.ev;
  const pass = handle.dataset.pass;
  const from = Number(handle.dataset.idx);
  const container = handle.closest('.skill-table');
  // While dragging on a touch screen the page mustn't scroll under the finger.
  const noScroll = (t) => t.preventDefault();
  addEventListener('touchmove', noScroll, { passive: false });
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
    removeEventListener('touchmove', noScroll);
    dragJustEnded = true;
    setTimeout(() => (dragJustEnded = false), 350);
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
    if (label === 'Start value') return fam === 'xcel' ? (e.options?.vt?.altBoard && e.level === 'gold' ? "The Xcel vault chart value, with the alternative springboard (9.5)." : "From the Xcel vault chart for this level.") : 'Execution + D score' + (L.masters ? ' + age bonus.' : '.');
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
      Bonus: 'Sapphire: +0.1 for each "C", for one "D", and for each "B"+"B" (or higher) connection, up to +0.4. Skills in the Xcel Code and UCG’s own additions earn bonus; Development / Level 9-10 skills don’t.',
      'Missing SRs': '-0.50 for each special requirement not met (not ticked below).',
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
  tipFor?.classList.remove('tip-open');
  tipFor = btn;
  btn.classList.add('tip-open');
  // Inside the breakdown sheet (a modal dialog), the bubble must be in the dialog to show above it.
  const host = btn.closest('dialog[open]') || document.body;
  if (tipEl.parentNode !== host) host.appendChild(tipEl);
  tipEl.textContent = btn.dataset.tip;
  tipEl.hidden = false;
  const r = btn.getBoundingClientRect();
  const w = Math.min(btn.dataset.tipWide != null ? 380 : 260, innerWidth - 16);
  tipEl.style.maxWidth = `${w}px`;
  const left = Math.min(Math.max(8, r.left + r.width / 2 - tipEl.offsetWidth / 2), innerWidth - tipEl.offsetWidth - 8);
  const above = r.top - tipEl.offsetHeight - 8;
  tipEl.style.left = `${left}px`;
  tipEl.style.top = `${above > 8 ? above : r.bottom + 8}px`;
}
function hideTip() {
  tipFor?.classList.remove('tip-open');
  tipFor = null;
  tipEl.hidden = true;
}
const canHover = () => matchMedia('(hover: hover)').matches;
document.addEventListener('mouseover', (ev) => {
  if (!canHover()) return; // a tap also fires mouseover: taps are handled on click
  const b = ev.target.closest('[data-tip]');
  if (b && b !== tipFor) showTip(b);
  else if (!b && tipFor) hideTip();
});
document.addEventListener('focusin', (ev) => ev.target.matches?.('[data-tip]:focus-visible') && showTip(ev.target));
document.addEventListener('focusout', (ev) => ev.target === tipFor && hideTip());
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-tip]');
  if (b) {
    if (tipFor === b && !canHover()) hideTip();
    else showTip(b);
  } else if (tipFor) hideTip();
});
addEventListener('scroll', () => tipFor && hideTip(), true);

// ---- Skill picker --------------------------------------------------------------
// Typing in a skill name (or clicking its arrow) opens a list of skills for the
// apparatus; picking one fills in the name and its value / EG (or shorthand / DD).
// Anything else typed is kept as a custom skill with values set by hand.

const picker = { el: null, input: null, items: [], active: -1 };
const SRC_LABEL = { UCG: 'UCG Code of Points', WG: 'World Gymnastics Code of Points', USAG: 'USAG Xcel / Development Program values', UCGM: 'UCG Masters Code of Points' };
const SRC_SHORT = { UCGM: 'Masters' };
// "Masters PB 12 (page 7)": the Masters lists number their boxes per page.
const boxTitle = (s) => `${SRC_LABEL[s.src] || s.src}${s.box ? `: box ${s.box.replace(/^\S+ /, '')}` : ''}${s.page ? `, page ${s.page}` : ''}`;

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
      const more = e.target.closest('.pop-note.more');
      if (more) {
        more.classList.replace('more', 'open');
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
      else if (fam === 'infinity' || fam === 'xcel') tests.push((s) => String(s.group) === eg);
      else if (fam === 'wagMasters') tests.push((s) => String(s.mgroup || WG_TO_MASTERS[evId]?.[s.group]) === eg);
      labels.push(fam === 'infinity' || fam === 'xcel' ? `group ${eg}` : `EG ${ROMAN[eg] || eg}`);
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
    picker.openedAt = performance.now();
    makeRoom();
  }
  if (input.dataset.vault != null) {
    picker.vault = true;
    picker.filter = null;
    const all = [{ id: '', name: '— No vault —', meta: '' }, ...vaultChoices(e)];
    picker.items = query ? all.filter((v) => v.id && matchesQuery(query, vaultSearchText(v.name))) : all;
    picker.active = query && picker.items.length ? 0 : -1;
    input.setAttribute('aria-expanded', 'true');
    renderPicker(query);
    el.hidden = false;
    el.scrollTop = 0;
    placePicker();
    return;
  }
  picker.vault = false;
  const fam = levelInfo(e.disc, e.level).family;
  const all = searchSkills(e.disc, searchApp(e, input.dataset.ev), query).filter(
    (s) => (e.disc !== 'wag' || wagSkillAllowed(fam, e.level, s)) && (e.disc !== 'mag' || magSkillAllowed(e.level, s))
  );
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
  markLongNotes();
}

// Touch screens: a note cut off at two lines shows "More", and a tap on it shows the rest
// (the tap doesn't pick the skill; once the note is open, tapping it picks as usual).
// With a mouse the whole note is in the row's tooltip.
function markLongNotes() {
  if (canHover()) return;
  $$('.pop-note', picker.el).forEach((n) => n.classList.toggle('more', n.scrollHeight > n.clientHeight + 1));
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
  const html = [];
  if (picker.vault) {
    let last;
    picker.items.forEach((v, i) => {
      if (!query && v.head && v.head !== last) html.push(`<div class="pop-head" role="presentation">${esc((last = v.head))}</div>`);
      html.push(`<div class="pop-opt vault-opt${i === picker.active ? ' active' : ''}" role="option" id="pop-opt-${i}" data-skill="${i}" aria-selected="${i === picker.active}">
        <span class="pop-name">${esc(v.name)}</span><span class="pop-meta">${esc(v.meta)}</span></div>`);
    });
    if (!picker.items.length) html.push(`<div class="pop-empty">No vaults at this level match. Try other words, or open the list.</div>`);
    picker.el.innerHTML = html.join('');
    setActive(picker.active);
    return;
  }
  const spec = eventSpec(e, picker.input.dataset.ev);
  if (picker.notice) html.push(`<div class="pop-notice" role="status">${esc(picker.notice)}</div>`);
  if (picker.filter) {
    html.push(`<div class="pop-filter" role="presentation"><span>Only ${esc(picker.filter.label)} skills${picker.hidden ? ` (${picker.hidden} hidden)` : ''}</span><button type="button" class="pop-filter-btn" data-show-all>Show all</button></div>`);
  }
  let lastHead;
  picker.items.forEach((s, i) => {
    const head = e.disc === 'tt' ? null : e.disc === 'mag' ? (s.eg ? `EG ${ROMAN[s.eg]} · ${spec.groups?.[s.eg - 1]?.label.replace(/^[IV]+\. /, '') || ''}` : 'No element group (no EG bonus)') : s.mgroup ? `Masters group ${ROMAN[s.mgroup]}` : s.group ? (s.src === 'WG' ? `WG group ${s.group}` : `Group ${s.group}${s.groupName ? ` · ${s.groupName}` : ''}`) : 'Skills';
    if (!query && head && head !== lastHead) {
      html.push(`<div class="pop-head" role="presentation">${esc(head)}</div>`);
      lastHead = head;
    }
    const meta = e.disc === 'tt' ? `${esc(s.notation || '')} · ${fmt(s.dd)}` : `${esc(s.value || 'No value')}${s.eg ? ` · EG ${ROMAN[s.eg]}` : s.mgroup ? ` · ${ROMAN[s.mgroup]}` : s.group ? ` · G${s.group}` : ''}`;
    html.push(`
      <div class="pop-opt${i === picker.active ? ' active' : ''}" role="option" id="pop-opt-${i}" data-skill="${i}" aria-selected="${i === picker.active}"${s.note ? ` title="Note: ${esc(s.note)}"` : ''}>
        <span class="src-badge ${s.src.toLowerCase()}" title="${esc(boxTitle(s))}">${SRC_SHORT[s.src] || s.src}</span>
        <span class="pop-name">${s.box ? `<span class="pop-box">${esc(s.box.replace(/^\S+ /, ''))}</span>` : ''}<span class="pop-text">${esc(s.name)}${s.eponym ? ` <span class="pop-eponym">(${esc(s.eponym)})</span>` : ''}${s.aka?.length ? `<span class="pop-aka">aka ${esc(s.aka.slice(0, 2).join(', '))}</span>` : ''}${s.note ? `<span class="pop-aka pop-note">Note: ${esc(s.note)}</span>` : ''}</span></span>
        <span class="pop-meta">${meta}</span>
      </div>`);
  });
  const srcs = [...new Set(picker.items.map((s) => s.src))];
  html.push(
    picker.items.length
      ? `<div class="pop-foot">${srcs.map((s) => `<span class="src-badge ${s.toLowerCase()}">${SRC_SHORT[s] || s}</span> ${SRC_LABEL[s] || s}`).join(' ')}. Not listed? Type your own name and set the ${e.disc === 'tt' ? 'shorthand and DD' : 'value'} yourself.</div>`
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
  // On phones the event chips stay pinned under the header, and the start value bar at the bottom.
  const chips = isPhone() ? $('#summary')?.getBoundingClientRect().bottom || 0 : 0;
  const bar = $('#sv-bar');
  const barTop = bar && getComputedStyle(bar).position === 'fixed' ? bar.getBoundingClientRect().top : Infinity;
  const top = Math.max(vv ? vv.offsetTop : 0, $('.site-header')?.getBoundingClientRect().bottom || 0, chips);
  const bottom = Math.min(vv ? vv.offsetTop + vv.height : innerHeight, barTop);
  return { top, bottom };
}
const isPhone = () => matchMedia('(max-width: 640px), (pointer: coarse)').matches;

// Phones: scroll the skill box up under the header so the list fits below it, above
// the keyboard (the usual pattern for a search box with suggestions on mobile), also
// after the phone's own scroll to the focused box (which can leave it behind the header).
function makeRoom() {
  if (!picker.input || !isPhone()) return;
  const r = picker.input.getBoundingClientRect();
  const { top, bottom } = visibleArea();
  // Just opened (keyboard sliding up): right up to the top, so the list gets all the room
  // down to the keyboard. Later (e.g. the toolbar resizing as the page scrolls), only when
  // the list has no room or the box is hidden, so it doesn't fight the gymnast's scrolling.
  const want = justOpened() ? Math.abs(r.top - top - 8) > 2 : bottom - r.bottom < 260 || r.top < top;
  if (want) window.scrollBy({ top: r.top - top - 8 });
}
// Just after the list opens, the keyboard is still sliding up and the phone scrolls the
// page, which can briefly hide the box: that isn't the gymnast scrolling away.
const justOpened = () => isPhone() && performance.now() - (picker.openedAt || 0) < 1500;

function placePicker() {
  if (!picker.input) return;
  const r = picker.input.getBoundingClientRect();
  const { top, bottom } = visibleArea();
  if (r.bottom < top || r.top > bottom) {
    if (!justOpened()) return closePicker();
    picker.el.hidden = true; // until the box is back in view
    return makeRoom();
  }
  picker.el.hidden = false;
  const w = Math.min(Math.max(r.width + 60, 440), innerWidth - 16);
  const left = Math.min(Math.max(8, r.left), innerWidth - w - 8);
  const below = bottom - r.bottom - 8;
  const above = r.top - top - 8;
  // Below the box unless there's clearly more room above (never on phones: there the box is moved up instead).
  const phone = isPhone();
  const up = !phone && below < 240 && above > below;
  // Phones: the list fills the space down to the keyboard.
  const maxHeight = phone ? Math.max(120, below) : Math.max(120, Math.min(380, up ? above : below));
  // Phones: the list sits in the page right under its box (position: absolute), so it stays
  // attached however iOS pans the screen for the keyboard; a fixed list can end up over the box.
  picker.el.classList.toggle('in-page', phone);
  const dx = phone ? scrollX : 0;
  const dy = phone ? scrollY : 0;
  Object.assign(picker.el.style, { left: `${left + dx}px`, width: `${w}px`, maxHeight: `${maxHeight}px`, bottom: '' });
  picker.el.style.top = up ? `${Math.max(top, r.top - 4 - Math.min(picker.el.scrollHeight, maxHeight))}px` : `${r.bottom + 4 + dy}px`;
}

function pickSkill(i) {
  const s = picker.items[i];
  const input = picker.input;
  if (!s || !input) return;
  const e = entry();
  if (picker.vault) {
    e.vault = s.id;
    if (e.vaultFlag) {
      delete e.vaultFlag;
      $('.vault-flag')?.remove();
    }
    input.value = vaultName(e);
    closePicker();
    updateComputed();
    scheduleSave();
    return;
  }
  const evId = input.dataset.ev;
  const pass = input.dataset.pass;
  const row = rowsOf(e, evId, pass)[Number(input.dataset.idx)];
  const fam = levelInfo(e.disc, e.level).family;
  row.name = s.label;
  row.skillId = s.id;
  row.fromList = true; // its values came from the list, so they don't filter it next time
  clearRevalueFlags(row);
  if (e.disc === 'tt') Object.assign(row, { notation: s.notation || '', dd: s.dd });
  else {
    const letters = eventSpec(e, evId).letters;
    if (letters.includes(s.value)) row.letter = s.value;
    else if (!s.value) row.letter = ''; // a listed skill with no value (Sapphire / Infinity no-value cast)
    if (fam === 'mag') row.eg = s.eg ? String(s.eg) : '';
    if (fam === 'infinity' || fam === 'xcel') row.eg = s.group ? String(s.group) : '';
    // WAG Masters: UCG Masters skills carry their own condensed group; WG groups are mapped.
    if (fam === 'wagMasters') row.eg = s.mgroup ? String(s.mgroup) : s.group && WG_TO_MASTERS[evId]?.[s.group] ? String(WG_TO_MASTERS[evId][s.group]) : '';
  }
  closePicker();
  renderRows(evId, pass, { row: Number(input.dataset.idx), part: isPhone() ? null : 'name' });
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
    if (it.repeatWhy === 'dmtFirst' || it.repeatWhy === 'dmtDismount') return ['Repeat', `Repeats pass 1's ${it.repeatWhy === 'dmtFirst' ? 'first skill' : 'dismount'} in the same position: no difficulty`];
    if (it.repeatWhy === 'fulls') return ['4th full', 'Fulls earn difficulty at most 3 times per pass'];
    if ('dd' in it) return [`Repeat of Skill ${n}`, `Repeat of skill ${n}: a repeated skill gets no difficulty`];
    return [`Repeat of Skill ${n}`, `Repeat of skill ${n}: each element only earns value-part credit once`];
  }
  if (it.status === 'restricted') return ['Restricted', `${it.restrictWhy || 'Above this level’s allowed difficulty'}: −0.50, and no value part credit`];
  if (it.flag === 'over') return ['Check level', 'This skill is outside what this level allows'];
  if (it.status !== 'noncounting') return ['', ''];
  if (it.reason === 'eg') return ['Over 4 in EG', 'Only 4 skills from one element group count, so this one adds no difficulty'];
  if (it.reason === 'sr') return ['Over 3 EG II/III', 'Only 3 EG II or III skills count before a B or higher EG I skill'];
  if (it.reason === 'egOnly') return ['EG credit only', 'Not one of your counting skills, but it earns its element group bonus'];
  if (it.reason === 'offLevel') return ['Not at this level', "Not allowed at this level (search hides it), so it earns no credit: no value, element group, requirement or bonus"];
  if (it.reason === 'onlyOne') return ['Only one allowed', 'Only one tap swing or underswing with counterswing is allowed at Platinum, so this one earns no credit'];
  if (it.reason === 'extraVp') return ['Extra', 'Not needed for this level’s value parts'];
  if (it.reason === 'noValue') return it.skillId ? ['No value', 'This skill has no value, so it adds nothing to the D score'] : ['', ''];
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
    const row = list[it.idx];
    const [text, title] = row?.noCredit
      ? ['Not credited here', "None of the codes this level uses has this skill, so it earns nothing. Pick a replacement or remove it."]
      : flagFor(it, spec)[0]
        ? flagFor(it, spec)
        : row?.approx
          ? ['Approximate', 'Re-valued from a broader entry: the value depends on which version is performed. Check it.']
          : row?.check
            ? ['Check value', "Typed in by hand, so it couldn't be re-valued for this level."]
            : row?.matchedFrom
              ? ['Matched', `Brought over as “${row.matchedFrom}” and matched to this listed skill (same value and group). Check it's the skill performed.`]
            : ['', ''];
    const flagEl = $('[data-calc="flag"]', rowEl);
    flagEl.textContent = text;
    // A tap (or hover, or keyboard focus) shows why, in the tip bubble.
    if (title) flagEl.dataset.tip = title;
    else delete flagEl.dataset.tip;
    flagEl.tabIndex = title ? 0 : -1;
    flagEl.setAttribute('role', title ? 'button' : 'presentation');
    if (title) flagEl.setAttribute('aria-label', `${text}: ${title}`);
    else flagEl.removeAttribute('aria-label');
    rowEl.classList.toggle('flagged', !!text);
    const listed = findSkill(row?.skillId);
    const src = listed?.src || (it.name ? 'Custom' : '');
    const badge = $('[data-calc="src"]', rowEl);
    // A listed skill shows its box number in its code ("WG I.75", "Xcel 7.104") so it can be checked.
    badge.textContent = listed?.box || SRC_SHORT[src] || src;
    badge.className = `src-badge ${src.toLowerCase()}`;
    badge.title = src === 'Custom' ? 'Not from the skill list: values are set by hand' : listed ? boxTitle(listed) : '';
    $('.skill-input', rowEl).title = it.name;
    // The folded row on phones: the name, then difficulty · group · where it's from.
    $('[data-calc="sum-name"]', rowEl).textContent = row?.name || 'Add a skill';
    const group = spec.groups && row?.eg ? spec.groups.find((g) => String(g.value) === String(row.eg))?.label : '';
    const meta = spec.columns === 'dd'
      ? [row?.notation || '', row?.dd !== '' && row?.dd != null ? `DD ${fmt(row.dd)}` : '']
      : [row?.letter || '–', spec.groups ? (group ? shortGroupRow(group) : 'EG –') : '', listed?.box || (it.name ? (SRC_SHORT[src] || src) : '')];
    $('[data-calc="sum-meta"]', rowEl).textContent = row?.name || row?.letter || row?.notation ? meta.filter(Boolean).join(' · ') : '';
  }
}
// "II. Forward acrobatic elements" -> "II Forward acro"; "7. Walkovers/Cartwheels etc." -> "G7 Walkovers/Cartwheels etc."
const shortGroupRow = (label) => {
  const [, k, name] = label.match(/^(\w+)\. (.*)$/) || [, '', label];
  return /^\d+$/.test(k) ? `G${k} ${name}` : `${k} ${shortGroup(name)}`;
};

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
        const addBtn = $(`[data-add-skill="${ev.id}"][data-pass="${p}"]`, card);
        if (addBtn) addBtn.hidden = e.passes[ev.id][p].skills.length >= maxRows(e, ev.id, p, MAX_ROWS);
      });
    } else {
      updateRows($(`[data-routine="${ev.id}"]`, card), r.items, spec, e.routines[ev.id]);
      const counting = r.items.filter((it) => it.status === 'counting').length;
      const listed = r.items.filter((it) => it.status !== 'blank').length;
      const count = $('[data-calc="count"]', card);
      if (count) count.textContent = spec.columns === 'dd' ? `${listed} skill${listed === 1 ? '' : 's'} listed` : spec.maxCounting ? `${counting} of ${spec.maxCounting} counting · ${listed} listed` : `${listed} listed`;
      $(`[data-add-skill="${ev.id}"]`, card).hidden = e.routines[ev.id].length >= maxRows(e, ev.id, null, MAX_ROWS);
    }

    for (const o of spec.options) {
      const row = $(`[data-option-row="${ev.id}:${o.id}"]`, card);
      const el = $(`[data-calc="opt-${o.id}"]`, card);
      if (!row || !el) continue;
      // Met by a skill in the routine (rings swing to handstand, floor double flips):
      // tick it and say which skill.
      const met = o.detect || o.connect ? r.detected?.[o.id] : null;
      if (o.connect) $('[data-help]', row).textContent = met ? `Earned by ${met}.` : o.help;
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
    if (spec.sr) {
      spec.sr.forEach((_, i) => {
        const row = $(`[data-sr-row="${ev.id}:${i}"]`, card);
        if (!row) return;
        $('input', row).checked = !!r.sr?.[i];
        $('[data-sr-how]', row).textContent = srHow(r, i, e.options?.[ev.id]?.srSet?.[i]);
      });
    }
    const vrow = $(`[data-option-row="vt:altBoard"]`, card);
    if (vrow) vrow.classList.toggle('on', !!e.options?.vt?.altBoard);

    const perGroup = groupBonuses(r);
    $$('.cg-list li', card).forEach((li) => {
      const k = Number(li.dataset.cg);
      li.classList.toggle('earned', (r.earnedGroups || []).includes(k));
      $('[data-cg-val]', li).textContent = perGroup[k] ? `+${fmt(perGroup[k])}` : '';
    });
    const egTotal = (r.totals || []).find(([label]) => label === 'EG bonus')?.[1];
    const totalEl = $('[data-cg-total]', card);
    if (totalEl) totalEl.textContent = egTotal ? `+${fmt(egTotal)}` : '0.0';
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
      .join('') + (score.allAround == null ? '' : `<div class="stat stat-aa"><span>All-around</span><strong>${fmt(score.allAround)}</strong></div>`);
  const n = D.events.length + (score.allAround == null ? 0 : 1);
  $('#summary').dataset.count = n;
  $('#summary').style.setProperty('--n', n);
  // Phones: the chips scroll sideways; keep the open event's chip in view.
  const chips = $('#summary');
  const open = $('.stat-tab.active', chips);
  if (isPhone() && open && (open.offsetLeft < chips.scrollLeft || open.offsetLeft + open.offsetWidth > chips.scrollLeft + chips.clientWidth)) {
    chips.scrollLeft = open.offsetLeft - 16;
  }
  // Phones: the open event's start value stays in a bar at the bottom of the screen.
  const curEv = eventInfo(e.disc, cur);
  const curSv = score.events[cur].sv;
  $('#sv-bar-label').textContent = `${curEv.short} ${e.disc === 'tt' ? 'difficulty' : 'start value'}`;
  $('#sv-bar-value').textContent = curSv == null ? '—' : e.disc === 'tt' ? `DD ${fmt(curSv)}` : fmt(curSv);
  $('#sv-breakdown').onclick = () => openBreakdown(cur);
  $('#summary').onclick = (ev) => {
    const t = ev.target.closest('[data-tab]');
    if (t) selectTab(t.dataset.tab, ev.detail === 0); // Enter / Space: keep focus on the redrawn tab
  };
  $('#summary').onkeydown = onTabKey;
}

// What each element group adds: MAG reports it per group; UCG Infinity and WAG Masters
// credit it to the skill that earned it.
const ROMAN_KEY = { I: 1, II: 2, III: 3, IV: 4 };
function groupBonuses(r) {
  if (r.egBonus) return Object.fromEntries(Object.entries(r.egBonus).map(([k, v]) => [Number(k), v]));
  const out = {};
  for (const it of r.items || []) {
    if (!it.bonus) continue;
    const k = it.condensed ? ROMAN_KEY[it.condensed] ?? Number(it.condensed) : Number(it.eg);
    if (k) out[k] = (out[k] || 0) + it.bonus;
  }
  return out;
}

// Phones: "Breakdown" opens a sheet with the parts of the start value and the element groups.
function openBreakdown(evId) {
  const e = entry();
  const ev = eventInfo(e.disc, evId);
  const r = scoreEvent(e, evId);
  $('#breakdown')?.remove();
  const dlg = document.createElement('dialog');
  dlg.id = 'breakdown';
  dlg.className = 'modal sheet';
  dlg.setAttribute('aria-label', `${ev.label} breakdown`);
  const totals = r.totals || [];
  const last = totals.length - 1;
  const cg = $(`[data-event-card="${evId}"] .cg-card`);
  const notes = [...(r.notes || []), ...(r.warnings || [])];
  dlg.innerHTML = `
    <div class="modal-body">
      <div class="sheet-head">
        <div><span class="sheet-label">${esc(ev.label)}</span><strong class="sheet-value">${r.sv == null ? '—' : e.disc === 'tt' ? `DD ${fmt(r.sv)}` : fmt(r.sv)}</strong></div>
        <button type="button" class="icon-btn" data-close aria-label="Close">${ICON_X}</button>
      </div>
      <dl class="sheet-totals">${totals.map(([label, value], i) => `<div${i === last ? ' class="grand"' : ''}><dt>${esc(label)}</dt><dd>${i === last ? fmt(value) : signed(value)}</dd></div>`).join('')}</dl>
      ${cg ? `<div class="sheet-cg">${cg.innerHTML}</div>` : ''}
      ${notes.length ? `<ul class="sheet-notes">${notes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    </div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (x) => (x.target === dlg || x.target.closest('[data-close]')) && dlg.close());
  dlg.showModal();
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
    if (isStale(err)) reportError(err); // a newer version replaced this page's PDF code: offer Reload
    else alert(`Could not create the PDF: ${err?.message || err}`);
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
  stopWatching();
  stopWatching = () => {};
  renderUserArea();
  $('#guest-banner').hidden = !user?.guest;
  if (!user) {
    state.athletes = [];
    renderAthletePicker();
    renderSignIn();
    renderMoveBanner();
    return;
  }
  $('#local-banner').hidden = !user.local;
  if (user.guest) {
    state.athletes = [];
    state.athleteId = null;
    state.entryId = null;
    renderAll();
    renderMoveBanner();
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
  renderMoveBanner();
  if (!user.local) stopWatching = store.watchAthletes(applyRemote);
}

// ---- Feedback -----------------------------------------------------------------------
// "Send feedback" in the account menu: js/feedback.js sends it with who and where it came from.
function feedbackContext() {
  const u = state.user;
  const a = athlete();
  const e = entry();
  // Every column says something, so a blank never looks like a lost answer.
  const signedIn = u && !u.guest && !u.local;
  return {
    name: !u ? 'Not signed in' : u.guest ? 'Guest (not signed in)' : u.local ? 'Local mode' : u.displayName || '(no name)',
    email: signedIn ? u.email || '(no email)' : '(not signed in)',
    athlete: a ? a.name || 'Unnamed athlete' : !u ? '(sign-in screen)' : '(no athlete open)',
    level: e ? levelInfo(e.disc, e.level)?.name || e.level : a ? '(no level yet)' : '(none)',
    apparatus: e ? eventInfo(e.disc, currentEvent(e))?.label || '' : '(none)',
  };
}

// ---- Errors -------------------------------------------------------------------------
// Anything unexpected shows a message with a Reload button instead of failing silently.
// Harmless browser noise and dropped connections (handled where they happen) are ignored.
const IGNORED_ERRORS = /ResizeObserver loop|AbortError|aborted|^Failed to fetch$|^Load failed$|NetworkError when attempting to fetch/i;
function reportError(err) {
  const msg = String(err?.message || err || '');
  if (!msg || err?.name === 'AbortError' || IGNORED_ERRORS.test(msg)) return;
  showToast('error-toast', isStale(err) ? 'A new version of the planner is available.' : 'Something went wrong.', 'Reload', () => guestOkToReload() && location.reload());
}
// A lazy part of the planner that no longer exists: a newer version has replaced this page's.
function isStale(err) {
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported/i.test(String(err?.message || err || ''));
}
addEventListener('error', (ev) => reportError(ev.error || ev.message));
addEventListener('unhandledrejection', (ev) => reportError(ev.reason));

// ---- Updates ----------------------------------------------------------------------
// The built site runs a service worker (tools/sw-template.js) that keeps the planner on the
// device. A new deploy installs in the background; offer to switch to it.
function watchForUpdates() {
  const sw = navigator.serviceWorker;
  if (!sw) return;
  const hadController = !!sw.controller; // the very first install doesn't need a reload
  let reloading = false;
  // Safe to switch versions without asking: nothing is waiting to save, and no guest
  // work would be lost by the reload.
  const idle = () => !saveTimers.size && !guestHasWork() && !$('dialog[open]');
  // Another tab switched to the new version (every tab gets this): reload only if nothing
  // would be lost, otherwise offer it.
  sw.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    if (idle()) {
      reloading = true;
      location.reload();
    } else showReload();
  });
  sw.getRegistration().then((reg) => {
    if (!reg) return;
    const offer = (worker) => worker && sw.controller && showUpdate(worker);
    // Downloaded on an earlier visit and the page has only just opened: switch now
    // (phones rarely see the "new version" bar, and a plain refresh keeps the old copy).
    if (reg.waiting && sw.controller && idle()) reg.waiting.postMessage('skipWaiting');
    else offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => w.state === 'installed' && offer(w));
    });
    document.addEventListener('visibilitychange', () => {
      // Back in the foreground: look for a new version.
      if (document.visibilityState === 'visible') return reg.update().catch(() => {});
      // Going to the background with a new version ready: switch while nobody's looking.
      if (reg.waiting && sw.controller && idle()) reg.waiting.postMessage('skipWaiting');
    });
  });
}
function showUpdate(worker) {
  if (!$('#update-toast')) showToast('update-toast', 'A new version of the planner is ready.', 'Reload', () => guestOkToReload() && worker.postMessage('skipWaiting'));
}
function showReload() {
  if (!$('#update-toast')) showToast('update-toast', 'A new version of the planner is ready.', 'Reload', () => guestOkToReload() && location.reload());
}
// Not signed in, a reload loses everything: ask first (iPhones show no "leave page" warning).
const guestOkToReload = () =>
  !guestHasWork() || (reloadConfirmed = confirm("You're not signed in, so reloading clears your athletes and routines. Reload anyway?"));
watchForUpdates();

store.init(onUser).catch((e) => {
  console.error(e);
  app.innerHTML = `<p class="error">Could not start the app: ${esc(e?.message || e)}</p>`;
});
