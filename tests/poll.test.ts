import { describe, expect, it } from "vitest";
import { applyAction, snapshot } from "../lib/activity";
import { createSchema } from "../lib/validation";
import { fixture } from "./fixtures";

function poll(multiple = false) {
  const a = fixture("u");
  a.data.showCloud = false;
  a.data.options = [
    { id: "o1", text: "Zoo" },
    { id: "o2", text: "Museum" },
    { id: "o3", text: "Kletterpark" },
  ];
  a.data.multiple = multiple;
  a.data.chart = "bar";
  a.data.ballots = {};
  return a;
}

describe("Umfrage", () => {
  it("zählt jede Person einmal und erlaubt das Ändern der Stimme", () => {
    const a = poll();
    applyAction(a, { action: "vote", options: ["o1"] }, false, "p1");
    applyAction(a, { action: "vote", options: ["o2"] }, false, "p2");
    applyAction(a, { action: "vote", options: ["o1"] }, false, "p2");
    const s = snapshot(a, true, "host");
    expect(s.data.total).toBe(2);
    expect(s.data.results.map((r) => r.count)).toEqual([2, 0, 0]);
    expect(s.data).not.toHaveProperty("ballots");
    expect(JSON.stringify(s)).not.toContain("p1");
  });
  it("verbirgt Ergebnisse vor Schülern, bis die Lehrkraft sie freigibt", () => {
    const a = poll();
    applyAction(a, { action: "vote", options: ["o3"] }, false, "p1");
    let s = snapshot(a, false, "p1");
    expect(s.data.results).toEqual([]);
    expect(s.data.ownVotes).toEqual(["o3"]);
    expect(snapshot(a, false, "p2").data.ownVotes).toEqual([]);
    applyAction(a, { action: "settings", showCloud: true }, true, "host");
    s = snapshot(a, false, "p2");
    expect(s.data.results.find((r) => r.id === "o3")?.count).toBe(1);
  });
  it("prüft Einfach-/Mehrfachauswahl, unbekannte Antworten und Pause", () => {
    const single = poll();
    expect(() =>
      applyAction(
        single,
        { action: "vote", options: ["o1", "o2"] },
        false,
        "p",
      ),
    ).toThrow("genau eine");
    expect(() =>
      applyAction(single, { action: "vote", options: ["x"] }, false, "p"),
    ).toThrow("gibt es nicht");
    applyAction(single, { action: "settings", paused: true }, true, "host");
    expect(() =>
      applyAction(single, { action: "vote", options: ["o1"] }, false, "p"),
    ).toThrow("geschlossen");
    const multi = poll(true);
    applyAction(
      multi,
      { action: "vote", options: ["o1", "o2", "o2"] },
      false,
      "p",
    );
    const s = snapshot(multi, true, "host");
    expect(s.data.total).toBe(1);
    expect(s.data.results.map((r) => r.count)).toEqual([1, 1, 0]);
  });
  it("lässt nur die Lehrkraft zurücksetzen und die Diagrammart wechseln", () => {
    const a = poll();
    applyAction(a, { action: "vote", options: ["o1"] }, false, "p");
    expect(() => applyAction(a, { action: "reset" }, false, "p")).toThrow();
    expect(() =>
      applyAction(a, { action: "settings", chart: "pie" }, false, "p"),
    ).toThrow();
    expect(() =>
      applyAction(a, { action: "vote", options: ["o1"] }, true, "host"),
    ).toThrow();
    applyAction(a, { action: "settings", chart: "pie" }, true, "host");
    applyAction(a, { action: "reset" }, true, "host");
    expect(a.data.chart).toBe("pie");
    expect(snapshot(a, true, "host").data.total).toBe(0);
  });
  it("verlangt beim Erstellen mindestens zwei Antworten", () => {
    const base = {
      kind: "u",
      title: "Wandertag?",
      participantId: "46e9029c-b268-44b5-b0f4-123456789abc",
    };
    expect(createSchema.safeParse({ ...base, options: ["Zoo"] }).success).toBe(
      false,
    );
    expect(
      createSchema.safeParse({ ...base, options: ["Zoo", "Museum"] }).success,
    ).toBe(true);
    expect(createSchema.safeParse({ ...base, kind: "w" }).success).toBe(true);
  });
});

describe("Umfrage, zweite Runde", () => {
  it("bewahrt nur die Summen der ersten Runde und vergleicht", () => {
    const a = poll();
    applyAction(a, { action: "vote", options: ["o1"] }, false, "p1");
    applyAction(a, { action: "vote", options: ["o1"] }, false, "p2");
    applyAction(a, { action: "settings", showCloud: true }, true, "host");
    expect(() => applyAction(a, { action: "round2" }, false, "p1")).toThrow();
    applyAction(a, { action: "round2" }, true, "host");
    expect(a.data.firstRound).toEqual({
      voters: 2,
      counts: { o1: 2, o2: 0, o3: 0 },
    });
    expect(a.data.showCloud).toBe(false);
    expect(snapshot(a, false, "p1").data.ownVotes).toEqual([]);
    expect(snapshot(a, false, "p1").data.firstRound).toBeUndefined();
    applyAction(a, { action: "vote", options: ["o2"] }, false, "p1");
    const s = snapshot(a, true, "host");
    expect(s.data.round).toBe(2);
    expect(s.data.total).toBe(1);
    expect(s.data.results.map((r) => [r.firstCount, r.count])).toEqual([
      [2, 0],
      [0, 1],
      [0, 0],
    ]);
    expect(() => applyAction(a, { action: "round2" }, true, "host")).toThrow();
    applyAction(a, { action: "reset" }, true, "host");
    expect(a.data.round).toBe(1);
    expect(
      snapshot(a, true, "host").data.results[0].firstCount,
    ).toBeUndefined();
  });
  it("startet keine zweite Runde ohne Stimmen", () => {
    expect(() =>
      applyAction(poll(), { action: "round2" }, true, "host"),
    ).toThrow("noch keine Stimmen");
  });
});
