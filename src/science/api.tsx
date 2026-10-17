import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type User = { id: string; email: string; name: string; role: 'admin' | 'reader' };
export type Category = { slug: string; label: string };
export const categories: Category[] = [
  { slug: 'toan-hoc', label: 'Toán học' }, { slug: 'vat-li', label: 'Vật lí' },
  { slug: 'hoa-hoc', label: 'Hóa học' }, { slug: 'sinh-hoc', label: 'Sinh học' },
  { slug: 'cong-nghe', label: 'Công nghệ' }, { slug: 'stem', label: 'STEM' },
];
export type Block =
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'image'; src: string; alt: string; caption: string }
  | { type: 'formula'; latex: string; caption: string }
  | { type: 'link'; label: string; url: string };
export type Reference = { label: string; url: string };
export type Article = {
  id: string; title: string; slug: string; summary: string; coverImage: string; coverAlt: string;
  category: string; tags: string[]; author: string; blocks: Block[]; references: Reference[];
  status: 'draft' | 'published'; featured: boolean; publishedAt: string | null; createdAt: string; updatedAt: string;
};
export type Comment = { id: string; articleId: string; articleTitle: string; articleSlug: string; body: string; status: 'visible' | 'hidden'; authorName: string; createdAt: string };
export type ArticleList = { items: Article[]; total: number; page: number; pageSize: number; totalPages: number; categories: Category[] };
export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;
  constructor(message: string, status: number, code: string, fields?: Record<string, string>) {
    super(message); this.status = status; this.code = code; this.fields = fields;
  }
}
type ScienceContextValue = {
  user: User | null; ready: boolean; sessionError: string; request: <T>(path: string, options?: RequestInit) => Promise<T>;
  refreshSession: () => Promise<void>; logout: () => Promise<void>;
};
const ScienceContext = createContext<ScienceContextValue | null>(null);

export function ScienceProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const csrf = useRef('');
  const sessionPromise = useRef<Promise<void> | null>(null);
  const refreshSession = useCallback(async () => {
    if (sessionPromise.current) return sessionPromise.current;
    const pending = (async () => {
      try {
        const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message || 'Không thể kết nối phiên đăng nhập.');
        csrf.current = body.csrfToken || ''; setUser(body.user || null); setSessionError('');
      } catch (error) { csrf.current = ''; setUser(null); setSessionError(error instanceof Error ? error.message : 'Không thể kết nối máy chủ.'); }
      finally { setReady(true); }
    })();
    sessionPromise.current = pending;
    await pending;
    sessionPromise.current = null;
  }, []);
  useEffect(() => { void refreshSession(); }, [refreshSession]);
  const request = useCallback(async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const method = (options.method || 'GET').toUpperCase();
    const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    if (mutation && !csrf.current) await refreshSession();
    const headers = new Headers(options.headers);
    if (mutation) headers.set('X-CSRF-Token', csrf.current);
    if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    let response: Response;
    try { response = await fetch(path, { ...options, headers, credentials: 'same-origin', cache: 'no-store' }); }
    catch { throw new ApiError('Không kết nối được máy chủ. Hãy kiểm tra mạng rồi thử lại.', 0, 'NETWORK'); }
    let body: any = null;
    try { body = await response.json(); } catch { /* A DELETE may return no content. */ }
    if (!response.ok) throw new ApiError(body?.error?.message || `Yêu cầu không thành công (${response.status}).`, response.status, body?.error?.code || 'HTTP_ERROR', body?.error?.fields);
    if (body && Object.prototype.hasOwnProperty.call(body, 'csrfToken')) { csrf.current = body.csrfToken || ''; setUser(body.user || null); }
    return body as T;
  }, [refreshSession]);
  const logout = useCallback(async () => { await request('/api/auth/logout', { method: 'POST', body: '{}' }); setUser(null); }, [request]);
  return <ScienceContext.Provider value={{ user, ready, sessionError, request, refreshSession, logout }}>{children}</ScienceContext.Provider>;
}
export function useScience() {
  const context = useContext(ScienceContext);
  if (!context) throw new Error('ScienceProvider is required.');
  return context;
}
export function safeUrl(value?: string, image = false) {
  if (!value) return '';
  if (image && /^\/media\/[a-zA-Z0-9_./-]+$/.test(value) && !value.includes('..')) return value;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
export const categoryLabel = (slug: string) => categories.find(category => category.slug === slug)?.label || slug;
export const formatDate = (value?: string | null) => value && !Number.isNaN(new Date(value).getTime()) ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value)) : '';
export const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Đã có lỗi xảy ra. Hãy thử lại.';
