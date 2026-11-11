"use client";
import { useState } from "react";
import type { Action } from "@/lib/validation";

type Entry = { text: string; count: number; normalized: string };

/** Lehrkraft fasst ähnliche Begriffe (z. B. „Freunde“ und „Freundschaft“) zu einem zusammen. */
export function WordMerge({
  words,
  merges,
  busy,
  send,
}: {
  words: Entry[];
  merges: Record<string, string>;
  busy: boolean;
  send: (action: Action) => Promise<boolean>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const visible = new Set(words.map((w) => w.normalized));
  const chosen = selected.filter((w) => visible.has(w));
  const groups = new Map<string, string[]>();
  for (const [from, to] of Object.entries(merges))
    groups.set(to, [...(groups.get(to) ?? []), from]);
  const label = (normalized: string) =>
    words.find((w) => w.normalized === normalized)?.text ?? normalized;
  const sorted = [...words].sort(
    (a, b) => b.count - a.count || a.text.localeCompare(b.text, "de"),
  );
  return (
    <details className="word-merge no-print">
      <summary>
        Wörter zusammenfassen
        {groups.size > 0
          ? ` (${groups.size} ${groups.size === 1 ? "Gruppe" : "Gruppen"})`
          : ""}
      </summary>
      <p className="hint">
        Ähnliche Begriffe anhaken und zusammenfassen. Sie zählen dann als ein
        Wort; angezeigt wird der häufigste.
      </p>
      {sorted.length < 2 ? (
        <p className="hint">Dafür braucht es mindestens zwei Begriffe.</p>
      ) : (
        <div className="merge-list">
          {sorted.map((w) => (
            <label key={w.normalized} className="merge-chip">
              <input
                type="checkbox"
                checked={chosen.includes(w.normalized)}
                onChange={(e) =>
                  setSelected((s) =>
                    e.target.checked
                      ? [...s, w.normalized]
                      : s.filter((x) => x !== w.normalized),
                  )
                }
              />
              {w.text} <small>{w.count}</small>
            </label>
          ))}
        </div>
      )}
      <button
        className="merge-button"
        disabled={busy || chosen.length < 2}
        onClick={async () => {
          if (await send({ action: "merge", words: chosen })) setSelected([]);
        }}
      >
        ⇢ {chosen.length} Begriffe zusammenfassen
      </button>
      {groups.size > 0 && (
        <ul className="merge-groups">
          {[...groups].map(([target, members]) => (
            <li key={target}>
              <b>{label(target)}</b>
              <span> ← {members.join(", ")}</span>
              <button
                className="subtle"
                disabled={busy}
                onClick={() => void send({ action: "unmerge", word: target })}
              >
                trennen ↶
              </button>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
