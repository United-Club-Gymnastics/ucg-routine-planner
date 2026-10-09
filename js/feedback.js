// Feedback and bug reports: the "Feedback" button in the corner opens a short form; it's
// sent to UCG's feedback Google Form (responses go to a Google Sheet, which emails the
// planner's maintainers). Who sent it and what they were looking at are added for them.
// Google doesn't let a page read the form's reply (no-cors), so "sent" means it went out.
// Loaded only when the button is used.

const FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSc8_pQ1hDb9DhVsn2iv6O_RJKEN78Rs5rgSABGE8w8GYfafuA/formResponse';
// The form's questions (entry ids from the form; a question added there needs its id here).
const ENTRY = {
  type: 2111223531,
  message: 66434965,
  name: 1855114294,
  email: 1631089420,
  athlete: 1917588411,
  level: 1571019246,
  apparatus: 963299018,
  page: 742666991,
  version: 858212723,
  browser: 171607110,
  device: 1640758801,
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Browser and device, readable: "Chrome 141", "Android phone · 412×915". */
export function describeClient(nav = navigator, scr = screen) {
  const ua = nav.userAgent || '';
  const v = (re, name) => {
    const m = ua.match(re);
    return m && `${name} ${m[1]}`;
  };
  const browser =
    v(/Edg\/(\d+)/, 'Edge') || v(/OPR\/(\d+)/, 'Opera') || v(/Firefox\/(\d+)/, 'Firefox') ||
    v(/CriOS\/(\d+)/, 'Chrome (iOS)') || v(/Chrome\/(\d+)/, 'Chrome') || v(/Version\/(\d+).*Safari/, 'Safari') ||
    ua.slice(0, 80);
  const os =
    (/iPhone|iPod/.test(ua) && 'iPhone') ||
    (/iPad/.test(ua) && 'iPad') ||
    (/Android/.test(ua) && (/Mobile/.test(ua) ? 'Android phone' : 'Android tablet')) ||
    (/Mac OS X/.test(ua) && (nav.maxTouchPoints > 1 ? 'iPad' : 'Mac')) ||
    (/Windows/.test(ua) && 'Windows') ||
    (/CrOS/.test(ua) && 'Chromebook') ||
    (/Linux/.test(ua) && 'Linux') ||
    'Other';
  return { browser, device: `${os} · screen ${scr.width}×${scr.height}` };
}

/** The form fields for a report. */
export function formBody(report) {
  const body = new URLSearchParams();
  for (const [k, id] of Object.entries(ENTRY)) if (report[k] != null && report[k] !== '') body.append(`entry.${id}`, String(report[k]));
  return body;
}

async function send(report) {
  await fetch(FORM, { method: 'POST', mode: 'no-cors', body: formBody(report) });
}

/**
 * Open the feedback form. `context()` says who and where: { name, email, athlete, level,
 * apparatus }. Resolves when it's closed.
 */
export function openFeedback(context) {
  document.querySelector('#feedback-dialog')?.remove();
  const dlg = document.createElement('dialog');
  dlg.id = 'feedback-dialog';
  dlg.className = 'modal';
  dlg.setAttribute('aria-labelledby', 'feedback-title');
  document.body.appendChild(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  const ctx = context();
  // Placeholders like "(no athlete open)" fill the Sheet's columns; the summary skips them.
  const real = (v) => v && !String(v).startsWith('(');
  const where = [ctx.athlete, ctx.level, ctx.apparatus].filter(real).join(' · ');
  dlg.innerHTML = `
    <form class="modal-body" method="dialog" novalidate>
      <h2 id="feedback-title" class="card-subtitle">Send feedback</h2>
      <fieldset class="feedback-type">
        <legend>What's it about?</legend>
        <label><input type="radio" name="type" value="Bug" checked /> Something's wrong</label>
        <label><input type="radio" name="type" value="Idea" /> An idea</label>
        <label><input type="radio" name="type" value="Question" /> A question</label>
      </fieldset>
      <label class="field"><span>Tell us more</span>
        <textarea name="message" rows="5" required placeholder="What happened, or what would help? For a wrong value or skill, say which skill and what you expected."></textarea></label>
      <p class="muted feedback-note">Sent with it: ${esc(ctx.name || 'not signed in')}${real(ctx.email) ? ` (${esc(ctx.email)})` : ''}${where ? `, ${esc(where)}` : ''}, this page's address, and your browser and device.</p>
      <p class="error" role="alert" hidden></p>
      <div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="submit" class="btn btn-primary">Send</button></div>
    </form>`;
  const form = dlg.querySelector('form');
  const error = dlg.querySelector('.error');
  dlg.querySelector('[data-close]').onclick = () => dlg.close();
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const message = form.message.value.trim();
    if (!message) {
      error.textContent = 'Please write a few words first.';
      error.hidden = false;
      form.message.focus();
      return;
    }
    const button = form.querySelector('[type=submit]');
    button.disabled = true;
    button.textContent = 'Sending…';
    const now = context(); // in case the page changed while typing
    try {
      await send({
        type: form.type.value, message, ...now, page: location.href,
        version: document.querySelector('meta[name="planner-version"]')?.content || 'development', ...describeClient(),
      });
      dlg.querySelector('.modal-body').innerHTML = `
        <h2 class="card-subtitle">Thanks!</h2>
        <p>Your ${form.type.value === 'Bug' ? 'report' : form.type.value.toLowerCase()} is on its way to the UCG planner team.</p>
        <div class="modal-actions"><button type="button" class="btn btn-primary" data-close>Close</button></div>`;
      dlg.querySelector('[data-close]').onclick = () => dlg.close();
    } catch (err) {
      console.error(err);
      button.disabled = false;
      button.textContent = 'Send';
      error.textContent = "Couldn't send it. Check your connection and try again.";
      error.hidden = false;
    }
  };
  dlg.showModal();
  form.message.focus();
}
