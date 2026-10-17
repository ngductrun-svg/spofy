import { useEffect, useState } from "react";
import App from "./App";
import { ScienceRouter } from "./science";

const locationKey = () => window.location.pathname + window.location.search;
const handled = (path: string) => path === "/" || /^\/(khoa-hoc|dang-nhap|dang-ky|admin)(\/|$)/.test(path);

/** Small same-origin router; archive fragments stay with the existing App. */
export function RootApp() {
  const [route, setRoute] = useState(() => ({ location: locationKey(), revision: 0 }));
  useEffect(() => {
    const pop = () => setRoute(previous => ({ location: locationKey(), revision: previous.revision + 1 }));
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      const next = new URL(anchor.href);
      if (next.origin !== location.origin || !handled(next.pathname)) return;
      if (next.pathname === location.pathname && next.search === location.search) return;
      event.preventDefault();
      if (!document.dispatchEvent(new Event("spofy:before-navigate", { cancelable: true }))) return;
      history.pushState(null, "", next.pathname + next.search + next.hash);
      setRoute(previous => ({ location: locationKey(), revision: previous.revision + 1 }));
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("popstate", pop);
    document.addEventListener("click", click);
    return () => { window.removeEventListener("popstate", pop); document.removeEventListener("click", click); };
  }, []);
  return route.location.split("?")[0] === "/" ? <App key={route.revision} /> : <ScienceRouter key={route.revision} path={route.location.split("?")[0]} />;
}
