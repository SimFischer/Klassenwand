import { describe, expect, it } from "vitest";
import { applyAction } from "../lib/activity";
import { mayEdit } from "../lib/auth";
import { AppError } from "../lib/errors";
import { fixture } from "./fixtures";

function board() {
  const activity = fixture("t");
  applyAction(
    activity,
    { action: "post", columnId: "c1", text: "These", author: "A" },
    false,
    "owner",
    1000,
  );
  return activity;
}

describe("Serverrechte der Text-Pinnwand", () => {
  it.each(["post-edit", "post-delete"] as const)(
    "%s erlaubt eigene Änderungen bis unmittelbar vor Ablauf der zehn Minuten",
    (action) => {
      for (const now of [1000, 600999]) {
        const a = board();
        applyAction(
          a,
          { action, id: a.data.posts[0].id, text: "Neu" },
          false,
          "owner",
          now,
        );
        if (action === "post-edit") expect(a.data.posts[0].text).toBe("Neu");
        else expect(a.data.posts).toHaveLength(0);
      }
    },
  );

  it.each(["post-edit", "post-delete"] as const)(
    "%s verweigert fremde, abgelaufene und zukünftige Beiträge",
    (action) => {
      for (const [participant, now] of [
        ["other", 2000],
        ["owner", 601000],
        ["owner", 999],
      ] as const) {
        const a = board();
        const posts = structuredClone(a.data.posts);
        expect(() =>
          applyAction(
            a,
            { action, id: a.data.posts[0].id, text: "Neu" },
            false,
            participant,
            now,
          ),
        ).toThrowError(
          new AppError(
            403,
            "Eigene Beiträge lassen sich nur innerhalb von 10 Minuten ändern.",
          ),
        );
        expect(a.data.posts).toEqual(posts);
      }
    },
  );

  it("erlaubt der Lehrkraft Änderungen auch nach Ablauf des Zeitfensters", () => {
    const a = board();
    const id = a.data.posts[0].id;
    applyAction(
      a,
      { action: "post-edit", id, text: "Korrektur" },
      true,
      "teacher",
      601000,
    );
    expect(a.data.posts[0].text).toBe("Korrektur");
    applyAction(a, { action: "post-delete", id }, true, "teacher", 601001);
    expect(a.data.posts).toHaveLength(0);
    expect(mayEdit("owner", "owner", 1000, 999)).toBe(false);
  });

  it("erlaubt Antworten auf fremde Beiträge, Folgeantworten und Bezüge", () => {
    const a = board();
    const root = a.data.posts[0].id;
    applyAction(
      a,
      {
        action: "post",
        columnId: "c1",
        text: "Antwort",
        author: "B",
        parentId: root,
      },
      false,
      "other",
      2000,
    );
    const reply = a.data.posts[1].id;
    applyAction(
      a,
      {
        action: "post",
        columnId: "c1",
        text: "Folgeantwort",
        author: "C",
        parentId: reply,
        replyTo: reply,
        referenceId: root,
      },
      false,
      "third",
      3000,
    );
    expect(a.data.posts[2]).toMatchObject({
      parentId: root,
      replyTo: reply,
      referenceId: root,
      approved: true,
    });
  });

  it.each(["paused", "closed"] as const)(
    "beachtet %s auch bei Antworten",
    (mode) => {
      const a = board();
      if (mode === "paused") a.data.paused = true;
      else a.data.columns[0].closed = true;
      expect(() =>
        applyAction(
          a,
          {
            action: "post",
            columnId: "c1",
            text: "Antwort",
            author: "",
            parentId: a.data.posts[0].id,
          },
          false,
          "other",
          2000,
        ),
      ).toThrow("geschlossen");
    },
  );
});
