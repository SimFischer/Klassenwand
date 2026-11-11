import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("../lib/db/index", () => ({ database: () => state.db }));
import { POST as create } from "../app/api/activities/route";
import { handlers } from "../lib/routes";
import { POST as cleanupRoute } from "../app/api/cron/cleanup/route";
import { activities, quizImages } from "../lib/db/schema";
import {
  GET as getImage,
  PUT as putImage,
} from "../app/api/q/[id]/image/[question]/route";
import { eq } from "drizzle-orm";
import type { Action } from "../lib/validation";
let pg: PGlite;
const participant = "46e9029c-b268-44b5-b0f4-123456789abc";
function req(path: string, method = "GET", data?: unknown, key?: string) {
  return new Request("http://localhost" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-participant-id": participant,
      ...(key ? { "x-host-key": key } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
}
beforeAll(async () => {
  pg = new PGlite();
  await migrate(drizzle(pg), { migrationsFolder: "./drizzle" });
  state.db = drizzle(pg);
});
afterAll(async () => {
  await pg.close();
});
describe("API mit echter PostgreSQL-Engine (PGlite)", () => {
  it("erstellt, pollt, moderiert und löscht eine Wortwolke", async () => {
    const response = await create(
      req("/api/activities", "POST", {
        kind: "w",
        title: "Frage?",
        participantId: participant,
      }),
    );
    expect(response.status).toBe(201);
    const { id, key } = await response.json();
    const ctx = { params: Promise.resolve({ id }) },
      api = handlers("w");
    expect((await api.GET(req("/api/w/" + id), ctx)).status).toBe(200);
    let result = await api.POST(
      req("/api/w/" + id, "POST", { action: "word", text: "Idee" }),
      ctx,
    );
    expect(result.status).toBe(200);
    let data = await (await api.GET(req("/api/w/" + id), ctx)).json();
    expect(data).not.toHaveProperty("hostHash");
    expect(data.data).not.toHaveProperty("participants");
    expect(data.data.words[0].text).toBe("Idee");
    expect(
      await (
        await api.GET(req(`/api/w/${id}?since=${data.revision}`), ctx)
      ).json(),
    ).toEqual({ unchanged: true });
    expect(
      (
        await api.POST(
          req(
            "/api/w/" + id,
            "POST",
            { action: "blacklist", word: "Idee" },
            "falsch",
          ),
          ctx,
        )
      ).status,
    ).toBe(403);
    result = await api.POST(
      req("/api/w/" + id, "POST", { action: "blacklist", word: "Idee" }, key),
      ctx,
    );
    expect(result.status).toBe(200);
    expect(
      (
        await api.POST(
          req("/api/w/" + id, "POST", { action: "word", text: "IDEE!" }),
          ctx,
        )
      ).status,
    ).toBe(200);
    data = await (await api.GET(req("/api/w/" + id), ctx)).json();
    expect(data.data.words).toEqual([]);
    expect(data.data.ownCount).toBe(2);
    expect(
      (await api.DELETE(req("/api/w/" + id, "DELETE", undefined, key), ctx))
        .status,
    ).toBe(200);
    expect((await api.GET(req("/api/w/" + id), ctx)).status).toBe(404);
  });
  it("moderiert Beiträge, Antworten und Bezüge über die Pinnwand-API", async () => {
    const { id, key } = await (
      await create(
        req("/api/activities", "POST", {
          kind: "t",
          title: "Diskussion",
          columns: ["Frage", "Ideen"],
          participantId: participant,
        }),
      )
    ).json();
    const api = handlers("t"),
      ctx = { params: Promise.resolve({ id }) };
    const state = async (key?: string) =>
      await (
        await api.GET(req("/api/t/" + id, "GET", undefined, key), ctx)
      ).json();
    const act = async (data: unknown, key?: string) =>
      await api.POST(req("/api/t/" + id, "POST", data, key), ctx);
    const initial = await state();
    const c1 = initial.data.columns[0].id,
      c2 = initial.data.columns[1].id;
    expect(
      (await act({ action: "settings", approval: true }, key)).status,
    ).toBe(200);
    expect(
      (await act({ action: "post", columnId: c1, text: "These" })).status,
    ).toBe(200);
    const id1 = (await state()).data.posts[0].id;
    const other = req("/api/t/" + id);
    other.headers.set(
      "x-participant-id",
      "a3e9029c-b268-44b5-b0f4-123456789abc",
    );
    expect((await (await api.GET(other, ctx)).json()).data.posts).toHaveLength(
      0,
    );
    expect(
      (await act({ action: "post-moderate", id: id1, approved: true })).status,
    ).toBe(403);
    expect(
      (await act({ action: "post-moderate", id: id1, approved: true }, key))
        .status,
    ).toBe(200);
    expect((await (await api.GET(other, ctx)).json()).data.posts).toHaveLength(
      1,
    );
    expect(
      (
        await act({
          action: "post",
          columnId: c2,
          text: "Bezug",
          referenceId: id1,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await act({
          action: "post",
          columnId: c1,
          text: "Antwort",
          parentId: id1,
        })
      ).status,
    ).toBe(200);
    expect(
      (await act({ action: "post-move", id: id1, columnId: c2 }, key)).status,
    ).toBe(200);
    const after = await state(key);
    expect(after.data.posts).toHaveLength(3);
    expect(
      after.data.posts.every((p: { columnId: string }) => p.columnId === c2),
    ).toBe(true);
    expect(
      (await act({ action: "column-update", id: c2, closed: true }, key))
        .status,
    ).toBe(200);
    expect(
      (await act({ action: "post", columnId: c2, text: "Zu spät" })).status,
    ).toBe(409);
    expect(
      (await api.DELETE(req("/api/t/" + id, "DELETE", undefined, key), ctx))
        .status,
    ).toBe(200);
  });
  it("weist Schülerzugriffe auf Verwaltung und fremde Beiträge serverseitig zurück", async () => {
    const { id, key } = await (
      await create(
        req("/api/activities", "POST", {
          kind: "t",
          title: "Rechteprüfung",
          columns: ["Frage", "Ideen"],
          participantId: participant,
        }),
      )
    ).json();
    const api = handlers("t"),
      ctx = { params: Promise.resolve({ id }) };
    const state = async () => (await api.GET(req(`/api/t/${id}`), ctx)).json();
    const initial = await state();
    const c1 = initial.data.columns[0].id,
      c2 = initial.data.columns[1].id;
    await api.POST(
      req(
        `/api/t/${id}`,
        "POST",
        { action: "post", columnId: c1, text: "Lehrerbeitrag" },
        key,
      ),
      ctx,
    );
    const before = await state();
    const postId = before.data.posts[0].id;
    const forbidden: Action[] = [
      { action: "post-edit", id: postId, text: "Fremde Änderung" },
      { action: "post-delete", id: postId },
      { action: "post-moderate", id: postId, hidden: true },
      { action: "post-moderate", id: postId, hidden: false },
      { action: "post-moderate", id: postId, approved: true },
      { action: "post-move", id: postId, columnId: c2 },
      { action: "column-add", title: "Unerlaubt" },
      { action: "column-update", id: c1, title: "Unerlaubt" },
      { action: "column-update", id: c1, closed: true },
      { action: "column-update", id: c1, closed: false },
      { action: "column-move", id: c1, direction: 1 },
      { action: "column-delete", id: c1 },
    ];
    for (const action of forbidden) {
      const request = req(`/api/t/${id}`, "POST", action);
      request.headers.set(
        "x-participant-id",
        "a3e9029c-b268-44b5-b0f4-123456789abc",
      );
      expect((await api.POST(request, ctx)).status, action.action).toBe(403);
    }
    expect(await state()).toEqual(before);
    expect(
      (
        await api.POST(
          req(
            `/api/t/${id}`,
            "POST",
            { action: "column-delete", id: c1 },
            "falsch",
          ),
          ctx,
        )
      ).status,
    ).toBe(403);
  });
  it("validiert Eingaben und begrenzt die Erstellung dauerhaft", async () => {
    expect(
      (
        await create(
          req("/api/activities", "POST", {
            kind: "b",
            title: "Falsch",
            participantId: participant,
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await create(
          req("/api/activities", "POST", {
            kind: "w",
            title: "x".repeat(17000),
            participantId: participant,
          }),
        )
      ).status,
    ).toBe(413);
    const device = "b3e9029c-b268-44b5-b0f4-123456789abc";
    for (let i = 0; i < 10; i++)
      expect(
        (
          await create(
            req("/api/activities", "POST", {
              kind: "w",
              title: "Limit-Test",
              participantId: device,
            }),
          )
        ).status,
      ).toBe(201);
    expect(
      (
        await create(
          req("/api/activities", "POST", {
            kind: "w",
            title: "Limit-Test",
            participantId: device,
          }),
        )
      ).status,
    ).toBe(429);
  });
  it("weist abgelaufene Aktivitäten sofort ab und räumt physisch auf", async () => {
    const { id } = await (
      await create(
        req("/api/activities", "POST", {
          kind: "t",
          title: "Pinnwand",
          participantId: participant,
        }),
      )
    ).json();
    await drizzle(pg)
      .update(activities)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(activities.id, id));
    const ctx = { params: Promise.resolve({ id }) };
    expect((await handlers("t").GET(req("/api/t/" + id), ctx)).status).toBe(
      404,
    );
    expect(
      (
        await handlers("t").POST(
          req("/api/t/" + id, "POST", {
            action: "post",
            columnId: "x",
            text: "Test",
          }),
          ctx,
        )
      ).status,
    ).toBe(404);
    process.env.CRON_SECRET = "x".repeat(40);
    expect(
      (
        await cleanupRoute(
          new Request("http://localhost/api/cron/cleanup", { method: "POST" }),
        )
      ).status,
    ).toBe(403);
    const cleaned = await cleanupRoute(
      new Request("http://localhost/api/cron/cleanup", {
        method: "POST",
        headers: { authorization: "Bearer " + process.env.CRON_SECRET },
      }),
    );
    expect((await cleaned.json()).deleted).toBe(1);
    expect(
      await drizzle(pg).select().from(activities).where(eq(activities.id, id)),
    ).toHaveLength(0);
  });
  it("erstellt eine Umfrage, nimmt Stimmen an und wertet sie aus", async () => {
    const response = await create(
      req("/api/activities", "POST", {
        kind: "u",
        title: "Wandertag?",
        options: ["Zoo", "Museum"],
        chart: "pie",
        participantId: participant,
      }),
    );
    expect(response.status).toBe(201);
    const { id, key, hostUrl } = await response.json();
    expect(hostUrl).toMatch(/^\/u\//);
    const ctx = { params: Promise.resolve({ id }) },
      api = handlers("u");
    let data = await (await api.GET(req("/api/u/" + id), ctx)).json();
    expect(data.data.options).toHaveLength(2);
    expect(data.data.chart).toBe("pie");
    expect(data.data.results).toEqual([]);
    const option = data.data.options[1].id;
    const vote = await api.POST(
      req("/api/u/" + id, "POST", { action: "vote", options: [option] }),
      ctx,
    );
    expect(vote.status).toBe(200);
    data = await (
      await api.GET(req("/api/u/" + id, "GET", undefined, key), ctx)
    ).json();
    expect(data.data.total).toBe(1);
    expect(data.data.results[1].count).toBe(1);
    expect(data.data).not.toHaveProperty("ballots");
    expect((await handlers("w").GET(req("/api/w/" + id), ctx)).status).toBe(
      404,
    );
  });
});

describe("Quiz-Bilder", () => {
  it("lädt ein Bild hoch und gibt es erst frei, wenn die Frage dran ist", async () => {
    const response = await create(
      req("/api/activities", "POST", {
        kind: "q",
        title: "Bilderquiz",
        questions: [
          { text: "Was ist das?", options: ["Hund", "Katze"], correct: 0 },
          {
            text: "Und das?",
            options: ["Wahr", "Falsch"],
            correct: 1,
            kind: "tf",
          },
        ],
        participantId: participant,
      }),
    );
    expect(response.status).toBe(201);
    const { id, key } = await response.json();
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString(
      "base64",
    );
    const image = (
      n: number,
      k?: string,
      data = `data:image/jpeg;base64,${jpeg}`,
    ) =>
      putImage(req(`/api/q/${id}/image/${n}`, "PUT", { data }, k), {
        params: Promise.resolve({ id, question: String(n) }),
      });
    const get = (n: number) =>
      getImage(req(`/api/q/${id}/image/${n}`), {
        params: Promise.resolve({ id, question: String(n) }),
      });
    expect((await image(0)).status).toBe(403);
    expect((await image(0, "falsch")).status).toBe(403);
    expect((await image(5, key)).status).toBe(404);
    expect(
      (await image(0, key, "data:image/svg+xml;base64,PHN2Zz4=")).status,
    ).toBe(400);
    expect((await image(0, key)).status).toBe(200);
    expect((await get(0)).status).toBe(404); // Quiz noch in der Lobby
    const ctx = { params: Promise.resolve({ id }) },
      api = handlers("q");
    await api.POST(
      req(`/api/q/${id}`, "POST", { action: "quiz", step: "start" }, key),
      ctx,
    );
    const shown = await get(0);
    expect(shown.status).toBe(200);
    expect(shown.headers.get("content-type")).toBe("image/jpeg");
    expect(Buffer.from(await shown.arrayBuffer())[0]).toBe(0xff);
    const view = (await (await api.GET(req(`/api/q/${id}`), ctx)).json()).data
      .quiz;
    expect(view.question.image).toBe(`/api/q/${id}/image/0`);
    await api.POST(
      req(`/api/q/${id}`, "POST", { action: "quiz", step: "reveal" }, key),
      ctx,
    );
    // Löschen der Aktivität entfernt auch die Bilder.
    await api.DELETE(req(`/api/q/${id}`, "DELETE", undefined, key), ctx);
    expect(
      await drizzle(pg)
        .select()
        .from(quizImages)
        .where(eq(quizImages.activityId, id)),
    ).toHaveLength(0);
  });
});
