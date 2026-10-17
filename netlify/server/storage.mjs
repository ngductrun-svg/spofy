import { getStore } from '@netlify/blobs';

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

let storage;
export function netlifyStorage() {
  // A site-wide store survives redeploys. Files are served only after the API
  // checks whether their article is published or the caller is an admin.
  return storage ??= createStorage(getStore({ name: 'spofy-article-media', consistency: 'strong' }));
}
