import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { verifiedWeeklyContent } from '../scripts/build-weekly.mjs';

// Synthetic records stay in this test file; the published editorial file is empty.
const record = (overrides = {}) => ({ id: 'test-question', status: 'verified', question: 'Câu hỏi kiểm thử?', answer: 'Đáp án dùng kiểm thử.', explanation: 'Giải thích dùng kiểm thử.', publishedAt: '2026-10-01T00:00:00Z', sources: [{ label: 'Nguồn kiểm thử', url: 'https://example.org/reference' }], ...overrides });
const build = items => verifiedWeeklyContent({ schemaVersion: 1, items }, Date.parse('2026-10-18T00:00:00Z'));

test('weekly content ships an honest empty state, without synthetic public questions', async () => {
  const source = JSON.parse(await readFile(new URL('../content/weekly-questions.json', import.meta.url), 'utf8'));
  assert.deepEqual(verifiedWeeklyContent(source).items, []);
});
test('weekly drafts and future scheduled records never enter the public payload', () => {
  assert.deepEqual(build([record({ status: 'draft' }), record({ id: 'future', publishedAt: '2099-01-01' })]).items, []);
});
test('weekly verified content projects a public whitelist and sorts by actual publication date', () => {
  const result = build([record({ id: 'older', privateEditorialNotes: 'not public' }), record({ id: 'newer', publishedAt: '2026-10-17' })]);
  assert.deepEqual(result.items.map(item => item.id), ['newer', 'older']);
  assert.equal(Object.hasOwn(result.items[1], 'privateEditorialNotes'), false);
  assert.equal(Object.hasOwn(result.items[1], 'status'), false);
});
test('weekly verified questions require an answer, explanation and at least one source', () => {
  for (const invalid of [{ answer: '' }, { explanation: '' }, { sources: [] }, { question: ' ' }]) assert.throws(() => build([record(invalid)]));
});
test('weekly source gate rejects scripts, insecure URLs and embedded credentials', () => {
  for (const url of ['javascript:alert(1)', 'http://example.org', 'https://user:secret@example.org']) assert.throws(() => build([record({ sources: [{ label: 'Nguồn', url }] })]));
});
test('weekly records reject duplicate identifiers and invalid publication dates', () => {
  assert.throws(() => build([record(), record()]));
  assert.throws(() => build([record({ publishedAt: 'not-a-date' })]));
});
