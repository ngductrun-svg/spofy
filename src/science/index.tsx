import { AdminArticleEditor, AdminArticles, AdminComments } from './Admin';
import { AdminAccounts } from './AdminAccounts';
import { ArticleDetail, AuthPage, ScienceListing, SciencePage } from './Public';
import './science.css';
export { ScienceProvider } from './api';
export { ScienceIntro } from './Public';

export function ScienceRouter({ path }: { path: string }) {
  const pathname = path.replace(/\/$/, '') || '/';
  if (pathname === '/khoa-hoc') return <ScienceListing />;
  if (pathname.startsWith('/khoa-hoc/')) { let slug = ''; try { slug = decodeURIComponent(pathname.slice('/khoa-hoc/'.length)); } catch { /* Invalid path gets an unavailable article response. */ } return <ArticleDetail slug={slug} />; }
  if (pathname === '/dang-nhap') return <AuthPage />;
  if (pathname === '/dang-ky') return <AuthPage register />;
  if (pathname === '/admin') return <AdminArticles />;
  if (pathname === '/admin/binh-luan') return <AdminComments />;
  if (pathname === '/admin/tai-khoan') return <AdminAccounts />;
  if (pathname === '/admin/dang-nhap') return <AdminAccounts history />;
  if (pathname === '/admin/bai-viet/moi') return <AdminArticleEditor />;
  if (pathname.startsWith('/admin/bai-viet/')) return <AdminArticleEditor id={decodeURIComponent(pathname.slice('/admin/bai-viet/'.length))} />;
  return <SciencePage><div className="science-empty"><h1>Không tìm thấy trang</h1><p>Đường dẫn này không có trong website SPOFY.</p><a className="science-button" href="/">Về trang chủ</a></div></SciencePage>;
}
