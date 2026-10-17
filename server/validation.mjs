import { fail } from './errors.mjs';

export const CATEGORIES = Object.freeze([
  { slug: 'toan-hoc', label: 'Toán học' }, { slug: 'vat-li', label: 'Vật lí' },
  { slug: 'hoa-hoc', label: 'Hóa học' }, { slug: 'sinh-hoc', label: 'Sinh học' },
  { slug: 'cong-nghe', label: 'Công nghệ' }, { slug: 'stem', label: 'STEM' },
]);
const bad = (field, message) => fail(422, 'VALIDATION', message, { [field]: message });
export function record(value, field = 'body') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) bad(field, 'Dữ liệu phải là một đối tượng hợp lệ.');
  return value;
}
export function onlyFields(value, keys) {
  record(value);
  if (Object.keys(value).some((key) => !keys.includes(key))) bad('body', 'Dữ liệu chứa trường không được hỗ trợ.');
}
export function plain(value, field, min, max) {
  if (typeof value !== 'string') bad(field, 'Vui lòng nhập nội dung văn bản.');
  const result = value.normalize('NFC').replace(/\r\n?/g, '\n').trim();
  if (result.length < min || result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(result)) bad(field, `Nội dung cần từ ${min} đến ${max} ký tự hợp lệ.`);
  return result;
}
export function safeUrl(value, field, { image = false, optional = false } = {}) {
  if (optional && (value === '' || value == null)) return '';
  const text = plain(value, field, 1, 2048);
  if (image && /^\/media\/[a-f0-9-]{36}\.(png|jpg)$/.test(text)) return text;
  try { const url = new URL(text); if (url.protocol === 'https:' && !url.username && !url.password) return url.href; } catch {}
  bad(field, image ? 'Ảnh cần dùng ảnh đã tải lên hoặc URL HTTPS hợp lệ.' : 'Liên kết cần dùng URL HTTPS hợp lệ.');
}
function list(value, field, max, parser) {
  if (!Array.isArray(value) || value.length > max) bad(field, `Danh sách không được vượt quá ${max} mục.`);
  return value.map(parser);
}
function parseBlock(raw, index) {
  record(raw, 'blocks');
  const field = `blocks.${index}`;
  switch (raw.type) {
    case 'heading': onlyFields(raw, ['type', 'level', 'text']); if (![2, 3].includes(raw.level)) bad(field, 'Cấp tiêu đề phải là 2 hoặc 3.'); return { type: raw.type, level: raw.level, text: plain(raw.text, field, 1, 200) };
    case 'paragraph': onlyFields(raw, ['type', 'text']); return { type: raw.type, text: plain(raw.text, field, 1, 12000) };
    case 'list': onlyFields(raw, ['type', 'ordered', 'items']); if (typeof raw.ordered !== 'boolean') bad(field, 'Loại danh sách không hợp lệ.'); return { type: raw.type, ordered: raw.ordered, items: list(raw.items, field, 60, item => plain(item, field, 1, 2000)) };
    case 'image': onlyFields(raw, ['type', 'src', 'alt', 'caption']); return { type: raw.type, src: safeUrl(raw.src, field, { image: true }), alt: plain(raw.alt, field, 1, 300), caption: plain(raw.caption ?? '', field, 0, 500) };
    case 'formula': onlyFields(raw, ['type', 'latex', 'caption']); return { type: raw.type, latex: plain(raw.latex, field, 1, 4000), caption: plain(raw.caption ?? '', field, 0, 500) };
    case 'link': onlyFields(raw, ['type', 'label', 'url']); return { type: raw.type, label: plain(raw.label, field, 1, 300), url: safeUrl(raw.url, field) };
    default: bad(field, 'Loại nội dung chưa được hỗ trợ. Không chấp nhận HTML hoặc mã thực thi.');
  }
}
export function validateArticle(raw, previous = {}) {
  onlyFields(raw, ['title', 'slug', 'summary', 'coverImage', 'coverAlt', 'category', 'tags', 'author', 'blocks', 'references', 'status', 'featured']);
  const value = { title: '', slug: '', summary: '', coverImage: '', coverAlt: '', category: 'stem', tags: [], author: '', blocks: [], references: [], status: 'draft', featured: false, ...previous, ...raw };
  const status = value.status;
  if (!['draft', 'published'].includes(status)) bad('status', 'Trạng thái bài viết không hợp lệ.');
  if (!CATEGORIES.some(item => item.slug === value.category)) bad('category', 'Chuyên mục không hợp lệ.');
  if (typeof value.featured !== 'boolean') bad('featured', 'Lựa chọn bài nổi bật phải là true hoặc false.');
  const title = plain(value.title, 'title', 1, 180);
  const slug = plain(value.slug, 'slug', 3, 160);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) bad('slug', 'Slug chỉ gồm chữ thường không dấu, số và dấu gạch nối.');
  const summary = plain(value.summary, 'summary', status === 'published' ? 10 : 0, 500);
  const coverImage = safeUrl(value.coverImage, 'coverImage', { image: true, optional: status === 'draft' });
  const coverAlt = plain(value.coverAlt, 'coverAlt', status === 'published' ? 1 : 0, 300);
  const author = plain(value.author, 'author', 1, 120);
  const tags = [...new Set(list(value.tags, 'tags', 15, tag => plain(tag, 'tags', 1, 40)))];
  const blocks = list(value.blocks, 'blocks', 120, parseBlock);
  if (status === 'published' && !blocks.length) bad('blocks', 'Bài xuất bản cần có nội dung.');
  const references = list(value.references, 'references', 40, reference => { onlyFields(reference, ['label', 'url']); return { label: plain(reference.label, 'references', 1, 300), url: safeUrl(reference.url, 'references') }; });
  return { title, slug, summary, coverImage, coverAlt, category: value.category, tags, author, blocks, references, status, featured: value.featured };
}
export function fold(text) { return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase(); }
export function email(value) { const text = plain(value, 'email', 3, 254).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(text)) bad('email', 'Email không hợp lệ.'); return text; }
export function password(value) { if (typeof value !== 'string' || value.length < 12 || value.length > 128 || Buffer.byteLength(value, 'utf8') > 512) bad('password', 'Mật khẩu cần từ 12 đến 128 ký tự.'); return value; }
