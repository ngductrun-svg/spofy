import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createPageHandler } from '../netlify/functions/page.mjs';
import { articleSlug, canonicalOrigin, pageMetadata, renderPageHtml, PAGE_CSP, SITE_ORIGIN } from '../server/page-meta.mjs';

const shell = '<!doctype html><html lang="vi"><head><meta name="description" content="old"><meta property="og:url" content="https://old.example/"><title>Old</title><link rel="canonical" href="https://old.example/"></head><body><div id="root"></div><noscript>Old fallback</noscript><script type="module" src="/assets/main.js"></script></body></html>';
const article = { status: 'published', slug: 'mot-cau-hoi', title: 'Một câu hỏi về ánh sáng', summary: 'Một mô tả do người biên tập cung cấp.', author: 'SPOFY', coverImage: '/media/fe7cc9f1-c896-4152-89ae-8094ae102d2b.jpg', coverAlt: 'Nguồn sáng trong thí nghiệm', publishedAt: '2026-10-17T01:00:00.000Z', updatedAt: '2026-10-18T01:00:00.000Z', blocks: [{ type: 'paragraph', text: 'Nội dung đã xuất bản.' }] };

test('public routes have distinct crawler-readable Vietnamese metadata and canonical production URLs', () => {
  const paths = ['/', '/khoa-hoc', '/bat-dau', '/cau-hoi-moi-tuan', '/tham-gia', '/quyen-rieng-tu'];
  const titles = new Set();
  for (const pathname of paths) {
    const { html, metadata, status } = renderPageHtml(shell, { pathname });
    assert.equal(status, 200);
    assert.equal(metadata.canonical, `${SITE_ORIGIN}${pathname}`);
    assert.ok(metadata.description.length > 40);
    assert.equal(metadata.robots, 'index, follow');
    assert.equal((html.match(/<title>/gu) || []).length, 1);
    assert.equal((html.match(/rel="canonical"/gu) || []).length, 1);
    assert.ok(!html.includes('old.example'));
    assert.ok(html.includes('/assets/main.js'));
    titles.add(metadata.title);
  }
  assert.equal(titles.size, paths.length);
  assert.equal(canonicalOrigin('https://spoof.example@evil.example/secret'), SITE_ORIGIN);
  assert.equal(canonicalOrigin('javascript:alert(1)'), SITE_ORIGIN);
  assert.equal(pageMetadata({ pathname: '/khoa-hoc?q=private#comments' }).canonical, `${SITE_ORIGIN}/khoa-hoc`);
});

test('article HTML includes title, summary, shared image, dates and safely escaped semantic fallback', () => {
  const malicious = { ...article, title: '"><script>alert(1)</script>', summary: '" onload="alert(2) & <img src=x>', author: '<script>author</script>', blocks: [{ type: 'paragraph', text: '<script>body</script>' }, { type: 'list', items: ['<img onerror=alert(1)>'] }] };
  const { html, metadata } = renderPageHtml(shell, { pathname: '/khoa-hoc/mot-cau-hoi', article: malicious });
  assert.equal(metadata.status, 200);
  assert.equal(metadata.type, 'article');
  assert.equal(metadata.image, `${SITE_ORIGIN}${article.coverImage}`);
  assert.ok(html.includes('article:published_time'));
  assert.ok(html.includes('article:modified_time'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('&lt;script&gt;body&lt;/script&gt;'));
  assert.ok(!html.includes('<script>alert(1)'));
  assert.ok(!html.includes('<img src=x>'));
  assert.ok(html.includes('<noscript><main><article>'));
  assert.equal(pageMetadata({ pathname: '/khoa-hoc/mot-cau-hoi', article: { ...article, coverImage: 'javascript:alert(1)' } }).image, null);
  const repeat = renderPageHtml(html, { pathname: '/khoa-hoc' }).html;
  assert.equal((repeat.match(/property="og:title"/gu) || []).length, 1);
  assert.ok(!repeat.includes('article:published_time'));
});

test('drafts, mismatched slugs and malformed paths return generic noindex metadata without private content', () => {
  for (const value of [null, { ...article, status: 'draft', title: 'PRIVATE TITLE', summary: 'PRIVATE SUMMARY' }, { ...article, slug: 'different' }]) {
    const rendered = renderPageHtml(shell, { pathname: '/khoa-hoc/mot-cau-hoi', article: value });
    assert.equal(rendered.status, 404);
    assert.equal(rendered.metadata.robots, 'noindex, nofollow');
    assert.ok(!rendered.html.includes('PRIVATE'));
    assert.ok(!rendered.html.includes('Nội dung đã xuất bản.'));
    assert.equal(rendered.metadata.type, 'website');
  }
  for (const path of ['/khoa-hoc/%ZZ', '/khoa-hoc/../../admin', '/khoa-hoc/a/b', '/khoa-hoc/%3Cscript%3E']) assert.equal(articleSlug(path), null);
  assert.equal(articleSlug('/.netlify/functions/page/khoa-hoc/mot-cau-hoi'), 'mot-cau-hoi');
});

test('account, admin, reset and verify pages never advertise indexing or include a token in canonical', () => {
  for (const pathname of ['/admin', '/admin/tai-khoan', '/dang-nhap', '/dang-ky', '/quen-mat-khau', '/dat-lai-mat-khau?token=secret', '/xac-minh-email?token=secret']) {
    const metadata = pageMetadata({ pathname });
    assert.equal(metadata.status, 200);
    assert.equal(metadata.robots, 'noindex, nofollow');
    assert.ok(!metadata.canonical.includes('secret'));
  }
  assert.ok(PAGE_CSP.includes("connect-src 'self';"));
  assert.ok(!PAGE_CSP.includes("script-src 'self' 'unsafe-inline'"));
});

test('Netlify page handler executes published-only PostgreSQL lookup and blocks draft disclosure', async t => {
  const pg = new PGlite();
  t.after(() => pg.close());
  await pg.exec('CREATE TABLE articles(title TEXT,slug TEXT,summary TEXT,cover_image TEXT,cover_alt TEXT,author TEXT,status TEXT,blocks_json TEXT,published_at BIGINT,updated_at BIGINT)');
  await pg.query('INSERT INTO articles VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [article.title, article.slug, article.summary, article.coverImage, article.coverAlt, article.author, 'published', JSON.stringify(article.blocks), 1792198800000, 1792285200000]);
  await pg.query("INSERT INTO articles(title,slug,summary,status) VALUES('SECRET DRAFT','hidden-draft','SECRET SUMMARY','draft')");
  const handler = createPageHandler({ loadShell: async () => shell, database: { query: (sql, values) => pg.query(sql, values) } });
  const response = await handler(new Request('https://preview-example.netlify.app/khoa-hoc/mot-cau-hoi'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Netlify-CDN-Cache-Control'), 'no-store');
  const html = await response.text();
  assert.ok(html.includes(article.title));
  assert.ok(html.includes(`${SITE_ORIGIN}/khoa-hoc/mot-cau-hoi`));
  assert.ok(!html.includes('preview-example.netlify.app'));
  const draft = await handler(new Request('https://preview-example.netlify.app/khoa-hoc/hidden-draft'));
  assert.equal(draft.status, 404);
  assert.equal(draft.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.ok(!(await draft.text()).includes('SECRET'));
  const head = await handler(new Request(`${SITE_ORIGIN}/khoa-hoc/mot-cau-hoi`, { method: 'HEAD' }));
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});

test('static and private pages do not require a DB; failures return generic noindex 503 without leaking secrets', async () => {
  let queried = false;
  const handler = createPageHandler({ loadShell: async () => shell, database: () => { queried = true; throw new Error('SECRET DATABASE URL'); } });
  for (const path of ['/', '/khoa-hoc', '/dang-nhap', '/admin/tai-khoan', '/not-a-page']) {
    const response = await handler(new Request(`${SITE_ORIGIN}${path}`));
    assert.equal(response.status, path === '/not-a-page' ? 404 : 200);
  }
  assert.equal(queried, false);
  const response = await handler(new Request(`${SITE_ORIGIN}/khoa-hoc/mot-cau-hoi`));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Retry-After'), '60');
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.ok(!(await response.text()).includes('SECRET DATABASE URL'));
  assert.equal((await handler(new Request(`${SITE_ORIGIN}/`, { method: 'POST' }))).status, 405);
  const noShell = createPageHandler({ loadShell: async () => { throw new Error('PRIVATE PATH'); } });
  const fallback = await noShell(new Request(`${SITE_ORIGIN}/`));
  assert.equal(fallback.status, 503);
  assert.ok(!(await fallback.text()).includes('PRIVATE PATH'));
});

test('known editorial display title is shared with metadata without changing the stored original title or category', () => {
  const original = { ...article, slug: 'calling-for-a-hot-drink', title: '[CALLING FOR A HOT DRINK]', category: 'toan-hoc', summary: 'Mở đầu gốc.' };
  const metadata = pageMetadata({ pathname: '/khoa-hoc/calling-for-a-hot-drink', article: original });
  assert.equal(metadata.title, 'Chocolate nóng trong những ngày lạnh | SPOFY');
  assert.equal(original.title, '[CALLING FOR A HOT DRINK]');
  assert.equal(original.category, 'toan-hoc');
  assert.ok(!metadata.description.includes('Mở đầu gốc.'));
});

test('deployment rules keep API and private media ahead of the HTML route and bundle the generated shell', async () => {
  const config = await readFile(new URL('../netlify.toml', import.meta.url), 'utf8');
  assert.ok(config.indexOf('from = "/api/*"') < config.indexOf('from = "/*"'));
  assert.ok(config.indexOf('from = "/media/*"') < config.indexOf('from = "/*"'));
  assert.ok(config.includes('"netlify/generated/page-shell.html"'));
  assert.ok(config.includes('"netlify/generated/deploy-context.json"'));
  assert.ok(config.includes('to = "/.netlify/functions/page/:splat"'));
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes(`property="og:url" content="${SITE_ORIGIN}/"`));
});
