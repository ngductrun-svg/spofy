import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ArchiveImage } from "./ArchiveImage";
import { displayTitle } from "./archiveDisplay";
import "./site-navigation.css";

export type NavigationRecord = {
  id: string;
  name: string;
  displayTitle?: string;
  timeline_date: string;
  photo_count?: number;
  image: string;
};

export type SiteNavigationProps = {
  records: NavigationRecord[];
  eventCount: number;
  photoCount: number;
  dateRange: string;
  loading?: boolean;
  onPanelOpen?: () => void;
  onAlbum?: (eventId: string) => void;
  onNavigate?: (id: string) => void;
};

const sections = [
  { id: "story", label: "Về SPOFY", eyebrow: "SCIENCE · PEOPLE · CURIOSITY" },
  { id: "history", label: "Dấu mốc", eyebrow: "NHỮNG KHOẢNH KHẮC ĐƯỢC GIỮ LẠI" },
  { id: "khoa-hoc", label: "Khoa học", eyebrow: "TỪ TRÍ TÒ MÒ ĐẾN HIỂU BIẾT" },
  { id: "gallery", label: "Kho ảnh", eyebrow: "MỖI TẤM ẢNH, MỘT KÝ ỨC" },
  { id: "connect", label: "Kết nối", eyebrow: "CHƯƠNG TIẾP THEO" },
] as const;
type Section = typeof sections[number]["id"];
const facebook = "https://www.facebook.com/spofy.sofia";
const count = (value: number) => value.toLocaleString("vi-VN");
const title = (record: NavigationRecord) => record.displayTitle || displayTitle(record.name);
const Arrow = () => <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;

/** One non-modal navigation surface. Native fragment links remain owned by App. */
export function SiteNavigation({ records, eventCount, photoCount, dateRange, loading = false, onPanelOpen, onAlbum, onNavigate }: SiteNavigationProps) {
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const pendingNavigation = useRef<string | null>(null);
  const navigateCallback = useRef(onNavigate);
  navigateCallback.current = onNavigate;
  const mobileToggle = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const openCallback = useRef(onPanelOpen);
  openCallback.current = onPanelOpen;
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches);
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [openPanel, setOpenPanel] = useState<Section | null>(null);
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [present, setPresent] = useState(false);
  const [entered, setEntered] = useState(false);
  const [moving, setMoving] = useState(false);
  const [surfaceHeight, setSurfaceHeight] = useState(0);
  const [active, setActive] = useState<Section | "">("");
  const [scrolled, setScrolled] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const [imageRetries, setImageRetries] = useState<Record<string, number>>({});
  const visible = mobile ? mobileOpen : desktopOpen;
  const years = useMemo(() => [...new Set(records.map(record => record.timeline_date.slice(0, 4)).filter(Boolean))].sort(), [records]);
  // These are already featured in the archive; original names and dates are retained.
  const previews = useMemo(() => ["event-01", "event-19", "event-51"].map(id => records.find(record => record.id === id)).filter((record): record is NavigationRecord => !!record), [records]);

  const close = useCallback((restoreFocus = false) => {
    // Keep the selected content rendered during exit; inert applies immediately.
    setDesktopOpen(false);
    setMobileOpen(false);
    if (restoreFocus) (mobile ? mobileToggle.current : opener.current)?.focus({ preventScroll: true });
  }, [mobile]);

  useLayoutEffect(() => {
    const node = bar.current;
    if (!node) return;
    const measure = () => document.documentElement.style.setProperty("--header-height", `${Math.ceil(node.getBoundingClientRect().height)}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const viewport = window.matchMedia("(max-width: 900px)");
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateViewport = () => {
      if (document.activeElement instanceof HTMLElement && root.current?.contains(document.activeElement)) {
        bar.current?.querySelector<HTMLAnchorElement>(".site-navigation-logo")?.focus({ preventScroll: true });
      }
      setMobile(viewport.matches);
      setMobileOpen(false);
      setDesktopOpen(false);
      setOpenPanel(null);
      pendingNavigation.current = null;
    };
    const updatePreference = () => setReduced(preference.matches);
    viewport.addEventListener("change", updateViewport);
    preference.addEventListener("change", updatePreference);
    return () => { viewport.removeEventListener("change", updateViewport); preference.removeEventListener("change", updatePreference); };
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 40);
      let current: Section | "" = "";
      for (const section of sections) {
        const node = document.getElementById(section.id);
        if (node && node.getBoundingClientRect().top <= window.innerHeight * .35) current = section.id;
      }
      setActive(current);
    };
    const requestUpdate = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => { window.removeEventListener("scroll", requestUpdate); window.removeEventListener("resize", requestUpdate); cancelAnimationFrame(frame); };
  }, []);

  useLayoutEffect(() => {
    const node = surface.current;
    if (!node || !present) return;
    const head = node.querySelector<HTMLElement>(".site-navigation-surface-head");
    const groups = node.querySelector<HTMLElement>(".site-navigation-groups");
    if (!head || !groups) return;
    let alive = true;
    const measure = () => {
      if (!alive) return;
      const selected = groups.querySelector<HTMLElement>(".is-expanded .site-navigation-content-inner");
      const contentHeight = selected?.scrollHeight || 0;
      const groupHeight = mobile
        ? Array.from(groups.querySelectorAll<HTMLElement>(".site-navigation-accordion")).reduce((sum, item) => sum + item.getBoundingClientRect().height, 0) + contentHeight + sections.length
        : contentHeight;
      const available = window.innerHeight - (bar.current?.getBoundingClientRect().height || 88);
      setSurfaceHeight(Math.ceil(Math.min(available, head.getBoundingClientRect().height + groupHeight)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(head);
    groups.querySelectorAll(".site-navigation-content-inner").forEach(node => observer.observe(node));
    window.addEventListener("resize", measure);
    document.fonts.ready.then(measure);
    return () => { alive = false; observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [mobile, openPanel, present, records, loading]);

  useEffect(() => {
    let frame = 0;
    let timer = 0;
    if (visible) {
      setPresent(true);
      setMoving(!reduced);
      // Reversal uses the current computed CSS height instead of restarting keyframes.
      if (present) setEntered(true);
      else frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => setEntered(true)); });
      timer = window.setTimeout(() => setMoving(false), reduced ? 0 : 560);
    } else {
      setEntered(false);
      setMoving(!reduced);
      timer = window.setTimeout(() => {
        setPresent(false);
        setMoving(false);
        const destination = pendingNavigation.current;
        pendingNavigation.current = null;
        if (destination) navigateCallback.current?.(destination);
      }, reduced ? 40 : 320);
    }
    return () => { cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, [visible, reduced]);

  useEffect(() => {
    const node = backdrop.current;
    if (!node || !visible) return;
    const hold = (event: Event) => event.preventDefault();
    node.addEventListener("wheel", hold, { passive: false });
    node.addEventListener("touchmove", hold, { passive: false });
    return () => { node.removeEventListener("wheel", hold); node.removeEventListener("touchmove", hold); };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || document.querySelector("dialog[open]")) return;
      event.preventDefault();
      close(true);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [visible, close]);

  const togglePanel = (id: Section, trigger: HTMLButtonElement) => {
    pendingNavigation.current = null;
    opener.current = trigger;
    if (mobile) setOpenPanel(previous => previous === id ? null : id);
    else if (desktopOpen && openPanel === id) close();
    else { openCallback.current?.(); setOpenPanel(id); setDesktopOpen(true); }
  };
  const toggleMobile = () => {
    pendingNavigation.current = null;
    if (!mobileOpen) {
      openCallback.current?.();
      setOpenPanel("story");
    }
    setMobileOpen(previous => !previous);
  };
  const destination = (href: string, label: string) => <a className="site-navigation-cta nav-stagger" href={href}>{label}<Arrow /></a>;
  const photoCards = (album = false) => <div className="site-navigation-previews">{previews.map((record, index) => {
    const imageKey = `${album ? "gallery" : "history"}:${record.id}`;
    const content = <><ArchiveImage src={record.image} alt={`Ảnh tư liệu: ${title(record)}`} aspectRatio="3 / 2" fit="contain" interactive={false} retryKey={imageRetries[imageKey] || 0}
      onError={() => setFailedImages(previous => new Set(previous).add(imageKey))}
      onLoad={() => setFailedImages(previous => { if (!previous.has(imageKey)) return previous; const next = new Set(previous); next.delete(imageKey); return next; })} /><span className="site-navigation-preview-caption"><small>{record.timeline_date.slice(0, 4)} · {typeof record.photo_count === "number" ? `${count(record.photo_count)} ảnh` : "Ảnh tư liệu"}</small><strong>{title(record)}</strong></span></>;
    const style = { "--nav-item-index": index + 1 } as CSSProperties;
    return <div className="site-navigation-preview-wrap nav-stagger" style={style} key={record.id}>{album && onAlbum
      ? <button className="site-navigation-preview" type="button" onClick={() => { close(true); onAlbum(record.id); }} aria-label={`Mở album ${title(record)}`}>{content}</button>
      : <a className="site-navigation-preview" href={`#${record.id}`} onClick={() => close()} aria-label={`Xem dấu mốc ${title(record)}`}>{content}</a>}
      {failedImages.has(imageKey) && <button className="site-navigation-image-retry" type="button" onClick={() => setImageRetries(previous => ({ ...previous, [imageKey]: (previous[imageKey] || 0) + 1 }))}>Thử tải lại ảnh<span aria-hidden="true">↻</span></button>}
    </div>;
  })}</div>;
  const contents: Record<Section, ReactNode> = {
    "khoa-hoc": <div className="site-navigation-story"><div className="site-navigation-intro nav-stagger"><h2>Tò mò hôm nay.<br /><em>Hiểu thêm ngày mai.</em></h2><p>Đọc, tìm hiểu và cùng trao đổi về Toán học, Vật lí, Hóa học, Sinh học, Công nghệ và STEM.</p><a className="site-navigation-cta" href="/khoa-hoc" onClick={() => close()}>Đọc bài khoa học<Arrow /></a></div><div className="site-navigation-intro nav-stagger" style={{ "--nav-item-index": 1 } as CSSProperties}><p>Mỗi câu hỏi mở ra một hướng khám phá. Những bài viết đã xuất bản của SPOFY được tập hợp trong chuyên mục Khoa học.</p><a className="site-navigation-secondary" href="/dang-nhap" onClick={() => close()}>Đăng nhập để bình luận<span aria-hidden="true">↗</span></a></div></div>,
    story: <div className="site-navigation-story">
      <div className="site-navigation-intro nav-stagger"><h2>Mọi hành trình<br />bắt đầu từ <em>“Vì sao?”</em></h2><p>SPOFY là nơi những người trẻ gặp nhau, thử nghiệm và chia sẻ niềm yêu thích khoa học.</p>{destination("#story", "Đọc câu chuyện SPOFY")}</div>
      <dl className="site-navigation-stats nav-stagger" style={{ "--nav-item-index": 1 } as CSSProperties}><div><dt>Hành trình trong tư liệu</dt><dd>{dateRange && dateRange !== "…" ? dateRange : "—"}</dd></div><div><dt>Nhóm sự kiện / hoạt động</dt><dd>{loading ? "—" : count(eventCount)}</dd></div><div><dt>Ảnh trong kho tư liệu</dt><dd>{loading ? "—" : count(photoCount)}</dd></div></dl>
    </div>,
    history: <div className="site-navigation-history"><div className="site-navigation-years nav-stagger" aria-label="Đi đến năm trong hành trình">{years.map(year => <a key={year} href={`#year-${year}`} onClick={() => close()}>{year}<span aria-hidden="true">↗</span></a>)}</div>{photoCards()}{destination("#history", "Khám phá dấu mốc")}</div>,
    gallery: <div className="site-navigation-gallery"><p className="site-navigation-panel-description nav-stagger">Ảnh hoạt động thật. Tên gốc, ngày và nguồn tư liệu được giữ cùng nhau.</p>{photoCards(true)}{destination("#gallery", "Mở kho ảnh")}</div>,
    connect: <div className="site-navigation-connect nav-stagger"><h2>Còn rất nhiều<br /><em>“Vì sao?”</em> phía trước.</h2><div><p>Theo dõi những câu chuyện mới và gặp SPOFY trên Facebook.</p><a className="site-navigation-cta" href={facebook} target="_blank" rel="noopener noreferrer" onClick={() => close()}>Gặp chúng mình<Arrow /></a><a className="site-navigation-secondary" href="#connect" onClick={() => close()}>Đến phần Kết nối<span aria-hidden="true">↓</span></a></div></div>,
  };

  return <div className="site-navigation-root" ref={root} data-menu-state={visible ? "open" : present ? "closing" : "closed"} onClickCapture={event => {
    if (!visible || !onNavigate || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="#"]') : null;
    if (!link?.hash) return;
    event.preventDefault();
    try { pendingNavigation.current = decodeURIComponent(link.hash.slice(1)); } catch { return; }
    // Defer the existing App anchor path until the surface and backdrop have exited.
    close(true);
  }} onBlurCapture={event => {
    const destination = event.relatedTarget;
    if (destination instanceof Node && !event.currentTarget.contains(destination)) close();
  }}>
    <div ref={backdrop} className={`site-navigation-backdrop${entered ? " is-open" : ""}${visible ? " is-active" : ""}`} hidden={!present} aria-hidden="true" inert={!visible} onPointerDown={() => close(true)} />
    <header className={`site-navigation${scrolled || visible ? " is-solid" : ""}`}>
      <div className="site-navigation-bar" ref={bar}>
        <a className="site-navigation-logo" href="#top" onClick={() => close()} aria-label="SPOFY — về đầu trang"><span aria-hidden="true"><svg viewBox="0 0 36 36" fill="none"><ellipse cx="18" cy="18" rx="15" ry="6" stroke="currentColor" transform="rotate(-38 18 18)" /><ellipse cx="18" cy="18" rx="15" ry="6" stroke="currentColor" transform="rotate(38 18 18)" /><circle cx="18" cy="18" r="3" fill="currentColor" /></svg></span><span>SPOFY<small>SCIENCE & CURIOSITY</small></span></a>
        <nav className="site-navigation-triggers" aria-label="Điều hướng SPOFY">{sections.map(section => <button key={section.id} id={`spofy-nav-trigger-${section.id}`} type="button" className={active === section.id ? "is-current" : undefined} aria-current={active === section.id ? "location" : undefined} aria-expanded={!mobile && desktopOpen && openPanel === section.id} aria-controls={`spofy-nav-content-${section.id}`} onClick={event => togglePanel(section.id, event.currentTarget)}>{section.label}<span aria-hidden="true">⌄</span></button>)}</nav>
        <a className="site-navigation-social" href={facebook} target="_blank" rel="noopener noreferrer">Gặp SPOFY trên Facebook<Arrow /></a>
        <button ref={mobileToggle} type="button" className="site-navigation-toggle" aria-label={mobileOpen ? "Đóng menu" : "Mở menu điều hướng"} aria-expanded={mobileOpen} aria-controls="spofy-navigation-panel" onClick={toggleMobile}><span /><span /></button>
      </div>
      <div ref={surface} id="spofy-navigation-panel" className={`site-navigation-surface${entered ? " is-open" : ""}${moving ? " is-moving" : ""}`} style={{ "--nav-surface-height": `${surfaceHeight}px` } as CSSProperties} hidden={!present} inert={!visible} aria-hidden={!visible}>
        <div className="site-navigation-surface-head"><span>{mobile ? "KHÁM PHÁ SPOFY" : sections.find(section => section.id === openPanel)?.eyebrow || "KHÁM PHÁ SPOFY"}</span><button type="button" className="site-navigation-close" onClick={() => close(true)} aria-label="Đóng bảng điều hướng"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></button></div>
        <div className="site-navigation-groups">{sections.map((section, index) => <section key={section.id} style={{ "--nav-group-index": index } as CSSProperties} className={`site-navigation-group${openPanel === section.id ? " is-expanded" : ""}`}>
          <button id={`spofy-mobile-trigger-${section.id}`} className="site-navigation-accordion" type="button" aria-expanded={mobile && mobileOpen && openPanel === section.id} aria-controls={`spofy-nav-content-${section.id}`} onClick={event => togglePanel(section.id, event.currentTarget)}><span>{section.label}</span><span aria-hidden="true">+</span></button>
          <div id={`spofy-nav-content-${section.id}`} className="site-navigation-content" role="region" aria-labelledby={`spofy-${mobile ? "mobile" : "nav"}-trigger-${section.id}`} inert={!visible || openPanel !== section.id} aria-hidden={!visible || openPanel !== section.id}><div className="site-navigation-content-inner">{contents[section.id]}</div></div>
        </section>)}</div>
      </div>
    </header>
  </div>;
}
