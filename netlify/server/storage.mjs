import { getStore, getDeployStore } from '@netlify/blobs';
import { isPreview, previewBlocked } from '../../server/deploy-policy.mjs';

export function createStorage(store) {
  return {
    async put(filename, bytes, metadata) {
      await store.set(filename, bytes, { metadata });
    },
    async get(filename) {
      const item = await store.getWithMetadata(filename, { type: 'arrayBuffer', consistency: 'strong' });
      return item ? { data: new Uint8Array(item.data), metadata: item.metadata } : null;
    },
    async delete(filename) { await store.delete(filename); },
  };
}

export function netlifyStorage(env, { siteStore = getStore, deployStore = getDeployStore } = {}) {
  // Only the private build-context snapshot may choose the cloud store. A local
  // build uploaded manually must not silently inherit production media access.
  if (!env || !['production', 'deploy-preview', 'branch-deploy'].includes(env.CONTEXT)) {
    throw new Error('STORAGE_CONTEXT_NOT_CONFIRMED');
  }
  if (previewBlocked(env)) throw new Error('PREVIEW_DATA_NOT_CONFIRMED');
  const options = { name: 'spofy-article-media', consistency: 'strong' };
  // Preserve the existing persistent production store. Preview media belongs to
  // this deploy only; the SDK requires its platform deployID and fails before
  // store creation when it is missing. Never fall back to the site-wide store.
  const store = isPreview(env.CONTEXT) ? deployStore(options) : siteStore(options);
  // The Function already caches its handler; do not share a module-level store
  // across contexts, including in tools/tests that reuse this module.
  return createStorage(store);
}
