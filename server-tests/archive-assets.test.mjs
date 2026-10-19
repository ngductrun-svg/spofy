import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { verifyAssetFile } from '../scripts/verify-archive-assets.mjs';

test('archive build check accepts verified real image and rejects missing, changed or disguised image bytes', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'spofy-archive-test-'));
  t.after(() => {
    assert.ok(resolve(directory).startsWith(`${resolve(tmpdir())}${sep}spofy-archive-test-`), 'Cleanup must stay in the named temporary test directory.');
    return rm(directory, { recursive: true, force: true });
  });
  const manifest = JSON.parse(await readFile(new URL('../scripts/archive-assets-manifest.json', import.meta.url), 'utf8'));
  const relative = 'photos/1190515168964915.webp';
  const expected = manifest.files[relative];
  const bytes = await readFile(new URL(`../public/archive/${relative}`, import.meta.url));
  const filename = join(directory, 'verified.webp');
  await writeFile(filename, bytes);
  assert.equal(await verifyAssetFile(filename, expected), bytes.length);
  const changed = Buffer.from(bytes); changed[changed.length - 1] ^= 1;
  await writeFile(filename, changed);
  await assert.rejects(verifyAssetFile(filename, expected), /SHA-256 changed/u);
  const disguised = Buffer.from(bytes); disguised.write('HTML', 0, 'ascii');
  await writeFile(filename, disguised);
  await assert.rejects(verifyAssetFile(filename, expected), /Not a WebP/u);
  await assert.rejects(verifyAssetFile(join(directory, 'missing.webp'), expected), { code: 'ENOENT' });
});
