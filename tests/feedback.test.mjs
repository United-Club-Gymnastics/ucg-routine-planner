// Feedback reports (js/feedback.js): what's sent to the feedback Google Form.
// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeClient, formBody } from '../js/feedback.js';

test('a report fills the form fields by their entry ids', () => {
  const body = formBody({ type: 'Bug', message: 'Wrong value', name: 'Nate', email: 'n@x.org', athlete: 'Julia', level: 'UCG Infinity', apparatus: 'Uneven Bars', page: 'https://routines.unitedclubgymnastics.org/', version: 'abc1234', browser: 'Chrome 141', device: 'Windows' });
  assert.equal(body.get('entry.1855114294'), 'Nate');
  assert.equal(body.get('entry.1917588411'), 'Julia');
  assert.equal(body.get('entry.171607110'), 'Chrome 141');
  assert.equal(body.get('entry.2111223531'), 'Bug');
  assert.equal(body.get('entry.66434965'), 'Wrong value');
  assert.equal(body.get('entry.742666991'), 'https://routines.unitedclubgymnastics.org/');
});

test('browser and device are readable', () => {
  const nav = (userAgent, maxTouchPoints = 0) => ({ userAgent, maxTouchPoints });
  const scr = { width: 390, height: 844 };
  assert.equal(describeClient(nav('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'), scr).browser, 'Safari 18');
  assert.equal(describeClient(nav('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'), scr).device, 'iPhone · screen 390×844');
  const win = describeClient(nav('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0'), { width: 1920, height: 1080 });
  assert.equal(win.browser, 'Edge 141');
  assert.match(win.device, /^Windows/);
  assert.equal(describeClient(nav('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'), scr).device, 'Android phone · screen 390×844');
});
