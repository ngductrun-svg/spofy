import { articleDisplay } from './article-display.mjs';

// A small HTML metadata layer shared by the local server and Netlify Function.
// It never reads sessions or private article data and does not replace React.
export const SITE_ORIGIN = 'https://spofysofia.netlify.app';
export const PAGE_CSP = `default-src 'self'; script-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;

export const PAGE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Netlify-CDN-Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': PAGE_CSP,
};

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
const concise = (text, max = 190) => String(text ?? '').replace(/\s+/gu, ' ').trim().slice(0, max);
export function canonicalOrigin(value = SITE_ORIGIN) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) return url.origin;
  } catch { /* A malformed public setting must not become an HTML URL. */ }
  return SITE_ORIGIN;
}
export function pagePath(value) {
  let path;
  try { path = new URL(value || '/', SITE_ORIGIN).pathname; } catch { return '/404'; }
  path = path.replace(/^\/\.netlify\/functions\/page(?=\/|$)/u, '') || '/';
  return path === '/' ? path : path.replace(/\/+$/u, '');
}
export function articleSlug(pathname) {
  const path = pagePath(pathname);
  if (!path.startsWith('/khoa-hoc/')) return null;
  let slug;
  try { slug = decodeURIComponent(path.slice('/khoa-hoc/'.length)); } catch { return null; }
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug) && slug.length <= 160 ? slug : null;
}
function safeImage(value, origin) {
  if (!value) return null;
  try {
    const url = new URL(value, origin);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    // Relative uploaded media are public only when the enclosing article is published.
    if (!/^[a-z][a-z\d+.-]*:/iu.test(value) && !/^\/media\/[a-f0-9-]{36}\.(?:png|jpg)$/u.test(value)) return null;
    return url.href;
  } catch { return null; }
}
function dateISO(value) {
  if (value == null || value === '') return null;
  const date = new Date(typeof value === 'string' && /^\d+$/u.test(value) ? Number(value) : value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function normalizeArticle(article) {
  if (!article || article.status !== 'published') return null;
  article = { ...article, ...articleDisplay(article) };
  let blocks = article.blocks;
  if (!blocks && typeof article.blocks_json === 'string') {
    try { blocks = JSON.parse(article.blocks_json); } catch { blocks = []; }
  }
  return {
    title: article.displayTitle || article.title,
    originalTitle: article.originalTitle || article.title,
    summary: article.editorialSummary || article.displaySummary || article.summary,
    slug: article.slug,
    author: article.author,
    cover: article.coverImage ?? article.cover_image,
    coverAlt: article.coverAlt ?? article.cover_alt,
    published: dateISO(article.publishedAt ?? article.published_at),
    updated: dateISO(article.updatedAt ?? article.updated_at),
    blocks: Array.isArray(blocks) ? blocks : [],
  };
}

const pages = {
  '/': ['SPOFY — Hành trình của trí tò mò', 'Cùng SPOFY đọc khoa học, khám phá hoạt động và tìm hiểu câu lạc bộ qua những dấu mốc cùng kho ảnh tư liệu từ năm 2017.'],
  '/khoa-hoc': ['Khoa học | SPOFY', 'Đọc các bài đã xuất bản của SPOFY về Toán học, Vật lí, Hóa học, Sinh học, Công nghệ và STEM. Đọc bài không cần tài khoản.'],
  '/bat-dau': ['Bắt đầu từ đây | SPOFY', 'Chọn hành trình của bạn: đọc khoa học, xem hoạt động hoặc tìm hiểu cách kết nối với SPOFY.'],
  '/cau-hoi-moi-tuan': ['Một câu hỏi mỗi tuần | SPOFY', 'Khám phá câu hỏi khoa học và phần giải thích đã được biên tập từ SPOFY. Nội dung chỉ xuất hiện khi có câu hỏi đã xác minh.'],
  '/tham-gia': ['Tham gia và câu hỏi thường gặp | SPOFY', 'Tìm hiểu SPOFY, theo dõi thông tin tuyển thành viên và kết nối qua trang Facebook chính thức của câu lạc bộ.'],
  '/quyen-rieng-tu': ['Thông tin quyền riêng tư | SPOFY', 'Tìm hiểu tài khoản, phiên đăng nhập, bình luận và dữ liệu mà website SPOFY sử dụng để vận hành.'],
  '/dang-nhap': ['Đăng nhập | SPOFY', 'Đăng nhập để bình luận và đặt câu hỏi trên SPOFY. Bạn có thể đọc các bài đã xuất bản mà không cần tài khoản.'],
  '/dang-ky': ['Đăng ký tài khoản | SPOFY', 'Tạo tài khoản độc giả để bình luận và đặt câu hỏi trên SPOFY. Đọc bài khoa học không cần đăng ký.'],
  '/quen-mat-khau': ['Quên mật khẩu | SPOFY', 'Yêu cầu liên kết khôi phục mật khẩu cho tài khoản SPOFY.'],
  '/dat-lai-mat-khau': ['Đặt lại mật khẩu | SPOFY', 'Đặt lại mật khẩu tài khoản SPOFY bằng liên kết khôi phục còn hiệu lực.'],
  '/xac-minh-email': ['Xác minh email | SPOFY', 'Xác minh địa chỉ email của tài khoản SPOFY bằng liên kết được gửi đến hộp thư của bạn.'],
};
const privatePath = path => /^\/(?:admin|dang-nhap|dang-ky|quen-mat-khau|dat-lai-mat-khau|xac-minh-email)(?:\/|$)/u.test(path);

export function pageMetadata({ pathname = '/', article, origin = SITE_ORIGIN, unavailable = false } = {}) {
  const path = pagePath(pathname), base = canonicalOrigin(origin);
  const published = normalizeArticle(article);
  const metadata = {
    title: '', description: '', canonical: new URL(path, base).href,
    image: `${base}/archive/photos/1190515168964915.webp`, imageAlt: 'Hoạt động SPOFY trong tư liệu của câu lạc bộ',
    type: 'website', robots: 'index, follow', status: 200, published: null, updated: null, author: null,
  };
  if (unavailable) {
    Object.assign(metadata, { title: 'Tạm thời chưa tải được nội dung | SPOFY', description: 'Website chưa kết nối được dữ liệu. Vui lòng thử lại sau.', robots: 'noindex, nofollow', status: 503 });
  } else if (path.startsWith('/khoa-hoc/')) {
    if (!published || !articleSlug(path) || published.slug !== articleSlug(path)) {
      Object.assign(metadata, { title: 'Không tìm thấy bài viết | SPOFY', description: 'Bài viết chưa được xuất bản hoặc đường dẫn không tồn tại.', robots: 'noindex, nofollow', status: 404 });
    } else {
      Object.assign(metadata, {
        title: `${concise(published.title, 160)} | SPOFY`, description: concise(published.summary) || 'Đọc bài khoa học đã xuất bản của SPOFY.',
        type: 'article', image: safeImage(published.cover, base), imageAlt: concise(published.coverAlt, 300),
        published: published.published, updated: published.updated, author: concise(published.author, 120),
      });
    }
  } else if (pages[path]) {
    [metadata.title, metadata.description] = pages[path];
    if (privatePath(path)) metadata.robots = 'noindex, nofollow';
  } else if (path === '/admin' || path.startsWith('/admin/')) {
    Object.assign(metadata, { title: 'Quản trị SPOFY', description: 'Khu vực quản trị dành cho tài khoản được cấp quyền.', robots: 'noindex, nofollow' });
  } else {
    Object.assign(metadata, { title: 'Không tìm thấy trang | SPOFY', description: 'Đường dẫn này không có trong website SPOFY.', robots: 'noindex, nofollow', status: 404 });
  }
  return metadata;
}

function metadataTags(metadata) {
  const tags = [
    `<title>${escapeHtml(metadata.title)}</title>`,
    `<meta name="description" content="${escapeHtml(metadata.description)}" />`,
    `<meta name="robots" content="${metadata.robots}" />`,
    `<link rel="canonical" href="${escapeHtml(metadata.canonical)}" />`,
    `<meta property="og:locale" content="vi_VN" />`,
    `<meta property="og:site_name" content="SPOFY" />`,
    `<meta property="og:type" content="${metadata.type}" />`,
    `<meta property="og:title" content="${escapeHtml(metadata.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(metadata.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(metadata.canonical)}" />`,
    `<meta name="twitter:card" content="${metadata.image ? 'summary_large_image' : 'summary'}" />`,
  ];
  if (metadata.image) tags.push(`<meta property="og:image" content="${escapeHtml(metadata.image)}" />`, `<meta property="og:image:alt" content="${escapeHtml(metadata.imageAlt)}" />`);
  if (metadata.type === 'article') {
    if (metadata.published) tags.push(`<meta property="article:published_time" content="${metadata.published}" />`);
    if (metadata.updated) tags.push(`<meta property="article:modified_time" content="${metadata.updated}" />`);
    if (metadata.author) tags.push(`<meta name="author" content="${escapeHtml(metadata.author)}" />`);
  }
  return `<!--spofy:meta:start-->\n${tags.join('\n')}\n<!--spofy:meta:end-->`;
}
function articleFallback(article) {
  const text = article.blocks.map(block => {
    if (!block || typeof block !== 'object') return '';
    if (block.type === 'paragraph') return `<p>${escapeHtml(block.text)}</p>`;
    if (block.type === 'heading') return `<h2>${escapeHtml(block.text)}</h2>`;
    if (block.type === 'list' && Array.isArray(block.items)) return `<ul>${block.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
    if (block.type === 'formula') return `<p><code>${escapeHtml(block.latex)}</code>${block.caption ? ` — ${escapeHtml(block.caption)}` : ''}</p>`;
    if (block.type === 'image' && block.caption) return `<p>${escapeHtml(block.caption)}</p>`;
    return '';
  }).join('\n');
  return `<article><h1>${escapeHtml(article.title)}</h1><p>${escapeHtml(article.summary)}</p>${text}</article>`;
}
/** Metadata is present in the first HTTP response, including for social crawlers. */
export function renderPageHtml(shell, options = {}) {
  const metadata = pageMetadata(options);
  let html = String(shell);
  const tags = metadataTags(metadata);
  if (/<!--spofy:meta:start-->[\s\S]*?<!--spofy:meta:end-->/u.test(html)) html = html.replace(/<!--spofy:meta:start-->[\s\S]*?<!--spofy:meta:end-->/u, () => tags);
  else {
    html = html.replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/giu, '')
      .replace(/<meta\b(?=[^>]*(?:name\s*=\s*["'](?:description|robots|author|twitter:[^"']*)["']|property\s*=\s*["'](?:og:|article:)[^"']*["']))[^>]*>/giu, '')
      .replace(/<link\b(?=[^>]*rel\s*=\s*["']canonical["'])[^>]*>/giu, '');
    html = html.replace(/<\/head\s*>/iu, () => `${tags}\n</head>`);
  }
  const article = normalizeArticle(options.article);
  const content = metadata.type === 'article' && metadata.status === 200 && article ? articleFallback(article) : `<h1>${escapeHtml(metadata.title)}</h1><p>${escapeHtml(metadata.description)}</p>`;
  const fallback = `<noscript><main>${content}<p>Bật JavaScript để sử dụng tìm kiếm, kho ảnh, tài khoản và bình luận.</p><nav aria-label="Liên kết SPOFY"><a href="/">Trang chủ</a> · <a href="/khoa-hoc">Khoa học</a> · <a href="https://www.facebook.com/spofy.sofia" rel="noopener noreferrer">Facebook SPOFY</a></nav></main></noscript>`;
  html = /<noscript\b[^>]*>[\s\S]*?<\/noscript\s*>/iu.test(html) ? html.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript\s*>/iu, () => fallback) : html.replace(/<\/body\s*>/iu, () => `${fallback}\n</body>`);
  return { html, status: metadata.status, metadata };
}
