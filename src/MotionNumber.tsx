import { useEffect, useRef } from "react";

export function MotionNumber({ value }: { value: number }) {
  const visible = useRef<HTMLSpanElement>(null);
  const completed = useRef(false);
  const formatted = value.toLocaleString("vi-VN");
  useEffect(() => {
    const node = visible.current;
    if (!node || !value || completed.current) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches || !("IntersectionObserver" in window)) { completed.current = true; return; }
    let frame = 0, started = 0;
    const finish = () => { cancelAnimationFrame(frame); frame = 0; node.textContent = formatted; completed.current = true; };
    const paint = (time: number) => {
      if (reduce.matches || document.hidden) { finish(); return; }
      started ||= time;
      const progress = Math.min(1, (time - started) / 800);
      node.textContent = Math.round(value * (1 - (1 - progress) ** 3)).toLocaleString("vi-VN");
      if (progress < 1) frame = requestAnimationFrame(paint); else finish();
    };
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); frame = requestAnimationFrame(paint); }
    }, { threshold: .4 });
    observer.observe(node); reduce.addEventListener("change", finish);
    document.addEventListener("visibilitychange", finish);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); reduce.removeEventListener("change", finish); document.removeEventListener("visibilitychange", finish); node.textContent = formatted; };
  }, [value, formatted]);
  return <strong><span className="sr-only">{formatted}</span><span ref={visible} aria-hidden="true">{formatted}</span></strong>;
}
