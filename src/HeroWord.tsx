import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ArchiveImage } from "./ArchiveImage";
import { MagneticWord3D } from "./MagneticWord3D";
import { displayTitle } from "./archiveDisplay";
import "./hero-word.css";

// These records also drive the full history. Source titles, IDs and dates stay intact.
export type HeroTimelineEvent = {
  id: string; name: string; displayTitle?: string; summary?: string; image: string;
  timeline_date: string; timeline_date_kind: "event_date" | "posted_date"; date_notes: string[];
};
export interface Milestone {
  id: string; year: string; title: string; originalTitle: string; description: string;
  image: string; branchAngle: number; date: string;
  dateKind: HeroTimelineEvent["timeline_date_kind"]; dateNote: string;
}
type Point = { x: number; y: number };
type Geometry = { width: number; mobile: boolean; count: number; starts: Point[]; ends: Point[] };
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const dateLabel = (value: string) => value.split("-").reverse().join(".");

export function HeroWord({ events, loading, onActiveChange, dismissSignal = 0 }: {
  events: HeroTimelineEvent[]; loading: boolean; onActiveChange: (active: boolean) => void; dismissSignal?: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const layer = useRef<HTMLElement>(null);
  const track = useRef<HTMLOListElement>(null);
  const [open, setOpen] = useState(false);
  const [present, setPresent] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [phase, setPhase] = useState<"closed" | "opening" | "open" | "closing">("closed");
  const [pulse, setPulse] = useState(0);
  const [page, setPage] = useState(0);
  const [geometry, setGeometry] = useState<Geometry>({ width: 1000, mobile: false, count: 5, starts: [], ends: [] });
  const [mobileIndex, setMobileIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const [imageRetries, setImageRetries] = useState<Record<string, number>>({});
  const requestedMobileIndex = useRef<number | null>(null);
  const centers = useRef<Point[]>([]);
  const reduced = useRef(false);
  const count = geometry.count;
  const pageCount = Math.max(1, Math.ceil(events.length / count));
  const safePage = Math.min(page, pageCount - 1);
  const milestones: Milestone[] = useMemo(() => events.map((event, index) => ({
    id: event.id, year: event.timeline_date.slice(0, 4), title: event.displayTitle ?? displayTitle(event.name),
    originalTitle: event.name, description: event.summary ?? "", image: event.image,
    branchAngle: -60 + (index % count) * 120 / Math.max(1, Math.min(count, events.length) - 1),
    date: event.timeline_date, dateKind: event.timeline_date_kind, dateNote: event.date_notes.join(" "),
  })), [events, count]);
  const shown = milestones.slice(safePage * count, (safePage + 1) * count);

  const close = useCallback(() => setOpen(false), []);
  const restoreFocus = useCallback(() => {
    setOpen(false); (opener.current ?? trigger.current)?.focus({ preventScroll: true });
  }, []);
  const toggle = (button: HTMLButtonElement) => {
    if (!open) opener.current = button;
    setOpen(value => !value);
  };

  const measure = useCallback(() => {
    const button = trigger.current, scene = root.current;
    if (!button || !scene) return;
    const box = button.getBoundingClientRect(), sceneBox = scene.getBoundingClientRect();
    centers.current = letterRefs.current.map(letter => ({
      x: box.left + (letter?.offsetLeft ?? 0) + (letter?.offsetWidth ?? 0) / 2, y: box.top + box.height / 2,
    }));
    const width = sceneBox.width, mobile = window.innerWidth < 700;
    const slots = window.innerWidth >= 1100 || mobile ? 5 : 3;
    const gap = 14, cardWidth = (width - (slots - 1) * gap) / slots;
    const panelTop = layer.current && !layer.current.hidden ? layer.current.getBoundingClientRect().top : box.bottom + 68;
    const starts = Array.from({ length: slots }, (_, index) => {
      const letterIndex = Math.round(index * 4 / (slots - 1));
      return { x: centers.current[letterIndex].x - sceneBox.left, y: Math.max(0, box.bottom - panelTop - box.height * .1) };
    });
    const ends = Array.from({ length: slots }, (_, index) => ({ x: mobile ? width / 2 : cardWidth / 2 + index * (cardWidth + gap), y: 84 }));
    const next = { width, mobile, count: slots, starts, ends };
    setGeometry(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
  }, []);

  useEffect(() => { onActiveChange(present); }, [present, onActiveChange]);
  useEffect(() => { setOpen(false); }, [dismissSignal]);
  useLayoutEffect(() => { measure(); }, [measure, present, expanded]);
  useEffect(() => {
    // Keep the same section mounted while its transforms reverse. The target
    // state changes immediately; hidden waits until the last exit has finished.
    let start = 0, finish = 0;
    if (open) {
      setPresent(true); setPhase("opening"); setPulse(value => value + 1);
      start = window.setTimeout(() => setExpanded(true), reduced.current ? 0 : 140);
      finish = window.setTimeout(() => setPhase("open"), reduced.current ? 40 : 1000);
    } else if (present) {
      setExpanded(false); setPhase("closing");
      finish = window.setTimeout(() => { setPresent(false); setPhase("closed"); }, reduced.current ? 40 : 650);
    }
    return () => { window.clearTimeout(start); window.clearTimeout(finish); };
    // `present` is intentionally a rendered phase, not a new animation target.
    // It must not restart an in-flight open/close transition.
  }, [open]);
  useLayoutEffect(() => {
    if (!geometry.mobile || requestedMobileIndex.current === null || !track.current) return;
    const index = clamp(requestedMobileIndex.current, 0, Math.max(0, shown.length - 1));
    const items = Array.from(track.current.children) as HTMLElement[];
    track.current.scrollTo({ left: (items[index]?.offsetLeft ?? 0) - (items[0]?.offsetLeft ?? 0), behavior: "instant" });
    setMobileIndex(index); requestedMobileIndex.current = null;
  }, [safePage, count, geometry.mobile, shown.length]);
  useEffect(() => {
    const scene = root.current, button = trigger.current;
    if (!scene || !button) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.current = reduceMotion.matches;
    let alive = true;
    const motionChange = () => { reduced.current = reduceMotion.matches; };
    let lastSceneWidth = -1, lastButtonWidth = -1, lastButtonHeight = -1;
    const observer = new ResizeObserver(entries => {
      // Expanding the history changes scene height each frame. Only typography
      // or a horizontal resize can move the stable branch anchors.
      let changed = false;
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (entry.target === scene && Math.abs(width - lastSceneWidth) > .25) {
          lastSceneWidth = width; changed = true;
        } else if (entry.target === button && (Math.abs(width - lastButtonWidth) > .25 || Math.abs(height - lastButtonHeight) > .25)) {
          lastButtonWidth = width; lastButtonHeight = height; changed = true;
        }
      }
      if (changed) measure();
    });
    observer.observe(scene); observer.observe(button);
    window.addEventListener("resize", measure);
    reduceMotion.addEventListener("change", motionChange);
    document.fonts.ready.then(() => { if (alive) measure(); });
    return () => {
      alive = false; observer.disconnect();
      window.removeEventListener("resize", measure);
      reduceMotion.removeEventListener("change", motionChange);
    };
  }, [measure]);

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !document.querySelector("dialog[open], [role='dialog'][aria-modal='true']")) {
        event.preventDefault(); restoreFocus();
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open, restoreFocus]);

  const changePage = (nextPage: number, index = 0) => {
    requestedMobileIndex.current = index;
    setPage(clamp(nextPage, 0, pageCount - 1)); setMobileIndex(index);
    if (!geometry.mobile) track.current?.scrollTo({ left: 0, behavior: "instant" });
  };
  const step = (direction: number) => {
    const next = mobileIndex + direction;
    if (geometry.mobile && next >= 0 && next < shown.length) {
      const item = track.current?.children[next] as HTMLElement | undefined;
      const first = track.current?.children[0] as HTMLElement | undefined;
      if (item && track.current) track.current.scrollTo({ left: item.offsetLeft - (first?.offsetLeft ?? 0), behavior: reduced.current ? "instant" : "smooth" });
      setMobileIndex(next);
    } else changePage(safePage + direction, geometry.mobile && direction < 0 ? count - 1 : 0);
  };
  const atStart = safePage === 0 && (!geometry.mobile || mobileIndex === 0);
  const atEnd = safePage === pageCount - 1 && (!geometry.mobile || mobileIndex === shown.length - 1);

  return <div className={`spofy-word-scene${open ? " is-open" : ""}`} ref={root} data-word-open={open} data-word-state={phase}>
    <span className="spofy-word-glow" aria-hidden="true" />
    <h1 className="spofy-hero-word spofy-wordmark" aria-label="SPOFY">
      <button type="button" className="spofy-word-trigger" ref={trigger} aria-label={open ? "SPOFY — đóng dấu mốc" : "SPOFY — mở dấu mốc"}
        aria-expanded={open} aria-controls="spofy-hero-timeline" onClick={event => toggle(event.currentTarget)}>
        <MagneticWord3D pulse={pulse} />
        {"SPOFY".split("").map((letter, index) => <span className="spofy-word-glyph spofy-letter" key={letter}
          data-letter={letter} data-index={index} ref={node => { letterRefs.current[index] = node; }} aria-hidden="true"><span className="spofy-word-face">{letter}</span></span>)}
      </button><span className="spofy-hero-word-star" aria-hidden="true">✳</span>
    </h1>
    <div className="spofy-word-action"><button type="button" className="spofy-word-open" aria-expanded={open}
      aria-controls="spofy-hero-timeline" onClick={event => toggle(event.currentTarget)}>{open ? "Đóng dấu mốc" : "Mở dấu mốc"}<span aria-hidden="true">{open ? "−" : "+"}</span></button></div>
    <div className="spofy-branch-expansion" data-present={present} data-expanded={expanded}>
    <div className="spofy-branch-expansion-inner">
    <section ref={layer} id="spofy-hero-timeline" hidden={!present} inert={!open || !expanded} aria-hidden={!open || !expanded}
      className={`spofy-branch-layer${expanded ? " is-open" : ""}${phase === "closing" ? " is-closing" : ""}${geometry.mobile ? " is-mobile" : ""}`} aria-label="Dấu mốc từ kho tư liệu SPOFY">
      <svg className="spofy-branches" viewBox={`0 0 ${geometry.width} 84`} preserveAspectRatio="none" aria-hidden="true">
        <defs>{shown.map((milestone, index) => {
          const start = geometry.starts[index], end = geometry.ends[index];
          return start && end && <linearGradient id={`branch-${milestone.id}`} key={milestone.id} gradientUnits="userSpaceOnUse" x1={start.x} y1={start.y} x2={end.x} y2={end.y}>
            <stop stopColor="#ff6a3d" /><stop offset="1" stopColor="#ffac82" stopOpacity=".35" /></linearGradient>;
        })}</defs>
        {shown.map((milestone, index) => {
          if (geometry.mobile && index !== mobileIndex) return null;
          const start = geometry.starts[index], end = geometry.ends[index]; if (!start || !end) return null;
          const bend = Math.sin(milestone.branchAngle * Math.PI / 180) * 28;
          const path = `M ${start.x} ${start.y} C ${start.x + bend} ${start.y + 56}, ${end.x - bend} ${end.y - 32}, ${end.x} ${end.y}`;
          return <g key={`${safePage}-${milestone.id}`} style={{ "--branch-delay": `${index * 60}ms`, "--branch-index": index, "--branch-reverse-index": shown.length - index - 1 } as CSSProperties}>
            <path className="spofy-branch-path" d={path} pathLength="1" stroke={`url(#branch-${milestone.id})`} /><circle className="spofy-branch-tip" cx={end.x} cy={end.y} r="3" /></g>;
        })}
      </svg>
      <button className="spofy-branch-close" type="button" onClick={restoreFocus} aria-label="Đóng dấu mốc">×</button>
      <ol ref={track} className="spofy-branch-nodes" aria-label="Chọn một nhóm để xem đúng hoạt động trong hành trình" style={{ "--branch-count": count } as CSSProperties}
        onScroll={event => {
          if (!geometry.mobile) return;
          const items = Array.from(event.currentTarget.children) as HTMLElement[];
          const left = event.currentTarget.scrollLeft + (items[0]?.offsetLeft ?? 0);
          const nearest = items.reduce((best, item, index) => Math.abs(item.offsetLeft - left) < Math.abs((items[best]?.offsetLeft ?? 0) - left) ? index : best, 0); setMobileIndex(nearest);
        }}>
        {shown.map((milestone, index) => <li key={`${safePage}-${milestone.id}`} className={`spofy-branch-node${failedImages.has(milestone.id) ? " has-image-error" : ""}`} style={{ "--node-delay": `${330 + index * 60}ms`, "--branch-index": index, "--branch-reverse-index": shown.length - index - 1 } as CSSProperties}>
          <a className="spofy-branch-card" href={`#${milestone.id}`} data-event-id={milestone.id} onClick={close} aria-label={`Xem nhóm hoạt động: ${milestone.title}`} title={milestone.originalTitle}>
            <div className="spofy-branch-card-heading"><ArchiveImage src={milestone.image} alt={milestone.title} className="spofy-branch-image" width={76} height={76} aspectRatio={1} fit="contain" interactive={false} loading="lazy" retryKey={imageRetries[milestone.id] ?? 0}
              onError={() => setFailedImages(previous => new Set(previous).add(milestone.id))}
              onLoad={() => setFailedImages(previous => { if (!previous.has(milestone.id)) return previous; const next = new Set(previous); next.delete(milestone.id); return next; })} />
              <time dateTime={milestone.date}><strong>{milestone.year}</strong><span>{milestone.dateKind === "event_date" ? "Diễn ra" : "Đăng ảnh"}<br />{dateLabel(milestone.date)}</span></time></div>
            <h3>{milestone.title}</h3>{milestone.description && <p>{milestone.description}</p>}
            <span className="spofy-branch-card-link">Xem nhóm hoạt động <span aria-hidden="true">↗</span></span>
            {milestone.dateNote && <span className="spofy-branch-date-note">Có ghi chú thời gian</span>}
          </a>
          {failedImages.has(milestone.id) && <button type="button" className="spofy-branch-retry" onClick={() => {
            setFailedImages(previous => { const next = new Set(previous); next.delete(milestone.id); return next; });
            setImageRetries(previous => ({ ...previous, [milestone.id]: (previous[milestone.id] ?? 0) + 1 }));
          }}>Thử tải lại ảnh</button>}
        </li>)}
      </ol>
      <div className="spofy-branch-controls"><p className="spofy-branch-caption" role="status">{events.length
        ? geometry.mobile ? `${safePage * count + mobileIndex + 1} / ${events.length} nhóm hoạt động` : `${safePage * count + 1}–${Math.min((safePage + 1) * count, events.length)} / ${events.length} nhóm hoạt động`
        : loading ? "Đang tải kho tư liệu…" : "Chưa tải được dấu mốc"}</p>
        <div className="spofy-branch-buttons"><button type="button" onClick={() => step(-1)} disabled={atStart || !events.length} aria-label={geometry.mobile ? "Nhóm hoạt động trước" : "Các nhóm hoạt động trước"}>← <span>Trước</span></button>
          <button type="button" onClick={() => step(1)} disabled={atEnd || !events.length} aria-label={geometry.mobile ? "Nhóm hoạt động tiếp theo" : "Các nhóm hoạt động tiếp theo"}><span>Sau</span> →</button></div>
        <a className="spofy-branch-all" href="#history" onClick={close}>Toàn bộ hành trình <span aria-hidden="true">↗</span></a>
      </div>
    </section>
    </div></div>
  </div>;
}
