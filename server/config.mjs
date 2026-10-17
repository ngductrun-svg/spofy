import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

export const projectDir = fileURLToPath(new URL('../', import.meta.url));
export function configuration() {
  const envFile = resolve(projectDir, '.env');
  if (existsSync(envFile)) loadEnvFile(envFile);
  const dataDir = resolve(projectDir, process.env.DATA_DIR ?? './data');
  const appOrigin = process.env.APP_ORIGIN ?? 'http://127.0.0.1:3000';
  const production = process.env.NODE_ENV === 'production';
  if (production && (!process.env.APP_ORIGIN || !appOrigin.startsWith('https://'))) throw new Error('Production cần APP_ORIGIN=https://tên-miền-của-bạn và reverse proxy HTTPS.');
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT phải là số nguyên từ 1 đến 65535.');
  return { host: process.env.HOST ?? '127.0.0.1', port, appOrigin, secureCookies: production || new URL(appOrigin).protocol === 'https:', dbPath: resolve(projectDir, process.env.DB_PATH ?? resolve(dataDir, 'spofy.sqlite')), mediaDir: resolve(projectDir, process.env.MEDIA_DIR ?? resolve(dataDir, 'media')), distDir: resolve(projectDir, process.env.DIST_DIR ?? './dist') };
}
