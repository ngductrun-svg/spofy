import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const bytes = readFileSync(new URL('../public/archive-data.json', import.meta.url));
const sha = createHash('sha256').update(bytes).digest('hex');
assert.equal(sha, '2de8da536787622f28574b4379e13b889bd3685d6551c041ddbec1838391b291', 'Original archive catalog must stay byte-for-byte unchanged.');
const archive = JSON.parse(bytes);
assert.equal(archive.events.length, 51);
assert.equal(archive.photos.length, 1471);
const events = new Map(archive.events.map(event => [event.id, event]));
const photos = new Map(archive.photos.map(photo => [photo.id, photo]));
assert.equal(events.size, 51, 'Duplicate event ID.');
assert.equal(photos.size, 1471, 'Duplicate photo ID.');
const memberships = new Set();
const checkFacebook = value => assert.match(new URL(value).hostname, /(^|\.)facebook\.com$/);
for (const event of archive.events) {
  assert.ok(event.name && event.timeline_date);
  assert.ok(Array.isArray(event.date_notes));
  assert.ok(['event_date', 'posted_date'].includes(event.timeline_date_kind));
  assert.equal(event.photo_count, event.photo_ids.length);
  for (const id of event.photo_ids) {
    const photo = photos.get(id);
    assert.ok(photo, 'Missing photo ' + id);
    assert.equal(photo.event_id, event.id);
    assert.equal(photo.event, event.name);
    assert.ok(!memberships.has(id), 'Photo assigned more than once: ' + id);
    memberships.add(id);
  }
  for (const id of event.representative_photo_ids) assert.ok(event.photo_ids.includes(id));
  for (const url of event.source_urls) checkFacebook(url);
}
assert.equal(memberships.size, 1471);
for (const photo of archive.photos) {
  assert.equal(photo.name, photo.id + '.jpg');
  assert.equal(photo.file, photo.name);
  assert.ok(photo.event_date || photo.posted_date);
  assert.equal(photo.image, 'photos/' + photo.id + '.webp');
  assert.equal(photo.thumb, 'thumbs/' + photo.id + '.webp');
  assert.ok(events.get(photo.event_id)?.photo_ids.includes(photo.id));
  checkFacebook(photo.photo_source);
  checkFacebook(photo.event_source);
}
console.log('PASS: 51 groups; 1,471 photos; original SHA-256 ' + sha + '; IDs, original names, dates, source URLs and memberships preserved.');
