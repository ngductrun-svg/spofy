import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ApiError, categories, formatDate, messageOf, safeUrl, useScience, type Article, type ArticleList, type Comment } from './api';
import { ArticleCard, ArticleContent, ArticleImage, articleTitle, articleSummary, articleCategory, readingMinutes, EmptyState, Notice } from './Content';
import { updatePageMetadata } from '../pageMetadata';

export function ScienceHeader() {
  const { user, ready, logout } = useScience();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function signOut() { setBusy(true); setError(''); try { await logout(); } catch (error) { setError(messageOf(error)); } finally { setBusy(false); } }
  return <header className="science-header"><a className="science-logo" href="/" aria-label="SPOFY — Trang chủ">SPOFY<span>Hành trình của trí tò mò</span></a><nav aria-label="Điều hướng khoa học"><a href="/">Trang chủ</a><a href="/khoa-hoc">Khoa học</a><a href="/tham-gia">Tham gia</a>{user?.role === 'admin' && <a href="/admin">Quản trị</a>}{ready && (user ? <><span className="science-account">{user.name}</span><button type="button" disabled={busy} onClick={signOut}>Đăng xuất</button></> : <a href="/dang-nhap">Đăng nhập</a>)}</nav><Notice error message={error} /></header>;
}
export function SciencePage({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  const { user } = useScience();
  return <div className="science-app"><a className="skip-link" href="#science-main">Đến nội dung</a><ScienceHeader />{user?.emailVerified === false && <div className="science-verification-banner" role="status">Email chưa được xác minh. Bạn vẫn có thể đọc bài; hãy <a href="/xac-minh-email">xác minh email</a> trước khi bình luận.</div>}<main id="science-main" className={`science-main${narrow ? ' is-narrow' : ''}`}>{children}</main><footer className="science-footer"><a href="/">SPOFY</a><p>Từ những câu hỏi nhỏ, mở ra những chân trời mới.</p><nav aria-label="Thông tin SPOFY"><a href="/tham-gia">Tham gia / FAQ</a><a href="/quyen-rieng-tu">Quyền riêng tư</a><a href="https://www.facebook.com/spofy.sofia" target="_blank" rel="noopener noreferrer">Facebook SPOFY ↗</a></nav></footer></div>;
}
export function ScienceIntro() {
  const { request } = useScience();
  const [items, setItems] = useState<Article[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController(); setStatus('loading');
    request<ArticleList>('/api/articles?pageSize=3&featured=1', { signal: abort.signal }).then(async data => {
      if (abort.signal.aborted) return;
      const result = data.items.length ? data : await request<ArticleList>('/api/articles?pageSize=3', { signal: abort.signal });
      if (!abort.signal.aborted) { setItems(result.items.slice(0, 3)); setStatus('ready'); }
    }).catch(() => { if (!abort.signal.aborted) setStatus('error'); });
    return () => abort.abort();
  }, [request, retry]);
  return <section id="khoa-hoc" className="science-intro section-wrap"><div className="section-label"><i className="dot" aria-hidden="true" /><span>KHOA HỌC SPOFY</span><span>Hỏi sâu hơn. Hiểu xa hơn.</span></div><div className="science-intro-heading"><div><h2>Nuôi dưỡng <em>trí tò mò.</em></h2><p>Cùng tìm hiểu Toán học, Vật lí, Hóa học, Sinh học, Công nghệ và STEM qua những bài viết của SPOFY.</p></div><a className="science-button" href="/khoa-hoc">Khám phá khoa học <span aria-hidden="true">↗</span></a></div>{status === 'loading' ? <p className="science-loading" role="status">Đang tải bài viết khoa học…</p> : status === 'error' ? <div className="science-empty"><h3>Chưa tải được chuyên mục Khoa học</h3><p>Hãy kiểm tra kết nối với máy chủ.</p><button className="science-button is-secondary" onClick={() => setRetry(value => value + 1)}>Thử lại</button></div> : items.length ? <div className={`science-grid${items.length < 3 ? ' is-sparse' : ''}`}>{items.map(article => <ArticleCard key={article.id} article={article} />)}</div> : <EmptyState />}</section>;
}
function initialFilters() {
  const params = new URLSearchParams(window.location.search);
  return { q: params.get('q') || '', category: params.get('category') || '', page: Math.max(1, Number(params.get('page')) || 1) };
}
export function ScienceListing() {
  const { request } = useScience();
  const [filters, setFilters] = useState(initialFilters);
  const [search, setSearch] = useState(filters.q);
  const [data, setData] = useState<ArticleList | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const results = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const abort = new AbortController(); setBusy(true); setError('');
    const query = new URLSearchParams({ q: filters.q, category: filters.category, page: String(filters.page), pageSize: '9' });
    request<ArticleList>(`/api/articles?${query}`, { signal: abort.signal }).then(body => { if (!abort.signal.aborted) setData(body); }).catch(error => { if (!abort.signal.aborted) setError(messageOf(error)); }).finally(() => { if (!abort.signal.aborted) setBusy(false); });
    const urlQuery = new URLSearchParams(); if (filters.q) urlQuery.set('q', filters.q); if (filters.category) urlQuery.set('category', filters.category); if (filters.page > 1) urlQuery.set('page', String(filters.page));
    window.history.replaceState(window.history.state, '', `/khoa-hoc${urlQuery.size ? `?${urlQuery}` : ''}`);
    return () => abort.abort();
  }, [request, filters, retry]);
  function submit(event: FormEvent) { event.preventDefault(); setFilters(previous => ({ ...previous, q: search.trim(), page: 1 })); }
  function pageTo(page: number) { setFilters(previous => ({ ...previous, page })); results.current?.focus({ preventScroll: true }); results.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); }
  return <SciencePage><div className="science-page-heading"><span className="science-eyebrow">SPOFY / KHOA HỌC</span><h1>Một câu hỏi.<br /><em>Nhiều chân trời.</em></h1><p>Đọc, tìm hiểu và cùng thảo luận về những ý tưởng khoa học.</p></div><form className="science-filters" onSubmit={submit} role="search"><label>Tìm bài viết<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tiêu đề, chủ đề hoặc từ khóa…" type="search" maxLength={100} /></label><label>Chuyên mục<select value={filters.category} onChange={event => setFilters(previous => ({ ...previous, category: event.target.value, page: 1 }))}><option value="">Tất cả chuyên mục</option>{categories.map(category => <option key={category.slug} value={category.slug}>{category.label}</option>)}</select></label><button className="science-button" type="submit">Tìm kiếm</button></form><div className="science-results-head"><h2 ref={results} tabIndex={-1}>Bài viết khoa học</h2><span role="status">{busy ? 'Đang tải…' : data ? `${data.total} bài viết` : ''}</span></div><Notice error message={error} />{error && <button className="science-button is-secondary" onClick={() => setRetry(value => value + 1)}>Thử tải lại</button>}<div aria-busy={busy}>{!error && data && (data.items.length ? <div className={`science-grid${data.items.length < 3 ? ' is-sparse' : ''}`}>{data.items.map(article => <ArticleCard key={article.id} article={article} />)}</div> : <EmptyState title={filters.q || filters.category ? 'Không tìm thấy bài viết phù hợp' : undefined}>{filters.q || filters.category ? 'Hãy thử từ khóa khác hoặc chọn tất cả chuyên mục.' : undefined}</EmptyState>)}</div>{data && data.totalPages > 1 && <nav className="science-pagination" aria-label="Phân trang bài viết"><button disabled={busy || data.page <= 1} onClick={() => pageTo(data.page - 1)}>← Trước</button><span>Trang {data.page} / {data.totalPages}</span><button disabled={busy || data.page >= data.totalPages} onClick={() => pageTo(data.page + 1)}>Sau →</button></nav>}</SciencePage>;
}
function ArticleComments({ article }: { article: Article }) {
  const { user, ready, request } = useScience();
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const sending = useRef(false);
  useEffect(() => {
    const abort = new AbortController(); setLoadError('');
    request<{ items: Comment[] }>(`/api/articles/${encodeURIComponent(article.id)}/comments`, { signal: abort.signal }).then(result => { if (!abort.signal.aborted) setComments(result.items); }).catch(error => { if (!abort.signal.aborted) setLoadError(messageOf(error)); });
    return () => abort.abort();
  }, [article.id, request, refresh]);
  async function send(event: FormEvent) {
    event.preventDefault(); if (sending.current) return; sending.current = true; setBusy(true); setError(''); setMessage('');
    try { await request(`/api/articles/${encodeURIComponent(article.id)}/comments`, { method: 'POST', body: JSON.stringify({ body: body.trim() }) }); setBody(''); setMessage('Đã gửi bình luận. Cảm ơn bạn đã cùng trao đổi.'); setRefresh(value => value + 1); }
    catch (error) { setError(messageOf(error)); } finally { sending.current = false; setBusy(false); }
  }
  return <section id="binh-luan" tabIndex={-1} className="science-comments" aria-labelledby="science-comments-heading"><h2 id="science-comments-heading">Cùng trao đổi</h2><p>Giữ thảo luận tôn trọng, rõ ràng và tập trung vào nội dung khoa học. Bình luận do admin quản lý.</p><Notice error message={loadError} />{loadError && <button className="science-button is-secondary" onClick={() => setRefresh(value => value + 1)}>Tải lại bình luận</button>}<div className="science-comment-list">{comments.map(comment => <article className="science-comment" key={comment.id}><div><strong>{comment.authorName}</strong><time dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time></div><p>{comment.body}</p></article>)}{!loadError && !comments.length && <p className="science-muted">Chưa có bình luận. Hãy là người mở đầu cuộc trao đổi.</p>}</div>{!ready ? <p role="status">Đang kiểm tra phiên đăng nhập…</p> : !user ? <div className="science-comment-signin"><p>Đăng nhập tài khoản độc giả để gửi bình luận.</p><a className="science-button" href={`/dang-nhap?next=${encodeURIComponent(`/khoa-hoc/${article.slug}#binh-luan`)}`}>Đăng nhập để bình luận</a><a className="science-inline-link" href={`/dang-ky?next=${encodeURIComponent(`/khoa-hoc/${article.slug}#binh-luan`)}`}>Tạo tài khoản độc giả</a></div> : user.emailVerified === false ? <div className="science-comment-signin"><p>Xác minh email để tham gia thảo luận. Nội dung bài viết luôn mở cho mọi người.</p><a className="science-button" href="/xac-minh-email">Xác minh email</a></div> : <form onSubmit={send}><label htmlFor="science-comment-body">Bình luận của {user.name}</label><textarea id="science-comment-body" disabled={busy} value={body} onChange={event => setBody(event.target.value)} minLength={3} maxLength={2000} required rows={4} placeholder="Chia sẻ câu hỏi hoặc góc nhìn của bạn…" /><div className="science-form-foot"><span>{body.length}/2000 ký tự · Tối thiểu 3 ký tự</span><button className="science-button" disabled={busy || body.trim().length < 3} type="submit">{busy ? 'Đang gửi…' : 'Gửi bình luận'}</button></div><Notice error message={error} /><Notice message={message} /></form>}</section>;
}
export function ArticleDetail({ slug }: { slug: string }) {
  const { request } = useScience();
  const [data, setData] = useState<{ article: Article; related: Article[] } | null>(null);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController(); setData(null); setError(''); setMissing(false);
    request<{ article: Article; related: Article[] }>(`/api/articles/${encodeURIComponent(slug)}`, { signal: abort.signal }).then(result => { if (!abort.signal.aborted) setData(result); }).catch(error => { if (!abort.signal.aborted) { setError(messageOf(error)); setMissing(error instanceof ApiError && error.status === 404); } });
    return () => abort.abort();
  }, [slug, request, retry]);
  useEffect(() => { if (data) updatePageMetadata(window.location.pathname, data.article); }, [data]);
  const article = data?.article;
  useEffect(() => {
    if (!article || window.location.hash !== '#binh-luan') return;
    const frame = requestAnimationFrame(() => { document.getElementById('binh-luan')?.scrollIntoView({ block: 'start', behavior: 'instant' }); document.getElementById('binh-luan')?.focus({ preventScroll: true }); });
    return () => cancelAnimationFrame(frame);
  }, [article?.id]);
  const cover = safeUrl(article?.coverImage, true);
  return <SciencePage><a className="science-inline-link" href="/khoa-hoc">← Tất cả bài viết</a>{error ? <div className="science-empty"><h1>{missing ? 'Bài viết không có sẵn' : 'Chưa tải được bài viết'}</h1><p>{missing ? 'Bài viết chưa được xuất bản hoặc không còn tồn tại.' : error}</p>{!missing && <button className="science-button" onClick={() => setRetry(value => value + 1)}>Thử lại</button>}</div> : !article ? <p className="science-loading" role="status">Đang tải bài viết…</p> : <><article className="science-article"><header>{article.editorialReview?.status === 'needs-source' ? <span className="science-category">{articleCategory(article)}</span> : <a className="science-category" href={`/khoa-hoc?category=${article.category}`}>{articleCategory(article)}</a>}<h1>{articleTitle(article)}</h1><p className="science-article-summary">{articleSummary(article)}</p>{article.editorialReview?.status === 'needs-source' && <aside className="science-editorial-note">Bài viết đang được đối chiếu với nguồn gốc; phần giải thích khoa học chưa đầy đủ. Chuyên mục và thẻ sẽ được biên tập sau khi kiểm tra nguồn.</aside>}<div className="science-meta"><span>{article.author}</span><time dateTime={article.publishedAt || undefined}>Đăng {formatDate(article.publishedAt)}</time>{readingMinutes(article) && <span>Khoảng {readingMinutes(article)} phút đọc</span>}{article.updatedAt && formatDate(article.updatedAt) !== formatDate(article.publishedAt) && <time dateTime={article.updatedAt}>Cập nhật {formatDate(article.updatedAt)}</time>}<button className="science-share" onClick={async event => { const target = event.currentTarget; try { await navigator.clipboard.writeText(window.location.origin + `/khoa-hoc/${encodeURIComponent(article.slug)}`); target.textContent = 'Đã chép liên kết'; } catch { target.textContent = 'Sao chép URL trên thanh địa chỉ'; } }}>Chép liên kết ↗</button></div></header>{cover && <figure className="science-article-cover"><ArticleImage src={cover} alt={article.coverAlt || articleTitle(article)} eager /></figure>}{article.originalTitle && article.originalTitle !== articleTitle(article) && <details className="science-original-title"><summary>Tên bài trong tư liệu</summary><p>{article.originalTitle}</p></details>}<ArticleContent blocks={article.blocks || []} />{safeUrl(article.sourceUrl) && <p className="science-article-source"><a className="science-inline-link" href={safeUrl(article.sourceUrl)} target="_blank" rel="noopener noreferrer">Xem nguồn bài gốc ↗</a></p>}{!!article.references?.length && <section className="science-references"><h2>Tài liệu tham khảo</h2><ol>{article.references.map((reference, index) => <li key={index}>{safeUrl(reference.url) ? <a href={safeUrl(reference.url)} target="_blank" rel="noopener noreferrer">{reference.label} ↗</a> : reference.label}</li>)}</ol></section>}{!!article.tags?.length && <div className="science-tags">{article.tags.map(tag => <span key={tag}>#{tag}</span>)}</div>}<ArticleComments article={article} /></article>{!!data?.related.length && <section className="science-related"><h2>Tiếp tục khám phá</h2><div className="science-grid">{data.related.map(item => <ArticleCard key={item.id} article={item} />)}</div></section>}</>}</SciencePage>;
}
