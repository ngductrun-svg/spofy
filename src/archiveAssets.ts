declare global {
  interface Window {
    __SPOFY_ASSET_BASE__?: string;
    __SPOFY_CATALOG_URL__?: string;
  }
}

const buildEnvironment = (import.meta as unknown as { env?: { VITE_ARCHIVE_ASSET_BASE?: string; VITE_ARCHIVE_CATALOG_URL?: string } }).env;
const isAbsolute = (path: string) => /^(?:[a-z][a-z\d+.-]*:|\/\/|\/)/i.test(path);

/** Resolve an archive-relative path; keep existing absolute URLs untouched. */
export function archiveAsset(path: string) {
  if (!path || isAbsolute(path)) return path;
  const base = (typeof window !== "undefined" ? window.__SPOFY_ASSET_BASE__ : undefined)
    ?? buildEnvironment?.VITE_ARCHIVE_ASSET_BASE ?? "/archive/";
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

/** Standalone HTML may provide its embedded catalog or a separate catalog URL. */
export function archiveCatalogURL() {
  return (typeof window !== "undefined" ? window.__SPOFY_CATALOG_URL__ : undefined)
    ?? buildEnvironment?.VITE_ARCHIVE_CATALOG_URL ?? "/archive-data.json";
}
