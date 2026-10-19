import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { netlifyDatabase } from '../server/database.mjs';
import { articleSlug, canonicalOrigin, pagePath, renderPageHtml, PAGE_HEADERS } from '../../server/page-meta.mjs';
import { runtimeSettings } from '../server/deploy-context.mjs';
import { previewBlocked } from '../../server/deploy-policy.mjs';

let shellPromise;
const loadBuiltShell = () => shellPromise ??= readFile(join(process.cwd(), 'netlify/generated/page-shell.html'), 'utf8').catch(error => { shellPromise = undefined; throw error; });

// The public renderer deliberately has no session handling and its only article
// query includes status='published'. A guessed draft slug cannot expose metadata.
export function createPageHandler({ loadShell = loadBuiltShell, database = netlifyDatabase, origin = process.env.SITE_ORIGIN, env = {} } = {}) {
  return async function page(request) {
    const headers = { ...PAGE_HEADERS };
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Phương thức không được hỗ trợ.', { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
    const pathname = pagePath(request.url);
    let article = null, unavailable = false;
    try {
      const slug = articleSlug(pathname);
      if (slug) {
        if (previewBlocked(env)) throw new Error('Preview database not confirmed');
        const db = typeof database === 'function' ? database() : database;
        const result = await db.query("SELECT title,slug,summary,cover_image,cover_alt,author,status,blocks_json,published_at,updated_at FROM articles WHERE slug=$1 AND status='published'", [slug]);
        article = result.rows[0] ?? null;
      }
    } catch {
      // Never print connection strings, SQL, request cookies or article content.
      console.error('SPOFY page: không kết nối được cơ sở dữ liệu.');
      unavailable = true;
    }
    let shell;
    try { shell = await loadShell(); }
    catch {
      return new Response('<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>SPOFY tạm thời chưa sẵn sàng</title><h1>SPOFY tạm thời chưa sẵn sàng</h1><p>Vui lòng thử lại sau.</p></html>', { status: 503, headers: { ...headers, 'Retry-After': '60', 'X-Robots-Tag': 'noindex, nofollow' } });
    }
    const rendered = renderPageHtml(shell, { pathname, article, unavailable, origin: canonicalOrigin(origin) });
    if (rendered.metadata.robots.startsWith('noindex')) headers['X-Robots-Tag'] = rendered.metadata.robots;
    if (rendered.status === 503) headers['Retry-After'] = '60';
    return new Response(request.method === 'HEAD' ? null : rendered.html, { status: rendered.status, headers });
  };
}

let handler;
export default async function(request) {
  try { const env = await runtimeSettings(); handler ??= createPageHandler({env}); return await handler(request); }
  catch { return new Response('SPOFY: chưa sẵn sàng phục vụ bản xem thử.',{status:503,headers:{...PAGE_HEADERS,'X-Robots-Tag':'noindex,nofollow'}}); }
}
