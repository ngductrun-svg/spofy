import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmailService } from '../server/auth-lifecycle.mjs';

const ORIGIN = 'https://preview-isolated.example.test';
const TOKEN = 'a'.repeat(64);
const BREVO_SECRET = 'test-only-brevo-secret';
const RESEND_SECRET = 'test-only-resend-secret';
const READER = 'reader@example.test';
const OWNER = 'owner-test@example.test';
const base = { APP_ORIGIN: ORIGIN, MAIL_PROVIDER: 'brevo', BREVO_API_KEY: BREVO_SECRET, MAIL_FROM: 'SPOFY <sender@example.test>' };
const message = { to: READER, purpose: 'verify', token: TOKEN };
const rejected = code => error => error.status === 503 && error.code === code;

test('Brevo sends verification and reset links through its selected authenticated API', async () => {
  const sent = [];
  const mail = createEmailService({
    env: { ...base, RESEND_API_KEY: RESEND_SECRET }, cloud: true,
    fetcher: async (url, options) => {
      sent.push({ url, options, body: JSON.parse(options.body) });
      return Response.json({ messageId: '<accepted-test-id@brevo.example.test>' }, { status: 201 });
    },
  });
  assert.equal(mail.configured, true);
  await mail.send(message);
  await mail.send({ ...message, purpose: 'reset' });
  assert.equal(sent.length, 2);
  for (const [index, request] of sent.entries()) {
    assert.equal(request.url, 'https://api.brevo.com/v3/smtp/email');
    assert.equal(request.options.method, 'POST');
    assert.equal(new Headers(request.options.headers).get('api-key'), BREVO_SECRET);
    assert.equal(new Headers(request.options.headers).get('authorization'), null);
    assert.equal(request.options.redirect, 'error');
    assert.ok(request.options.signal instanceof AbortSignal);
    assert.deepEqual(request.body.sender, { name: 'SPOFY', email: 'sender@example.test' });
    assert.deepEqual(request.body.to, [{ email: READER }]);
    assert.match(request.body.subject, /^SPOFY/);
    assert.ok(request.body.textContent.includes(`${ORIGIN}/${index ? 'dat-lai-mat-khau' : 'xac-minh-email'}#token=${TOKEN}`));
    assert.ok(!request.body.textContent.includes('?token='));
    assert.ok(!JSON.stringify(request.body).includes(BREVO_SECRET));
    assert.ok(!JSON.stringify(request).includes(RESEND_SECRET));
    assert.equal(request.body.cc, undefined);
    assert.equal(request.body.bcc, undefined);
  }
});

test('Brevo accepts a plain verified sender without requiring a custom display name', async () => {
  let sent;
  const mail = createEmailService({ env: { ...base, MAIL_FROM: 'sender@example.test' }, cloud: true,
    fetcher: async (_url, options) => { sent = JSON.parse(options.body); return Response.json({ messageId: 'accepted-test-id' }); } });
  assert.equal(mail.configured, true);
  await mail.send(message);
  assert.equal(sent.sender.email, 'sender@example.test');
  assert.equal(sent.sender.name, 'SPOFY');
});

test('Preview email requires an explicit test mailbox and redirects every message to it', async () => {
  for (const context of ['deploy-preview', 'branch-deploy']) {
    let calls = 0;
    const fetcher = async (_url, options) => {
      calls++;
      const body = JSON.parse(options.body);
      assert.deepEqual(body.to, [{ email: OWNER }]);
      assert.ok(!JSON.stringify(body).includes(READER));
      return Response.json({ messageId: 'accepted-test-id' });
    };
    for (const incomplete of [{}, { MAIL_MODE: 'test' }, { MAIL_TEST_RECIPIENT: OWNER }, { MAIL_MODE: 'test', MAIL_TEST_RECIPIENT: 'not-an-email' }]) {
      const mail = createEmailService({ env: { ...base, CONTEXT: context, ...incomplete }, cloud: true, fetcher });
      assert.equal(mail.configured, false);
      await assert.rejects(mail.send(message), rejected('MAIL_NOT_CONFIGURED'));
    }
    assert.equal(calls, 0);
    const mail = createEmailService({ env: { ...base, CONTEXT: context, MAIL_MODE: 'test', MAIL_TEST_RECIPIENT: OWNER }, cloud: true, fetcher });
    await mail.send(message);
    await mail.send({ ...message, purpose: 'reset' });
    assert.equal(calls, 2);
  }
});

test('Missing provider credentials, unknown providers, invalid senders and origins fail closed before HTTP', async () => {
  let calls = 0;
  const cases = [
    { ...base, BREVO_API_KEY: '', RESEND_API_KEY: RESEND_SECRET },
    { ...base, MAIL_PROVIDER: 'unknown', RESEND_API_KEY: RESEND_SECRET },
    { ...base, MAIL_PROVIDER: 'resend', RESEND_API_KEY: '' },
    { ...base, MAIL_PROVIDER: undefined, RESEND_API_KEY: '' },
    { ...base, MAIL_FROM: '' },
    { ...base, MAIL_FROM: 'not-an-email' },
    { ...base, MAIL_FROM: 'SPOFY <sender@example.test' },
    { ...base, MAIL_FROM: 'sender@example.test, second@example.test' },
    { ...base, MAIL_FROM: 'SPOFY\r\nBcc: victim@example.test <sender@example.test>' },
    { ...base, APP_ORIGIN: 'http://example.test' },
    { ...base, APP_ORIGIN: 'https://example.test/path' },
    { ...base, APP_ORIGIN: 'https://user:secret@example.test' },
  ];
  for (const env of cases) {
    const mail = createEmailService({ env, cloud: true, fetcher: async () => { calls++; throw new Error('Must not call a provider'); } });
    assert.equal(mail.configured, false);
    assert.throws(() => mail.assertConfigured(), rejected('MAIL_NOT_CONFIGURED'));
    await assert.rejects(mail.send(message), rejected('MAIL_NOT_CONFIGURED'));
  }
  assert.equal(calls, 0);
});

test('Brevo failures do not expose provider secrets, claim success or fall back to another service', async t => {
  const logged = [];
  t.mock.method(console, 'error', (...values) => logged.push(values));
  t.mock.method(console, 'warn', (...values) => logged.push(values));
  const privateDetail = `${BREVO_SECRET} recipient@example.test ${TOKEN}`;
  const failures = [
    async () => { throw new Error(privateDetail); },
    async () => Response.json({ detail: privateDetail }, { status: 429 }),
    async () => new Response(privateDetail, { status: 200 }),
    async () => Response.json({ id: 'wrong-provider-ack', detail: privateDetail }),
    async () => Response.json({ messageId: '' }),
    async () => Response.json({ messageId: '   ' }),
    async () => Response.json({ messageId: 123 }),
  ];
  for (const failure of failures) {
    const calls = [];
    const mail = createEmailService({ env: { ...base, RESEND_API_KEY: RESEND_SECRET }, cloud: true,
      fetcher: async (url, options) => { calls.push(url); return failure(url, options); } });
    await assert.rejects(mail.send(message), error => {
      assert.equal(error.status, 503);
      assert.equal(error.code, 'MAIL_DELIVERY_FAILED');
      const publicError = `${error} ${JSON.stringify(error)}`;
      for (const value of [BREVO_SECRET, RESEND_SECRET, TOKEN, 'recipient@example.test', 'wrong-provider-ack']) assert.ok(!publicError.includes(value));
      assert.equal(error.cause, undefined);
      return true;
    });
    assert.deepEqual(calls, ['https://api.brevo.com/v3/smtp/email']);
  }
  for (const value of [BREVO_SECRET, RESEND_SECRET, TOKEN, 'recipient@example.test']) assert.ok(!JSON.stringify(logged).includes(value));
});

test('Default and explicit Resend configurations preserve their original delivery contract', async () => {
  for (const provider of [undefined, 'resend']) {
    let sent;
    const mail = createEmailService({ env: { ...base, MAIL_PROVIDER: provider, RESEND_API_KEY: RESEND_SECRET }, cloud: true,
      fetcher: async (url, options) => { sent = { url, options, body: JSON.parse(options.body) }; return Response.json({ id: 'resend-test-ack' }); } });
    assert.equal(mail.configured, true);
    await mail.send(message);
    assert.equal(sent.url, 'https://api.resend.com/emails');
    assert.equal(new Headers(sent.options.headers).get('authorization'), `Bearer ${RESEND_SECRET}`);
    assert.equal(new Headers(sent.options.headers).get('api-key'), null);
    assert.equal(sent.body.from, base.MAIL_FROM);
    assert.equal(sent.body.to, READER);
    assert.ok(sent.body.text.includes(`${ORIGIN}/xac-minh-email#token=${TOKEN}`));
    assert.ok(!JSON.stringify(sent).includes(BREVO_SECRET));
  }
});

test('Injected isolated test transport still works without credentials or outbound HTTP', async () => {
  const sent = [];
  let calls = 0;
  const mail = createEmailService({ env: { APP_ORIGIN: ORIGIN }, cloud: true,
    transport: async value => { sent.push(value); },
    fetcher: async () => { calls++; throw new Error('Must not use HTTP in this fixture'); } });
  assert.equal(mail.configured, true);
  await mail.send(message);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, READER);
  assert.ok(sent[0].text.includes(`#token=${TOKEN}`));
  assert.equal(calls, 0);
});
