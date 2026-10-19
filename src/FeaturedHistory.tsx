import { useEffect, useRef } from "react";
import type { CSSProperties, FocusEvent } from "react";
import { ArchiveImage } from "./ArchiveImage";
import "./featured-history.css";

export type FeaturedHistoryRecord = {
  id: string;
  name: string;
  year: string;
  dateKind: "event_date" | "posted_date";
  photo: { src: string; alt: string; width?: number; height?: number; srcSet?: string };
  description?: string;
  photoCount: number;
  source_url: string;
};

type FeaturedHistoryProps = {
  records: FeaturedHistoryRecord[];
  onOpenAlbum: (id: string) => void;
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => 1 - Math.pow(1 - clamp(value), 3);
const number = (value: number) => value.toLocaleString("vi-VN");

/** A finite, native-scroll scene. With no script/motion, it is a normal card list. */
export function FeaturedHistory({ records, onOpenAlbum }: FeaturedHistoryProps) {
  const scene = useRef<HTMLDivElement>(null);
  const sticky = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const scheduleUpdate = useRef<(() => void) | null>(null);
  const keyboardFocus = useRef(false);
  const actionsReady = useRef(true);
  const visibleRecords = records.slice(0, 3);
  const recordKey = visibleRecords.map(record => record.id).join(":");

  useEffect(() => {
    const root = scene.current;
    const pinned = sticky.current;
    const plane = stage.current;
    if (!root || !pinned || !plane || !recordKey) return;

    const motion = window.matchMedia("(min-width: 901px) and (min-height: 641px) and (prefers-reduced-motion: no-preference)");
    let frame = 0;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let inView = true;
    let disposed = false;

    const stopFrame = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      clearTimeout(settleTimer);
      root.removeAttribute("data-moving");
    };

    const update = () => {
      frame = 0;
      if (disposed || document.hidden || !inView) return;
      const animated = motion.matches;
      root.dataset.mode = animated ? "scroll" : "static";
      if (!animated) {
        actionsReady.current = true;
        root.dataset.actionsReady = "true";
        root.removeAttribute("data-moving");
        root.style.setProperty("--featured-progress", "1");
        cards.current.forEach(card => {
          card?.style.removeProperty("transform");
          card?.style.removeProperty("opacity");
          card?.removeAttribute("data-current");
        });
        return;
      }

      const bounds = root.getBoundingClientRect();
      const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-height")) || 88;
      const travel = Math.max(1, bounds.height - pinned.getBoundingClientRect().height);
      const progress = clamp((header - bounds.top) / travel);
      const focused = keyboardFocus.current;
      const settled = focused || progress >= .85;
      actionsReady.current = settled;
      root.dataset.actionsReady = String(settled);
      root.dataset.keyboardFocus = String(focused);
      root.style.setProperty("--featured-progress", String(progress));
      // The browser receives writes only after a native scroll/measurement event.
      // No perpetual RAF or competing transition follows the scroll position.
      root.toggleAttribute("data-moving", progress > 0 && progress < .85 && !focused);
      clearTimeout(settleTimer);
      if (progress > 0 && progress < .85 && !focused) {
        settleTimer = setTimeout(() => root.removeAttribute("data-moving"), 180);
      }
      const current = Math.min(2, Math.floor(progress * 3));
      cards.current.forEach((card, index) => {
        if (!card) return;
        const local = focused ? 1 : ease((progress - index * .1) / (.65 - index * .025));
        const remaining = 1 - local;
        const x = [8, 0, -8][index] * remaining;
        const y = [0, 24, 48][index] * remaining;
        const z = [60, -72, -125][index] * remaining;
        const rotateY = [1, -3.5, -5.5][index] * remaining;
        const rotateX = [0, 1.5, 2.5][index] * remaining;
        const scale = 1 - [0, .055, .095][index] * remaining;
        card.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
        card.style.opacity = String(1 - [0, .13, .24][index] * remaining);
        card.dataset.current = String(!settled && index === current);
      });
    };

    const schedule = () => {
      if (disposed || frame || document.hidden || !inView) return;
      frame = requestAnimationFrame(update);
    };
    scheduleUpdate.current = schedule;

    const changeMode = () => {
      root.dataset.mode = motion.matches ? "scroll" : "static";
      stopFrame();
      schedule();
    };
    const changeVisibility = () => {
      if (document.hidden) stopFrame();
      else schedule();
    };
    const resumeScroll = () => {
      if (!keyboardFocus.current) return;
      keyboardFocus.current = false;
      root.dataset.keyboardFocus = "false";
      schedule();
    };
    const intersection = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
      inView = entries[0]?.isIntersecting ?? true;
      if (inView) schedule(); else stopFrame();
    }, { rootMargin: "80px 0px", threshold: 0 }) : null;
    intersection?.observe(root);

    const resize = "ResizeObserver" in window ? new ResizeObserver(schedule) : null;
    resize?.observe(root);
    resize?.observe(pinned);
    resize?.observe(plane);
    // An opened chapter, an image or a late font above the scene can alter its
    // position without resizing a photo. Observe the containing flow as well.
    if (root.parentElement) resize?.observe(root.parentElement);
    resize?.observe(document.body);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    root.addEventListener("wheel", resumeScroll, { passive: true });
    root.addEventListener("touchstart", resumeScroll, { passive: true });
    root.addEventListener("pointerdown", resumeScroll, { passive: true });
    document.addEventListener("visibilitychange", changeVisibility);
    plane.addEventListener("load", schedule, true);
    plane.addEventListener("error", schedule, true);
    motion.addEventListener("change", changeMode);
    document.fonts?.addEventListener("loadingdone", schedule);
    void document.fonts?.ready.then(() => { if (!disposed) schedule(); });
    changeMode();

    return () => {
      disposed = true;
      stopFrame();
      intersection?.disconnect();
      resize?.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      root.removeEventListener("wheel", resumeScroll);
      root.removeEventListener("touchstart", resumeScroll);
      root.removeEventListener("pointerdown", resumeScroll);
      document.removeEventListener("visibilitychange", changeVisibility);
      plane.removeEventListener("load", schedule, true);
      plane.removeEventListener("error", schedule, true);
      motion.removeEventListener("change", changeMode);
      document.fonts?.removeEventListener("loadingdone", schedule);
      scheduleUpdate.current = null;
      root.removeAttribute("data-mode");
      root.removeAttribute("data-actions-ready");
      root.removeAttribute("data-keyboard-focus");
      root.style.removeProperty("--featured-progress");
      cards.current.forEach(card => {
        card?.style.removeProperty("transform");
        card?.style.removeProperty("opacity");
        card?.removeAttribute("data-current");
      });
    };
  }, [recordKey]);

  const focusScene = (event: FocusEvent<HTMLDivElement>) => {
    // Focusing an action immediately brings every card to a readable plane.
    // Buttons stay in the tab order even while native scrolling is in progress.
    if (!(event.target instanceof HTMLElement) || !event.target.matches(":focus-visible")) return;
    keyboardFocus.current = true;
    if (scene.current) scene.current.dataset.keyboardFocus = "true";
    scheduleUpdate.current?.();
  };
  const blurScene = (event: FocusEvent<HTMLDivElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    keyboardFocus.current = false;
    if (scene.current) scene.current.dataset.keyboardFocus = "false";
    scheduleUpdate.current?.();
  };

  if (!visibleRecords.length) return null;
  return <div ref={scene} className="featured-history spofy-featured-scene" aria-labelledby="featured-history-title">
    <div ref={sticky} className="featured-story-sticky">
      <div className="featured-story-heading">
        <div><p className="featured-story-eyebrow">KÝ ỨC TRONG TƯ LIỆU</p><h3 id="featured-history-title">Dấu mốc nổi bật</h3></div>
        <p>Ba lối vào hành trình SPOFY.<br /><span className="featured-scroll-hint">Cuộn để những ký ức cùng hiện rõ.</span><span className="featured-static-hint">Mở album để xem những bức ảnh trong từng nhóm.</span></p>
      </div>
      <div ref={stage} className="featured-memory-stage" onFocusCapture={focusScene} onBlurCapture={blurScene}>
        {visibleRecords.map((record, index) => <div className="featured-memory-reveal" key={record.id} data-reveal style={{ "--reveal-index": index } as CSSProperties}>
          <article className="featured-memory-card" ref={element => { cards.current[index] = element; }} data-event-id={record.id}>
            <div className="featured-memory-photo"><ArchiveImage src={record.photo.src} srcSet={record.photo.srcSet} sizes="(max-width: 900px) 90vw, 45vw" alt={record.photo.alt} width={record.photo.width} height={record.photo.height} fit="contain" aspectRatio="3 / 2" loading="lazy" /></div>
            <div className="featured-memory-copy">
              <p className="featured-memory-date"><span>{record.year}</span><span>{record.dateKind === "event_date" ? "Sự kiện" : "Đăng ảnh"}</span></p>
              <h4>{record.name}</h4>
              {record.description && <p className="featured-memory-description">{record.description}</p>}
              <p className="featured-memory-count">{number(record.photoCount)} ảnh trong tư liệu</p>
              <div className="featured-memory-actions">
                <button type="button" onClick={() => { if (actionsReady.current || keyboardFocus.current) onOpenAlbum(record.id); }} aria-label={`Mở album ${record.name}`}>Mở album <span aria-hidden="true">↗</span></button>
                <a href={record.source_url} target="_blank" rel="noopener noreferrer" aria-label={`Nguồn Facebook: ${record.name}`}>Facebook gốc <span aria-hidden="true">↗</span></a>
              </div>
            </div>
          </article>
        </div>)}
      </div>
      <div className="featured-story-track" aria-hidden="true"><span /><span /><span /></div>
    </div>
  </div>;
}
