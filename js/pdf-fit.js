// Fits text into a PDF cell (shared by pdf.js and pdf-infinity.js; no pdf-lib import, so tests can use it).
// `font` is anything with widthOfTextAtSize(text, size) (a pdf-lib font) and, optionally, encodeText.
// First the text shrinks on one line, down to `wrapBelow`. If it still doesn't fit and `maxLines` > 1,
// it wraps at spaces at the largest size, down to `minSize`, that fits in `maxLines` lines. Only when
// nothing fits is the last line cut, and it ends with an ellipsis so the cut shows.
// Returns { lines, size }.
export function fitText(font, text, maxWidth, { size = 10, minSize = 6, maxLines = 1, wrapBelow = minSize } = {}) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  const width = (s, sz) => font.widthOfTextAtSize(s, sz);
  const steps = (from, to) => {
    const out = [];
    for (let s = from; s >= to - 1e-9; s -= 0.5) out.push(Math.round(s * 2) / 2);
    return out;
  };
  if (!t || !maxWidth) return { lines: [t], size };
  for (const s of steps(size, Math.max(minSize, wrapBelow))) if (width(t, s) <= maxWidth) return { lines: [t], size: s };
  if (maxLines > 1) {
    for (const s of steps(Math.min(size, wrapBelow), minSize)) {
      const lines = wrapWords(t, s, maxWidth, width);
      if (lines.length <= maxLines && lines.every((l) => width(l, s) <= maxWidth)) return { lines, size: s };
    }
  }
  // Nothing fits: keep the first lines and cut the last one.
  const lines = maxLines > 1 ? wrapWords(t, minSize, maxWidth, width) : [t];
  if (lines.length > maxLines) lines.splice(maxLines - 1, Infinity, lines.slice(maxLines - 1).join(' '));
  const dots = ellipsis(font);
  return { lines: lines.map((l) => cut(l, minSize, maxWidth, width, dots)), size: minSize };
}

function wrapWords(t, size, maxWidth, width) {
  const lines = [];
  let line = '';
  for (const word of t.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && width(next, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function cut(s, size, maxWidth, width, dots) {
  if (width(s, size) <= maxWidth) return s;
  let t = s;
  while (t.length > 1 && width(`${t}${dots}`, size) > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}${dots}`;
}

function ellipsis(font) {
  try {
    font.encodeText?.('…');
    return '…';
  } catch {
    return '...';
  }
}
