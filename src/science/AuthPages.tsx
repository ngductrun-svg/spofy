import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, messageOf, useScience } from './api';
import { Notice } from './Content';
import { SciencePage } from './Public';

type Fields = Record<string, string>;
type AuthResult = { message?: string };
const emailError = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value.trim()) && value.length <= 254 ? '' : 'Nhập một địa chỉ email hợp lệ.';
const passwordError = (value: string) => value.length < 12 || value.length > 128 ? 'Mật khẩu cần từ 12 đến 128 ký tự.' : '';
function safeDestination() {
  const value = new URLSearchParams(window.location.search).get('next') || '/khoa-hoc';
  try { const url = new URL(value, window.location.origin); if (value.startsWith('/') && !value.startsWith('//') && !/[\\\u0000-\u0020\u007f]/.test(value) && url.origin === window.location.origin) return url.pathname + url.search + url.hash; } catch { /* Return to the public listing for malformed destinations. */ }
  return '/khoa-hoc';
}
function fieldErrors(error: unknown) { return error instanceof ApiError ? error.fields || {} : {}; }
function PasswordField({ id, label = 'Mật khẩu', value, onChange, error, fresh = false, disabled = false }: { id: string; label?: string; value: string; onChange: (value: string) => void; error?: string; fresh?: boolean; disabled?: boolean }) {
  const [visible, setVisible] = useState(false);
  return <div className="science-password-field"><label htmlFor={id}>{label}</label><div className="science-password-control"><input id={id} name={id} type={visible ? 'text' : 'password'} autoComplete={fresh ? 'new-password' : 'current-password'} value={value} onChange={event => onChange(event.target.value)} minLength={fresh ? 12 : undefined} maxLength={128} required disabled={disabled} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : fresh ? `${id}-hint` : undefined} /><button type="button" aria-label={visible ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`} aria-pressed={visible} aria-controls={id} onClick={() => setVisible(previous => !previous)}>{visible ? 'Ẩn' : 'Hiện'}</button></div>{error && <small id={`${id}-error`} className="science-field-error" role="alert">{error}</small>}{fresh && <small id={`${id}-hint`}>12–128 ký tự; ưu tiên một cụm từ dài, riêng cho SPOFY. Máy chủ từ chối mật khẩu quá phổ biến.</small>}</div>;
}
function EmailField({ value, onChange, error, disabled = false }: { value: string; onChange: (value: string) => void; error?: string; disabled?: boolean }) {
  return <label htmlFor="auth-email">Email<input id="auth-email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={value} onChange={event => onChange(event.target.value)} maxLength={254} required disabled={disabled} aria-invalid={!!error} aria-describedby={error ? 'auth-email-error' : undefined} />{error && <small id="auth-email-error" className="science-field-error" role="alert">{error}</small>}</label>;
}
export function AuthPage({ register = false }: { register?: boolean }) {
  const { user, ready, sessionError, capabilities, request } = useScience();
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [fields, setFields] = useState<Fields>({});
  const sending = useRef(false), form = useRef<HTMLFormElement>(null);
  const next = safeDestination();
  const unavailable = register && ready && capabilities?.emailConfigured === false;
  function edit(field: string, value: string) { ({ name: setName, email: setEmail, password: setPassword } as Record<string, (value: string) => void>)[field](value); setFields(previous => ({ ...previous, [field]: '' })); }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (sending.current) return;
    const invalid: Fields = { email: emailError(email) };
    if (register && (name.trim().length < 2 || name.trim().length > 80)) invalid.name = 'Tên hiển thị cần từ 2 đến 80 ký tự.';
    if (register) invalid.password = passwordError(password); else if (!password) invalid.password = 'Nhập mật khẩu của bạn.';
    setFields(invalid); setError('');
    if (Object.values(invalid).some(Boolean)) { requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return; }
    sending.current = true; setBusy(true); setMessage('');
    try {
      const result = await request<AuthResult>(`/api/auth/${register ? 'register' : 'login'}`, { method: 'POST', body: JSON.stringify(register ? { name: name.trim(), email: email.trim(), password } : { email: email.trim(), password }) });
      if (register) { setPassword(''); setMessage(result.message || 'Yêu cầu đã được tiếp nhận. Vui lòng kiểm tra email để hoàn tất đăng ký.'); }
      else window.location.assign(next);
    } catch (failure) { setError(messageOf(failure)); setFields(fieldErrors(failure)); }
    finally { sending.current = false; setBusy(false); }
  }
  return <SciencePage narrow><section className="science-auth"><span className="science-eyebrow">TÀI KHOẢN SPOFY</span><h1>{register ? 'Cùng đặt câu hỏi.' : 'Chào bạn trở lại.'}</h1><p><strong>Đọc bài không cần tài khoản.</strong> {register ? 'Tài khoản độc giả dùng để bình luận, đặt câu hỏi và cùng trao đổi về khoa học.' : 'Đăng nhập để tham gia trao đổi dưới các bài viết khoa học.'}</p>{ready && user ? <div className="science-auth-signed"><p>Bạn đã đăng nhập với tài khoản {user.name}.</p><a className="science-button" href={next}>Tiếp tục →</a>{user.role === 'admin' && <a className="science-inline-link" href="/admin">Đến quản trị</a>}</div> : message ? <div className="science-auth-result"><Notice message={message} /><p>Liên kết xác minh có thời hạn. Kiểm tra cả thư rác; chỉ dùng email do bạn sở hữu.</p><a className="science-button" href={`/dang-nhap?next=${encodeURIComponent(next)}`}>Đến đăng nhập</a><a className="science-inline-link" href="/khoa-hoc">Đọc khoa học trong lúc chờ</a></div> : <form ref={form} onSubmit={submit} noValidate aria-busy={busy}>{register && <label htmlFor="auth-name">Tên hiển thị<input id="auth-name" name="name" autoComplete="name" value={name} onChange={event => edit('name', event.target.value)} minLength={2} maxLength={80} required disabled={busy} aria-invalid={!!fields.name} aria-describedby={fields.name ? 'auth-name-error' : undefined} />{fields.name && <small id="auth-name-error" className="science-field-error" role="alert">{fields.name}</small>}</label>}<EmailField value={email} onChange={value => edit('email', value)} error={fields.email} disabled={busy} /><PasswordField id="auth-password" value={password} onChange={value => edit('password', value)} error={fields.password} fresh={register} disabled={busy} />{!register && <a className="science-inline-link science-forgot-link" href="/quen-mat-khau">Quên mật khẩu?</a>}{unavailable && <Notice error message="Đăng ký đang chờ cấu hình dịch vụ gửi email của SPOFY. Bạn vẫn có thể đọc toàn bộ bài viết hoặc đăng nhập bằng tài khoản hiện có." />}<Notice error message={error || sessionError} /><button className="science-button" disabled={busy || !ready || unavailable} type="submit">{busy ? 'Đang xử lý…' : register ? 'Tạo tài khoản độc giả' : 'Đăng nhập'}</button><p className="science-auth-switch">{register ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'} <a href={`${register ? '/dang-nhap' : '/dang-ky'}?next=${encodeURIComponent(next)}`}>{register ? 'Đăng nhập' : 'Đăng ký độc giả'}</a></p>{register && <p className="science-auth-privacy">Tài khoản mới luôn có quyền độc giả. Xem <a href="/quyen-rieng-tu">thông tin quyền riêng tư</a> trước khi đăng ký.</p>}</form>}</section></SciencePage>;
}
export function ForgotPasswordPage() {
  const { request, ready, capabilities } = useScience();
  const [email, setEmail] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState(''), [field, setField] = useState(''), [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const unavailable = ready && capabilities?.emailConfigured === false;
  async function submit(event: FormEvent) {
    event.preventDefault(); if (sending.current) return; const invalid = emailError(email); setField(invalid); if (invalid) return;
    sending.current = true; setBusy(true); setError(''); setMessage('');
    try { const result = await request<AuthResult>('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: email.trim() }) }); setMessage(result.message || 'Nếu email phù hợp, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu. Hãy kiểm tra cả thư rác.'); }
    catch (failure) { setError(messageOf(failure)); } finally { sending.current = false; setBusy(false); }
  }
  return <SciencePage narrow><section className="science-auth"><span className="science-eyebrow">KHÔI PHỤC TÀI KHOẢN</span><h1>Quên mật khẩu?</h1><p>Nhập email bạn đã dùng với SPOFY. Phản hồi không xác nhận địa chỉ đó có tài khoản hay không.</p><form onSubmit={submit} noValidate aria-busy={busy}><EmailField value={email} onChange={value => { setEmail(value); setField(''); }} error={field} disabled={busy} />{unavailable && <Notice error message="Dịch vụ email chưa được cấu hình. SPOFY chưa thể gửi liên kết đặt lại mật khẩu; hãy liên hệ qua Facebook chính thức nếu cần hỗ trợ." />}<Notice error message={error} /><Notice message={message} /><button className="science-button" disabled={busy || !ready || unavailable}>{busy ? 'Đang gửi yêu cầu…' : 'Gửi hướng dẫn khôi phục'}</button><a className="science-inline-link" href="/dang-nhap">← Về đăng nhập</a></form></section></SciencePage>;
}
function useEmailToken() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  useEffect(() => { if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search); }, []);
  return token;
}
export function ResetPasswordPage() {
  const token = useEmailToken(), { request, ready } = useScience();
  const [password, setPassword] = useState(''), [repeat, setRepeat] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState(''), [fields, setFields] = useState<Fields>({}), [busy, setBusy] = useState(false);
  const sending = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (sending.current) return;
    const invalid = { password: passwordError(password), repeat: password !== repeat ? 'Hai mật khẩu chưa khớp nhau.' : '' }; setFields(invalid); if (Object.values(invalid).some(Boolean)) return;
    sending.current = true; setBusy(true); setError('');
    try { const result = await request<AuthResult>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }); setPassword(''); setRepeat(''); setMessage(result.message || 'Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới.'); }
    catch (failure) { setError(messageOf(failure)); setFields(fieldErrors(failure)); } finally { sending.current = false; setBusy(false); }
  }
  return <SciencePage narrow><section className="science-auth"><span className="science-eyebrow">KHÔI PHỤC TÀI KHOẢN</span><h1>Mật khẩu mới.</h1><p>Liên kết chỉ dùng một lần và hết hạn sau 30 phút. Các phiên đăng nhập cũ bị thu hồi sau khi đổi mật khẩu.</p>{message ? <><Notice message={message} /><a className="science-button" href="/dang-nhap">Đăng nhập lại</a></> : !token ? <><Notice error message="Thiếu liên kết khôi phục. Hãy mở liên kết trong email hoặc yêu cầu một email mới." /><a className="science-button" href="/quen-mat-khau">Yêu cầu liên kết mới</a></> : <form onSubmit={submit} noValidate aria-busy={busy}><PasswordField id="reset-password" label="Mật khẩu mới" value={password} onChange={setPassword} error={fields.password} fresh disabled={busy} /><PasswordField id="repeat-password" label="Nhập lại mật khẩu mới" value={repeat} onChange={setRepeat} error={fields.repeat} fresh disabled={busy} /><Notice error message={error} /><button className="science-button" disabled={busy || !ready}>{busy ? 'Đang lưu…' : 'Lưu mật khẩu mới'}</button><a className="science-inline-link" href="/quen-mat-khau">Liên kết hết hạn? Yêu cầu lại</a></form>}</section></SciencePage>;
}
export function VerifyEmailPage() {
  const token = useEmailToken(), { user, request, ready, capabilities } = useScience();
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [verified, setVerified] = useState(false);
  const sending = useRef(false);
  async function run(resend = false) {
    if (sending.current) return; sending.current = true; setBusy(true); setError(''); setMessage('');
    try { const result = await request<AuthResult>(`/api/auth/${resend ? 'resend-verification' : 'verify-email'}`, { method: 'POST', body: JSON.stringify(resend ? {} : { token }) }); setMessage(result.message || (resend ? 'Nếu phù hợp, hướng dẫn xác minh sẽ được gửi tới email của bạn.' : 'Đã xác minh email. Bạn có thể cùng trao đổi dưới bài viết.')); if (!resend) setVerified(true); }
    catch (failure) { setError(messageOf(failure)); } finally { sending.current = false; setBusy(false); }
  }
  return <SciencePage narrow><section className="science-auth"><span className="science-eyebrow">EMAIL SPOFY</span><h1>Xác minh email.</h1><p>Xác nhận địa chỉ email để gửi bình luận. Mỗi liên kết xác minh chỉ dùng một lần, trong vòng 24 giờ.</p><Notice error message={error} /><Notice message={message} />{verified || user?.emailVerified === true ? <a className="science-button" href="/khoa-hoc">Khám phá khoa học</a> : token ? <button className="science-button" disabled={busy || !ready} onClick={() => void run()}>{busy ? 'Đang xác minh…' : 'Xác minh địa chỉ email này'}</button> : !ready ? <p role="status">Đang kiểm tra phiên đăng nhập…</p> : user && user.emailVerified === false ? <><p>Gửi lại liên kết tới email của tài khoản đang đăng nhập.</p>{capabilities?.emailConfigured === false && <Notice error message="Dịch vụ email chưa được cấu hình. Hiện chưa thể gửi lại liên kết." />}<button className="science-button" disabled={busy || capabilities?.emailConfigured === false} onClick={() => void run(true)}>{busy ? 'Đang gửi…' : 'Gửi lại email xác minh'}</button></> : user ? <p>Tài khoản hiện hữu của bạn không yêu cầu xác minh lại để tiếp tục sử dụng.</p> : <><p>Hãy mở liên kết trong email đã nhận. Nếu cần gửi lại email, đăng nhập tài khoản trước.</p><a className="science-button" href="/dang-nhap?next=%2Fxac-minh-email">Đăng nhập</a></>}<a className="science-inline-link" href="/khoa-hoc">Tiếp tục đọc, không cần tài khoản</a></section></SciencePage>;
}
