import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';

const project = fileURLToPath(new URL('../', import.meta.url));
const digest = payload => createHash('sha256').update(payload).digest('hex');

export async function verifyAssetFile(filename, expected) {
  const bytes = await readFile(filename);
  assert.equal(bytes.length, expected.bytes, `Asset byte count changed: ${filename}`);
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', `Not a WebP RIFF image: ${filename}`);
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', `Not a WebP image: ${filename}`);
  assert.equal(digest(bytes), expected.sha256, `Asset SHA-256 changed: ${filename}`);
  assert.ok(Number.isInteger(expected.width) && expected.width > 0 && Number.isInteger(expected.height) && expected.height > 0, `Missing verified dimensions: ${filename}`);
  return bytes.length;
}

export async function verifyArchiveAssets() {
  const catalogBytes = await readFile(resolve(project, 'public/archive-data.json'));
  const catalog = JSON.parse(catalogBytes);
  const manifest = JSON.parse(await readFile(resolve(project, 'scripts/archive-assets-manifest.json'), 'utf8'));
  const variants = JSON.parse(await readFile(resolve(project, 'src/archiveVariants.json'), 'utf8'));
  const assetsDir = resolve(project, 'public/archive');
  assert.equal(digest(catalogBytes), '2de8da536787622f28574b4379e13b889bd3685d6551c041ddbec1838391b291', 'Source catalog changed.');
  assert.equal(digest(catalogBytes), manifest.catalogSha256);
  assert.equal(catalog.events.length, 51);
  assert.equal(catalog.photos.length, 1471);
  assert.equal(manifest.fileCount, 2942);
  assert.equal(Object.keys(manifest.files).length, 2942);
  assert.equal(Object.keys(variants).length, 1471);
  const expectedPaths = new Set(catalog.photos.flatMap(photo => [photo.image, photo.thumb]));
  assert.equal(expectedPaths.size, 2942);
  const actualPaths = (await Promise.all(['photos', 'thumbs'].map(async directory => (await readdir(resolve(assetsDir, directory), { withFileTypes: true })).filter(entry => entry.isFile()).map(entry => `${directory}/${entry.name}`)))).flat();
  assert.equal(actualPaths.length, expectedPaths.size, 'Unexpected or missing image variants.');
  for (const relative of actualPaths) assert.ok(expectedPaths.has(relative), `Unexpected asset: ${relative}`);
  for (const photo of catalog.photos) {
    const full = manifest.files[photo.image], thumb = manifest.files[photo.thumb];
    assert.ok(full && thumb, `Incomplete manifest: ${photo.id}`);
    assert.deepEqual(variants[photo.id], [thumb.width, full.width], `srcset widths differ from decoded images: ${photo.id}`);
  }
  let totalBytes = 0;
  const paths = [...expectedPaths];
  // Bound open files and memory while reading the complete 241 MB archive.
  for (let offset = 0; offset < paths.length; offset += 16) {
    const sizes = await Promise.all(paths.slice(offset, offset + 16).map(async relative => {
      const filename = resolve(assetsDir, relative);
      assert.ok(filename.startsWith(assetsDir + sep), 'Unsafe archive path.');
      return verifyAssetFile(filename, manifest.files[relative]);
    }));
    totalBytes += sizes.reduce((sum, value) => sum + value, 0);
  }
  assert.equal(totalBytes, manifest.totalBytes);
  return { groups: 51, photos: 1471, variants: paths.length, totalBytes };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await verifyArchiveAssets();
  console.log(`PASS: ${result.groups} groups; ${result.photos.toLocaleString('en-US')} photos; ${result.variants.toLocaleString('en-US')} local WebP variants; ${result.totalBytes.toLocaleString('en-US')} bytes; SHA-256 and real srcset widths verified.`);
}
