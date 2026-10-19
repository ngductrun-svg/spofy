import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
let contextPromise;
export async function runtimeSettings(env = process.env) {
  contextPromise ??= readFile(join(process.cwd(), 'netlify/generated/deploy-context.json'), 'utf8').then(JSON.parse);
  const built = await contextPromise;
  if (!built || !['production','deploy-preview','branch-deploy','local','dev'].includes(built.context)) throw new Error('Invalid deployment context');
  return { ...env, CONTEXT: built.context, PREVIEW_DATA_ISOLATED: built.previewDataIsolated ? 'true' : 'false' };
}
