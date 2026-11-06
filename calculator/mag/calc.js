// The UCG MAG judging calculator: pick a level and an apparatus, then score the routine with the same
// calculator as MAG judge practice (calibration/mag/calculator.js). The build also inlines it into one
// file for the UCG website (tools/build_site.mjs, UCG_MAG_Judging_Calculator.html).
import { EVENT_SHORT, LEVEL_TABS, createCalculator, rulesHtml } from '../../calibration/mag/calculator.js';
import { ALL_EVENTS } from '../../js/scoring/mag.js';

const root = document.getElementById('ucg-mag-calc');
const $ = (id) => root.querySelector(`#${id}`);
let level = 'int';
let event = 'fx';

const calc = createCalculator({ form: $('cp-calc'), fields: $('cp-calc-fields'), root });

function render() {
  $('cp-tabs').innerHTML = LEVEL_TABS.map(([id, name]) =>
    `<button type="button" role="tab" aria-selected="${id === level}" data-level="${id}">${name}</button>`).join('');
  $('cp-chips').innerHTML = ALL_EVENTS.map((id) =>
    `<button type="button" class="cp-routine${id === event ? ' is-current' : ''}" aria-pressed="${id === event}" data-event="${id}">${EVENT_SHORT[id]}</button>`).join('');
  $('cp-intro').innerHTML = rulesHtml(level, event);
}

/** A new routine: the calculator empties for the level and apparatus picked. */
function open(l, e) {
  level = l;
  event = e;
  render();
  calc.open(level, event);
}

$('cp-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-level]');
  if (b && b.dataset.level !== level) open(b.dataset.level, event);
});
$('cp-chips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-event]');
  if (b && b.dataset.event !== event) open(level, b.dataset.event);
});
$('cp-reset').addEventListener('click', () => {
  calc.reset();
  calc.update();
});

// A link can open a level and apparatus (…#adv-pb).
const [l, e] = decodeURIComponent(location.hash.slice(1)).split('-');
open(LEVEL_TABS.some(([id]) => id === l) ? l : level, ALL_EVENTS.includes(e) ? e : event);
