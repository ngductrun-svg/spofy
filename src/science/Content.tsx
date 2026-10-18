import { lazy, Suspense, useState, type ReactNode } from 'react';
import { type Article, type Block, categoryLabel, formatDate, safeUrl } from './api';

const Formula = lazy(() => import('./Formula'));
export const articleTitle = (article: Article) => article.displayTitle || article.title;
export const articleSummary = (article: Article) => article.editorialSummary || article.summary;
export const articleCategory = (article: Article) => article.editorialReview?.status === 'needs-source' ? 'Chờ đối chiếu chuyên mục' : categoryLabel(article.category);
export function readingMinutes(article: Article) {
  const text = (article.blocks || []).map(block => block.type === 'heading' || block.type === 'paragraph' ? block.text : block.type === 'list' ? block.items.join(' ') : block.type === 'image' || block.type === 'formula' ? block.caption : block.label).join(' ');
  return text.trim() ? Math.max(1, Math.ceil(text.trim().split(/\s+/u).length / 220)) : null;
}
export function CategoryIcon({ category }: { category: string }) {
  const paths: Record<string, ReactNode> = {
    'toan-hoc': <><path d="M17 5H7l6 7-6 7h10" /></>,
    'vat-li': <><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(55 12 12)" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-55 12 12)" /><circle cx="12" cy="12" r="1" /></>,
    'hoa-hoc': <><path d="M9 3h6M10 3v7l-6 9a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3M7 15h10" /><path d="M10 17h1m3 1h1" /></>,
    'sinh-hoc': <><path d="M6 2c0 9 12 11 12 20M18 2c0 9-12 11-12 20M7 5h10M9 9h6M9 15h6M7 19h10" /></>,
    'cong-nghe': <><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M9 2v5m6-5v5M9 17v5m6-5v5M2 9h5m-5 6h5m10-6h5m-5 6h5" /></>,
    stem: <><path d="m12 2 9 5v10l-9 5-9-5V7ZM3 7l9 5 9-5M12 12v10" /></>,
  };
  return <svg className="science-subject-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[category] || paths.stem}</svg>;
}
export function ArticleImage({ src, alt, className = '', eager = false }: { src: string; alt: string; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={`science-image-error ${className}`} role="img" aria-label={alt || 'Ảnh minh họa chưa tải được'}>Ảnh chưa tải được</span>;
  return <img className={className} src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}
export function ArticleContent({ blocks }: { blocks: Block[] }) {
  return <div className="science-prose">{blocks.map((block, index) => {
    switch (block.type) {
      case 'heading': return block.level === 3 ? <h3 key={index}>{block.text}</h3> : <h2 key={index}>{block.text}</h2>;
      case 'paragraph': return <p key={index}>{block.text}</p>;
      case 'list': return block.ordered ? <ol key={index}>{block.items.map((item, i) => <li key={i}>{item}</li>)}</ol> : <ul key={index}>{block.items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
      case 'image': { const src = safeUrl(block.src, true); return src ? <figure key={index}><ArticleImage src={src} alt={block.alt} /><figcaption>{block.caption}</figcaption></figure> : null; }
      case 'formula': return <Suspense key={index} fallback={<figure className="science-formula"><pre>{block.latex}</pre>{block.caption && <figcaption>{block.caption}</figcaption>}</figure>}><Formula latex={block.latex} caption={block.caption} /></Suspense>;
      case 'link': { const url = safeUrl(block.url); return url ? <p key={index}><a href={url} target="_blank" rel="noopener noreferrer">{block.label || url} ↗</a></p> : null; }
      default: return null;
    }
  })}</div>;
}
export function ArticleCard({ article }: { article: Article }) {
  const cover = safeUrl(article.coverImage, true);
  return <article className="science-card">
    <a className="science-card-cover" href={`/khoa-hoc/${encodeURIComponent(article.slug)}`} aria-label={`Đọc bài ${articleTitle(article)}`}>{cover ? <ArticleImage src={cover} alt={article.coverAlt || ''} /> : <CategoryIcon category={article.category} />}</a>
    <div className="science-card-copy"><span className="science-category">{articleCategory(article)}</span><h3><a href={`/khoa-hoc/${encodeURIComponent(article.slug)}`}>{articleTitle(article)}</a></h3><p>{articleSummary(article)}</p><div className="science-meta"><span>{article.author}</span><time dateTime={article.publishedAt || undefined}>{formatDate(article.publishedAt)}</time></div></div>
  </article>;
}
export function EmptyState({ title = 'Chưa có bài viết được xuất bản', children }: { title?: string; children?: ReactNode }) {
  return <div className="science-empty"><span aria-hidden="true">∴</span><h3>{title}</h3><p>{children || 'Những câu hỏi hay xứng đáng được tìm hiểu đến cùng. Bài viết chuyên môn của SPOFY sẽ xuất hiện tại đây sau khi được xuất bản.'}</p></div>;
}
export function Notice({ message, error = false }: { message?: string; error?: boolean }) {
  return message ? <p className={`science-notice${error ? ' is-error' : ''}`} role={error ? 'alert' : 'status'}>{message}</p> : null;
}
