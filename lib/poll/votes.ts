import type { ActivityData, PollResult } from "../types";
import type { Action } from "../validation";
import { demand } from "../errors";

/**
 * Umfrage-Aktionen. Jedes Gerät hat genau einen Stimmzettel, den es ersetzen kann,
 * solange die Eingabe offen ist. Damit zählt jede Person höchstens einmal.
 */
export function pollAction(
  d: ActivityData,
  a: Action,
  host: boolean,
  participant: string,
) {
  const options = d.options ?? [];
  if (a.action === "vote") {
    demand(!host, 403, "Die Lehrkraft stimmt nicht mit ab.");
    demand(!d.paused, 409, "Die Abstimmung ist gerade geschlossen.");
    const chosen = [...new Set(a.options)];
    demand(
      chosen.every((id) => options.some((o) => o.id === id)),
      400,
      "Diese Antwort gibt es nicht.",
    );
    demand(
      d.multiple || chosen.length === 1,
      400,
      "Bitte wähle genau eine Antwort.",
    );
    d.ballots = { ...(d.ballots ?? {}), [participant]: chosen };
    return;
  }
  demand(host, 403, "Nur die Lehrkraft darf die Umfrage verwalten.");
  if (a.action === "reset") {
    d.ballots = {};
    d.round = 1;
    delete d.firstRound;
    return;
  }
  if (a.action === "round2") {
    demand((d.round ?? 1) === 1, 409, "Die zweite Runde läuft bereits.");
    const voters = Object.keys(d.ballots ?? {}).length;
    demand(voters > 0, 409, "In der ersten Runde gibt es noch keine Stimmen.");
    // Für den Vergleich werden nur Summen behalten, keine Zuordnung zu Geräten.
    d.firstRound = {
      voters,
      counts: Object.fromEntries(tally(d).map((r) => [r.id, r.count])),
    };
    d.ballots = {};
    d.round = 2;
    d.paused = false;
    d.showCloud = false;
    return;
  }
  demand(false, 400, "Aktion passt nicht zur Umfrage.");
}

export function tally(d: ActivityData): PollResult[] {
  const counts = new Map<string, number>();
  for (const ballot of Object.values(d.ballots ?? {}))
    for (const id of ballot) counts.set(id, (counts.get(id) ?? 0) + 1);
  return (d.options ?? []).map((o) => ({
    ...o,
    count: counts.get(o.id) ?? 0,
    ...(d.firstRound ? { firstCount: d.firstRound.counts[o.id] ?? 0 } : {}),
  }));
}
