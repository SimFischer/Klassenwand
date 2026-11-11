import { safe, body, json, sameOrigin } from "@/lib/api";
import { createSchema } from "@/lib/validation";
import { newHostKey, newId, hashKey } from "@/lib/auth";
import { createActivity } from "@/lib/db/repository";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return safe(async () => {
    sameOrigin(request);
    const input = createSchema.parse(await body(request));
    const id = newId(),
      key = newHostKey();
    await createActivity(
      {
        id,
        kind: input.kind,
        title: input.title,
        hostHash: hashKey(key),
        expiresAt: new Date(Date.now() + 7 * 86400000),
        data: {
          paused: false,
          showCloud: true,
          maxWords: input.maxWords,
          maxLength: input.maxLength,
          words: [],
          blacklist: [],
          columns:
            input.kind === "t"
              ? input.columns.map((title) => ({
                  id: newId(),
                  title,
                  closed: false,
                }))
              : [],
          posts: [],
          approval: false,
          participants: {},
          ...(input.kind === "u"
            ? {
                showCloud: false,
                options: input.options.map((text) => ({ id: newId(), text })),
                multiple: input.multiple,
                chart: input.chart,
                ballots: {},
              }
            : {}),
        },
      },
      input.participantId,
    );
    return json(
      { id, key, hostUrl: `/${input.kind}/${id}/host?key=${key}` },
      201,
    );
  });
}
