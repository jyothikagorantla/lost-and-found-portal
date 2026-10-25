const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test_session_secret_1234567890_antigravity';

let mongod;
let app;
let agent;

test.before(async () => {
  mongod = await MongoMemoryServer.create({ spawn: { timeout: 60000 } });
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;

  await mongoose.connect(uri);

  const appModule = require('../app');
  app = appModule.app;
  agent = request.agent(app);
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
  setTimeout(() => process.exit(0), 200).unref();
  process.exit(0);
});

test('1. Static Pages Load Successfully', async (t) => {
  await t.test('GET / returns 200 with home hero and portal name', async () => {
    const res = await request(app).get('/');
    assert.equal(res.status, 200);
    assert.match(res.text, /Lost &amp; Found Portal/);
    assert.match(res.text, /Lost Something\? Let's Help You Find It\./);
  });

  await t.test('GET /about returns 200', async () => {
    const res = await request(app).get('/about');
    assert.equal(res.status, 200);
    assert.match(res.text, /About Lost &amp; Found Portal/);
  });

  await t.test('GET /contact returns 200', async () => {
    const res = await request(app).get('/contact');
    assert.equal(res.status, 200);
    assert.match(res.text, /Help &amp; Contact Support/);
  });

  await t.test('GET /unknown-route returns 404', async () => {
    const res = await request(app).get('/unknown-page-route');
    assert.equal(res.status, 404);
    assert.match(res.text, /404/);
  });
});

test('2. Authentication & Authorization Workflow', async (t) => {
  let csrfToken;

  await t.test('GET /auth/register loads form and sets CSRF token', async () => {
    const res = await agent.get('/auth/register');
    assert.equal(res.status, 200);
    const match = res.text.match(/name="_csrf" value="([a-f0-9]+)"/);
    assert.ok(match, 'CSRF token should be rendered in the form');
    csrfToken = match[1];
  });

  await t.test('POST /auth/register fails with mismatched passwords', async () => {
    const res = await agent.post('/auth/register').send({
      _csrf: csrfToken,
      name: 'Test Candidate',
      email: 'candidate@test.com',
      password: 'password123',
      confirmPassword: 'differentPassword',
    });
    assert.equal(res.status, 422);
    assert.match(res.text, /Passwords do not match/);
  });

  await t.test('POST /auth/register successfully registers and redirects to dashboard', async () => {
    const res = await agent.post('/auth/register').send({
      _csrf: csrfToken,
      name: 'Alice Johnson',
      email: 'alice@example.com',
      phone: '+1 555-0101',
      password: 'Password@123',
      confirmPassword: 'Password@123',
    });

    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/dashboard');
  });

  await t.test('POST /auth/register rejects duplicate email from new guest', async () => {
    const guestAgent = request.agent(app);
    const guestPage = await guestAgent.get('/auth/register');
    const guestCsrf = guestPage.text.match(/name="_csrf" value="([a-f0-9]+)"/)[1];

    const res = await guestAgent.post('/auth/register').send({
      _csrf: guestCsrf,
      name: 'Alice Duplicate',
      email: 'alice@example.com',
      password: 'Password@123',
      confirmPassword: 'Password@123',
    });

    assert.equal(res.status, 409);
    assert.match(res.text, /already exists/);
  });

  await t.test('GET /dashboard allows authenticated user', async () => {
    const res = await agent.get('/dashboard');
    assert.equal(res.status, 200);
    assert.match(res.text, /Alice/);
    assert.match(res.text, /My Total Reports/);
  });

  await t.test('Unauthenticated access to /dashboard redirects to /auth/login', async () => {
    const freshAgent = request.agent(app);
    const res = await freshAgent.get('/dashboard');
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/auth/login');
  });

  await t.test('Regular user is redirected with access denied from /admin routes', async () => {
    const res = await agent.get('/admin');
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/dashboard');
  });
});

test('3. Item Reporting & Search Features', async (t) => {
  let createdItemId;

  const res = await agent.get('/items/report-lost');
  const csrfToken = res.text.match(/name="_csrf" value="([a-f0-9]+)"/)[1];

  await t.test('POST /items creates a lost item report', async () => {
    const createRes = await agent.post('/items').send({
      _csrf: csrfToken,
      title: 'Blue Hydro Flask Bottle',
      type: 'lost',
      category: 'Other',
      location: 'Student Union Lounge Table 4',
      itemDate: new Date().toISOString().split('T')[0],
      description: 'Navy blue 32oz bottle with stickers of national parks.',
      additionalPrivateNotes: 'Scratch on the bottom base, dent near rim.',
    });

    assert.equal(createRes.status, 302);
    const redirectUrl = createRes.headers.location;
    assert.match(redirectUrl, /\/items\/[a-f0-9]+/);
    createdItemId = redirectUrl.split('/').pop();
  });

  await t.test('GET /items/:id renders item details and conceals private notes from public', async () => {
    const itemRes = await agent.get(`/items/${createdItemId}`);
    assert.equal(itemRes.status, 200);
    assert.match(itemRes.text, /Blue Hydro Flask Bottle/);
    assert.match(itemRes.text, /Student Union Lounge/);

    // Alice is the owner, so she CAN view private notes
    assert.match(itemRes.text, /Private Identifying Notes/);

    // Another unauthenticated visitor should NOT see private notes
    const guestRes = await request(app).get(`/items/${createdItemId}`);
    assert.doesNotMatch(guestRes.text, /Scratch on the bottom base/);
  });

  await t.test('GET /items search and filters work correctly', async () => {
    const searchRes = await request(app).get('/items?q=Hydro+Flask');
    assert.equal(searchRes.status, 200);
    assert.match(searchRes.text, /Blue Hydro Flask Bottle/);

    const emptyRes = await request(app).get('/items?q=NonExistentKeywordXYZ999');
    assert.equal(emptyRes.status, 200);
    assert.match(emptyRes.text, /No matching items found/);
  });
});

test('4. Ownership Claims & Resolution Workflow', async (t) => {
  // Create second user 'Bob' to claim Alice's item
  const bobAgent = request.agent(app);
  const regPage = await bobAgent.get('/auth/register');
  const bobCsrf = regPage.text.match(/name="_csrf" value="([a-f0-9]+)"/)[1];

  await bobAgent.post('/auth/register').send({
    _csrf: bobCsrf,
    name: 'Bob Finder',
    email: 'bob@example.com',
    password: 'Password@123',
    confirmPassword: 'Password@123',
  });

  // Bob reports a FOUND item
  const bobReportPage = await bobAgent.get('/items/report-found');
  const bobReportCsrf = bobReportPage.text.match(/name="_csrf" value="([a-f0-9]+)"/)[1];

  const foundRes = await bobAgent.post('/items').send({
    _csrf: bobReportCsrf,
    title: 'Silver Car Keys with Fob',
    type: 'found',
    category: 'Keys',
    location: 'West Campus Parking Structure Level 2',
    itemDate: new Date().toISOString().split('T')[0],
    description: 'Ring of 3 brass keys and an electronic remote key fob.',
  });

  const foundItemId = foundRes.headers.location.split('/').pop();

  // Alice claims Bob's found keys
  const aliceItemPage = await agent.get(`/items/${foundItemId}`);
  const aliceCsrf = aliceItemPage.text.match(/name="_csrf" value="([a-f0-9]+)"/)[1];

  const claimRes = await agent.post(`/claims/item/${foundItemId}`).send({
    _csrf: aliceCsrf,
    explanation: 'These are my spare Honda keys! The key fob has a chip on the lock button.',
  });

  assert.equal(claimRes.status, 302);

  // Bob reviews and approves Alice's claim
  const bobClaimsPage = await bobAgent.get('/items/' + foundItemId);
  assert.match(bobClaimsPage.text, /Received Claims/);
  assert.match(bobClaimsPage.text, /Alice Johnson/);

  // Bob opens full claim page and approves it
  const claimIdMatch = bobClaimsPage.text.match(/\/claims\/([a-f0-9]{24})/);
  assert.ok(claimIdMatch, 'Claim link should exist');
  const claimId = claimIdMatch[1];

  const claimDetailPage = await bobAgent.get(`/claims/${claimId}`);
  const reviewCsrf = claimDetailPage.text.match(/name="_csrf" value="([a-f0-9]+)"/)[1];

  const reviewRes = await bobAgent.post(`/claims/${claimId}/review`).send({
    _csrf: reviewCsrf,
    status: 'approved',
    reviewNotes: 'Verified key count and description. Handover arranged at main gate.',
  });

  assert.equal(reviewRes.status, 302);

  // Check that Alice received an approved notification
  const aliceNotifPage = await agent.get('/notifications');
  assert.match(aliceNotifPage.text, /APPROVED/);
  assert.match(aliceNotifPage.text, /Silver Car Keys with Fob/);
});

test('5. Administrator Access and Moderation', async (t) => {
  // Create Admin user
  const User = require('../models/User');
  const adminHash = await User.hashPassword('Admin@123456');
  await User.create({
    name: 'Super Administrator',
    email: 'admin_test@example.com',
    passwordHash: adminHash,
    role: 'admin',
    accountStatus: 'active',
  });

  const adminAgent = request.agent(app);
  const loginPage = await adminAgent.get('/auth/login');
  const loginCsrf = loginPage.text.match(/name="_csrf" value="([a-f0-9]+)"/)[1];

  await adminAgent.post('/auth/login').send({
    _csrf: loginCsrf,
    email: 'admin_test@example.com',
    password: 'Admin@123456',
  });

  await t.test('Admin can access /admin dashboard', async () => {
    const res = await adminAgent.get('/admin');
    assert.equal(res.status, 200);
    assert.match(res.text, /Administrator Control Center/);
    assert.match(res.text, /Total Users/);
  });

  await t.test('Admin can view all users list', async () => {
    const res = await adminAgent.get('/admin/users');
    assert.equal(res.status, 200);
    assert.match(res.text, /Alice Johnson/);
    assert.match(res.text, /Bob Finder/);
  });

  await t.test('Admin can view all items list', async () => {
    const res = await adminAgent.get('/admin/items');
    assert.equal(res.status, 200);
    assert.match(res.text, /Blue Hydro Flask Bottle/);
    assert.match(res.text, /Silver Car Keys with Fob/);
  });
});
