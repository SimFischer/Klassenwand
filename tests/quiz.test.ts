import { describe, expect, it } from "vitest";
import { applyAction, snapshot } from "../lib/activity";
import { points } from "../lib/quiz/quiz";
import { createSchema } from "../lib/validation";
import { fixture } from "./fixtures";

function quiz() {
  const a = fixture("q");
  a.data.quiz = {
    questions: [
      {
        id: "q1",
        text: "Hauptstadt von Frankreich?",
        options: ["Lyon", "Paris", "Nizza"],
        correct: 1,
        seconds: 20,
      },
      {
        id: "q2",
        text: "2 + 2?",
        options: ["4", "5"],
        correct: 0,
        seconds: 10,
      },
    ],
    phase: "lobby",
    current: 0,
    startedAt: 0,
    players: {},
  };
  return a;
}
const t0 = 1_000_000;

describe("Quiz", () => {
  it("spielt eine Runde mit Punkten nach Schnelligkeit", () => {
    const a = quiz();
    applyAction(
      a,
      { action: "join", name: "  Flinker   Fuchs " },
      false,
      "p1",
      t0,
    );
    applyAction(a, { action: "join", name: "Kluger Dachs" }, false, "p2", t0);
    applyAction(a, { action: "quiz", step: "start" }, true, "host", t0);
    applyAction(a, { action: "answer", choice: 1 }, false, "p1", t0 + 1000);
    applyAction(a, { action: "answer", choice: 1 }, false, "p2", t0 + 15000);
    expect(() =>
      applyAction(a, { action: "answer", choice: 0 }, false, "p1", t0 + 2000),
    ).toThrow("schon geantwortet");
    let view = snapshot(a, false, "p1").data.quiz!;
    expect(view.question?.correct).toBeUndefined();
    expect(view.distribution).toBeUndefined();
    expect(view.me?.answer?.correct).toBeUndefined();
    expect(view.answered).toBe(2);
    expect(view.me).toMatchObject({ score: 0 });
    expect(
      snapshot(a, true, "host").data.quiz!.leaderboard.every(
        (p) => p.score === 0,
      ),
    ).toBe(true);
    applyAction(
      a,
      { action: "quiz", step: "reveal" },
      true,
      "host",
      t0 + 16000,
    );
    view = snapshot(a, false, "p1").data.quiz!;
    expect(view.question?.correct).toBe(1);
    expect(view.distribution).toEqual([0, 2, 0]);
    expect(view.me).toMatchObject({
      name: "Flinker Fuchs",
      score: 1000,
      rank: 1,
    });
    expect(view.leaderboard[1].score).toBeLessThan(1000);
    expect(view.leaderboard[1].score).toBeGreaterThanOrEqual(500);
    expect(JSON.stringify(snapshot(a, true, "host"))).not.toMatch(/"p1"|"p2"/);
  });
  it("lehnt zu späte Antworten, Fremdsteuerung und Antworten ohne Namen ab", () => {
    const a = quiz();
    applyAction(a, { action: "join", name: "A" }, false, "p1", t0);
    expect(() =>
      applyAction(a, { action: "quiz", step: "start" }, false, "p1", t0),
    ).toThrow("Lehrkraft");
    expect(() =>
      applyAction(a, { action: "answer", choice: 0 }, false, "p1", t0),
    ).toThrow("keine Frage");
    applyAction(a, { action: "quiz", step: "start" }, true, "host", t0);
    expect(() =>
      applyAction(a, { action: "answer", choice: 0 }, false, "p9", t0 + 10),
    ).toThrow("Spitznamen");
    expect(() =>
      applyAction(a, { action: "answer", choice: 3 }, false, "p1", t0 + 10),
    ).toThrow("gibt es nicht");
    expect(() =>
      applyAction(a, { action: "answer", choice: 1 }, false, "p1", t0 + 25000),
    ).toThrow("abgelaufen");
  });
  it("geht durch alle Fragen, zeigt das Endergebnis und startet neu", () => {
    const a = quiz();
    applyAction(a, { action: "join", name: "A" }, false, "p1", t0);
    applyAction(a, { action: "quiz", step: "start" }, true, "host", t0);
    expect(() =>
      applyAction(a, { action: "quiz", step: "next" }, true, "host", t0),
    ).toThrow("auflösen");
    applyAction(a, { action: "quiz", step: "reveal" }, true, "host", t0);
    applyAction(a, { action: "quiz", step: "reveal" }, true, "host", t0);
    applyAction(a, { action: "quiz", step: "next" }, true, "host", t0 + 100);
    expect(a.data.quiz!.current).toBe(1);
    applyAction(a, { action: "answer", choice: 0 }, false, "p1", t0 + 200);
    applyAction(a, { action: "quiz", step: "reveal" }, true, "host", t0);
    applyAction(a, { action: "quiz", step: "next" }, true, "host", t0);
    expect(a.data.quiz!.phase).toBe("finished");
    expect(snapshot(a, false, "p1").data.quiz!.me?.score).toBe(1000);
    applyAction(a, { action: "quiz", step: "restart" }, true, "host", t0);
    expect(a.data.quiz!.phase).toBe("lobby");
    expect(a.data.quiz!.players.p1).toMatchObject({ name: "A", score: 0 });
  });
  it("lässt die Lehrkraft unpassende Spitznamen entfernen", () => {
    const a = quiz();
    applyAction(a, { action: "join", name: "Unsinn" }, false, "p1", t0);
    const id = snapshot(a, true, "host").data.quiz!.leaderboard[0].id;
    applyAction(a, { action: "kick", player: id }, true, "host", t0);
    expect(snapshot(a, true, "host").data.total).toBe(0);
  });
  it("vergibt 1000 bis 500 Punkte und prüft das Erstellen", () => {
    expect(points(0, 20)).toBe(1000);
    expect(points(20000, 20)).toBe(500);
    expect(points(11000, 20)).toBe(750);
    const base = {
      kind: "q",
      title: "Quiz",
      participantId: "46e9029c-b268-44b5-b0f4-123456789abc",
    };
    expect(createSchema.safeParse(base).success).toBe(false);
    expect(
      createSchema.safeParse({
        ...base,
        questions: [{ text: "?", options: ["a", "b"], correct: 2 }],
      }).success,
    ).toBe(false);
    expect(
      createSchema.safeParse({
        ...base,
        questions: [{ text: "?", options: ["a", "b"], correct: 1 }],
      }).success,
    ).toBe(true);
  });
});
