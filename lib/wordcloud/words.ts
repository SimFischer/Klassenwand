import type { Word } from "../types";
export function cleanWord(input: string) {
  return input
    .trim()
    .replace(/\s+/gu, " ")
    .replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, "");
}
export const normalizeWord = (input: string) =>
  cleanWord(input).toLocaleLowerCase("de-DE");
export const isBlacklisted = (input: string, blacklist: string[]) =>
  blacklist.includes(normalizeWord(input));
/** Folgt zusammengefassten Begriffen bis zum Hauptbegriff. */
export function resolveMerge(
  normalized: string,
  merges: Record<string, string> = {},
) {
  let key = normalized;
  for (let i = 0; i < 20 && merges[key] && merges[key] !== key; i++)
    key = merges[key];
  return key;
}
export function aggregate(
  words: Word[],
  blacklist: string[],
  merges: Record<string, string> = {},
) {
  const groups = new Map<
    string,
    {
      count: number;
      variants: Map<string, number>;
      own: Map<string, number>;
    }
  >();
  for (const word of words) {
    const key = resolveMerge(word.normalized, merges);
    if (blacklist.includes(word.normalized) || blacklist.includes(key))
      continue;
    const group = groups.get(key) ?? {
      count: 0,
      variants: new Map<string, number>(),
      own: new Map<string, number>(),
    };
    group.count++;
    group.variants.set(word.text, (group.variants.get(word.text) ?? 0) + 1);
    // Schreibweisen des Hauptbegriffs selbst haben Vorrang bei der Anzeige.
    if (word.normalized === key)
      group.own.set(word.text, (group.own.get(word.text) ?? 0) + 1);
    groups.set(key, group);
  }
  return [...groups].map(([normalized, g]) => ({
    normalized,
    count: g.count,
    text: [...(g.own.size ? g.own : g.variants)].sort(
      (a, b) => b[1] - a[1],
    )[0][0],
  }));
}
/** Fasst Begriffe zum häufigsten von ihnen zusammen. Bestehende Gruppen wandern mit. */
export function mergeWords(
  words: Word[],
  blacklist: string[],
  merges: Record<string, string>,
  selected: string[],
) {
  const keys = [
    ...new Set(selected.map((w) => resolveMerge(normalizeWord(w), merges))),
  ].filter(Boolean);
  if (keys.length < 2) return merges;
  const counts = new Map(
    aggregate(words, blacklist, merges).map((w) => [w.normalized, w.count]),
  );
  const target = [...keys].sort(
    (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0),
  )[0];
  const next = { ...merges };
  for (const [from, to] of Object.entries(next))
    if (keys.includes(to)) next[from] = target;
  for (const key of keys) if (key !== target) next[key] = target;
  delete next[target];
  return next;
}
/** Löst eine Gruppe wieder in einzelne Begriffe auf. */
export function unmergeWord(merges: Record<string, string>, target: string) {
  return Object.fromEntries(
    Object.entries(merges).filter(([, to]) => to !== target),
  );
}
