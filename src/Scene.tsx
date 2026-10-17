import { useCallback, useEffect, useRef, useState } from "react";
import "./hero.css";
import { HeroWord } from "./HeroWord";
import type { HeroTimelineEvent } from "./HeroWord";
import { SiteNavigation } from "./SiteNavigation";

const Arrow = ({ down = false }: { down?: boolean }) => <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={down ? "M12 4v16m-6-6 6 6 6-6" : "M5 19 19 5M5 5h14v14"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;

function ScienceMarks() {
  return <div className="spofy-hero-science" aria-hidden="true">
    <span className="spofy-hero-formula spofy-hero-formula--math">∫ <i>∞</i><small>f(x) dx</small></span>
    <svg className="spofy-hero-atom" viewBox="0 0 160 160" fill="none"><circle cx="80" cy="80" r="4" fill="currentColor" /><ellipse cx="80" cy="80" rx="70" ry="26" stroke="currentColor" /><ellipse cx="80" cy="80" rx="70" ry="26" stroke="currentColor" transform="rotate(60 80 80)" /><ellipse cx="80" cy="80" rx="70" ry="26" stroke="currentColor" transform="rotate(120 80 80)" /><circle cx="142" cy="67" r="4" fill="currentColor" /></svg>
    <svg className="spofy-hero-dna" viewBox="0 0 75 150" fill="none"><path d="M12 5c0 35 51 35 51 70s-51 35-51 70M63 5c0 35-51 35-51 70s51 35 51 70M16 20h43M27 35h21M27 55h21M16 70h43M16 85h43M27 100h21M27 120h21M16 135h43" stroke="currentColor" strokeWidth="1.3" /></svg>
  </div>;
}

export function Scene({ onAlbum, onNavigate, events, loading, eventCount, photoCount, dateRange }: {
  onAlbum: (group?: string) => void; events: (HeroTimelineEvent & { photo_count: number })[];
  onNavigate?: (id: string) => void;
  loading: boolean; eventCount: number; photoCount: number; dateRange: string;
}) {
  const hero = useRef<HTMLElement>(null);
  const [wordActive, setWordActive] = useState(false);
  const [dismissSignal, setDismissSignal] = useState(0);
  const closeBranches = useCallback(() => setDismissSignal(value => value + 1), []);

  // Scroll uses outer wrappers; the existing glyph transforms belong to the pointer effect.
  useEffect(() => {
    const node = hero.current;
    if (!node) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, inView = true, alive = true;
    const paint = () => {
      frame = 0;
      if (document.hidden || !inView) return;
      const box = node.getBoundingClientRect();
      const progress = reduce.matches ? 0 : Math.min(1, Math.max(0, -box.top / Math.max(1, box.height)));
      node.style.setProperty("--hero-photo-y", `${progress * 28}px`);
      node.style.setProperty("--hero-photo-scale", String(reduce.matches ? 1 : 1.04 - progress * .04));
      node.style.setProperty("--hero-marks-y", `${progress * -12}px`);
    };
    const schedule = () => { if (alive && !frame && inView && !document.hidden) frame = requestAnimationFrame(paint); };
    const stop = () => { cancelAnimationFrame(frame); frame = 0; };
    const visibility = () => { if (document.hidden) stop(); else schedule(); };
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; if (inView) schedule(); else stop(); });
    const resize = new ResizeObserver(schedule);
    observer.observe(node); resize.observe(node);
    addEventListener("scroll", schedule, { passive: true }); addEventListener("resize", schedule);
    document.addEventListener("visibilitychange", visibility); reduce.addEventListener("change", schedule);
    document.fonts.ready.then(schedule); schedule();
    return () => { alive = false; stop(); observer.disconnect(); resize.disconnect(); removeEventListener("scroll", schedule); removeEventListener("resize", schedule); document.removeEventListener("visibilitychange", visibility); reduce.removeEventListener("change", schedule); };
  }, []);


  return <>
    <SiteNavigation records={events} eventCount={eventCount} photoCount={photoCount} dateRange={dateRange} loading={loading} onPanelOpen={closeBranches} onAlbum={onAlbum} onNavigate={onNavigate} />
    <header className="spofy-hero" ref={hero} data-word-active={wordActive}>
      <div className="spofy-hero-photo" aria-hidden="true" />
      <div className="spofy-hero-shade" aria-hidden="true" />
      <ScienceMarks />
      <div className="spofy-hero-main">
        <p className="spofy-hero-kicker"><span /> CÂU LẠC BỘ KHOA HỌC · STEM</p>
        <div className="spofy-word-scroll"><div className="spofy-word-entrance"><HeroWord events={events} loading={loading} onActiveChange={setWordActive} dismissSignal={dismissSignal} /></div></div>
        <p className="spofy-hero-tagline">Khơi trí tò mò.<br className="spofy-hero-mobile-break" /> <em>Mở lối khám phá.</em></p>
        <a className="spofy-hero-science-cta" href="/khoa-hoc">Khám phá khoa học <Arrow /></a>
      </div>
      <div className="spofy-hero-bottom">
        <div className="spofy-hero-copy"><span className="spofy-hero-overline">MỖI CÂU HỎI, MỘT KHỞI ĐẦU.</span><p>Thí nghiệm. Gặp gỡ. Cùng lớn lên.<br />Đi qua những dấu mốc và khoảnh khắc<br className="spofy-hero-desktop-break" /> làm nên câu chuyện của SPOFY.</p><a href="#history">Khám phá hành trình <Arrow down /></a></div>
        <a className="spofy-hero-album" href="#gallery"><span className="spofy-hero-album-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor"/></svg></span><span>Khám phá kho ảnh<small>ẢNH HOẠT ĐỘNG THẬT CỦA SPOFY</small></span><Arrow /></a>
      </div>
      <div className="spofy-hero-foot">
        <div className="spofy-hero-subjects" aria-label="Toán học, vật lí, hóa học, sinh học"><span><i>∑</i> TOÁN</span><span><i>λ</i> VẬT LÍ</span><span><i>H₂</i> HÓA HỌC</span><span><i className="spofy-hero-dna-label">DNA</i> SINH HỌC</span></div>
        <a href="#story" className="spofy-hero-scroll">CUỘN ĐỂ KHÁM PHÁ <Arrow down /></a>
      </div>
      <a className="spofy-hero-photo-credit" href="https://www.facebook.com/photo/?fbid=1190515168964915&set=pcb.1190516162298149" target="_blank" rel="noopener noreferrer">Ảnh nền: SPOFY x HaNoi STEM Festival · Facebook gốc ↗</a>
    </header>
  </>;
}
