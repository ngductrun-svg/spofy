import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/** This module and KaTeX are requested only when an article contains a formula. */
export default function Formula({ latex, caption }: { latex: string; caption: string }) {
  const html = useMemo(() => {
    try { return katex.renderToString(latex, { displayMode: true, throwOnError: false, trust: false, strict: 'warn', maxExpand: 200, maxSize: 20, output: 'htmlAndMathml' }); }
    catch { return ''; }
  }, [latex]);
  return <figure className="science-formula">{html ? <div className="science-equation" dangerouslySetInnerHTML={{ __html: html }} /> : <pre>{latex}</pre>}{caption && <figcaption>{caption}</figcaption>}</figure>;
}
