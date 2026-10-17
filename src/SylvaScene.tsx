import { useEffect, useRef } from "react";
import { SylvaHero } from "@designcodeio/threeui";
import "@designcodeio/threeui/style.css";
import brandStyles from "./hero-brand.css?raw";

export function Scene({ onAlbum }: { onAlbum: (group?: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = host.current?.querySelector("iframe");
    if (!frame) return;
    const cleanups: (() => void)[] = [];
    function adapt() {
      cleanups.splice(0).forEach((cleanup) => cleanup());
      const doc = frame!.contentDocument;
      if (!doc?.querySelector("#hero")) return;
      doc.documentElement.lang = "vi";
      doc.title = "SPOFY — Hành trình của trí tò mò";
      frame!.title = doc.title;
      let sheet = doc.getElementById("spofy-brand") as HTMLStyleElement | null;
      if (!sheet) { sheet = doc.createElement("style"); sheet.id = "spofy-brand"; }
      sheet.textContent = brandStyles;
      doc.head.append(sheet);
      const text = (selector: string, content: string) => {
        const node = doc.querySelector(selector);
        if (node) node.textContent = content;
      };
      const label = (selector: string, content: string) => doc.querySelector(selector)?.setAttribute("aria-label", content);
      text(".headline span:nth-child(1) i", "Lớn cùng");
      text(".headline span:nth-child(2) i", "trí tò mò.");
      text(".lede", "Từ 2017, SPOFY kết nối những người trẻ qua khoa học và trải nghiệm.");
      text(".ghost", "SPOFY");
      text(".card--about .label", "SỰ KIỆN CHÍNH / 2026");
      text(".card--about h2", "Pharos Fair 26.");
      text(".card--stove .label", "KHOA HỌC & CỘNG ĐỒNG");
      text(".card--stove h2", "Science Heart.");
      text(".stat--a dt", "Ngày thành lập");
      text(".stat--a dd", "10.08.2017");
      text(".stat--b dt", "Ngôi nhà chung");
      text(".stat--b dd", "KHTN · Hà Nội");
      text(".liquid-button--explore .lbl", "Hành trình SPOFY");
      const scroll = doc.querySelector(".scroll");
      if (scroll?.firstChild) scroll.firstChild.textContent = "KHÁM PHÁ";
      label(".knob--about", "Xem album Pharos Fair 26 — Odyssey");
      label(".card--stove .knob", "Xem album Science Heart 2025");
      label(".liquid-button--play", "Xem câu chuyện bằng ảnh");
      label("nav", "Điều hướng SPOFY");
      label(".dock-mark", "SPOFY — trang đầu");
      const mark = doc.querySelector(".dock-mark");
      if (mark && !mark.querySelector("img")) {
        const img = doc.createElement("img"); img.src = "/images/spofy-mark.jpg"; img.alt = "SPOFY"; mark.append(img);
      }
      function photo(selector: string, src: string, alt: string) {
        const img = doc.querySelector(selector) as HTMLImageElement | null;
        if (img) { img.src = src; img.alt = alt; }
      }
      photo(".card--about img", "/images/pharos-odyssey-03.jpg", "Thí nghiệm ngọn lửa tại Pharos Fair 26 — ảnh Facebook Pharos Fair");
      photo(".card--stove img", "/images/science-heart-2025-11.jpg", "SPOFY và COSMOS tại Science Heart 2025 — ảnh CNH Spotlight");
      function bind(selector: string, action: () => void) {
        const node = doc!.querySelector(selector);
        if (!node) return;
        const handler = (event: Event) => { event.preventDefault(); action(); };
        node.addEventListener("click", handler);
        cleanups.push(() => node.removeEventListener("click", handler));
      }
      const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      const links = ["Đầu trang", "Câu chuyện", "Dấu mốc", "Kho ảnh", "Kết nối"];
      const targets = ["top", "story", "history", "gallery", "connect"];
      doc.querySelectorAll(".dock-item").forEach((node, index) => {
        const caption = node.querySelector("span:not(.glyph)");
        if (caption) caption.textContent = links[index];
        node.setAttribute("aria-label", links[index]);
        node.setAttribute("href", `#${targets[index]}`);
        const handler = (event: Event) => { event.preventDefault(); jump(targets[index]); };
        node.addEventListener("click", handler);
        cleanups.push(() => node.removeEventListener("click", handler));
      });
      bind(".liquid-button--explore", () => jump("history"));
      bind(".scroll", () => jump("story"));
      bind(".knob--about", () => onAlbum("odyssey"));
      bind(".card--stove .knob", () => onAlbum("station"));
      bind(".liquid-button--play", () => onAlbum());
      // Ask the authored dock to measure its localized labels and loaded font.
      const resize = () => frame!.contentWindow?.dispatchEvent(new Event("resize"));
      resize();
      doc.fonts.ready.then(resize);
    }
    frame.addEventListener("load", adapt);
    if (frame.contentDocument?.readyState === "complete") adapt();
    return () => { frame.removeEventListener("load", adapt); cleanups.forEach((cleanup) => cleanup()); };
  }, [onAlbum]);
  return (
    <div className="shader-frame" ref={host}>
      <SylvaHero
        variant="living-green"
        headingFont="lexend"
        bodyFont="lexend"
        headingWeight="300"
        bodyWeight="300"
        primaryColor="#ffffff"
        headingSize={63}
        bodySize={16.5}
        headingLetterSpacing={-0.006}
      />
    </div>
  );
}
