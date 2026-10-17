import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN, READER, PNG, articleFixture, createArticle, setupRoles, startFixture } from './helpers.mjs';

const rejected = (response, statuses = [400, 413, 415, 422]) => assert.ok(statuses.includes(response.status), `expected ${statuses.join('/')} but received ${response.status}: ${response.text}`);
const ids = (response) => response.json.items.map(item => item.id);

test('published-only API, featured cap, pagination, search and durable SQLite across restart', async (t) => {
  const fixture = await startFixture();
  t.after(() => fixture.close());
  const { guest, admin, reader } = await setupRoles(fixture);
  const draft = await createArticle(admin, { slug: 'private-draft' });
  const published = [];
  for (let index = 0; index < 4; index++) published.push(await createArticle(admin, {
    slug: `published-test-${index}`, title: `Dữ liệu thử xuất bản ${index}`,
    status: 'published', featured: index < 3, category: index % 2 ? 'toan-hoc' : 'vat-li',
  }));
  for (const client of [guest, reader]) {
    const list = await client.request('/api/articles?page=1&pageSize=2');
    assert.equal(list.status, 200, list.text);
    assert.equal(list.json.total, 4);
    assert.equal(list.json.items.length, 2);
    assert.equal(list.json.totalPages, 2);
    assert.ok(!JSON.stringify(list.json).includes('private-draft'));
    const hiddenSlug = await client.request(`/api/articles/${draft.slug}`);
    assert.equal(hiddenSlug.status, 404, hiddenSlug.text);
    const guessedId = await client.request(`/api/articles/${draft.id}`);
    assert.equal(guessedId.status, 404, guessedId.text);
    const draftComments = await client.request(`/api/articles/${draft.id}/comments`);
    assert.equal(draftComments.status, 404, draftComments.text);
    const featured = await client.request('/api/articles?featured=1&pageSize=3');
    assert.equal(featured.status, 200, featured.text);
    assert.ok(featured.json.items.length <= 3);
    assert.equal(featured.json.total, 3);
    assert.ok(!ids(featured).includes(published[3].id));
    assert.ok(featured.json.items.every(item => item.status === 'published' && item.featured));
    const search = await client.request(`/api/articles?q=${encodeURIComponent('Dữ liệu thử xuất bản 2')}`);
    assert.equal(search.status, 200, search.text);
    assert.ok(ids(search).includes(published[2].id));
    const category = await client.request('/api/articles?category=toan-hoc');
    assert.equal(category.status, 200, category.text);
    assert.equal(category.json.total, 2);
  }
  const detail = await guest.request(`/api/articles/${published[0].slug}`);
  assert.equal(detail.status, 200, detail.text);
  assert.equal(detail.json.article.id, published[0].id);
  assert.ok(detail.json.related.every(item => item.status === 'published'));
  const commentResult = await reader.request(`/api/articles/${published[0].id}/comments`, { method: 'POST', data: { body: 'Bình luận kiểm thử cần được lưu bền vững.' } });
  assert.equal(commentResult.status, 201, commentResult.text);
  await fixture.restart();
  const visitorAfterRestart = fixture.client();
  const persisted = await visitorAfterRestart.request(`/api/articles/${published[0].slug}`);
  assert.equal(persisted.status, 200, persisted.text);
  const comments = await visitorAfterRestart.request(`/api/articles/${published[0].id}/comments`);
  assert.equal(comments.status, 200, comments.text);
  assert.ok(comments.json.items.some(item => item.body === 'Bình luận kiểm thử cần được lưu bền vững.'));
  await admin.login();
  const update = await admin.request(`/api/admin/articles/${published[0].id}`, { method: 'PATCH', data: { status: 'draft' } });
  assert.equal(update.status, 200, update.text);
  assert.equal((await guest.request(`/api/articles/${published[0].slug}`)).status, 404);
  assert.equal((await guest.request(`/api/articles/${published[0].id}/comments`)).status, 404);
  assert.ok(!ids(await guest.request('/api/articles')).includes(published[0].id));
});

test('server enforces guest/reader/admin roles for every protected write, including own comments', async (t) => {
  const fixture = await startFixture();
  t.after(() => fixture.close());
  const { guest, admin, reader } = await setupRoles(fixture);
  const article = await createArticle(admin, { status: 'published' });
  const comment = await reader.request(`/api/articles/${article.id}/comments`, { method: 'POST', data: { body: 'Bình luận để kiểm tra quyền sở hữu.' } });
  assert.equal(comment.status, 201, comment.text);
  const commentId = comment.json.comment.id;
  const attempts = [
    ['/api/admin/articles', 'GET'],
    ['/api/admin/articles', 'POST', articleFixture({ slug: 'forbidden-post' })],
    [`/api/admin/articles/${article.id}`, 'GET'],
    [`/api/admin/articles/${article.id}`, 'PATCH', { title: 'Không được sửa' }],
    [`/api/admin/articles/${article.id}`, 'DELETE'],
    ['/api/admin/comments', 'GET'],
    [`/api/admin/comments/${commentId}`, 'PATCH', { status: 'hidden' }],
    [`/api/admin/comments/${commentId}`, 'DELETE'],
    ['/api/admin/uploads', 'POST', undefined, PNG, { 'Content-Type': 'image/png' }],
  ];
  for (const [client, expected] of [[guest, 401], [reader, 403]]) {
    for (const [path, method, data, body, headers] of attempts) {
      const response = await client.request(path, { method, data, body, headers });
      assert.equal(response.status, expected, `${method} ${path}: ${response.text}`);
    }
  }
  for (const path of [`/api/articles/${article.id}/comments/${commentId}`, `/api/comments/${commentId}`]) {
    for (const method of ['PATCH', 'DELETE']) {
      const response = await reader.request(path, { method, ...(method === 'PATCH' ? { data: { body: 'Sửa trái phép' } } : {}) });
      rejected(response, [403, 404, 405]);
    }
  }
  const guestComment = await guest.request(`/api/articles/${article.id}/comments`, { method: 'POST', data: { body: 'Khách không được gửi.' } });
  assert.equal(guestComment.status, 401, guestComment.text);
  const unchanged = await guest.request(`/api/articles/${article.id}/comments`);
  assert.equal(unchanged.json.items.length, 1);
  assert.equal(unchanged.json.items[0].body, 'Bình luận để kiểm tra quyền sở hữu.');
  assert.equal((await guest.request(`/api/articles/${article.slug}`)).json.article.title, article.title);
});

test('admin draft, preview read, edit, publish, unpublish and delete preserve publication boundaries', async (t) => {
  const fixture = await startFixture();
  t.after(() => fixture.close());
  const { guest, admin } = await setupRoles(fixture);
  const draft = await createArticle(admin, { slug: 'draft-lifecycle', summary: '', coverImage: '', coverAlt: '', blocks: [] });
  assert.equal(draft.status, 'draft');
  const adminRead = await admin.request(`/api/admin/articles/${draft.id}`);
  assert.equal(adminRead.status, 200, adminRead.text);
  assert.equal(adminRead.json.article.id, draft.id);
  const badPublish = await admin.request(`/api/admin/articles/${draft.id}`, { method: 'PATCH', data: { status: 'published' } });
  rejected(badPublish);
  assert.equal((await guest.request(`/api/articles/${draft.slug}`)).status, 404);
  const edit = await admin.request(`/api/admin/articles/${draft.id}`, { method: 'PATCH', data: {
    ...articleFixture({ slug: 'updated-lifecycle', title: 'Bài kiểm thử đã sửa', status: 'published', featured: true }),
  } });
  assert.equal(edit.status, 200, edit.text);
  assert.equal(edit.json.article.slug, 'updated-lifecycle');
  const published = await guest.request('/api/articles/updated-lifecycle');
  assert.equal(published.status, 200, published.text);
  assert.equal(published.json.article.title, 'Bài kiểm thử đã sửa');
  const duplicateSlug = await admin.request('/api/admin/articles', { method: 'POST', data: articleFixture({ slug: 'updated-lifecycle' }) });
  assert.equal(duplicateSlug.status, 409, duplicateSlug.text);
  assert.equal((await admin.request(`/api/admin/articles/${draft.id}`, { method: 'PATCH', data: { role: 'reader' } })).status, 422);
  assert.equal((await admin.request(`/api/admin/articles/${draft.id}`, { method: 'PATCH', data: { status: 'draft' } })).status, 200);
  assert.equal((await guest.request('/api/articles/updated-lifecycle')).status, 404);
  const removed = await admin.request(`/api/admin/articles/${draft.id}`, { method: 'DELETE' });
  assert.ok([200, 204].includes(removed.status), removed.text);
  assert.equal((await admin.request(`/api/admin/articles/${draft.id}`)).status, 404);
  assert.equal((await guest.request('/api/articles/updated-lifecycle')).status, 404);
});

test('registration never grants admin; session cookie, CSRF/origin and logout are server verified', async (t) => {
  const fixture = await startFixture();
  t.after(() => fixture.close());
  const attacker = fixture.client();
  const escalated = await attacker.register({ ...READER, email: 'promotion@example.test' }, { role: 'admin', isAdmin: true });
  rejected(escalated, [400, 422]);
  const reader = fixture.client();
  const registration = await reader.register();
  assert.equal(registration.status, 201, registration.text);
  const session = await reader.session();
  assert.equal(session.json.user.role, 'reader');
  assert.ok(session.json.csrfToken);
  assert.ok(!session.text.includes(READER.password));
  assert.ok(!session.json.user.passwordHash);
  const cookieHeaders = registration.headers.getSetCookie().join(';');
  assert.match(cookieHeaders, /HttpOnly/i);
  assert.match(cookieHeaders, /SameSite=(?:Lax|Strict)/i);
  assert.match(cookieHeaders, /Path=\//i);
  assert.ok(!('token' in (registration.json ?? {})), 'no bearer session token returned to browser JavaScript');
  const admin = fixture.client();
  await admin.login();
  for (const options of [
    { csrf: false },
    { origin: 'https://attacker.example.test' },
    { origin: false },
    { headers: { 'X-CSRF-Token': 'incorrect-token' }, csrf: false },
  ]) {
    const response = await admin.request('/api/admin/articles', { method: 'POST', data: articleFixture(), ...options });
    assert.equal(response.status, 403, response.text);
  }
  const savedCookies = new Map(admin.cookies);
  const logout = await admin.request('/api/auth/logout', { method: 'POST', data: {} });
  assert.ok([200, 204].includes(logout.status), logout.text);
  assert.equal((await admin.session()).json.user, null);
  admin.cookies = savedCookies; // Replay a previously valid cookie after server-side logout.
  const replay = await admin.request('/api/admin/articles');
  assert.equal(replay.status, 401, replay.text);
});

test('comment limits, duplicate prevention and admin moderation are enforced by the backend', async (t) => {
  const fixture = await startFixture({ limits: { comments: { count: 3, windowMs: 60_000 }, commentIntervalMs: 1_000 } });
  t.after(() => fixture.close());
  const { guest, admin, reader } = await setupRoles(fixture);
  const article = await createArticle(admin, { status: 'published' });
  for (const body of ['', '  ', 'x'.repeat(2001)]) {
    rejected(await reader.request(`/api/articles/${article.id}/comments`, { method: 'POST', data: { body } }));
  }
  const first = await reader.request(`/api/articles/${article.id}/comments`, { method: 'POST', data: { body: 'Nội dung kiểm thử bình luận duy nhất.' } });
  assert.equal(first.status, 201, first.text);
  fixture.advance(1_100);
  const duplicate = await reader.request(`/api/articles/${article.id}/comments`, { method: 'POST', data: { body: 'Nội dung kiểm thử bình luận duy nhất.' } });
  assert.equal(duplicate.status, 409, duplicate.text);
  const second = await reader.request(`/api/articles/${article.id}/comments`, { method: 'POST', data: { body: 'Bình luận kế tiếp trong cửa sổ giới hạn.' } });
  assert.equal(second.status, 201, second.text);
  const tooFast = await reader.request(`/api/articles/${article.id}/comments`, { method: 'POST', data: { body: 'Gửi ngay lập tức cần bị chặn.' } });
  assert.equal(tooFast.status, 429, tooFast.text);
  assert.ok(tooFast.headers.get('Retry-After'));
  fixture.advance(1_100);
  const third = await reader.request(`/api/articles/${article.id}/comments`, { method: 'POST', data: { body: 'Bình luận hợp lệ thứ ba.' } });
  assert.equal(third.status, 201, third.text);
  fixture.advance(1_100);
  const windowLimited = await reader.request(`/api/articles/${article.id}/comments`, { method: 'POST', data: { body: 'Vượt số bình luận trong một phút.' } });
  assert.equal(windowLimited.status, 429, windowLimited.text);
  const commentId = first.json.comment.id;
  const hidden = await admin.request(`/api/admin/comments/${commentId}`, { method: 'PATCH', data: { status: 'hidden' } });
  assert.equal(hidden.status, 200, hidden.text);
  assert.ok(!ids(await guest.request(`/api/articles/${article.id}/comments`)).includes(commentId));
  const management = await admin.request('/api/admin/comments');
  assert.equal(management.status, 200, management.text);
  assert.ok(management.json.items.some(item => item.id === commentId && item.status === 'hidden'));
  assert.equal((await admin.request(`/api/admin/comments/${commentId}`, { method: 'PATCH', data: { status: 'visible' } })).status, 200);
  assert.ok(ids(await guest.request(`/api/articles/${article.id}/comments`)).includes(commentId));
  assert.ok([200, 204].includes((await admin.request(`/api/admin/comments/${commentId}`, { method: 'DELETE' })).status));
  assert.ok(!ids(await guest.request(`/api/articles/${article.id}/comments`)).includes(commentId));
});

test('article schema rejects executable markup/URLs and supports safe scientific content', async (t) => {
  const fixture = await startFixture();
  t.after(() => fixture.close());
  const { admin, guest } = await setupRoles(fixture);
  const invalidFields = [
    { blocks: [{ type: 'html', html: '<img src=x onerror=alert(1)>' }] },
    { blocks: [{ type: 'link', label: 'mã độc', url: 'javascript:alert(1)' }] },
    { blocks: [{ type: 'image', src: 'data:image/svg+xml,<svg onload=alert(1)>', caption: 'x', alt: 'x' }] },
    { references: [{ label: 'Không an toàn', url: 'javascript:alert(1)' }] },
    { coverImage: 'javascript:alert(1)' },
    { category: 'Chuyên mục không tồn tại' },
    { slug: '../api/admin/articles' },
  ];
  for (let index = 0; index < invalidFields.length; index++) {
    rejected(await admin.request('/api/admin/articles', { method: 'POST', data: articleFixture({ slug: `unsafe-test-${index}`, ...invalidFields[index] }) }));
  }
  const textPayload = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
  const safe = await createArticle(admin, { status: 'published', blocks: [
    { type: 'paragraph', text: textPayload },
    { type: 'heading', level: 2, text: 'Công thức kiểm thử' },
    { type: 'formula', latex: 'E = mc^2', caption: 'Công thức dưới dạng dữ liệu' },
    { type: 'list', ordered: false, items: ['Nội dung dữ liệu thứ nhất', 'Nội dung dữ liệu thứ hai'] },
    { type: 'link', label: 'Nguồn tham khảo', url: 'https://example.test/reference' },
  ], references: [{ label: 'Nguồn kiểm thử', url: 'https://example.test/source' }] });
  const publicResult = await guest.request(`/api/articles/${safe.slug}`);
  assert.equal(publicResult.status, 200, publicResult.text);
  assert.equal(publicResult.headers.get('Content-Type')?.split(';')[0], 'application/json');
  assert.ok(publicResult.headers.get('X-Content-Type-Options')?.includes('nosniff'));
  // Plain text blocks must remain data; the frontend renders them using React text nodes.
  assert.ok(publicResult.json.article.blocks.every(block => !('html' in block)));
  const { reader } = await setupReaderOnly(fixture, 'safe-comment@example.test');
  const comment = await reader.request(`/api/articles/${safe.id}/comments`, { method: 'POST', data: { body: textPayload } });
  assert.equal(comment.status, 201, comment.text);
  assert.equal(comment.json.comment.body, textPayload);
});

test('only admins can upload: real images accepted, SVG/spoofed/oversized files rejected and drafts private', async (t) => {
  const fixture = await startFixture();
  t.after(() => fixture.close());
  const { admin, reader, guest } = await setupRoles(fixture);
  for (const [client, status] of [[guest, 401], [reader, 403]]) assert.equal((await client.request('/api/admin/uploads', { method: 'POST', body: PNG, headers: { 'Content-Type': 'image/png' } })).status, status);
  const upload = await admin.request('/api/admin/uploads', { method: 'POST', body: PNG, headers: { 'Content-Type': 'image/png' } });
  assert.equal(upload.status, 201, upload.text);
  assert.equal(upload.json.image.mime, 'image/png');
  assert.equal(upload.json.image.width, 1);
  assert.equal(upload.json.image.height, 1);
  const src = upload.json.image.src;
  assert.ok(typeof src === 'string' && src.startsWith('/'));
  const privateImage = await guest.request(src);
  assert.equal(privateImage.status, 404, privateImage.text);
  const draft = await createArticle(admin, { slug: 'draft-with-private-image', coverImage: src, coverAlt: 'Ảnh kiểm thử tạm' });
  assert.equal((await guest.request(src)).status, 404);
  const adminImage = await admin.request(src);
  assert.equal(adminImage.status, 200, adminImage.text);
  assert.equal(adminImage.headers.get('Content-Type')?.split(';')[0], 'image/png');
  assert.equal((await admin.request(`/api/admin/articles/${draft.id}`, { method: 'PATCH', data: { status: 'published' } })).status, 200);
  assert.equal((await guest.request(src)).status, 200);
  assert.equal((await admin.request(`/api/admin/articles/${draft.id}`, { method: 'PATCH', data: { status: 'draft' } })).status, 200);
  assert.equal((await guest.request(src)).status, 404);
  for (const [body, contentType] of [
    [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), 'image/svg+xml'],
    [Buffer.from('<script>alert(1)</script>'), 'image/png'],
    [PNG, 'text/html'],
    [Buffer.alloc(5 * 1024 * 1024 + 1, 0), 'image/png'],
  ]) rejected(await admin.request('/api/admin/uploads', { method: 'POST', body, headers: { 'Content-Type': contentType } }));
  assert.equal((await guest.request('/media/../../server/auth.mjs')).status, 404);
});

test('login attempts are rate limited and failed authentication gives no admin session', async (t) => {
  const fixture = await startFixture({ limits: { login: { count: 3, windowMs: 60_000 } } });
  t.after(() => fixture.close());
  const attacker = fixture.client();
  await attacker.session();
  for (let attempt = 0; attempt < 3; attempt++) {
    const denied = await attacker.request('/api/auth/login', { method: 'POST', data: { email: ADMIN.email, password: 'Incorrect-password-2026' } });
    assert.equal(denied.status, 401, denied.text);
  }
  await fixture.restart(); // IP/account counters must survive a server restart.
  const blocked = await attacker.request('/api/auth/login', { method: 'POST', data: { email: ADMIN.email, password: ADMIN.password } });
  assert.equal(blocked.status, 429, blocked.text);
  assert.ok(blocked.headers.get('Retry-After'));
  assert.equal((await attacker.request('/api/admin/articles')).status, 401);
  fixture.advance(60_001);
  assert.equal((await attacker.request('/api/auth/login', { method: 'POST', data: { email: ADMIN.email, password: ADMIN.password } })).status, 200);
});

test('production cookie has Secure and sessions expire on the server', async (t) => {
  const fixture = await startFixture({ secureCookies: true });
  t.after(() => fixture.close());
  const admin = fixture.client();
  const login = await admin.login();
  assert.match(login.headers.getSetCookie().join(';'), /; Secure(?:;|$)/i);
  const user = fixture.app.db.prepare('SELECT password_hash FROM users WHERE email=?').get(ADMIN.email);
  assert.ok(user.password_hash.startsWith('scrypt$'));
  assert.ok(!user.password_hash.includes(ADMIN.password));
  fixture.advance(7 * 24 * 60 * 60 * 1000 + 1);
  const expired = await admin.request('/api/admin/articles');
  assert.equal(expired.status, 401, expired.text);
  assert.equal((await admin.session()).json.user, null);
});

async function setupReaderOnly(fixture, email) {
  const reader = fixture.client();
  const registration = await reader.register({ ...READER, email });
  assert.equal(registration.status, 201, registration.text);
  await reader.session();
  return { reader };
}
