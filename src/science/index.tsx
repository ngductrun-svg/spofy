import { lazy, Suspense } from 'react';
import { ArticleDetail, ScienceListing, SciencePage } from './Public';
import './science.css';
export { ScienceProvider } from './api';
export { ScienceIntro } from './Public';

const AdminArticles = lazy(() => import('./Admin').then(module => ({ default: module.AdminArticles })));
const AdminComments = lazy(() => import('./Admin').then(module => ({ default: module.AdminComments })));
const AdminArticleEditor = lazy(() => import('./Admin').then(module => ({ default: module.AdminArticleEditor })));
const AdminAccounts = lazy(() => import('./AdminAccounts').then(module => ({ default: module.AdminAccounts })));
const AuthPage = lazy(() => import('./AuthPages').then(module => ({ default: module.AuthPage })));
const ForgotPasswordPage = lazy(() => import('./AuthPages').then(module => ({ default: module.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./AuthPages').then(module => ({ default: module.ResetPasswordPage })));
const VerifyEmailPage = lazy(() => import('./AuthPages').then(module => ({ default: module.VerifyEmailPage })));
const StartHerePage = lazy(() => import('./Engagement').then(module => ({ default: module.StartHerePage })));
const WeeklyQuestionPage = lazy(() => import('./Engagement').then(module => ({ default: module.WeeklyQuestionPage })));
const ParticipationFaq = lazy(() => import('./Engagement').then(module => ({ default: module.ParticipationFaq })));
const PrivacyPage = lazy(() => import('./Engagement').then(module => ({ default: module.PrivacyPage })));
export function ScienceRouter({ path }: { path: string }) {
  const pathname = path.replace(/\/$/, '') || '/';
  function page() {
    if (pathname === '/khoa-hoc') return <ScienceListing />;
    if (pathname.startsWith('/khoa-hoc/')) { let slug = ''; try { slug = decodeURIComponent(pathname.slice('/khoa-hoc/'.length)); } catch { /* Invalid paths get a safe unavailable response. */ } return <ArticleDetail slug={slug} />; }
    if (pathname === '/dang-nhap') return <AuthPage />;
    if (pathname === '/dang-ky') return <AuthPage register />;
    if (pathname === '/quen-mat-khau') return <ForgotPasswordPage />;
    if (pathname === '/dat-lai-mat-khau') return <ResetPasswordPage />;
    if (pathname === '/xac-minh-email') return <VerifyEmailPage />;
    if (pathname === '/bat-dau') return <StartHerePage />;
    if (pathname === '/cau-hoi-moi-tuan') return <WeeklyQuestionPage />;
    if (pathname === '/tham-gia') return <ParticipationFaq standalone />;
    if (pathname === '/quyen-rieng-tu') return <PrivacyPage />;
    if (pathname === '/admin') return <AdminArticles />;
    if (pathname === '/admin/binh-luan') return <AdminComments />;
    if (pathname === '/admin/tai-khoan') return <AdminAccounts />;
    if (pathname === '/admin/dang-nhap') return <AdminAccounts history />;
    if (pathname === '/admin/bai-viet/moi') return <AdminArticleEditor />;
    if (pathname.startsWith('/admin/bai-viet/')) { try { return <AdminArticleEditor id={decodeURIComponent(pathname.slice('/admin/bai-viet/'.length))} />; } catch { /* Display the public not-found view. */ } }
    return <SciencePage><div className="science-empty"><h1>Không tìm thấy trang</h1><p>Đường dẫn này không có trong website SPOFY.</p><a className="science-button" href="/">Về trang chủ</a></div></SciencePage>;
  }
  return <Suspense fallback={<SciencePage><p className="science-loading" role="status">Đang mở trang…</p></SciencePage>}>{page()}</Suspense>;
}
