import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useMemo } from 'react';
import { type Article, type Block, categoryLabel, formatDate, safeUrl } from './api';

function Formula({ latex, caption }: { latex: string; caption: string }) {
  const html = useMemo(() => {
    try { return katex.renderToString(latex, { displayMode: true, throwOnError: false, trust: false, strict: 'warn', maxExpand: 200, maxSize: 20, output: 'htmlAndMathml' }); }
    catch { return ''; }
  }, [latex]);
  return <figure className="science-formula">{html ? <div className="science-equation" dangerouslySetInnerHTML={{ __html: html }} /> : <pre>{latex}</pre>}{caption && <figcaption>{caption}</figcaption>}</figure>;
}
export function ArticleContent({ blocks }: { blocks: Block[] }) {
  return <div className="science-prose">{blocks.map((block, index) => {
    switch (block.type) {
      case 'heading': return block.level === 3 ? <h3 key={index}>{block.text}</h3> : <h2 key={index}>{block.text}</h2>;
      case 'paragraph': return <p key={index}>{block.text}</p>;
      case 'list': return block.ordered ? <ol key={index}>{block.items.map((item, i) => <li key={i}>{item}</li>)}</ol> : <ul key={index}>{block.items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
      case 'image': { const src = safeUrl(block.src, true); return src ? <figure key={index}><img src={src} alt={block.alt} loading="lazy" referrerPolicy="no-referrer" /><figcaption>{block.caption}</figcaption></figure> : null; }
      case 'formula': return <Formula key={index} latex={block.latex} caption={block.caption} />;
      case 'link': { const url = safeUrl(block.url); return url ? <p key={index}><a href={url} target="_blank" rel="noopener noreferrer">{block.label || url} ↗</a></p> : null; }
      default: return null;
    }
  })}</div>;
}
export function ArticleCard({ article }: { article: Article }) {
  const cover = safeUrl(article.coverImage, true);
  return <article className="science-card">
    <a className="science-card-cover" href={`/khoa-hoc/${encodeURIComponent(article.slug)}`} tabIndex={-1} aria-hidden="true">{cover ? <img src={cover} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="science-cover-symbol" aria-hidden="true">{({ 'toan-hoc': '∑', 'vat-li': 'λ', 'hoa-hoc': 'H₂', 'sinh-hoc': '⌘', 'cong-nghe': '⌁', stem: '∞' } as Record<string, string>)[article.category] || '∴'}</span>}</a>
    <div className="science-card-copy"><span className="science-category">{categoryLabel(article.category)}</span><h3><a href={`/khoa-hoc/${encodeURIComponent(article.slug)}`}>{article.title}</a></h3><p>{article.summary}</p><div className="science-meta"><span>{article.author}</span><time dateTime={article.publishedAt || undefined}>{formatDate(article.publishedAt)}</time></div></div>
  </article>;
}
export function EmptyState({ title = 'Chưa có bài viết được xuất bản', children }: { title?: string; children?: React.ReactNode }) {
  return <div className="science-empty"><span aria-hidden="true">∴</span><h3>{title}</h3><p>{children || 'Những câu hỏi hay xứng đáng được tìm hiểu đến cùng. Bài viết chuyên môn của SPOFY sẽ xuất hiện tại đây sau khi được xuất bản.'}</p></div>;
}
export function Notice({ message, error = false }: { message?: string; error?: boolean }) {
  return message ? <p className={`science-notice${error ? ' is-error' : ''}`} role={error ? 'alert' : 'status'}>{message}</p> : null;
}
