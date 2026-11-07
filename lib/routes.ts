import { safe, body, json, sameOrigin } from "./api";
import { actionSchema, participantSchema } from "./validation";
import { changeActivity, findActivity } from "./db/repository";
import { validHostKey } from "./auth";
import { demand } from "./errors";
import { applyAction, snapshot } from "./activity";
import type { Activity, Kind } from "./types";
type Context = { params: Promise<{ id: string }> };
const activity = (row: Awaited<ReturnType<typeof findActivity>>): Activity => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  revision: row.revision,
  data: row.data,
  createdAt: row.createdAt.getTime(),
  expiresAt: row.expiresAt.getTime(),
});
export function handlers(kind: Kind) {
  return {
    GET: (request: Request, ctx: Context) =>
      safe(async () => {
        const { id } = await ctx.params;
        const row = await findActivity(id, kind);
        const key = request.headers.get("x-host-key");
        const host = validHostKey(key, row.hostHash);
        demand(!key || host, 403, "Der Lehrkraft-Schlüssel ist ungültig.");
        const participant = participantSchema.parse(
          request.headers.get("x-participant-id"),
        );
        if (
          new URL(request.url).searchParams.get("since") ===
          String(row.revision)
        )
          return json({ unchanged: true });
        return json(snapshot(activity(row), host, participant));
      }),
    POST: (request: Request, ctx: Context) =>
      safe(async () => {
        sameOrigin(request);
        const { id } = await ctx.params;
        const action = actionSchema.parse(await body(request));
        const participant = participantSchema.parse(
          request.headers.get("x-participant-id"),
        );
        await changeActivity(id, kind, (row) => {
          const key = request.headers.get("x-host-key"),
            host = validHostKey(key, row.hostHash);
          demand(!key || host, 403, "Der Lehrkraft-Schlüssel ist ungültig.");
          applyAction(activity(row), action, host, participant);
        });
        return json({ ok: true });
      }),
    DELETE: (request: Request, ctx: Context) =>
      safe(async () => {
        sameOrigin(request);
        const { id } = await ctx.params;
        await changeActivity(id, kind, (row) => {
          demand(
            validHostKey(request.headers.get("x-host-key"), row.hostHash),
            403,
            "Der Lehrkraft-Schlüssel ist ungültig.",
          );
          return "delete";
        });
        return json({ ok: true });
      }),
  };
}
