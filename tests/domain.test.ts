import { describe, it, expect } from "vitest";
import {
  aggregate,
  normalizeWord,
  isBlacklisted,
} from "../lib/wordcloud/words";
import {
  hashKey,
  validHostKey,
  newHostKey,
  mayEdit,
  validSecret,
} from "../lib/auth";
import { applyAction, snapshot } from "../lib/activity";
import { fixture } from "./fixtures";
describe("Normalisierung und Blacklist", () => {
  it("entfernt Randzeichen und vereinheitlicht Leerzeichen und Großschreibung", () => {
    expect(normalizeWord("  „Gute   IDEEN!“  ")).toBe("gute ideen");
    expect(normalizeWord("E-Mail")).toBe("e-mail");
    expect(normalizeWord("...")).toBe("");
  });
  it("zeigt die häufigste Schreibweise und zählt alle Varianten", () => {
    const a = fixture();
    for (const [i, text] of ["IDEEN", "Ideen", "Ideen"].entries())
      applyAction(a, { action: "word", text }, false, `p${i}`);
    expect(aggregate(a.data.words, [])).toEqual([
      { text: "Ideen", normalized: "ideen", count: 3 },
    ]);
  });
  it("ignoriert neue Blacklist-Begriffe still und erlaubt Wiederherstellen", () => {
    const a = fixture();
    applyAction(a, { action: "word", text: "Hallo" }, false, "p");
    applyAction(
      a,
      { action: "blacklist", word: "hallo", restore: false },
      true,
      "host",
    );
    expect(snapshot(a, false, "p").data.words).toEqual([]);
    expect(isBlacklisted(" HALLO! ", a.data.blacklist)).toBe(true);
    expect(() =>
      applyAction(a, { action: "word", text: "HALLO!" }, false, "p"),
    ).not.toThrow();
    expect(a.data.words).toHaveLength(1);
    applyAction(
      a,
      { action: "blacklist", word: "hallo", restore: true },
      true,
      "host",
    );
    expect(snapshot(a, false, "p").data.words[0].count).toBe(1);
  });
  it("begrenzt Einsendungen und setzt sie explizit zurück", () => {
    const a = fixture();
    for (let i = 0; i < 3; i++)
      applyAction(a, { action: "word", text: "Test" }, false, "p");
    expect(() =>
      applyAction(a, { action: "word", text: "Test" }, false, "p"),
    ).toThrow("alle deine Begriffe");
    applyAction(a, { action: "reset" }, true, "host");
    expect(a.data.participants.p.count).toBe(0);
  });
});
describe("Rechte", () => {
  it("prüft zufällige geheime Schlüssel auch bei abweichender Länge", () => {
    const key = newHostKey();
    expect(key.length).toBeGreaterThanOrEqual(32);
    expect(validHostKey(key, hashKey(key))).toBe(true);
    for (const bad of [null, "", key + "x", "falsch"])
      expect(validHostKey(bad, hashKey(key))).toBe(false);
    expect(validHostKey(key, "ungültig")).toBe(false);
    expect(validSecret("abc", "abc")).toBe(false);
  });
  it("erlaubt eigene Änderungen nur innerhalb von zehn Minuten", () => {
    expect(mayEdit("a", "a", 1000, 600999)).toBe(true);
    expect(mayEdit("a", "a", 1000, 601000)).toBe(false);
    expect(mayEdit("b", "a", 1000, 2000)).toBe(false);
  });
  it("verweigert Moderation ohne Host-Recht", () => {
    expect(() =>
      applyAction(
        fixture(),
        { action: "blacklist", word: "Test", restore: false },
        false,
        "p",
      ),
    ).toThrow("Lehrkraft");
    expect(() =>
      applyAction(
        fixture("t"),
        { action: "column-delete", id: "c1" },
        false,
        "p",
      ),
    ).toThrow("Lehrkraft");
  });
});
describe("Text-Pinnwand", () => {
  it("hält Freigaben und Gerätekennungen von anderen Geräten fern", () => {
    const a = fixture("t");
    a.data.approval = true;
    applyAction(
      a,
      { action: "post", columnId: "c1", text: "Meine These", author: "" },
      false,
      "p",
    );
    expect(snapshot(a, false, "other").data.posts).toHaveLength(0);
    const own = snapshot(a, false, "p").data.posts[0];
    expect(own.own).toBe(true);
    expect(own).not.toHaveProperty("participant");
    expect(snapshot(a, true, "host").data.posts).toHaveLength(1);
  });
  it("führt Antworten auf Antworten in einer Ebene und verschiebt sie zusammen", () => {
    const a = fixture("t");
    applyAction(
      a,
      { action: "post", columnId: "c1", text: "These", author: "" },
      false,
      "p",
    );
    const root = a.data.posts[0];
    applyAction(
      a,
      {
        action: "post",
        columnId: "c1",
        text: "Antwort",
        author: "A",
        parentId: root.id,
      },
      false,
      "q",
    );
    const reply = a.data.posts[1];
    applyAction(
      a,
      {
        action: "post",
        columnId: "c1",
        text: "Weitere Antwort",
        author: "B",
        parentId: reply.id,
        replyTo: reply.id,
      },
      false,
      "r",
    );
    expect(a.data.posts[2].parentId).toBe(root.id);
    applyAction(
      a,
      { action: "post-move", id: root.id, columnId: "c2" },
      true,
      "host",
    );
    expect(a.data.posts.every((p) => p.columnId === "c2")).toBe(true);
  });
  it("verhindert Antworten auf unsichtbare Beiträge und fremde Änderungen", () => {
    const a = fixture("t");
    applyAction(
      a,
      { action: "post", columnId: "c1", text: "Test", author: "" },
      false,
      "p",
    );
    const id = a.data.posts[0].id;
    expect(() =>
      applyAction(a, { action: "post-edit", id, text: "Geändert" }, false, "q"),
    ).toThrow("Eigene Beiträge");
    applyAction(a, { action: "post-moderate", id, hidden: true }, true, "host");
    expect(() =>
      applyAction(
        a,
        {
          action: "post",
          columnId: "c1",
          text: "Antwort",
          author: "",
          parentId: id,
        },
        false,
        "q",
      ),
    ).toThrow("nicht gefunden");
  });
  it("prüft Rate-Limit, Spaltenschluss und Freigabe nach Bearbeitung", () => {
    const a = fixture("t");
    a.data.columns[0].closed = true;
    expect(() =>
      applyAction(
        a,
        { action: "post", columnId: "c1", text: "Test", author: "" },
        false,
        "p",
      ),
    ).toThrow("geschlossen");
    const b = fixture("t");
    applyAction(
      b,
      { action: "post", columnId: "c1", text: "Test", author: "" },
      false,
      "p",
      1000,
    );
    b.data.approval = true;
    applyAction(
      b,
      { action: "post-edit", id: b.data.posts[0].id, text: "Neu" },
      false,
      "p",
      2000,
    );
    expect(b.data.posts[0].approved).toBe(false);
    for (let i = 0; i < 18; i++)
      applyAction(
        b,
        { action: "post-edit", id: b.data.posts[0].id, text: "Neu" },
        false,
        "p",
        2000,
      );
    expect(() =>
      applyAction(
        b,
        { action: "post-edit", id: b.data.posts[0].id, text: "Neu" },
        false,
        "p",
        2000,
      ),
    ).toThrow("warte");
  });
});

describe("Wörter zusammenfassen", () => {
  it("fasst zum häufigsten Begriff zusammen und kann wieder trennen", () => {
    const a = fixture();
    a.data.maxWords = 20;
    for (const [i, text] of [
      "Freunde",
      "Freunde",
      "Freundschaft",
      "Freund",
      "Spaß",
    ].entries())
      applyAction(a, { action: "word", text }, false, `p${i}`);
    applyAction(
      a,
      { action: "merge", words: ["freundschaft", "freunde"] },
      true,
      "host",
    );
    applyAction(
      a,
      { action: "merge", words: ["freund", "freunde"] },
      true,
      "host",
    );
    let words = snapshot(a, false, "p").data.words;
    expect(words).toContainEqual({
      text: "Freunde",
      normalized: "freunde",
      count: 4,
    });
    expect(words).toHaveLength(2);
    expect(snapshot(a, false, "p").data.merges).toBeUndefined();
    expect(snapshot(a, true, "host").data.merges).toEqual({
      freundschaft: "freunde",
      freund: "freunde",
    });
    expect(() =>
      applyAction(
        a,
        { action: "merge", words: ["spaß", "freunde"] },
        false,
        "p",
      ),
    ).toThrow();
    applyAction(
      a,
      { action: "blacklist", word: "freunde", restore: false },
      true,
      "host",
    );
    expect(snapshot(a, true, "host").data.words.map((w) => w.text)).toEqual([
      "Spaß",
    ]);
    applyAction(
      a,
      { action: "blacklist", word: "freunde", restore: true },
      true,
      "host",
    );
    applyAction(a, { action: "unmerge", word: "freunde" }, true, "host");
    words = snapshot(a, true, "host").data.words;
    expect(words).toHaveLength(4);
  });
});
