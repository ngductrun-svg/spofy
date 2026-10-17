import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ApiError, categories, categoryLabel, formatDate, messageOf, safeUrl, useScience, type Article, type ArticleList, type Comment } from './api';
import { ArticleCard, ArticleContent, EmptyState, Notice } from './Content';

export function ScienceHeader() {
  const { user, ready, logout } = useScience();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function signOut() { setBusy(true); setError(''); try { await logout(); } catch (error) { setError(messageOf(error)); } finally { setBusy(false); } }
  return <header className="science-header"><a className="science-logo" href="/" aria-label="SPOFY — Trang chủ">SPOFY<span>Hành trình của trí tò mò</span></a><nav aria-label="Điều hướng khoa học"><a href="/">Trang chủ</a><a href="/khoa-hoc">Khoa học</a>{user?.role === 'admin' && <a href="/admin">Quản trị</a>}{ready && (user ? <><span className="science-account">{user.name}</span><button type="button" disabled={busy} onClick={signOut}>Đăng xuất</button></> : <a href="/dang-nhap">Đăng nhập</a>)}</nav><Notice error message={error} /></header>;
}
export function SciencePage({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return <div className="science-app"><a className="skip-link" href="#science-main">Đến nội dung</a><ScienceHeader /><main id="science-main" className={`science-main${narrow ? ' is-narrow' : ''}`}>{children}</main><footer className="science-footer"><a href="/">SPOFY</a><p>Từ những câu hỏi nhỏ, mở ra những chân trời mới.</p><a href="https://www.facebook.com/spofy.sofia" target="_blank" rel="noopener noreferrer">Facebook SPOFY ↗</a></footer></div>;
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
  return <section id="khoa-hoc" className="science-intro section-wrap"><div className="section-label"><i className="dot" aria-hidden="true" /><span>KHOA HỌC SPOFY</span><span>Hỏi sâu hơn. Hiểu xa hơn.</span></div><div className="science-intro-heading"><div><h2>Nuôi dưỡng <em>trí tò mò.</em></h2><p>Cùng tìm hiểu Toán học, Vật lí, Hóa học, Sinh học, Công nghệ và STEM qua những bài viết của SPOFY.</p></div><a className="science-button" href="/khoa-hoc">Khám phá khoa học <span aria-hidden="true">↗</span></a></div>{status === 'loading' ? <p className="science-loading" role="status">Đang tải bài viết khoa học…</p> : status === 'error' ? <div className="science-empty"><h3>Chưa tải được chuyên mục Khoa học</h3><p>Hãy kiểm tra kết nối với máy chủ.</p><button className="science-button is-secondary" onClick={() => setRetry(value => value + 1)}>Thử lại</button></div> : items.length ? <div className="science-grid">{items.map(article => <ArticleCard key={article.id} article={article} />)}</div> : <EmptyState />}</section>;
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
  return <SciencePage><div className="science-page-heading"><span className="science-eyebrow">SPOFY / KHOA HỌC</span><h1>Một câu hỏi.<br /><em>Nhiều chân trời.</em></h1><p>Đọc, tìm hiểu và cùng thảo luận về những ý tưởng khoa học.</p></div><form className="science-filters" onSubmit={submit} role="search"><label>Tìm bài viết<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tiêu đề, chủ đề hoặc từ khóa…" type="search" maxLength={100} /></label><label>Chuyên mục<select value={filters.category} onChange={event => setFilters(previous => ({ ...previous, category: event.target.value, page: 1 }))}><option value="">Tất cả chuyên mục</option>{categories.map(category => <option key={category.slug} value={category.slug}>{category.label}</option>)}</select></label><button className="science-button" type="submit">Tìm kiếm</button></form><div className="science-results-head"><h2 ref={results} tabIndex={-1}>Bài viết khoa học</h2><span role="status">{busy ? 'Đang tải…' : data ? `${data.total} bài viết` : ''}</span></div><Notice error message={error} />{error && <button className="science-button is-secondary" onClick={() => setRetry(value => value + 1)}>Thử tải lại</button>}<div aria-busy={busy}>{!error && data && (data.items.length ? <div className="science-grid">{data.items.map(article => <ArticleCard key={article.id} article={article} />)}</div> : <EmptyState title={filters.q || filters.category ? 'Không tìm thấy bài viết phù hợp' : undefined}>{filters.q || filters.category ? 'Hãy thử từ khóa khác hoặc chọn tất cả chuyên mục.' : undefined}</EmptyState>)}</div>{data && data.totalPages > 1 && <nav className="science-pagination" aria-label="Phân trang bài viết"><button disabled={busy || data.page <= 1} onClick={() => pageTo(data.page - 1)}>← Trước</button><span>Trang {data.page} / {data.totalPages}</span><button disabled={busy || data.page >= data.totalPages} onClick={() => pageTo(data.page + 1)}>Sau →</button></nav>}</SciencePage>;
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
  useEffect(() => {
    const abort = new AbortController(); setLoadError('');
    request<{ items: Comment[] }>(`/api/articles/${encodeURIComponent(article.id)}/comments`, { signal: abort.signal }).then(result => { if (!abort.signal.aborted) setComments(result.items); }).catch(error => { if (!abort.signal.aborted) setLoadError(messageOf(error)); });
    return () => abort.abort();
  }, [article.id, request, refresh]);
  async function send(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { await request(`/api/articles/${encodeURIComponent(article.id)}/comments`, { method: 'POST', body: JSON.stringify({ body: body.trim() }) }); setBody(''); setMessage('Đã gửi bình luận. Cảm ơn bạn đã cùng trao đổi.'); setRefresh(value => value + 1); }
    catch (error) { setError(messageOf(error)); } finally { setBusy(false); }
  }
  return <section className="science-comments" aria-labelledby="science-comments-heading"><h2 id="science-comments-heading">Cùng trao đổi</h2><p>Giữ thảo luận tôn trọng, rõ ràng và tập trung vào nội dung khoa học. Bình luận do admin quản lý.</p><Notice error message={loadError} />{loadError && <button className="science-button is-secondary" onClick={() => setRefresh(value => value + 1)}>Tải lại bình luận</button>}<div className="science-comment-list">{comments.map(comment => <article className="science-comment" key={comment.id}><div><strong>{comment.authorName}</strong><time dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time></div><p>{comment.body}</p></article>)}{!loadError && !comments.length && <p className="science-muted">Chưa có bình luận. Hãy là người mở đầu cuộc trao đổi.</p>}</div>{!ready ? <p role="status">Đang kiểm tra phiên đăng nhập…</p> : !user ? <div className="science-comment-signin"><p>Đăng nhập tài khoản độc giả để gửi bình luận.</p><a className="science-button" href={`/dang-nhap?next=${encodeURIComponent(`/khoa-hoc/${article.slug}#binh-luan`)}`}>Đăng nhập để bình luận</a><a className="science-inline-link" href="/dang-ky">Tạo tài khoản độc giả</a></div> : <form id="binh-luan" onSubmit={send}><label htmlFor="science-comment-body">Bình luận của {user.name}</label><textarea id="science-comment-body" disabled={busy} value={body} onChange={event => setBody(event.target.value)} minLength={3} maxLength={2000} required rows={4} placeholder="Chia sẻ câu hỏi hoặc góc nhìn của bạn…" /><div className="science-form-foot"><span>{body.length}/2000 ký tự · Tối thiểu 3 ký tự</span><button className="science-button" disabled={busy || body.trim().length < 3} type="submit">{busy ? 'Đang gửi…' : 'Gửi bình luận'}</button></div><Notice error message={error} /><Notice message={message} /></form>}</section>;
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
  useEffect(() => { const previous = document.title; if (data) document.title = `${data.article.title} — Khoa học SPOFY`; return () => { document.title = previous; }; }, [data]);
  const article = data?.article;
  const cover = safeUrl(article?.coverImage, true);
  return <SciencePage><a className="science-inline-link" href="/khoa-hoc">← Tất cả bài viết</a>{error ? <div className="science-empty"><h1>{missing ? 'Bài viết không có sẵn' : 'Chưa tải được bài viết'}</h1><p>{missing ? 'Bài viết chưa được xuất bản hoặc không còn tồn tại.' : error}</p>{!missing && <button className="science-button" onClick={() => setRetry(value => value + 1)}>Thử lại</button>}</div> : !article ? <p className="science-loading" role="status">Đang tải bài viết…</p> : <><article className="science-article"><header><a className="science-category" href={`/khoa-hoc?category=${article.category}`}>{categoryLabel(article.category)}</a><h1>{article.title}</h1><p className="science-article-summary">{article.summary}</p><div className="science-meta"><span>{article.author}</span><time dateTime={article.publishedAt || undefined}>{formatDate(article.publishedAt)}</time><button className="science-share" onClick={async event => { const target = event.currentTarget; try { await navigator.clipboard.writeText(window.location.origin + `/khoa-hoc/${encodeURIComponent(article.slug)}`); target.textContent = 'Đã chép liên kết'; } catch { target.textContent = 'Sao chép URL trên thanh địa chỉ'; } }}>Chép liên kết ↗</button></div></header>{cover && <figure className="science-article-cover"><img src={cover} alt={article.coverAlt || article.title} referrerPolicy="no-referrer" /></figure>}<ArticleContent blocks={article.blocks || []} />{!!article.references?.length && <section className="science-references"><h2>Tài liệu tham khảo</h2><ol>{article.references.map((reference, index) => <li key={index}>{safeUrl(reference.url) ? <a href={safeUrl(reference.url)} target="_blank" rel="noopener noreferrer">{reference.label} ↗</a> : reference.label}</li>)}</ol></section>}{!!article.tags?.length && <div className="science-tags">{article.tags.map(tag => <span key={tag}>#{tag}</span>)}</div>}<ArticleComments article={article} /></article>{!!data?.related.length && <section className="science-related"><h2>Tiếp tục khám phá</h2><div className="science-grid">{data.related.map(item => <ArticleCard key={item.id} article={item} />)}</div></section>}</>}</SciencePage>;
}
export function AuthPage({ register = false }: { register?: boolean }) {
  const { user, ready, sessionError, request } = useScience();
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const nextValue = new URLSearchParams(window.location.search).get('next') || '/khoa-hoc';
  let next = '/khoa-hoc';
  try {
    const destination = new URL(nextValue, window.location.origin);
    if (nextValue.startsWith('/') && !nextValue.startsWith('//') && !/[\\\u0000-\u0020\u007f]/.test(nextValue) && destination.origin === window.location.origin) next = destination.pathname + destination.search + destination.hash;
  } catch { /* A malformed return URL falls back to the science listing. */ }
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await request(`/api/auth/${register ? 'register' : 'login'}`, { method: 'POST', body: JSON.stringify(register ? { name: name.trim(), email, password } : { email, password }) }); window.location.assign(next); }
    catch (error) { setError(messageOf(error)); setBusy(false); }
  }
  return <SciencePage narrow><section className="science-auth"><span className="science-eyebrow">TÀI KHOẢN SPOFY</span><h1>{register ? 'Cùng đặt câu hỏi.' : 'Chào bạn trở lại.'}</h1><p>{register ? 'Tạo tài khoản độc giả để đọc và gửi bình luận. Tài khoản mới luôn có quyền độc giả.' : 'Đăng nhập để tham gia trao đổi dưới các bài viết khoa học.'}</p>{ready && user ? <div className="science-auth-signed"><p>Bạn đã đăng nhập với tài khoản {user.name}.</p><a className="science-button" href={next}>Tiếp tục →</a>{user.role === 'admin' && <a className="science-inline-link" href="/admin">Đến quản trị</a>}</div> : <form onSubmit={submit}>{register && <label>Tên hiển thị<input autoComplete="name" value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={80} required /></label>}<label>Email<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} required /></label><label>Mật khẩu<input type="password" autoComplete={register ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} minLength={register ? 12 : undefined} maxLength={128} required />{register && <small>Ít nhất 12 ký tự. Nên dùng một mật khẩu riêng cho SPOFY.</small>}</label><Notice error message={error || sessionError} /><button className="science-button" disabled={busy || !ready} type="submit">{busy ? 'Đang xử lý…' : register ? 'Tạo tài khoản độc giả' : 'Đăng nhập'}</button><p className="science-auth-switch">{register ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'} <a href={`${register ? '/dang-nhap' : '/dang-ky'}?next=${encodeURIComponent(next)}`}>{register ? 'Đăng nhập' : 'Đăng ký độc giả'}</a></p></form>}</section></SciencePage>;
}
