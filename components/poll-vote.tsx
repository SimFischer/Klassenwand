"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { PollOption } from "@/lib/types";
import { pollColors } from "./poll-chart";

export function PollVote({
  options,
  multiple,
  ownVotes,
  paused,
  busy,
  onVote,
}: {
  options: PollOption[];
  multiple: boolean;
  ownVotes: string[];
  paused: boolean;
  busy: boolean;
  onVote: (options: string[]) => Promise<boolean>;
}) {
  const [selected, setSelected] = useState<string[]>(ownVotes);
  const saved = ownVotes.join("|");
  // Nach dem Neuladen oder Zurücksetzen durch die Lehrkraft die gespeicherte Wahl übernehmen.
  useEffect(() => setSelected(saved ? saved.split("|") : []), [saved]);
  const voted = ownVotes.length > 0;
  const changed =
    selected.length !== ownVotes.length ||
    selected.some((id) => !ownVotes.includes(id));
  function toggle(id: string) {
    setSelected((current) =>
      multiple
        ? current.includes(id)
          ? current.filter((x) => x !== id)
          : [...current, id]
        : [id],
    );
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (selected.length) await onVote(selected);
  }
  return (
    <form className="poll-form" onSubmit={submit}>
      <fieldset disabled={busy || paused}>
        <legend>
          {multiple
            ? "Wähle eine oder mehrere Antworten"
            : "Wähle eine Antwort"}
        </legend>
        {options.map((o, i) => (
          <label
            key={o.id}
            className={`poll-option ${selected.includes(o.id) ? "selected" : ""}`}
            style={
              {
                "--option-color": pollColors[i % pollColors.length],
              } as React.CSSProperties
            }
          >
            <input
              type={multiple ? "checkbox" : "radio"}
              name="poll-option"
              value={o.id}
              checked={selected.includes(o.id)}
              onChange={() => toggle(o.id)}
            />
            <span>{o.text}</span>
          </label>
        ))}
        <button
          className="primary"
          disabled={!selected.length || (voted && !changed)}
        >
          {voted ? "Stimme ändern →" : "Abstimmen →"}
        </button>
      </fieldset>
      <p className="hint">
        {paused
          ? "Die Abstimmung ist gerade geschlossen."
          : voted
            ? "Deine Stimme ist angekommen. Solange die Abstimmung offen ist, kannst du sie noch ändern."
            : "Du kannst einmal abstimmen."}
      </p>
    </form>
  );
}
