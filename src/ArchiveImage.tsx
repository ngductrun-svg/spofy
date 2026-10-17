import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactEventHandler } from "react";
import "./archive-image.css";

export type ArchiveImageProps = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  loading?: "eager" | "lazy";
  className?: string;
  style?: CSSProperties;
  aspectRatio?: string | number;
  fit?: "cover" | "contain";
  interactive?: boolean;
  retryKey?: string | number;
  srcSet?: string;
  sizes?: string;
  onLoad?: ReactEventHandler<HTMLImageElement>;
  onError?: ReactEventHandler<HTMLImageElement>;
};

type ImageState = { key: string; status: "loading" | "loaded" | "error"; retry: number; retrySrc?: string };

// Retry only follows an explicit user action. Do not add cache-busting parameters
// to signed URLs, data URLs, or blob URLs: remounting the image is sufficient.
export function ArchiveImage({ src, alt, width, height, loading = "lazy", className = "", style,
  aspectRatio, fit = "cover", interactive = true, retryKey = 0, srcSet, sizes, onLoad, onError,
}: ArchiveImageProps) {
  const sourceKey = `${src}\u0000${String(retryKey)}`;
  const image = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<ImageState>({ key: sourceKey, status: src ? "loading" : "error", retry: 0 });
  const current = state.key === sourceKey ? state : { key: sourceKey, status: src ? "loading" as const : "error" as const, retry: 0 };
  const status = current.status;
  const retry = current.retry;
  const ratio = aspectRatio ?? (width && height ? `${width} / ${height}` : "4 / 3");

  useEffect(() => {
    const node = image.current;
    if (node?.complete && node.naturalWidth > 0) {
      setState(previous => ({ ...(previous.key === sourceKey ? previous : { key: sourceKey, retry: 0 }), status: "loaded" }));
    }
  }, [sourceKey, retry]);

  const retryImage = () => {
    if (retry > 0) return;
    const retrySrc = image.current?.currentSrc || src;
    setState({ key: sourceKey, status: "loading", retry: 1, retrySrc });
  };

  return <span className={`archive-image is-${status}${className ? ` ${className}` : ""}`}
    style={{ "--archive-image-ratio": ratio, "--archive-image-fit": fit, ...style } as CSSProperties}
    data-image-state={status}>
    {src && <img key={`${sourceKey}:${retry}`} ref={image} className="archive-image-media"
      src={current.retrySrc || src} srcSet={retry ? undefined : srcSet} sizes={sizes}
      alt={alt} width={width} height={height} loading={loading} decoding="async"
      aria-hidden={status === "error" ? true : undefined}
      onLoad={event => {
        setState(previous => ({ ...(previous.key === sourceKey ? previous : { key: sourceKey, retry }), status: "loaded" }));
        onLoad?.(event);
      }}
      onError={event => {
        setState(previous => ({ ...(previous.key === sourceKey ? previous : { key: sourceKey, retry }), status: "error" }));
        onError?.(event);
      }} />}
    {status === "loading" && <span className="archive-image-status archive-image-loading" aria-hidden="true"><span className="archive-image-loading-mark" />Đang tải ảnh…</span>}
    {status === "error" && <span className="archive-image-status archive-image-error">
      <span className="archive-image-error-copy" role="img" aria-label={alt || "Ảnh tư liệu SPOFY"}>
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 8h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span>{retry ? "Ảnh vẫn chưa tải được" : "Chưa tải được ảnh"}</span>
      </span>
      {interactive && retry === 0 && !!src && <button type="button" className="archive-image-retry" onClick={event => { event.stopPropagation(); retryImage(); }}>Thử tải lại <span aria-hidden="true">↻</span></button>}
    </span>}
  </span>;
}
