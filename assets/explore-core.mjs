export const normalize = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function matches(text, query) {
  const haystack = normalize(text);
  return normalize(query).trim().split(/\s+/).filter(Boolean).every(word => haystack.includes(word));
}
export function searchRecords(records, query, kind = '') {
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  return records.filter(r => (!kind || r.kind === kind) && matches(`${r.title} ${r.kind} ${r.text}`, query))
    .map(r => ({...r, score: words.reduce((sum,w) => sum + (normalize(r.title).includes(w) ? 5 : 1), 0)}))
    .sort((a,b) => b.score-a.score);
}
