import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

export const ORIGIN = 'http://127.0.0.1:3000';
export const ADMIN = { email: 'admin@example.test', name: 'Quản trị kiểm thử', password: 'Str0ng-Science!2026' };
export const READER = { email: 'reader@example.test', name: 'Độc giả kiểm thử', password: 'Str0ng-Reader!2026' };
// A real 1×1 PNG; test fixtures are never inserted into the production database.
export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE1cAAAAASUVORK5CYII=', 'base64');

export async function startFixture(options = {}) {
  const { createApplication } = await import('../server/app.mjs');
  const { provisionAdmin } = await import('../server/auth.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'spofy-science-http-test-'));
  const dbPath = join(directory, 'test.sqlite');
  const mediaDir = join(directory, 'media');
  let clock = Date.now();
  let application;
  const mail = [];
  const settings = {
    dbPath, mediaDir, distDir: join(directory, 'missing-dist'), appOrigin: ORIGIN,
    secureCookies: false, now: () => clock, env: {}, mailTransport: async message => { mail.push(message); }, ...options,
  };
  async function start() {
    application = createApplication(settings);
    await new Promise((resolveListen, reject) => {
      application.server.once('error', reject);
      application.server.listen(0, '127.0.0.1', resolveListen);
    });
    return application;
  }
  await start();
  await provisionAdmin(application.db, ADMIN);
  const fixture = {
    get app() { return application; },
    get url() { return `http://127.0.0.1:${application.server.address().port}`; },
    dbPath, mediaDir, mail,
    advance(milliseconds) { clock += milliseconds; },
    async restart() { await application.close(); await start(); },
    async close() {
      try { await application.close(); }
      finally {
        const expectedPrefix = resolve(tmpdir()) + sep;
        assert.ok(resolve(directory).startsWith(expectedPrefix), 'only remove the owned temporary test directory');
        await rm(directory, { recursive: true, force: true });
      }
    },
  };
  fixture.client = () => new HttpClient(fixture);
  return fixture;
}

export class HttpClient {
  constructor(fixture) { this.fixture = fixture; this.cookies = new Map(); this.csrfToken = ''; }
  async request(path, options = {}) {
    const { method = 'GET', data, body, csrf = true, origin = true, headers = {} } = options;
    const requestHeaders = { ...headers };
    if (this.cookies.size) requestHeaders.Cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    if (origin) requestHeaders.Origin = typeof origin === 'string' ? origin : ORIGIN;
    if (csrf && !['GET', 'HEAD', 'OPTIONS'].includes(method) && this.csrfToken) requestHeaders['X-CSRF-Token'] = this.csrfToken;
    if (data !== undefined) requestHeaders['Content-Type'] = 'application/json';
    const response = await fetch(this.fixture.url + path, {
      method, headers: requestHeaders, body: data !== undefined ? JSON.stringify(data) : body,
      redirect: 'manual',
    });
    for (const header of response.headers.getSetCookie()) {
      const cookie = header.split(';')[0];
      const separator = cookie.indexOf('=');
      const name = cookie.slice(0, separator);
      const value = cookie.slice(separator + 1);
      if (/max-age=0(?:;|$)/i.test(header) || !value) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    const text = await response.text();
    let json;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    if (json?.csrfToken) this.csrfToken = json.csrfToken;
    return { status: response.status, json, text, headers: response.headers };
  }
  async session() {
    const result = await this.request('/api/auth/session');
    assert.equal(result.status, 200, result.text);
    return result;
  }
  async register(account = READER, extra = {}) {
    await this.session();
    const before = this.fixture.mail.length;
    const registered = await this.request('/api/auth/register', { method: 'POST', data: { ...account, ...extra } });
    if (registered.status !== 202 || this.fixture.mail.length === before) return registered;
    const message = this.fixture.mail.findLast(item => item.to === account.email);
    const token = message?.text.match(/#token=([a-f0-9]{64})/)?.[1];
    assert.ok(token, 'the isolated mail transport receives a real verification link');
    // Existing tests need an authenticated reader. They now go through the real
    // verification endpoint; dedicated lifecycle tests inspect registration itself.
    const verified = await this.request('/api/auth/verify-email', { method: 'POST', data: { token } });
    assert.equal(verified.status, 200, verified.text);
    return { ...verified, registrationResponse: registered };
  }
  async login(account = ADMIN) {
    await this.session();
    const result = await this.request('/api/auth/login', { method: 'POST', data: { email: account.email, password: account.password } });
    assert.equal(result.status, 200, result.text);
    await this.session();
    return result;
  }
}

export function articleFixture(overrides = {}) {
  return {
    title: 'Bài kiểm thử tạm thời về sóng', slug: 'bai-kiem-thu-tam-thoi-ve-song',
    summary: 'Dữ liệu kiểm thử tự động trong cơ sở dữ liệu tạm; không phải bài viết SPOFY.',
    category: 'vat-li', tags: ['kiểm thử'], author: 'Tác giả kiểm thử',
    coverImage: 'https://example.test/temporary-test-cover.png', coverAlt: 'Ảnh bìa kiểm thử tạm thời',
    blocks: [
      { type: 'heading', level: 2, text: 'Dữ liệu kiểm thử' },
      { type: 'paragraph', text: 'Đây là nội dung tạm thời để kiểm tra API thật.' },
    ],
    references: [], status: 'draft', featured: false, ...overrides,
  };
}

export async function createArticle(admin, overrides = {}) {
  const result = await admin.request('/api/admin/articles', { method: 'POST', data: articleFixture(overrides) });
  assert.equal(result.status, 201, result.text);
  assert.ok(result.json?.article?.id, result.text);
  return result.json.article;
}

export async function setupRoles(fixture) {
  const guest = fixture.client();
  await guest.session();
  const admin = fixture.client();
  await admin.login();
  const reader = fixture.client();
  const registration = await reader.register();
  assert.equal(registration.status, 200, registration.text);
  await reader.session();
  return { guest, admin, reader };
}
