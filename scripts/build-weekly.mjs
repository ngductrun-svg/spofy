import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/** Editorial source records: {id, status:'draft'|'verified', question, answer,
 * explanation, publishedAt (ISO date), sources:[{label,url:httpsURL}]}.
 * Drafts never enter the public JSON. This is a build-time editorial gate,
 * not a replacement for checking the scientific answer and its sources. */
export function verifiedWeeklyContent(input, now = Date.now()) {
  if (input?.schemaVersion !== 1 || !Array.isArray(input.items)) throw new Error('Cấu trúc câu hỏi không hợp lệ.');
  const identifiers = new Set();
  const items = input.items.filter(item => item.status === 'verified').map(item => {
    if (typeof item.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(item.id) || identifiers.has(item.id)) throw new Error('Mã câu hỏi phải hợp lệ và không trùng.');
    identifiers.add(item.id);
    for (const [key, max] of [['question', 400], ['answer', 3000], ['explanation', 8000]]) {
      if (typeof item[key] !== 'string' || !item[key].trim() || item[key].length > max) throw new Error(`Câu hỏi ${item.id} thiếu ${key} hợp lệ.`);
    }
    if (!Array.isArray(item.sources) || item.sources.length < 1 || item.sources.length > 10) throw new Error(`Câu hỏi ${item.id} cần nguồn đã đối chiếu.`);
    const sources = item.sources.map(source => {
      let url; try { url = new URL(source.url); } catch { throw new Error(`Nguồn của ${item.id} không hợp lệ.`); }
      if (url.protocol !== 'https:' || url.username || url.password || typeof source.label !== 'string' || !source.label.trim() || source.label.length > 300) throw new Error(`Nguồn của ${item.id} cần nhãn và URL HTTPS hợp lệ.`);
      return { label: source.label.trim(), url: url.href };
    });
    const published = Date.parse(item.publishedAt);
    if (!Number.isFinite(published)) throw new Error(`Câu hỏi ${item.id} cần ngày xuất bản hợp lệ.`);
    return { id: item.id, question: item.question.trim(), answer: item.answer.trim(), explanation: item.explanation.trim(), sources, publishedAt: new Date(published).toISOString() };
  }).filter(item => Date.parse(item.publishedAt) <= now).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return { schemaVersion: 1, items };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const input = JSON.parse(await readFile(new URL('../content/weekly-questions.json', import.meta.url), 'utf8'));
  const output = verifiedWeeklyContent(input);
  await writeFile(new URL('../public/science-weekly.json', import.meta.url), `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Câu hỏi đã xác minh được xuất bản: ${output.items.length}.`);
}
