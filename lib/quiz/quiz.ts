import type { ActivityData, QuizPlayer, QuizState, QuizView } from "../types";
import type { Action } from "../validation";
import { demand } from "../errors";
import { newId } from "../auth";

/** Antworten, die bis zu dieser Zeit nach Fragenstart eingehen, erhalten volle Punkte (Abfrageverzögerung). */
const FULL_POINTS_MS = 2000;
/** Toleranz für Netzwerklaufzeit nach Ablauf des Countdowns. */
const GRACE_MS = 1500;

export function points(elapsed: number, seconds: number) {
  const limit = seconds * 1000;
  const late = Math.min(
    Math.max(
      (elapsed - FULL_POINTS_MS) / Math.max(limit - FULL_POINTS_MS, 1),
      0,
    ),
    1,
  );
  return Math.round(1000 - 500 * late);
}

export function cleanName(name: string) {
  return name.replace(/\s+/gu, " ").trim().slice(0, 20);
}

/**
 * Quiz-Aktionen. Teilnehmende spielen unter einem selbst gewählten Spitznamen;
 * die Gerätekennung wird nie an andere ausgegeben.
 */
export function quizAction(
  d: ActivityData,
  a: Action,
  host: boolean,
  participant: string,
  now: number,
) {
  const q = d.quiz;
  demand(q, 404, "Dieses Quiz existiert nicht mehr.");
  if (a.action === "join") {
    demand(!host, 403, "Die Lehrkraft spielt nicht mit.");
    const name = cleanName(a.name);
    demand(name.length > 0, 400, "Bitte gib einen Spitznamen ein.");
    const existing = q.players[participant];
    if (existing) existing.name = name;
    else {
      demand(Object.keys(q.players).length < 500, 429, "Dieses Quiz ist voll.");
      q.players[participant] = { id: newId(), name, score: 0, answers: {} };
    }
    return;
  }
  if (a.action === "answer") {
    demand(!host, 403, "Die Lehrkraft spielt nicht mit.");
    const player = q.players[participant];
    demand(player, 409, "Bitte gib zuerst einen Spitznamen ein.");
    demand(q.phase === "question", 409, "Gerade läuft keine Frage.");
    const question = q.questions[q.current];
    demand(!player.answers[question.id], 409, "Du hast schon geantwortet.");
    demand(
      a.choice < question.options.length,
      400,
      "Diese Antwort gibt es nicht.",
    );
    const elapsed = now - q.startedAt;
    demand(
      elapsed <= question.seconds * 1000 + GRACE_MS,
      409,
      "Die Zeit ist leider abgelaufen.",
    );
    const correct = a.choice === question.correct;
    const earned = correct ? points(elapsed, question.seconds) : 0;
    player.answers[question.id] = { choice: a.choice, correct, points: earned };
    player.score += earned;
    return;
  }
  demand(host, 403, "Nur die Lehrkraft steuert das Quiz.");
  if (a.action === "kick") {
    for (const [key, p] of Object.entries(q.players))
      if (p.id === a.player) delete q.players[key];
    return;
  }
  if (a.action === "quiz") {
    if (a.step === "start") {
      demand(q.phase === "lobby", 409, "Das Quiz läuft bereits.");
      q.phase = "question";
      q.current = 0;
      q.startedAt = now;
    } else if (a.step === "reveal") {
      if (q.phase !== "question") return; // doppelte automatische Auflösung ignorieren
      q.phase = "reveal";
    } else if (a.step === "next") {
      demand(q.phase === "reveal", 409, "Bitte zuerst die Frage auflösen.");
      if (q.current + 1 < q.questions.length) {
        q.current++;
        q.phase = "question";
        q.startedAt = now;
      } else q.phase = "finished";
    } else {
      q.phase = "lobby";
      q.current = 0;
      q.startedAt = 0;
      for (const p of Object.values(q.players)) {
        p.score = 0;
        p.answers = {};
      }
    }
    return;
  }
  demand(false, 400, "Aktion passt nicht zum Quiz.");
}

/**
 * Punktestand ohne die laufende Frage – sonst verriete eine Punktänderung vor der
 * Auflösung, ob die Antwort richtig war.
 */
function settledScore(q: QuizState, p: QuizPlayer) {
  const question = q.questions[q.current];
  return q.phase === "question" && question
    ? p.score - (p.answers[question.id]?.points ?? 0)
    : p.score;
}

function ranking(q: QuizState) {
  return Object.values(q.players)
    .map((p) => ({ ...p, score: settledScore(q, p) }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "de"));
}

/** Öffentliche Sicht auf das Quiz – ohne Gerätekennungen, Lösung erst nach Auflösung. */
export function quizView(
  q: QuizState,
  host: boolean,
  participant: string,
  now = Date.now(),
): QuizView {
  const question = q.questions[q.current];
  const revealed = q.phase === "reveal" || q.phase === "finished";
  const players = Object.values(q.players);
  const ranked = ranking(q);
  const me = q.players[participant];
  const own = me && question ? me.answers[question.id] : undefined;
  return {
    phase: q.phase,
    current: q.current,
    count: q.questions.length,
    question:
      q.phase === "lobby" || !question
        ? undefined
        : {
            text: question.text,
            options: question.options,
            seconds: question.seconds,
            correct: revealed ? question.correct : undefined,
          },
    remainingMs:
      q.phase === "question" && question
        ? Math.max(0, q.startedAt + question.seconds * 1000 - now)
        : 0,
    answered: question
      ? players.filter((p) => p.answers[question.id]).length
      : 0,
    players: players.length,
    distribution:
      revealed && question
        ? question.options.map(
            (_, i) =>
              players.filter((p) => p.answers[question.id]?.choice === i)
                .length,
          )
        : undefined,
    leaderboard:
      revealed || host
        ? ranked
            .slice(0, host && q.phase === "lobby" ? 500 : 10)
            .map(({ id, name, score }) => ({ id, name, score }))
        : [],
    me: me
      ? {
          name: me.name,
          score: settledScore(q, me),
          rank: ranked.findIndex((p) => p.id === me.id) + 1,
          answer: own
            ? {
                choice: own.choice,
                correct: revealed ? own.correct : undefined,
                points: revealed ? own.points : undefined,
              }
            : undefined,
        }
      : undefined,
  };
}
