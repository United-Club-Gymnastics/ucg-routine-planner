// PDF export for every level:
//   MAG Dev / Int / Adv, MAG + WAG Masters: fill in the official start value worksheets
//   T&T: fill in the competition cards (NAIGC logo removed, requirements corrected)
//   UCG Infinity: Julia Sharpe's worksheet (pdf-infinity.js)
//   Xcel: a UCG Xcel worksheet drawn here (there is no official one)
// The official sheets aren't fillable forms, so answers are written at fixed
// positions measured from each sheet, in PDF points from the top left.
import { PDFDocument, StandardFonts, rgb } from 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.esm.min.js';
import { DISCIPLINES, DECADE_LABELS, eventInfo, eventSpec, levelInfo, scoreEntry } from './model.js';
import { XCEL_SR, XCEL_VP } from './data/xcel.js';

const PAGE_H = 792;
const INK = rgb(0.094, 0.294, 0.337); // UCG dark blue green, reads as "filled in"
const NAVY = rgb(0.118, 0.169, 0.22);
const MUTED = rgb(0.29, 0.353, 0.4);
const LINE = rgb(0.647, 0.784, 0.812);
const fmt = (n) => (n == null ? '' : Number(n).toFixed(1));
const ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };

// ---- shared drawing helpers ----------------------------------------------------

function safeText(font, text) {
  const s = String(text ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/≥/g, '>=');
  return [...s]
    .map((ch) => {
      try {
        font.encodeText(ch);
        return ch;
      } catch {
        return '?';
      }
    })
    .join('');
}

// x, y measured from the top left; y is the text baseline. Some templates'
// media boxes don't start at 0 (the T&T cards start at y = 7.92), so measure
// from the box's top edge.
function writer(page, fonts, color = INK) {
  const mb = page.getMediaBox();
  const PAGE_H = mb.y + mb.height;
  const text = (s, x, y, { size = 10, font = fonts.regular, maxWidth, c = color } = {}) => {
    let t = safeText(font, s);
    if (maxWidth) {
      while (size > 6 && font.widthOfTextAtSize(t, size) > maxWidth) size -= 0.5;
      while (t.length > 1 && font.widthOfTextAtSize(t, size) > maxWidth) t = t.slice(0, -1);
    }
    page.drawText(t, { x, y: PAGE_H - y, size, font, color: c });
    return font.widthOfTextAtSize(t, size);
  };
  const center = (s, cx, y, opts = {}) => {
    const font = opts.font || fonts.regular;
    const size = opts.size || 10;
    const t = safeText(font, s);
    text(t, cx - font.widthOfTextAtSize(t, size) / 2, y, opts);
  };
  const line = (x1, y1, x2, y2, thickness = 0.75, c = LINE) => page.drawLine({ start: { x: x1, y: PAGE_H - y1 }, end: { x: x2, y: PAGE_H - y2 }, thickness, color: c });
  const box = (x, y, w, h, { border = LINE, thickness = 0.75, fill } = {}) =>
    page.drawRectangle({ x, y: PAGE_H - y - h, width: w, height: h, borderColor: border, borderWidth: thickness, color: fill });
  const ellipse = (cx, cy, rx, ry) => page.drawEllipse({ x: cx, y: PAGE_H - cy, xScale: rx, yScale: ry, borderColor: color, borderWidth: 1.5 });
  const check = (x, y) => {
    page.drawLine({ start: { x: x + 2, y: PAGE_H - y - 6 }, end: { x: x + 5.5, y: PAGE_H - y - 10 }, thickness: 1.8, color });
    page.drawLine({ start: { x: x + 5.5, y: PAGE_H - y - 10 }, end: { x: x + 11, y: PAGE_H - y - 1 }, thickness: 1.8, color });
  };
  return { text, center, line, box, ellipse, check };
}

const templates = {};
async function template(url) {
  if (!templates[url]) {
    templates[url] = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`Could not load the worksheet (${url})`);
      return res.arrayBuffer();
    });
  }
  return PDFDocument.load(await templates[url]);
}
async function addTemplatePage(doc, url) {
  const t = await template(url);
  const [page] = await doc.copyPages(t, [0]);
  doc.addPage(page);
  return page;
}

// ---- MAG Developmental / Intermediate / Advanced ---------------------------------

const MAG_LAYOUTS = {
  dev: {
    url: 'assets/worksheets/dev.pdf', name: { x: 157, y: 83 }, event: { x: 385, y: 83 },
    cols: [[75.5, 296.5], [296.5, 355.5], [355.5, 410.5], [410.5, 470.5], [470.5, 542.5]], rowTop: 242.5, rowH: 24.7,
    lines: { x: 516, ys: [426.5, 482.7, 538.2, 579.4] }, fill: ['skillsAndBonus', 'eg', 'base', 'sv'],
  },
  int: {
    url: 'assets/worksheets/int.pdf', name: { x: 157, y: 83 }, event: { x: 385, y: 83 },
    cols: [[75.5, 296.5], [296.5, 355.5], [355.5, 410.5], [410.5, 470.5], [470.5, 555.5]], rowTop: 228.5, rowH: 24.75,
    lines: { x: 512, ys: [476, 532.2, 588.5, 644, 685.3] }, fill: ['skills', 'eg', 'bonus', 'base', 'sv'],
  },
  adv: {
    url: 'assets/worksheets/adv.pdf', name: { x: 139, y: 75.5 }, event: { x: 367, y: 75.5 },
    cols: [[57.5, 265.5], [265.5, 323.5], [323.5, 382.5], [382.5, 471.5], [471.5, 540.5]], rowTop: 191.5, rowH: 24.75,
    lines: { x: 494, ys: [434.8, 553.3, 604.3, 641, 667.3] }, fill: ['skills', 'eg', 'bonus', 'base', 'sv'],
    deductions: { fx: { x: 282, y: 701.8 }, sr: { x: 309, y: 715.3 } },
  },
};

async function magPage(doc, fonts, athlete, entry, evId, r) {
  const L = MAG_LAYOUTS[entry.level];
  const page = await addTemplatePage(doc, L.url);
  const w = writer(page, fonts);
  w.text(athlete.name, L.name.x, L.name.y - 1, { size: 11, font: fonts.bold, maxWidth: 180 });
  w.text(eventInfo('mag', evId).label, L.event.x, L.event.y - 1, { size: 11, font: fonts.bold, maxWidth: 140 });
  (r.rows || []).forEach((row, i) => {
    const y = L.rowTop + i * L.rowH + L.rowH / 2 + 3.5;
    const [name, diff, value, eg] = L.cols;
    w.text(row.name, name[0] + 20, y, { maxWidth: name[1] - name[0] - 26 });
    w.center(row.letter, (diff[0] + diff[1]) / 2, y);
    if (row.letter) w.center(fmt(row.value), (value[0] + value[1]) / 2, y);
    if (row.eg) w.center(String(row.eg), (eg[0] + eg[1]) / 2, y);
  });
  const values = {
    skills: fmt(r.difficulty),
    skillsAndBonus: fmt((r.difficulty || 0) + (r.bonus || 0)),
    eg: fmt(r.egTotal),
    bonus: fmt(r.bonus),
    base: fmt(10 - (r.shortDeduction || 0)),
    sv: fmt(r.sv),
  };
  if (r.sv != null) L.fill.forEach((key, i) => w.text(values[key], L.lines.x, L.lines.ys[i] - 3, { size: 11, font: key === 'sv' ? fonts.bold : fonts.regular }));
  const mark = L.deductions?.[evId];
  if (mark && r.deductions) w.text(`<-- applies to this routine (-${fmt(r.deductions)})`, mark.x, mark.y, { size: 9, font: fonts.bold });
  const spec = eventSpec(entry, evId);
  const bonuses = spec.options.filter((o) => r.optionValues?.[o.id]).map((o) => `${o.label} +${fmt(r.optionValues[o.id])}`);
  const notes = [];
  if (bonuses.length) notes.push(`Bonuses${L.fill.includes('skillsAndBonus') ? ' (included in line 1)' : ''}: ${bonuses.join(', ')}.`);
  if (r.capped) notes.push(`Start value capped at ${fmt(r.cap)} (${fmt(r.raw)} before the cap).`);
  notes.forEach((n, i) => w.text(n, L.cols[0][0], 740 + i * 13, { size: 9, maxWidth: 480 }));
}

// ---- Masters (MAG + WAG) -------------------------------------------------------

const MASTERS_LAYOUTS = {
  mag: { url: 'assets/worksheets/mag-masters.pdf', y1: 76.6, y2: 91.6, rowTop: 177.5, lines: [362.4, 433.6, 504.1, 534.1] },
  wag: { url: 'assets/worksheets/wag-masters.pdf', y1: 67.6, y2: 82.6, rowTop: 183.5, lines: [368.4, 424.6, 495.1, 525.1] },
};
const MASTERS_COLS = [[75.5, 289.5], [289.5, 428.5], [428.5, 484.5], [484.5, 570.5]];

async function mastersPage(doc, fonts, athlete, entry, evId, r) {
  const L = MASTERS_LAYOUTS[entry.disc];
  const page = await addTemplatePage(doc, L.url);
  const w = writer(page, fonts);
  w.text(athlete.name, 159, L.y1 - 1, { size: 11, font: fonts.bold, maxWidth: 170 });
  w.text(DECADE_LABELS[entry.decade] || '', 408, L.y1 - 1, { size: 10, font: fonts.bold, maxWidth: 34 });
  w.text(eventInfo(entry.disc, evId).short, 536, L.y1 - 1, { size: 10, font: fonts.bold, maxWidth: 44 });
  w.text(athlete.club, 217, L.y2 - 1, { size: 11, font: fonts.bold, maxWidth: 200 });
  const rowH = 24.83;
  (r.rows || []).slice(0, 6).forEach((row, i) => {
    const y = L.rowTop + i * rowH + rowH / 2 + 3.5;
    const [name, diff, value, eg] = MASTERS_COLS;
    w.text(row.name, name[0] + 20, y, { maxWidth: name[1] - name[0] - 26 });
    w.center(row.letter === 'ME' ? 'Masters' : row.letter, (diff[0] + diff[1]) / 2, y);
    if (row.letter) w.center(fmt(row.value), (value[0] + value[1]) / 2, y);
    if (row.eg) w.center(ROMAN[row.eg] || String(row.eg), (eg[0] + eg[1]) / 2, y);
  });
  if (r.sv != null) {
    [fmt(r.difficulty), fmt(r.egTotal), fmt(10 - (r.shortBy || r.shortDeduction || 0)), fmt(r.sv)].forEach((v, i) =>
      w.text(v, 512, L.lines[i] - 3, { size: 11, font: i === 3 ? fonts.bold : fonts.regular })
    );
  }
  const extra = (r.items || []).filter((it) => it.reason === 'egOnly');
  if (extra.length) w.text(`EG bonus also from skills outside the 6 counting: ${extra.map((x) => x.name).join(', ')}.`, 75, 560, { size: 9, maxWidth: 480 });
}

// ---- T&T competition cards -----------------------------------------------------

const LEVEL_X = { nf: [169.3, 253.2], if: [281.7, 420.1], hf: [448.0, 533.9] };
const TT_CARDS = {
  tr: { url: 'assets/worksheets/tt-tr.pdf', levelY: [105.7, 128.4], name: [96, 165], club: [131, 205], cols: [54.4, 395.8, 476.8, 557.7], passes: [{ top: 259.7, h: 27.1, n: 10 }] },
  sy: { url: 'assets/worksheets/tt-sy.pdf', levelY: [92.9, 115.6], name: [101, 141.5], club: [146, 177.5], cols: [54.4, 395.8, 476.8, 557.7], passes: [{ top: 227.8, h: 29.8, n: 10 }] },
  dmt: { url: 'assets/worksheets/tt-dmt.pdf', levelY: [105.7, 128.4], name: [96, 165], club: [131, 205], cols: [54.4, 369, 473, 557.7], labelled: true,
    passes: [{ top: 280.2, h: 38.5, n: 2 }, { top: 459.8, h: 38.5, n: 2 }] },
  'tu-nf': { url: 'assets/worksheets/tt-tu-nf.pdf', name: [96, 113], club: [131, 145], cols: [54.4, 383.1, 482.9, 557.7], passes: [{ top: 194.7, h: 23.1, n: 7 }, { top: 427.8, h: 23.1, n: 7 }] },
  'tu-if': { url: 'assets/worksheets/tt-tu-if.pdf', name: [96, 113], club: [131, 145], cols: [54.4, 383.1, 482.9, 557.7], passes: [{ top: 194.1, h: 22.4, n: 8 }, { top: 435.2, h: 22.4, n: 8 }] },
  'tu-hf': { url: 'assets/worksheets/tt-tu-hf.pdf', name: [96, 113], club: [131, 145], cols: [54.4, 383.1, 482.9, 557.7], passes: [{ top: 194.1, h: 22.4, n: 8 }, { top: 435.2, h: 22.4, n: 8 }] },
};

async function ttPage(doc, fonts, athlete, entry, evId) {
  const key = evId === 'tu' ? `tu-${entry.level}` : evId;
  const C = TT_CARDS[key];
  const page = await addTemplatePage(doc, C.url);
  const w = writer(page, fonts);
  const synchroPartner = evId === 'sy' ? entry.options?.sy?.partner : '';
  w.text(synchroPartner ? `${athlete.name} & ${synchroPartner}` : athlete.name, C.name[0], C.name[1], { size: 13, font: fonts.bold, maxWidth: 330 });
  w.text(athlete.club, C.club[0], C.club[1], { size: 13, font: fonts.bold, maxWidth: 300 });
  if (C.levelY) {
    const [x0, x1] = LEVEL_X[entry.level];
    w.ellipse((x0 + x1) / 2, (C.levelY[0] + C.levelY[1]) / 2 + 1, (x1 - x0) / 2 + 8, 14);
  }
  const lists = evId === 'tu' || evId === 'dmt' ? (entry.passes?.[evId] || []).map((p) => p.skills || []) : [entry.routines?.[evId] || []];
  const [x0, x1, x2, x3] = C.cols;
  C.passes.forEach((P, pi) => {
    (lists[pi] || []).filter((s) => s.name || s.notation).slice(0, P.n).forEach((s, i) => {
      const y = P.top + i * P.h + P.h / 2 + 4;
      w.text(s.name, x0 + (C.labelled ? 62 : 22), y, { size: 11, maxWidth: x1 - x0 - (C.labelled ? 68 : 28) });
      w.center(s.notation, (x1 + x2) / 2, y, { size: 11 });
      if (s.dd !== '' && s.dd != null) w.center(fmt(s.dd), (x2 + x3) / 2, y, { size: 11 });
    });
  });
}

// ---- Xcel: a UCG worksheet (no official one exists) -----------------------------

async function xcelPages(doc, fonts, athlete, entry, events, score) {
  const L = levelInfo('wag', entry.level);
  const logo = await loadLogo(doc);
  for (const evId of events) {
    const page = doc.addPage([612, 792]);
    const w = writer(page, fonts, NAVY);
    const ev = eventInfo('wag', evId);
    const r = score.events[evId];
    let y = 46;
    if (logo) {
      const h = 30;
      page.drawImage(logo, { x: 48, y: PAGE_H - y - h + 8, width: (logo.width / logo.height) * h, height: h });
    }
    w.text(`${L.name} Start Value Worksheet`, 48, y + 44, { size: 20, font: fonts.bold });
    w.text(ev.label, 48, y + 62, { size: 12, c: MUTED });
    y += 90;
    const field = (label, value, x, width) => {
      const lw = w.text(label, x, y, { size: 10, font: fonts.bold });
      w.line(x + lw + 4, y + 2, x + width, y + 2, 0.6, NAVY);
      w.text(value, x + lw + 8, y - 1, { size: 11, maxWidth: width - lw - 10, c: INK });
    };
    field('Gymnast name:', athlete.name, 48, 300);
    field('Club:', athlete.club, 362, 202);
    y += 28;

    if (ev.kind === 'vault') {
      w.text('Vault', 48, y, { size: 12, font: fonts.bold });
      y += 20;
      const v = r.vault;
      w.text(v ? v.label : 'No vault selected', 48, y, { size: 12, c: INK, maxWidth: 420 });
      w.text('Start value', 470, y - 14, { size: 9, c: MUTED });
      w.box(470, y - 10, 94, 30, { border: NAVY, thickness: 1.2 });
      w.center(v ? fmt(v.sv) : '', 517, y + 10, { size: 16, font: fonts.bold, c: INK });
      if (entry.level === 'gold' && entry.options?.vt?.altBoard) w.text('Alternative springboard (mini-trampoline) used: 9.5 start value.', 48, y + 22, { size: 10, c: INK });
      continue;
    }

    // Skills table: thin rules only, no filled blocks (saves ink).
    const cols = [[48, 70, '#'], [70, 400, 'Skill'], [400, 470, 'Value'], [470, 564, 'Value part']];
    for (const [x0, , label] of cols) w.text(label.toUpperCase(), x0 + 4, y, { size: 8, font: fonts.bold, c: MUTED });
    y += 6;
    w.line(48, y, 564, y, 1, NAVY);
    const items = (r.items || []).filter((it) => it.status !== 'blank');
    const rowH = 19;
    const n = Math.max(8, items.length);
    for (let i = 0; i < n; i++) {
      const it = items[i];
      const ty = y + rowH * (i + 1) - 6;
      w.text(String(i + 1), 52, ty, { size: 9, c: MUTED });
      if (it) {
        w.text(it.name, 74, ty, { size: 10, maxWidth: 322, c: INK });
        w.center(it.letter, 435, ty, { size: 10, c: INK });
        const vp = it.status === 'restricted' ? 'Restricted (-0.50)' : it.status === 'repeat' ? 'Repeat' : it.vp ? `${it.vp} VP` : '';
        w.text(vp, 474, ty, { size: 9, c: INK });
      }
      w.line(48, y + rowH * (i + 1), 564, y + rowH * (i + 1), 0.5);
    }
    y += rowH * n + 22;

    w.text('Value parts required', 48, y, { size: 11, font: fonts.bold });
    const need = XCEL_VP[entry.level].reduce((m, l) => ({ ...m, [l]: (m[l] || 0) + 1 }), {});
    w.text(Object.entries(need).map(([l, c]) => `${c} ${l}`).join(' + ') + '  (a higher value part can fill a lower one)', 190, y, { size: 10 });
    y += 16;
    w.text(r.missingVp?.length ? `Missing: ${r.missingVp.join(', ')}  (-${fmt(r.vpMissing)})` : 'All value parts met', 48, y, { size: 10, c: INK });
    y += 26;

    w.text('Special requirements', 48, y, { size: 11, font: fonts.bold });
    w.text('-0.50 for each one missing', 190, y, { size: 10, c: MUTED });
    y += 8;
    const met = entry.options?.[evId]?.sr || [];
    XCEL_SR[entry.level][evId].forEach((t, i) => {
      y += 18;
      w.box(48, y - 11, 13, 13, { border: NAVY, thickness: 1 });
      if (met[i]) {
        const cw = writer(page, fonts, INK);
        cw.check(49, y - 11);
      }
      w.text(`${i + 1}. ${t}`, 68, y, { size: 9.5, maxWidth: 496 });
    });
    y += 34;

    // Start value line
    const parts = [
      ['Start', fmt(r.base)],
      ...(entry.level === 'sapphire' ? [['+ Bonus', fmt(r.bonus)]] : []),
      ['- SRs', fmt(r.srMissing * 0.5)],
      ['- VPs', fmt(r.vpMissing)],
      ['- Restricted', fmt(r.restricted * 0.5)],
      ['= Start value', r.sv == null ? '' : fmt(r.sv)],
    ];
    const bw = 516 / parts.length;
    parts.forEach(([label, val], i) => {
      const x = 48 + i * bw;
      const last = i === parts.length - 1;
      w.text(label, x + 4, y, { size: 9, font: fonts.bold, c: MUTED });
      w.box(x + 2, y + 6, bw - 8, 30, { border: last ? NAVY : LINE, thickness: last ? 1.4 : 0.75 });
      w.center(val, x + 2 + (bw - 8) / 2, y + 27, { size: last ? 16 : 13, font: last ? fonts.bold : fonts.regular, c: INK });
    });
    y += 58;
    w.text(`Planned with the UCG Routine Planner. Values from the USAG Xcel Code of Points (2022-2028) and the UCG Women's Rules Policy.`, 48, 760, { size: 8, c: MUTED, maxWidth: 516 });
  }
}

async function loadLogo(doc) {
  try {
    const res = await fetch('assets/logo.png');
    return res.ok ? await doc.embedPng(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

// ---- entry point --------------------------------------------------------------

export async function exportEntryPdf(athlete, entry, events) {
  const doc = await PDFDocument.create();
  const fonts = { regular: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };
  const fam = levelInfo(entry.disc, entry.level).family;
  const score = scoreEntry(entry);
  if (fam === 'infinity') {
    const { addInfinityPages } = await import('./pdf-infinity.js');
    await addInfinityPages(doc, fonts, athlete, entry, events);
  } else if (fam === 'xcel') {
    await xcelPages(doc, fonts, athlete, entry, events, score);
  } else {
    for (const evId of events) {
      const ev = eventInfo(entry.disc, evId);
      if (entry.disc === 'tt') await ttPage(doc, fonts, athlete, entry, evId);
      else if (ev.kind === 'vault') continue; // no MAG / Masters vault worksheet
      else if (levelInfo(entry.disc, entry.level).masters) await mastersPage(doc, fonts, athlete, entry, evId, score.events[evId]);
      else await magPage(doc, fonts, athlete, entry, evId, score.events[evId]);
    }
  }
  if (!doc.getPageCount()) throw new Error('There is no worksheet for this event.');
  doc.setTitle(`${athlete.name || 'Athlete'} - UCG ${DISCIPLINES[entry.disc].name} ${levelInfo(entry.disc, entry.level).name}`);
  return doc.save();
}

export function downloadPdf(bytes, athlete, entry, events) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const lvl = levelInfo(entry.disc, entry.level).short;
  const suffix = events.length === 1 ? ` ${eventInfo(entry.disc, events[0]).short}` : '';
  a.download = `${(athlete.name || 'Athlete').trim()} ${DISCIPLINES[entry.disc].name} ${lvl}${suffix}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
