import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AdminLayout } from './Admin';
import { Notice } from './Content';
import { messageOf, useScience } from './api';

type ManagedAccount = {
  id: string; email: string; name: string; role: 'admin' | 'reader'; createdAt: string;
  lastLoginAt: string | null; loginCount: number; activeSessions: number;
};
type LoginEvent = {
  id: string; userId: string; name: string; email: string; role: 'admin' | 'reader';
  eventType: 'login' | 'register'; occurredAt: string;
};
type RecordPage<T> = {
  items: T[]; total: number; page: number; pageSize: number; totalPages: number;
  trackingStartedAt: string; historyRetentionLimit: number;
};
const accountDate = (value: string | null) => value && !Number.isNaN(new Date(value).getTime())
  ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
  : 'Chưa ghi nhận';
const roleLabel = (role: ManagedAccount['role']) => role === 'admin' ? 'Admin' : 'Độc giả';

/** Admin-only, read-only account and successful authentication records. */
export function AdminAccounts({ history = false }: { history?: boolean }) {
  const { user, request } = useScience();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ q: '', role: '', page: 1 });
  const [data, setData] = useState<RecordPage<ManagedAccount | LoginEvent> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const results = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (user?.role !== 'admin') return;
    const abort = new AbortController();
    setLoading(true); setError('');
    const query = new URLSearchParams({ q: filters.q, page: String(filters.page), pageSize: '20' });
    if (!history && filters.role) query.set('role', filters.role);
    request<RecordPage<ManagedAccount | LoginEvent>>(`/api/admin/${history ? 'login-events' : 'users'}?${query}`, { signal: abort.signal })
      .then(body => { if (!abort.signal.aborted) setData(body); })
      .catch(reason => { if (!abort.signal.aborted) setError(messageOf(reason)); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [user, request, filters, refresh, history]);

  function submit(event: FormEvent) { event.preventDefault(); setFilters(previous => ({ ...previous, q: search.trim(), page: 1 })); }
  function pageTo(page: number) {
    setFilters(previous => ({ ...previous, page }));
    results.current?.focus({ preventScroll: true });
    results.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }
  const accounts = history ? [] : (data?.items || []) as ManagedAccount[];
  const events = history ? (data?.items || []) as LoginEvent[] : [];
  return <AdminLayout title={history ? 'Lịch sử đăng nhập' : 'Tài khoản thành viên'}>
    <div className="science-account-introduction">
      <p>{history ? 'Các lần đăng nhập thành công và đăng ký tài khoản đã tạo phiên đăng nhập. Chỉ admin được xem.' : 'Xem tài khoản đã đăng ký và các lần xác thực được ghi nhận. Khu vực này chỉ hiển thị thông tin, không thay đổi quyền tài khoản.'}</p>
      <button className="science-button is-secondary" type="button" disabled={loading} onClick={() => setRefresh(value => value + 1)}>{loading ? 'Đang tải…' : 'Làm mới dữ liệu'}</button>
    </div>
    <aside className="science-account-note" aria-label="Phạm vi dữ liệu đăng nhập">
      {!history && <p><strong>Phiên chưa hết hạn không có nghĩa là đang online.</strong> Một người có thể có nhiều phiên trên các thiết bị khác nhau.</p>}
      <p>Lịch sử {data?.trackingStartedAt ? <>bắt đầu được ghi nhận từ <time dateTime={data.trackingStartedAt}>{accountDate(data.trackingStartedAt)}</time></> : 'được ghi nhận từ khi nâng cấp tính năng này'}. Tài khoản cũ có thể hiển thị “Chưa ghi nhận”. Giữ tối đa {(data?.historyRetentionLimit || 10000).toLocaleString('vi-VN')} lần xác thực gần nhất; số lần của từng tài khoản là tổng đã ghi nhận kể từ khi bật tính năng.</p>
    </aside>
    <form className={`science-filters science-account-filters${history ? ' is-history' : ''}`} onSubmit={submit} role="search">
      <label>Tìm tài khoản<input type="search" value={search} maxLength={100} onChange={event => setSearch(event.target.value)} placeholder="Tên hoặc email" /></label>
      {!history && <label>Vai trò<select value={filters.role} onChange={event => setFilters(previous => ({ ...previous, role: event.target.value, page: 1 }))}><option value="">Tất cả vai trò</option><option value="reader">Độc giả</option><option value="admin">Admin</option></select></label>}
      <button className="science-button" type="submit">Tìm kiếm</button>
    </form>
    <div className="science-results-head"><h2 ref={results} tabIndex={-1}>{history ? 'Lần xác thực đã ghi nhận' : 'Danh sách tài khoản'}</h2><span role="status">{loading ? 'Đang tải…' : data && !error ? `${data.total.toLocaleString('vi-VN')} ${history ? 'lần' : 'tài khoản'}` : ''}</span></div>
    <Notice error message={error} />
    {error && <button className="science-button is-secondary" onClick={() => setRefresh(value => value + 1)}>Thử tải lại</button>}
    <div aria-busy={loading}>
      {!error && data && (!data.items.length ? <div className="science-empty"><h2>{filters.q || filters.role ? 'Không có kết quả phù hợp' : history ? 'Chưa ghi nhận lần xác thực nào' : 'Chưa có tài khoản'}</h2><p>{filters.q || filters.role ? 'Thử lại tên, email hoặc bộ lọc khác.' : history ? 'Các lần đăng nhập thành công mới sẽ hiển thị tại đây. Tài khoản tạo qua công cụ admin chưa tự tạo phiên đăng nhập.' : 'Tài khoản đăng ký mới sẽ hiển thị tại đây.'}</p></div> : <div className="science-account-table-wrap">
        {history ? <table className="science-account-table is-history"><caption className="science-sr-only">Lịch sử đăng nhập và đăng ký thành công</caption><thead><tr><th scope="col">Tài khoản</th><th scope="col">Vai trò hiện tại</th><th scope="col">Hoạt động</th><th scope="col">Thời điểm</th></tr></thead><tbody>{events.map(event => <tr key={event.id}><td data-label="Tài khoản" className="science-account-identity"><strong>{event.name}</strong><span>{event.email}</span></td><td data-label="Vai trò hiện tại"><span className="science-status">{roleLabel(event.role)}</span></td><td data-label="Hoạt động">{event.eventType === 'register' ? 'Đăng ký và đăng nhập' : 'Đăng nhập thành công'}</td><td data-label="Thời điểm"><time dateTime={event.occurredAt}>{accountDate(event.occurredAt)}</time></td></tr>)}</tbody></table>
          : <table className="science-account-table"><caption className="science-sr-only">Tài khoản thành viên và thông tin đăng nhập</caption><thead><tr><th scope="col">Tài khoản</th><th scope="col">Vai trò</th><th scope="col">Ngày tạo</th><th scope="col">Xác thực gần nhất</th><th scope="col">Số lần ghi nhận</th><th scope="col">Phiên chưa hết hạn</th></tr></thead><tbody>{accounts.map(account => <tr key={account.id}><td data-label="Tài khoản" className="science-account-identity"><strong>{account.name}</strong><span>{account.email}</span></td><td data-label="Vai trò"><span className="science-status">{roleLabel(account.role)}</span></td><td data-label="Ngày tạo"><time dateTime={account.createdAt}>{accountDate(account.createdAt)}</time></td><td data-label="Xác thực gần nhất">{account.lastLoginAt ? <time dateTime={account.lastLoginAt}>{accountDate(account.lastLoginAt)}</time> : 'Chưa ghi nhận'}</td><td data-label="Số lần ghi nhận">{account.loginCount.toLocaleString('vi-VN')}</td><td data-label="Phiên chưa hết hạn">{account.activeSessions.toLocaleString('vi-VN')}</td></tr>)}</tbody></table>}
      </div>)}
    </div>
    {!error && data && data.totalPages > 1 && <nav className="science-pagination" aria-label={history ? 'Phân trang lịch sử đăng nhập' : 'Phân trang tài khoản'}><button disabled={loading || data.page <= 1} onClick={() => pageTo(data.page - 1)}>← Trước</button><span>Trang {data.page} / {data.totalPages}</span><button disabled={loading || data.page >= data.totalPages} onClick={() => pageTo(data.page + 1)}>Sau →</button></nav>}
  </AdminLayout>;
}
