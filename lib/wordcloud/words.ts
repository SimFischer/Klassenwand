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
export function aggregate(words: Word[], blacklist: string[]) {
  const groups = new Map<
    string,
    { count: number; variants: Map<string, number> }
  >();
  for (const word of words) {
    if (blacklist.includes(word.normalized)) continue;
    const group = groups.get(word.normalized) ?? {
      count: 0,
      variants: new Map<string, number>(),
    };
    group.count++;
    group.variants.set(word.text, (group.variants.get(word.text) ?? 0) + 1);
    groups.set(word.normalized, group);
  }
  return [...groups].map(([normalized, g]) => ({
    normalized,
    count: g.count,
    text: [...g.variants].sort((a, b) => b[1] - a[1])[0][0],
  }));
}
