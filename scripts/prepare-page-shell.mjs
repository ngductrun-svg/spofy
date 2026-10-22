import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { renderPageHtml } from '../server/page-meta.mjs';
import { buildContext } from '../server/deploy-policy.mjs';

const distFile = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const shellDirectory = fileURLToPath(new URL('../netlify/generated/', import.meta.url));
const source = await readFile(distFile, 'utf8');
if (!source.includes('id="root"') || !source.includes('/assets/')) throw new Error('Chưa có HTML đã build của Vite. Hãy chạy vite build trước.');
const { html } = renderPageHtml(source, { pathname: '/' });
await mkdir(shellDirectory, { recursive: true });
await writeFile(fileURLToPath(new URL('../netlify/generated/page-shell.html', import.meta.url)), html, 'utf8');
await writeFile(distFile, html, 'utf8');
await writeFile(fileURLToPath(new URL('../netlify/generated/deploy-context.json', import.meta.url)), JSON.stringify(buildContext(process.env)), 'utf8');
console.log('Đã chuẩn bị HTML metadata và shell cho Netlify page Function.');
