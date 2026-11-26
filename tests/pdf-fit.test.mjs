// Long skill names in PDF exports wrap onto two lines instead of being cut off (js/pdf-fit.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { fitText } from '../js/pdf-fit.js';

const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
const LONG = 'Pullover mount with feet together (mount or long hang pullover on high bar)';
// The WAG Masters sheet's name cell, less the box number (about 140pt at 9.5pt).
const CELL = 140;

test('a name that fits stays on one line at full size', () => {
  assert.deepEqual(fitText(font, 'Back hip circle', CELL, { size: 9.5, wrapBelow: 8, minSize: 6.5, maxLines: 2 }), { lines: ['Back hip circle'], size: 9.5 });
});

test('a long name wraps onto two lines, keeping every word', () => {
  const fit = fitText(font, LONG, CELL, { size: 9.5, wrapBelow: 8, minSize: 6.5, maxLines: 2 });
  assert.equal(fit.lines.length, 2);
  assert.equal(fit.lines.join(' '), LONG);
  assert.ok(fit.size >= 6.5 && fit.size <= 8);
  for (const l of fit.lines) assert.ok(font.widthOfTextAtSize(l, fit.size) <= CELL);
});

test('text too long even for two lines is cut with an ellipsis, never silently', () => {
  const fit = fitText(font, `${LONG} ${LONG} ${LONG}`, CELL, { size: 9.5, minSize: 6.5, maxLines: 2 });
  assert.equal(fit.lines.length, 2);
  assert.ok(fit.lines[1].endsWith('…'));
  for (const l of fit.lines) assert.ok(font.widthOfTextAtSize(l, fit.size) <= CELL);
});

test('one line only: shrinks to the minimum, then ends with an ellipsis', () => {
  const fit = fitText(font, LONG, 120, { size: 10 });
  assert.equal(fit.size, 6);
  assert.equal(fit.lines.length, 1);
  assert.ok(fit.lines[0].endsWith('…'));
  assert.ok(font.widthOfTextAtSize(fit.lines[0], 6) <= 120);
});

test('a single word wider than the cell is cut, not dropped', () => {
  const fit = fitText(font, 'Supercalifragilisticexpialidocious', 40, { size: 10, minSize: 6, maxLines: 2 });
  assert.equal(fit.lines.length, 1);
  assert.ok(fit.lines[0].startsWith('Super') && fit.lines[0].endsWith('…'));
});
