import { pageMetadata } from '../server/page-meta.mjs';

// The same metadata model also renders the initial HTTP HTML for crawlers.
// Updating the browser head keeps in-app navigation consistent with direct URLs.
export function updatePageMetadata(pathname: string, article?: unknown) {
  const meta = pageMetadata({ pathname, article });
  document.title = meta.title;
  function tag(key: string, value: string | null | undefined, property = false) {
    const attribute = property ? 'property' : 'name';
    let node = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
    if (!value) { node?.remove(); return; }
    if (!node) { node = document.createElement('meta'); node.setAttribute(attribute, key); document.head.append(node); }
    node.content = value;
  }
  tag('description', meta.description); tag('robots', meta.robots);
  tag('og:title', meta.title, true); tag('og:description', meta.description, true);
  tag('og:url', meta.canonical, true); tag('og:type', meta.type, true);
  tag('og:image', meta.image, true); tag('og:image:alt', meta.imageAlt, true);
  tag('article:published_time', meta.published, true); tag('article:modified_time', meta.updated, true);
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); }
  canonical.href = meta.canonical;
}
