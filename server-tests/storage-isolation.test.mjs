import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { netlifyStorage } from '../netlify/server/storage.mjs';

function memoryStore(entries = new Map()) {
  return {
    async set(key, value, { metadata }) { entries.set(key, { data: Uint8Array.from(value), metadata }); },
    async getWithMetadata(key) { return entries.get(key) ?? null; },
    async delete(key) { entries.delete(key); },
  };
}

test('production media keeps the original site-wide store and does not require a preview flag', async () => {
  const calls = [], entries = new Map();
  const storage = netlifyStorage({ CONTEXT: 'production' }, {
    siteStore(options) { calls.push(options); return memoryStore(entries); },
    deployStore() { assert.fail('production must not select a deploy store'); },
  });
  assert.deepEqual(calls, [{ name: 'spofy-article-media', consistency: 'strong' }]);
  await storage.put('existing-name.webp', new Uint8Array([1, 2]), { article: 'published' });
  assert.deepEqual((await storage.get('existing-name.webp')).data, new Uint8Array([1, 2]));
  await storage.delete('existing-name.webp');
  assert.equal(entries.size, 0);
});

test('preview uploads and deletes cannot touch production media, even after a production adapter was created', async () => {
  const production = new Map([['same-key.webp', { data: new Uint8Array([7]), metadata: { production: true } }]]);
  const productionStorage = netlifyStorage({ CONTEXT: 'production' }, { siteStore: () => memoryStore(production) });
  for (const CONTEXT of ['deploy-preview', 'branch-deploy']) {
    const preview = new Map();
    let calls = 0;
    const storage = netlifyStorage({ CONTEXT, PREVIEW_DATA_ISOLATED: 'true' }, {
      siteStore() { assert.fail('preview must never open the site-wide production store'); },
      deployStore(options) { calls++; assert.deepEqual(options, { name: 'spofy-article-media', consistency: 'strong' }); return memoryStore(preview); },
    });
    assert.equal(await storage.get('same-key.webp'), null, 'no fallback reads from production');
    await storage.put('same-key.webp', new Uint8Array([8]), { preview: true });
    assert.equal(preview.size, 1);
    await storage.delete('same-key.webp');
    assert.equal(preview.size, 0);
    assert.deepEqual((await productionStorage.get('same-key.webp')).data, new Uint8Array([7]));
    assert.equal(production.size, 1);
    assert.equal(calls, 1);
  }
});

test('missing, local or unconfirmed preview context fails before either store factory is called', () => {
  let calls = 0;
  const factories = { siteStore() { calls++; }, deployStore() { calls++; } };
  for (const env of [undefined, {}, { CONTEXT: 'local' }, { CONTEXT: 'dev' }, { CONTEXT: 'unknown' }, { CONTEXT: 'deploy-preview' }, { CONTEXT: 'branch-deploy', PREVIEW_DATA_ISOLATED: 'false' }]) {
    assert.throws(() => netlifyStorage(env, factories), /STORAGE_CONTEXT_NOT_CONFIRMED|PREVIEW_DATA_NOT_CONFIRMED/);
  }
  assert.equal(calls, 0);
});

test('real Netlify SDK requires a deploy ID and namespaces preview media separately without network calls', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { setEnvironmentContext, getStore, getDeployStore } from '@netlify/blobs';
    import { netlifyStorage } from './netlify/server/storage.mjs';
    setEnvironmentContext({});
    assert.throws(() => netlifyStorage({CONTEXT:'deploy-preview',PREVIEW_DATA_ISOLATED:'true'}), error => error.name === 'MissingBlobsEnvironmentError' && error.message.includes('deployID'));
    setEnvironmentContext({deployID:'0123456789abcdef01234567',siteID:'00000000-0000-0000-0000-000000000001',token:'test-only-not-a-credential'});
    const production = getStore({name:'spofy-article-media',consistency:'strong'});
    const preview = getDeployStore({name:'spofy-article-media',consistency:'strong'});
    assert.notEqual(preview.name, production.name);
    assert.match(preview.name, /0123456789abcdef01234567/);
    assert.ok(preview.name.endsWith(':spofy-article-media'));
    console.log('SDK context and namespace assertions passed; no get/set/delete request made.');
  `], { cwd: new URL('../', import.meta.url), env: { ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}) }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /assertions passed/);
});
