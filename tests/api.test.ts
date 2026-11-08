import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("../lib/db/index", () => ({ database: () => state.db }));
import { POST as create } from "../app/api/activities/route";
import { handlers } from "../lib/routes";
import { POST as cleanupRoute } from "../app/api/cron/cleanup/route";
import { activities } from "../lib/db/schema";
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
});
