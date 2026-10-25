// scripts/smokeTest.js
//
// End-to-end check against a RUNNING copy of the app (start it first with
// `npm start`, then run `npm run smoke` in a second terminal).
// It registers a throw-away user, checks the dashboard, logs out, logs in again,
// and prints the real server error message if any step returns a 500.
//
// Needs Node 18+ (global fetch). Optional: BASE_URL=http://localhost:3000
require('dotenv').config();

const BASE = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const cookies = {};
let failures = 0;

const cookieHeader = () =>
  Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');

const call = async (method, path, form) => {
  const headers = {};
  if (Object.keys(cookies).length) headers.cookie = cookieHeader();
  let body;
  if (form) {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(form).toString();
  }
  const res = await fetch(BASE + path, { method, headers, body, redirect: 'manual' });
  const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  for (const c of setCookies) {
    const [pair] = c.split(';');
    const idx = pair.indexOf('=');
    cookies[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  const text = await res.text();
  return { status: res.status, location: res.headers.get('location'), text };
};

const csrfFrom = (html) => {
  const m = html.match(/name="_csrf" value="([a-f0-9]+)"/);
  return m ? m[1] : null;
};

const errorMessageFrom = (html) => {
  const m = html.match(/<p class="text-muted mb-4">\s*([\s\S]*?)\s*<\/p>/);
  return m ? m[1].replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"') : null;
};

const check = (label, ok, res) => {
  if (ok) {
    console.log(`  PASS  ${label}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL  ${label}  (HTTP ${res.status}${res.location ? ' -> ' + res.location : ''})`);
  const msg = res.status >= 500 ? errorMessageFrom(res.text) : null;
  if (msg) console.log(`        Server error message: ${msg}`);
  console.log('        Also check the terminal running "npm start" for the [Error Handler] block.');
};

(async () => {
  const email = `smoke_${Date.now()}@example.com`;
  const password = 'Smoke#12345';
  console.log(`Smoke test against ${BASE}\n`);

  let res = await call('GET', '/');
  check('GET /  (home page)', res.status === 200, res);

  res = await call('GET', '/auth/register');
  check('GET /auth/register  (form + CSRF token)', res.status === 200 && !!csrfFrom(res.text), res);
  let csrf = csrfFrom(res.text);

  res = await call('POST', '/auth/register', {
    _csrf: csrf,
    name: 'Smoke Tester',
    email,
    phone: '',
    password,
    confirmPassword: password,
  });
  check('POST /auth/register  (creates user, redirects to /dashboard)', res.status === 302 && res.location === '/dashboard', res);

  res = await call('GET', '/dashboard');
  check('GET /dashboard  (logged in after register)', res.status === 200, res);

  res = await call('GET', '/auth/logout');
  check('GET /auth/logout', res.status === 302, res);

  res = await call('GET', '/auth/login');
  check('GET /auth/login  (form + CSRF token)', res.status === 200 && !!csrfFrom(res.text), res);
  csrf = csrfFrom(res.text);

  res = await call('POST', '/auth/login', { _csrf: csrf, email, password });
  check('POST /auth/login  (redirects after login)', res.status === 302, res);

  res = await call('GET', '/dashboard');
  check('GET /dashboard  (logged in after login)', res.status === 200, res);

  res = await call('GET', '/items');
  check('GET /items  (browse items)', res.status === 200, res);

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => {
  console.error(`\nCould not reach ${BASE}: ${err.cause ? err.cause.message : err.message}`);
  console.error('Is the app running? Start it with "npm start" in another terminal first.');
  process.exit(2);
});