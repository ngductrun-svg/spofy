import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Scene } from "./Scene";
import { ArchiveImage } from "./ArchiveImage";
import { archiveAsset, archiveCatalogURL } from "./archiveAssets";
import { displayTitle } from "./archiveDisplay";
import { FeaturedHistory } from "./FeaturedHistory";
import { MotionNumber } from "./MotionNumber";
import { ScienceIntro } from "./science";
import type { CSSProperties } from "react";

type EventGroup = {
  id: string; name: string; summary?: string; photo_count: number;
  event_dates: string[]; posted_dates: string[]; timeline_date: string;
  timeline_date_kind: "event_date" | "posted_date"; date_notes: string[];
  source_urls: string[]; photo_ids: string[]; representative_photo_ids: string[];
};
type Photo = {
  id: string; name: string; file: string; event_id: string; event: string;
  event_date: string | null; posted_date: string; date_note: string;
  photo_source: string; event_source: string; alt: string; image: string;
  thumb: string; width: number; height: number;
};
type Archive = { events: EventGroup[]; photos: Photo[] };
type Scope = { ids: string[]; kind: "album" | "results"; eventId?: string };

const facebook = "https://www.facebook.com/spofy.sofia";
const date = (value?: string | null) => value ? value.split("-").reverse().join(".") : "Chưa xác định";
const count = (value: number) => value.toLocaleString("vi-VN");
const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi").replace(/đ/g, "d");
const yearOf = (photo: Photo) => (photo.event_date || photo.posted_date || "").slice(0, 4);
const featuredIds = ["event-01", "event-39", "event-51"];
const covers: Record<string, string> = {
  "event-06": "2943277732563336", "event-19": "3597281073829662", "event-27": "139132372053408",
  "event-39": "448405177786849", "event-40": "1190515168964915", "event-48": "971677545459607",
  "event-49": "1871026064247152", "event-51": "1903481897668235",
};
const cardDate = (event: EventGroup) => event.timeline_date_kind === "event_date"
  ? date(event.timeline_date) : event.posted_dates.map(value => date(value)).join(" · ");
const Arrow = () => <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" stroke="currentColor" strokeWidth="1.5" /></svg>;

export default function App() {
  const [data, setData] = useState<Archive | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [expandedYears, setExpandedYears] = useState<Set<string>>(() => new Set());
  const [activeYear, setActiveYear] = useState("");
  const [anchorRequest, setAnchorRequest] = useState<{ id: string; serial: number; behavior: ScrollBehavior } | null>(null);
  const [yearFilter, setYearFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(36);
  const [scope, setScope] = useState<Scope>({ ids: [], kind: "results" });
  const [photoIndex, setPhotoIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [lastLoadedPhoto, setLastLoadedPhoto] = useState<Photo | null>(null);
  const [outgoingPhoto, setOutgoingPhoto] = useState<Photo | null>(null);
  const [lightboxFailedId, setLightboxFailedId] = useState("");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const [imageRetries, setImageRetries] = useState<Record<string, number>>({});
  const [pendingAlbum, setPendingAlbum] = useState<{ group?: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const railShell = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLElement>(null);
  const pageFocusRequested = useRef(false);
  const lastLoadedPhotoRef = useRef<Photo | null>(null);
  const dialogAnimation = useRef<Animation | null>(null);
  const dialogClosing = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(archiveCatalogURL(), { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((archive: Archive) => {
        if (!Array.isArray(archive.events) || !Array.isArray(archive.photos) || !archive.photos.length) throw new Error("Dữ liệu chưa đầy đủ");
        setData(archive);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Lỗi kết nối");
        setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);

  const photoMap = useMemo(() => new Map((data?.photos ?? []).map(photo => [photo.id, photo])), [data]);
  const eventMap = useMemo(() => new Map((data?.events ?? []).map(event => [event.id, event])), [data]);
  const years = useMemo(() => [...new Set((data?.events ?? []).map(event => event.timeline_date.slice(0, 4)).filter(Boolean))].sort(), [data]);
  const dateRange = years.length ? `${years[0]}–${years[years.length - 1]}` : "…";
  const groupsByYear = useMemo(() => new Map(years.map(year => [year, (data?.events ?? []).filter(event => event.timeline_date.startsWith(year))])), [years, data]);
  const getCover = useCallback((event: EventGroup) => photoMap.get(covers[event.id] || event.representative_photo_ids[0] || event.photo_ids[0]), [photoMap]);
  const heroEvents = useMemo(() => (data?.events ?? []).map(event => {
    const cover = getCover(event);
    return { ...event, displayTitle: displayTitle(event.name), image: cover ? archiveAsset(cover.thumb) : "" };
  }), [data, getCover]);
  const featured = useMemo(() => featuredIds.map(id => eventMap.get(id)).filter((event): event is EventGroup => !!event), [eventMap]);
  const featuredRecords = useMemo(() => featured.map(event => {
    const photo = getCover(event);
    return { id: event.id, name: displayTitle(event.name), year: event.timeline_date.slice(0, 4), dateKind: event.timeline_date_kind,
      photo: { src: photo ? archiveAsset(photo.image) : "", alt: photo?.alt || event.name, width: photo?.width, height: photo?.height },
      photoCount: event.photo_count, source_url: event.source_urls[0] || facebook };
  }), [featured, getCover]);
  const sortedPhotos = useMemo(() => {
    if (!data) return [];
    const ordered = [...data.photos].sort((a, b) => (b.event_date || b.posted_date || "").localeCompare(a.event_date || a.posted_date || ""));
    const representatives = new Set(data.events.map(event => covers[event.id] || event.representative_photo_ids[0]));
    return [...ordered.filter(photo => representatives.has(photo.id)), ...ordered.filter(photo => !representatives.has(photo.id))];
  }, [data]);
  const filtered = useMemo(() => {
    const search = fold(query.trim());
    return sortedPhotos.filter(photo => (yearFilter === "all" || yearOf(photo) === yearFilter)
      && (eventFilter === "all" || photo.event_id === eventFilter)
      && (!search || fold(`${photo.event} ${photo.name} ${photo.file} ${photo.id}`).includes(search)));
  }, [sortedPhotos, query, yearFilter, eventFilter]);
  const availableEvents = useMemo(() => {
    const matching = new Set((data?.photos ?? []).filter(photo => yearFilter === "all" || yearOf(photo) === yearFilter).map(photo => photo.event_id));
    return (data?.events ?? []).filter(event => matching.has(event.id));
  }, [data, yearFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageStart = (safePage - 1) * pageSize;
  const visiblePhotos = filtered.slice(pageStart, pageStart + pageSize);
  const currentPhoto = photoMap.get(scope.ids[photoIndex]);
  const currentGroup = currentPhoto ? eventMap.get(currentPhoto.event_id) : undefined;
  const lightboxReady = !!currentPhoto && lastLoadedPhoto?.id === currentPhoto.id;
  const lightboxFailed = !!currentPhoto && lightboxFailedId === currentPhoto.id;
  const previousFrame = lightboxReady ? outgoingPhoto : lastLoadedPhoto;

  // Expand destinations first; CSS scroll-margin owns all header offsets.
  const requestAnchor = useCallback((id: string, behavior: ScrollBehavior = "auto") => {
    if (!id) return;
    const event = eventMap.get(id);
    const year = event?.timeline_date.slice(0, 4) || (id.startsWith("year-") ? id.slice(5) : "");
    if (year && years.includes(year)) {
      setJourneyOpen(true);
      setExpandedYears(previous => new Set(previous).add(year));
      setActiveYear(year);
    }
    setAnchorRequest(previous => ({ id, behavior, serial: (previous?.serial ?? 0) + 1 }));
  }, [eventMap, years]);

  // The menu calls this after its exit; pushState avoids a premature native jump.
  const navigateFromMenu = useCallback((id: string) => {
    if (!id) return;
    const fragment = `#${encodeURIComponent(id)}`;
    if (location.hash !== fragment) history.pushState(null, "", fragment);
    requestAnchor(id, "smooth");
  }, [requestAnchor]);

  useEffect(() => {
    if (!data) return;
    const fromHash = () => {
      try { requestAnchor(decodeURIComponent(location.hash.slice(1))); } catch { /* Ignore malformed fragments. */ }
    };
    const fromLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="#"]') : null;
      if (anchor?.hash) {
        try { requestAnchor(decodeURIComponent(anchor.hash.slice(1))); } catch { /* Keep native behavior. */ }
      }
    };
    window.addEventListener("hashchange", fromHash);
    window.addEventListener("popstate", fromHash);
    document.addEventListener("click", fromLink);
    fromHash();
    return () => {
      window.removeEventListener("hashchange", fromHash);
      window.removeEventListener("popstate", fromHash);
      document.removeEventListener("click", fromLink);
    };
  }, [data, requestAnchor]);

  useLayoutEffect(() => {
    if (!anchorRequest) return;
    let cancelled = false;
    let frame = 0;
    const scrollWhenMeasured = () => {
      if (cancelled) return;
      // Give the header / rail ResizeObservers a frame after expanded content mounts.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (cancelled) return;
          const target = document.getElementById(anchorRequest.id);
          if (!target) return;
          target.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : anchorRequest.behavior, block: "start" });
          // Section navigation leaves the next Tab at its destination, not in an inert menu.
          if (anchorRequest.behavior === "smooth") {
            const temporaryTabIndex = !target.hasAttribute("tabindex") && !target.matches("a[href], button, input, select, textarea, summary, [contenteditable='true']");
            if (temporaryTabIndex) {
              target.setAttribute("tabindex", "-1");
              target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
            }
            target.focus({ preventScroll: true });
          }
        });
      });
    };
    if (document.fonts?.status === "loading") void document.fonts.ready.then(scrollWhenMeasured);
    else scrollWhenMeasured();
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [anchorRequest]);

  useLayoutEffect(() => {
    const element = railShell.current;
    const mobile = window.matchMedia("(max-width: 900px)");
    const measure = () => document.documentElement.style.setProperty("--year-rail-height", `${journeyOpen && mobile.matches && element ? Math.ceil(element.getBoundingClientRect().height) : 0}px`);
    measure();
    const observer = element && "ResizeObserver" in window ? new ResizeObserver(measure) : null;
    if (element) observer?.observe(element);
    mobile.addEventListener("change", measure);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      mobile.removeEventListener("change", measure);
      window.removeEventListener("resize", measure);
      document.documentElement.style.setProperty("--year-rail-height", "0px");
    };
  }, [journeyOpen, data]);

  useEffect(() => {
    if (!journeyOpen) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const styles = getComputedStyle(document.documentElement);
      const line = parseFloat(styles.getPropertyValue("--header-height")) + parseFloat(styles.getPropertyValue("--year-rail-height")) + 32;
      const nodes = years.map(year => document.getElementById(`year-${year}`)).filter((node): node is HTMLElement => !!node);
      const current = [...nodes].reverse().find(node => node.getBoundingClientRect().top <= (Number.isFinite(line) ? line : 140)) || nodes[0];
      if (current) setActiveYear(current.id.slice(5));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    update();
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); };
  }, [journeyOpen, years, expandedYears]);

  useEffect(() => {
    const node = rail.current;
    const selected = node?.querySelector<HTMLElement>(`a[data-year="${activeYear}"]`);
    if (!node || !selected || !window.matchMedia("(max-width: 900px)").matches) return;
    if (selected.offsetLeft < node.scrollLeft || selected.offsetLeft + selected.offsetWidth > node.scrollLeft + node.clientWidth) {
      node.scrollTo({ left: selected.offsetLeft - (node.clientWidth - selected.offsetWidth) / 2, behavior: "auto" });
    }
  }, [activeYear, journeyOpen]);

  const launch = useCallback((nextScope: Scope, initialId?: string, keepOpener = false) => {
    if (!nextScope.ids.length) return;
    if (!keepOpener) opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setScope(nextScope);
    setPhotoIndex(Math.max(0, initialId ? nextScope.ids.indexOf(initialId) : 0));
    setPlaying(false);
    lastLoadedPhotoRef.current = null;
    setLastLoadedPhoto(null);
    setOutgoingPhoto(null);
    setLightboxFailedId("");
    setModalOpen(true);
  }, []);
  const openAlbum = useCallback((group?: string) => {
    if (!data) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setPendingAlbum({ group });
      document.getElementById("gallery")?.scrollIntoView({ behavior: "auto" });
      return;
    }
    const event = eventMap.get(group ?? "");
    launch(event ? { ids: event.photo_ids, kind: "album", eventId: event.id } : { ids: sortedPhotos.map(photo => photo.id), kind: "results" }, event ? getCover(event)?.id : undefined);
  }, [data, eventMap, sortedPhotos, launch, getCover]);
  useEffect(() => {
    if (!data || !pendingAlbum) return;
    const event = eventMap.get(pendingAlbum.group ?? "");
    launch(event ? { ids: event.photo_ids, kind: "album", eventId: event.id } : { ids: sortedPhotos.map(photo => photo.id), kind: "results" }, event ? getCover(event)?.id : undefined, true);
    setPendingAlbum(null);
  }, [data, pendingAlbum, eventMap, sortedPhotos, launch, getCover]);
  const movePhoto = useCallback((direction: number) => {
    if (scope.ids.length) setPhotoIndex(index => (index + direction + scope.ids.length) % scope.ids.length);
  }, [scope.ids.length]);
  const closeModal = useCallback(() => {
    setPlaying(false);
    const modal = dialog.current;
    if (!modal?.open || dialogClosing.current) return;
    dialogClosing.current = true;
    dialogAnimation.current?.cancel();
    const finish = () => {
      dialogAnimation.current = null;
      dialogClosing.current = false;
      if (modal.open) modal.close();
      delete modal.dataset.phase;
      setModalOpen(false);
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || typeof modal.animate !== "function") { finish(); return; }
    modal.dataset.phase = "closing";
    const animation = modal.animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.97)" }], {
      duration: parseFloat(getComputedStyle(modal).getPropertyValue("--motion-fast")) || 200,
      easing: getComputedStyle(modal).getPropertyValue("--ease").trim(), fill: "forwards",
    });
    dialogAnimation.current = animation;
    void animation.finished.then(() => { if (dialogAnimation.current === animation) { finish(); animation.cancel(); } }).catch(() => {});
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { setReducedMotion(media.matches); if (media.matches) setPlaying(false); };
    const onVisibility = () => { if (document.hidden) setPlaying(false); };
    update();
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { media.removeEventListener("change", update); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  useEffect(() => {
    const modal = dialog.current;
    if (!modalOpen || !currentPhoto || !modal) return;
    if (!modal.open) modal.showModal();
    dialogClosing.current = false;
    modal.dataset.phase = "open";
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches && typeof modal.animate === "function") {
      const animation = modal.animate([{ opacity: 0, transform: "scale(.97)" }, { opacity: 1, transform: "scale(1)" }], {
        duration: parseFloat(getComputedStyle(modal).getPropertyValue("--motion-dialog")) || 260,
        easing: getComputedStyle(modal).getPropertyValue("--ease").trim(),
      });
      dialogAnimation.current = animation;
      void animation.finished.then(() => { if (dialogAnimation.current === animation) dialogAnimation.current = null; }).catch(() => {});
    }
    closeButton.current?.focus();
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = priorOverflow;
      dialogAnimation.current?.cancel(); dialogAnimation.current = null; dialogClosing.current = false;
      delete modal.dataset.phase;
      if (modal.open) modal.close();
    };
  }, [modalOpen, !!currentPhoto]);

  useEffect(() => {
    if (!playing || !modalOpen || reducedMotion || scope.ids.length < 2 || document.hidden) return;
    const timer = window.setInterval(() => movePhoto(1), 5000);
    return () => window.clearInterval(timer);
  }, [playing, modalOpen, reducedMotion, scope.ids.length, movePhoto]);

  useEffect(() => {
    if (!modalOpen || scope.ids.length < 2 || document.hidden) return;
    const adjacentIds = new Set([scope.ids[(photoIndex + scope.ids.length - 1) % scope.ids.length], scope.ids[(photoIndex + 1) % scope.ids.length]]);
    adjacentIds.delete(scope.ids[photoIndex]);
    const images = [...adjacentIds].map(id => {
      const image = new Image();
      const photo = photoMap.get(id);
      if (photo) image.src = archiveAsset(photo.image);
      return image;
    });
    return () => images.forEach(image => { image.src = ""; });
  }, [modalOpen, photoIndex, scope.ids, photoMap]);

  useEffect(() => { setPage(1); }, [query, yearFilter, eventFilter]);
  useLayoutEffect(() => {
    if (!pageFocusRequested.current) return;
    pageFocusRequested.current = false;
    const frame = requestAnimationFrame(() => {
      document.getElementById("gallery-results")?.scrollIntoView({ behavior: "auto", block: "start" });
      document.getElementById("gallery-results-heading")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [page, pageSize]);
  const changePage = (next: number) => { pageFocusRequested.current = true; setPage(Math.max(1, Math.min(pageCount, next))); };
  const resetFilters = () => { setQuery(""); setYearFilter("all"); setEventFilter("all"); setPage(1); };
  const markImage = (instanceKey: string, failed: boolean) => setFailedImages(previous => {
    if (previous.has(instanceKey) === failed) return previous;
    const next = new Set(previous);
    if (failed) next.add(instanceKey); else next.delete(instanceKey);
    return next;
  });
  const retryImage = (instanceKey: string) => { markImage(instanceKey, false); setImageRetries(previous => ({ ...previous, [instanceKey]: (previous[instanceKey] ?? 0) + 1 })); };

  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>("[data-reveal]:not(.revealed)");
    if (!("IntersectionObserver" in window) || reducedMotion) { nodes.forEach(node => node.classList.add("revealed")); return; }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.remove("reveal-pending"); entry.target.classList.add("revealed"); observer.unobserve(entry.target); }
    }), { threshold: .06 });
    nodes.forEach(node => {
      if (node.getClientRects().length) { node.classList.add("reveal-pending"); observer.observe(node); }
    });
    return () => { observer.disconnect(); nodes.forEach(node => node.classList.remove("reveal-pending")); };
  }, [data, safePage, pageSize, query, yearFilter, eventFilter, loading, journeyOpen, expandedYears, reducedMotion]);

  const renderImage = (photo: Photo, instanceKey: string, className?: string, full = false, interactive = false) => <ArchiveImage
    src={archiveAsset(full ? photo.image : photo.thumb)} alt={photo.alt || displayTitle(photo.event)}
    width={photo.width} height={photo.height} loading={full ? "eager" : "lazy"}
    className={className} fit="contain" interactive={interactive} retryKey={imageRetries[instanceKey] ?? 0}
    onError={() => markImage(instanceKey, true)} onLoad={() => markImage(instanceKey, false)}
  />;
  const imageRetry = (photo: Photo | undefined, instanceKey: string) => photo && failedImages.has(instanceKey)
    ? <button type="button" className="photo-retry" onClick={() => retryImage(instanceKey)}>Thử tải lại ảnh · {displayTitle(photo.event)}</button> : null;
  const renderEvent = (event: EventGroup) => {
    const cover = getCover(event);
    const imageKey = `event:${event.id}`;
    return <article id={event.id} className="archive-event-card" key={event.id} data-event-id={event.id} data-reveal>
      <button type="button" className="archive-event-image" onClick={() => openAlbum(event.id)} aria-label={`Mở album ${displayTitle(event.name)}`}>
        {cover && renderImage(cover, imageKey)}<span className="event-image-count">{count(event.photo_count)} ảnh</span><span className="event-image-arrow"><Arrow /></span>
      </button>
      {imageRetry(cover, imageKey)}
      <div className="archive-event-copy">
        <p className="event-date"><span>{event.timeline_date_kind === "event_date" ? "Sự kiện" : "Đăng ảnh"}</span><span>{cardDate(event)}</span></p>
        <h4>{displayTitle(event.name)}</h4>
        {event.date_notes.length > 0 && <details className="event-date-note"><summary>Về mốc thời gian</summary>{event.date_notes.map((note, index) => <p key={index}>{note}</p>)}</details>}
        <div className="event-card-actions"><button type="button" className="text-link" onClick={() => openAlbum(event.id)}>Mở album<span aria-hidden="true">↗</span></button><a href={event.source_urls[0] || cover?.photo_source || facebook} target="_blank" rel="noopener noreferrer" aria-label={`Nguồn Facebook: ${displayTitle(event.name)}`}>Facebook gốc ↗</a></div>
        <details className="event-record-details"><summary>Thông tin tư liệu</summary><dl><div><dt>Mã nhóm</dt><dd>{event.id}</dd></div><div><dt>Tên gốc</dt><dd>{event.name}</dd></div><div><dt>Ngày diễn ra</dt><dd>{event.event_dates.map(value => date(value)).join(" · ") || "Chưa xác định"}</dd></div><div><dt>Ngày đăng ảnh</dt><dd>{event.posted_dates.map(value => date(value)).join(" · ")}</dd></div></dl><ul>{event.source_urls.map((source, index) => <li key={source}><a href={source} target="_blank" rel="noopener noreferrer">Nguồn Facebook {index + 1} ↗</a></li>)}</ul></details>
      </div>
    </article>;
  };

  return <>
    <a className="skip-link" href="#story">Đến câu chuyện SPOFY</a>
    <div id="top"><Scene onAlbum={openAlbum} onNavigate={navigateFromMenu} events={heroEvents} loading={loading} eventCount={data?.events.length ?? 0} photoCount={data?.photos.length ?? 0} dateRange={dateRange} /></div>
    <main>
      <ScienceIntro />
      <section id="story" className="story section-wrap">
        <div className="section-label" data-reveal><span className="dot" />01 / CHÚNG MÌNH LÀ SPOFY<span>SCIENCE · PEOPLE · CURIOSITY</span></div>
        <div className="story-layout"><div><h2><span className="motion-line" data-reveal>Từ một câu hỏi.</span><span className="motion-line" data-reveal style={{ "--reveal-index": 1 } as CSSProperties}>Đến <em>cả hành trình.</em></span></h2><div className="story-visuals">{[featured[0], featured[2]].filter(Boolean).map((event, index) => {
          const photo = getCover(event);
          return photo && <figure key={event.id} data-reveal style={{ "--reveal-angle": `${index ? -4 : 4}deg`, "--reveal-z": "-40px", "--reveal-index": index + 2 } as CSSProperties}><ArchiveImage src={archiveAsset(photo.image)} alt={photo.alt || event.name} width={photo.width} height={photo.height} fit="contain" loading="lazy" /><figcaption><a href={`#${event.id}`}>{event.timeline_date.slice(0,4)} · {displayTitle(event.name)} ↗</a></figcaption></figure>;
        })}</div></div><div className="story-copy" data-reveal style={{ "--reveal-index": 2 } as CSSProperties}><p>Có những điều bắt đầu bằng một câu hỏi: <span>“Vì sao?”</span></p><p>Thành lập ngày 10 tháng 8 năm 2017 tại Trường THPT Chuyên Khoa học Tự nhiên, SPOFY là nơi những người trẻ gặp nhau, thử nghiệm và chia sẻ niềm yêu thích khoa học.</p><p>Từ những buổi gặp mặt đến các hoạt động giao lưu khoa học và Pharos Fair, mỗi bức ảnh lưu lại một phần hành trình. Đi qua từng năm để gặp lại những con người và trải nghiệm đã làm nên SPOFY.</p><a className="text-link" href="#history">Đi qua những dấu mốc<Arrow /></a></div></div>
        <div className="archive-stats" aria-label="Quy mô kho tư liệu"><div><strong>{dateRange}</strong><span>HÀNH TRÌNH TRONG TƯ LIỆU</span></div><div>{data ? <MotionNumber value={data.events.length} /> : <strong>…</strong>}<span>NHÓM SỰ KIỆN / HOẠT ĐỘNG</span></div><div>{data ? <MotionNumber value={data.photos.length} /> : <strong>…</strong>}<span>ẢNH · MỖI TẤM MỘT KÝ ỨC</span></div></div>
        <div className="identity-line"><span>SCIENCE PROPAGANDIZED ORGANIZATION FOR YOUTH</span><span>THPT CHUYÊN KHOA HỌC TỰ NHIÊN · HÀ NỘI</span></div>
      </section>

      <section id="history" className="history section-wrap archive-history">
        <div className="section-label" data-reveal><span className="dot" />02 / NHỮNG DẤU MỐC<span>HÀNH TRÌNH {dateRange}</span></div>
        <div className="section-heading" data-reveal><h2>Trí tò mò.<br /><em>Không ngừng lớn.</em></h2><p>Hành trình {dateRange}.<br />Tên gốc, ảnh hoạt động và nguồn tư liệu được giữ cùng nhau.</p></div>
        <p className="date-explainer" data-reveal><span>SỰ KIỆN</span> là ngày diễn ra được ghi trong tư liệu. <span>ĐĂNG ẢNH</span> là ngày đăng Facebook khi chưa rõ ngày diễn ra. Mở “Về mốc thời gian” để đọc ghi chú suy luận.</p>
        {loading && <div className="archive-status" role="status"><span className="loading-orbit" aria-hidden="true" /><p>Đang mở kho ảnh SPOFY…</p></div>}
        {error && <div className="archive-status archive-error" role="alert"><p>Chưa tải được kho ảnh.<span>{error}</span></p><button type="button" className="text-link" onClick={() => setAttempt(value => value + 1)}>Thử tải lại ↻</button><a href={facebook} target="_blank" rel="noopener noreferrer">Xem SPOFY trên Facebook ↗</a></div>}
        {data && <>
          <FeaturedHistory records={featuredRecords} onOpenAlbum={openAlbum} />
          <button type="button" className="history-toggle" aria-expanded={journeyOpen} aria-controls="full-journey" onClick={() => setJourneyOpen(value => !value)}>{journeyOpen ? "Thu gọn toàn bộ hành trình" : "Xem toàn bộ hành trình"}<span>{count(data.events.length)} nhóm · {dateRange} {journeyOpen ? "−" : "+"}</span></button>
          <div id="full-journey" hidden={!journeyOpen}><div className="archive-timeline">
            <div className="year-rail-shell" ref={railShell}>
              <button type="button" className="year-rail-scroll year-rail-scroll--prev" aria-label="Cuộn đến các năm trước" onClick={() => rail.current?.scrollBy({ left: -220, behavior: reducedMotion ? "auto" : "smooth" })}>‹</button>
              <nav className="year-rail" ref={rail} aria-label="Chọn năm trong hành trình SPOFY"><span className="rail-label">THEO NĂM</span>{years.map(year => <a key={year} href={`#year-${year}`} data-year={year} className={activeYear === year ? "active" : undefined} aria-current={activeYear === year ? "location" : undefined}>{year}<span aria-hidden="true">↗</span></a>)}</nav>
              <button type="button" className="year-rail-scroll year-rail-scroll--next" aria-label="Cuộn đến các năm tiếp theo" onClick={() => rail.current?.scrollBy({ left: 220, behavior: reducedMotion ? "auto" : "smooth" })}>›</button>
            </div>
            <div className="year-chapters">{years.map(year => {
              const groups = groupsByYear.get(year) ?? [];
              const expanded = expandedYears.has(year);
              return <section id={`year-${year}`} className="year-chapter" aria-labelledby={`heading-${year}`} key={year}>
                <header className="year-heading"><h3 id={`heading-${year}`}>{year}<span aria-hidden="true">.</span></h3><p className="year-summary">{groups.length} nhóm sự kiện / hoạt động<br /><span>{count(groups.reduce((sum, event) => sum + event.photo_count, 0))} ảnh tư liệu</span></p><button type="button" className="year-toggle" aria-expanded={expanded} aria-controls={`events-${year}`} aria-label={`${expanded ? "Thu gọn" : "Mở"} ${groups.length} nhóm năm ${year}`} onClick={() => setExpandedYears(previous => { const next = new Set(previous); if (next.has(year)) next.delete(year); else next.add(year); return next; })}>{expanded ? "Thu gọn −" : "Mở năm +"}</button></header>
                <div id={`events-${year}`} className="event-card-grid" hidden={!expanded}>{groups.map(renderEvent)}</div>
              </section>;
            })}</div>
          </div></div>
        </>}
      </section>

      <section id="gallery" className="gallery section-wrap archive-gallery">
        <div className="section-label"><span className="dot" />03 / KHOẢNH KHẮC<span>SPOFY / PHOTO ARCHIVE</span></div>
        <div className="section-heading"><h2>Mỗi bức ảnh.<br /><em>Một phần chúng mình.</em></h2><p>Từ dấu mốc nổi bật, chọn năm hoặc nhóm hoạt động.<br />Mở ảnh để xem ngày, ghi chú và liên kết nguồn.</p></div>
        <div className="archive-filters"><label className="archive-search"><span>TÌM TRONG KHO ẢNH</span><input type="search" placeholder="Tên hoạt động, tên file hoặc mã ảnh…" value={query} onChange={event => setQuery(event.target.value)} disabled={!data} /></label><label><span>NĂM</span><select value={yearFilter} onChange={event => { setYearFilter(event.target.value); setEventFilter("all"); }} disabled={!data}><option value="all">Tất cả các năm</option>{[...years].reverse().map(year => <option key={year} value={year}>{year}</option>)}</select></label><label><span>SỰ KIỆN / HOẠT ĐỘNG</span><select value={eventFilter} onChange={event => setEventFilter(event.target.value)} disabled={!data}><option value="all">Tất cả các nhóm</option>{availableEvents.map(event => <option key={event.id} value={event.id}>{displayTitle(event.name)}</option>)}</select></label></div>
        <div id="gallery-results" className="archive-results"><h3 id="gallery-results-heading" tabIndex={-1} role="status" aria-live="polite">{loading ? "Đang tải ảnh…" : data ? <><strong>{count(filtered.length)}</strong> / {count(data.photos.length)} ảnh tư liệu{filtered.length > 0 && <span> · ảnh {count(pageStart + 1)}–{count(Math.min(pageStart + pageSize, filtered.length))}</span>}</> : "Kho ảnh chưa tải được."}</h3><label className="gallery-page-size"><span>Ảnh mỗi trang</span><select value={pageSize} onChange={event => { pageFocusRequested.current = true; setPageSize(Number(event.target.value)); setPage(1); }}><option value={36}>36</option><option value={72}>72</option></select></label><button type="button" onClick={resetFilters} disabled={!data || (!query && yearFilter === "all" && eventFilter === "all")}>Xóa bộ lọc ↺</button></div>
        {pendingAlbum && loading && <p className="archive-pending" role="status">Album sẽ mở khi dữ liệu tải xong.</p>}
        {error && <div className="archive-status"><p>Kho ảnh chưa sẵn sàng.</p><button type="button" className="text-link" onClick={() => setAttempt(value => value + 1)}>Thử tải lại ↻</button></div>}
        {data && !filtered.length && <div className="archive-status"><p>Chưa có ảnh khớp với tìm kiếm này.</p><button type="button" className="text-link" onClick={resetFilters}>Xem lại toàn bộ kho ảnh ↗</button></div>}
        <div className="gallery-page-motion" key={`${query}|${yearFilter}|${eventFilter}|${safePage}|${pageSize}`}><div className="photo-grid archive-photo-grid">{visiblePhotos.map((photo, index) => <div className="photo-tile-wrap" key={photo.id} data-reveal data-reveal-kind="thumbnail" style={{ "--reveal-index": index % 5 } as CSSProperties}><button type="button" className="photo-tile" onClick={() => launch({ ids: filtered.map(item => item.id), kind: "results" }, photo.id)} aria-label={`Xem ảnh: ${displayTitle(photo.event)}`}>
          {renderImage(photo, `gallery:${photo.id}`)}<span className="tile-caption"><span>{displayTitle(photo.event)}<small>{date(photo.event_date || photo.posted_date)} · {photo.event_date ? "Sự kiện" : "Đăng ảnh"}</small></span><Arrow /></span>
        </button>{imageRetry(photo, `gallery:${photo.id}`)}</div>)}</div></div>
        {filtered.length > 0 && <nav className="archive-pagination" aria-label="Phân trang kho ảnh"><button type="button" onClick={() => changePage(safePage - 1)} disabled={safePage === 1}>← Trang trước</button><label><span>Trang</span><select aria-label="Chọn trang ảnh" value={safePage} onChange={event => changePage(Number(event.target.value))}>{Array.from({ length: pageCount }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select><span>/ {pageCount}</span></label><button type="button" onClick={() => changePage(safePage + 1)} disabled={safePage === pageCount}>Trang sau →</button></nav>}
        <p className="archive-note">Ảnh được đối chiếu từ gói tư liệu SPOFY, tổng hợp ngày 13.10.2026. Tên file gốc theo mã Facebook được giữ trong “Thông tin tư liệu”. Một nhóm có thể là album hoặc bài recap của cùng hoạt động; {data ? count(data.events.length) : "…"} nhóm không mặc nhiên là từng ấy sự kiện độc lập.</p>
      </section>

      <section id="connect" className="connect section-wrap"><div className="section-label"><span className="dot" />CHƯƠNG TIẾP THEO<span>ĐƯỢC VIẾT CÙNG NHAU</span></div><h2><span className="motion-line" data-reveal>Còn rất nhiều</span><span className="motion-line" data-reveal style={{ "--reveal-index": 1 } as CSSProperties}><em>“Vì sao?”</em> phía trước.</span></h2><div className="connect-bottom" data-reveal style={{ "--reveal-index": 2 } as CSSProperties}><p>Theo dõi những câu chuyện mới<br />và gặp SPOFY trên Facebook.</p><a className="connect-button" href={facebook} target="_blank" rel="noopener noreferrer">Gặp chúng mình<Arrow /></a></div></section>
    </main>

    <footer className="footer section-wrap"><div className="footer-top"><a href="#top" className="footer-logo">SPOFY<span>SCIENCE. PEOPLE. CURIOSITY.</span></a><a href={facebook} target="_blank" rel="noopener noreferrer">Facebook SPOFY ↗</a><a href="#top">Về đầu trang ↑</a></div><details className="credits"><summary>Nguồn tư liệu & cách đọc thời gian</summary><p>Kho ảnh gồm {data ? count(data.photos.length) : "…"} ảnh, chia thành {data ? count(data.events.length) : "…"} nhóm sự kiện / hoạt động trong giai đoạn {dateRange}, lấy từ tệp SPOFY_Xem_anh.html và danh mục ảnh đi kèm. Nguồn ghi nhận ảnh từ page SPOFY và Pharos Fair. Ảnh được tối ưu dung lượng để hiển thị trên web, giữ nguyên nội dung và tỷ lệ.</p><p>Ngày diễn ra và ngày đăng Facebook được lưu riêng. “Chưa xác định” nghĩa là tư liệu chưa nêu rõ ngày diễn ra; một số mốc được suy ra từ bài recap và có ghi chú trong album. Kho tư liệu không khẳng định bao gồm mọi ảnh đã ẩn, đã xóa hoặc chưa truy cập được. Một ảnh đăng lại có thể mang nhiều mã Facebook khác nhau.</p><ul><li><a href={facebook} target="_blank" rel="noopener noreferrer">Page SPOFY · facebook.com/spofy.sofia ↗</a></li><li><a href="https://www.facebook.com/pharos.spofy" target="_blank" rel="noopener noreferrer">Pharos Fair · facebook.com/pharos.spofy ↗</a></li><li><a href={archiveCatalogURL()} download="SPOFY-danh-muc-anh.json">Tải danh mục ảnh, sự kiện & liên kết nguồn · JSON ↓</a></li></ul></details><div className="footer-rule"><span>SPOFY / KÝ ỨC CỦA TRÍ TÒ MÒ</span><span>TƯ LIỆU {dateRange}</span></div></footer>

    <dialog className="lightbox archive-lightbox" ref={dialog} aria-labelledby="lightbox-title" onClose={() => { setModalOpen(false); setPlaying(false); requestAnimationFrame(() => { if (opener.current?.isConnected) opener.current.focus({ preventScroll: true }); }); }} onCancel={event => { event.preventDefault(); closeModal(); }} onKeyDown={event => {
      if (dialogClosing.current || (event.target instanceof HTMLElement && event.target.closest("input, select, textarea"))) return;
      if (event.key === "ArrowRight") { event.preventDefault(); movePhoto(1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); movePhoto(-1); }
    }} onClick={event => { if (event.target === event.currentTarget) closeModal(); }}>
      {currentPhoto && <div className="lightbox-content"><div className="lightbox-header"><span>{scope.kind === "album" ? "ALBUM SPOFY" : "KẾT QUẢ KHO ẢNH"}</span><button type="button" ref={closeButton} onClick={closeModal} aria-label="Đóng album ảnh">Đóng ×</button></div>
        <div className="lightbox-image"><div className="lightbox-frame">
          {previousFrame && <img className="lightbox-previous-image" src={archiveAsset(previousFrame.image)} alt="" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", opacity: lightboxReady || lightboxFailed ? 0 : 1, transition: reducedMotion ? "none" : "opacity var(--motion-crossfade) var(--ease)" }} />}
          <ArchiveImage key={currentPhoto.id} src={archiveAsset(currentPhoto.image)} alt={currentPhoto.alt || displayTitle(currentPhoto.event)} width={currentPhoto.width} height={currentPhoto.height} loading="eager" className="lightbox-archive-image" fit="contain" interactive
            style={{ position: "absolute", inset: 0, opacity: lightboxReady || lightboxFailed ? 1 : 0, transition: reducedMotion ? "none" : "opacity var(--motion-crossfade) var(--ease)" }}
            onError={() => setLightboxFailedId(currentPhoto.id)}
            onLoad={() => {
              const previous = lastLoadedPhotoRef.current;
              setOutgoingPhoto(previous?.id !== currentPhoto.id ? previous : null);
              lastLoadedPhotoRef.current = currentPhoto;
              setLastLoadedPhoto(currentPhoto);
              setLightboxFailedId("");
            }} />
          {!lightboxReady && !lightboxFailed && <span className="lightbox-transfer-status" role="status" style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", zIndex: 2, padding: "8px 12px", background: "#171113ee", color: "#f3e6dd", borderRadius: 8, fontSize: 13 }}>{previousFrame ? "Đang tải ảnh tiếp theo…" : "Đang tải ảnh…"}</span>}
        </div><button type="button" className="lightbox-prev" onClick={() => movePhoto(-1)} disabled={scope.ids.length < 2} aria-label="Ảnh trước">←</button><button type="button" className="lightbox-next" onClick={() => movePhoto(1)} disabled={scope.ids.length < 2} aria-label="Ảnh tiếp theo">→</button></div>
        <div className="lightbox-meta archive-lightbox-meta"><div className="archive-photo-details"><h2 id="lightbox-title">{displayTitle(currentPhoto.event)}</h2><p className="lightbox-event-name">Ảnh {count(photoIndex + 1)} / {count(scope.ids.length)} {scope.kind === "album" ? "trong album" : "trong kết quả"}</p><dl className="photo-dates"><div><dt>Ngày diễn ra</dt><dd>{date(currentPhoto.event_date)}</dd></div><div><dt>Đăng ảnh Facebook</dt><dd>{date(currentPhoto.posted_date)}</dd></div></dl>
          {currentPhoto.date_note && <p className="photo-date-note">{currentPhoto.date_note}</p>}
          {currentGroup && currentGroup.date_notes.filter(note => note !== currentPhoto.date_note).map((note, index) => <p className="photo-date-note" key={index}>{note}</p>)}
          <div className="photo-source-links"><a href={currentPhoto.photo_source} target="_blank" rel="noopener noreferrer">Nguồn ảnh Facebook ↗</a><a href={currentPhoto.event_source || facebook} target="_blank" rel="noopener noreferrer">Bài đăng / album hoạt động ↗</a></div>
          <details className="photo-record-details"><summary>Thông tin tư liệu</summary><dl><div><dt>Tên file gốc</dt><dd>{currentPhoto.name}</dd></div><div><dt>Đường dẫn file gốc</dt><dd>{currentPhoto.file}</dd></div><div><dt>Mã ảnh</dt><dd>{currentPhoto.id}</dd></div><div><dt>Mã nhóm</dt><dd>{currentPhoto.event_id}</dd></div><div><dt>Tên hoạt động gốc</dt><dd>{currentGroup?.name || currentPhoto.event}</dd></div></dl></details>
        </div><div className="lightbox-tools"><button type="button" aria-pressed={playing} onClick={() => setPlaying(value => !value)} disabled={scope.ids.length < 2 || reducedMotion} title={reducedMotion ? "Chế độ giảm chuyển động đang bật; dùng nút trước / sau để xem ảnh." : undefined}>{playing ? "Tạm dừng Ⅱ" : "Trình chiếu ▷"}</button><span aria-live="polite">{count(photoIndex + 1)} / {count(scope.ids.length)}</span><small>{reducedMotion ? "Giảm chuyển động: chuyển ảnh thủ công." : "← → chuyển ảnh · Esc đóng"}</small></div></div>
      </div>}
    </dialog>
  </>;
}
