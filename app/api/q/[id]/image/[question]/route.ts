import { body, json, safe, sameOrigin } from "@/lib/api";
import { validHostKey } from "@/lib/auth";
import { demand } from "@/lib/errors";
import {
  findActivity,
  findQuizImage,
  saveQuizImage,
} from "@/lib/db/repository";
import { parseImage } from "@/lib/quiz/image";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; question: string }> };

function index(value: string) {
  const n = Number(value);
  demand(Number.isInteger(n) && n >= 0 && n < 30, 404, "Bild nicht gefunden.");
  return n;
}

/** Bild einer Frage. Erst sichtbar, sobald die Frage im Quiz an der Reihe ist. */
export async function GET(_request: Request, ctx: Context) {
  return safe(async () => {
    const { id, question } = await ctx.params;
    const n = index(question);
    const quiz = (await findActivity(id, "q")).data.quiz;
    demand(
      quiz && quiz.phase !== "lobby" && n <= quiz.current,
      404,
      "Bild noch nicht freigegeben.",
    );
    const image = await findQuizImage(id, n);
    return new Response(Buffer.from(image.data, "base64"), {
      headers: {
        "Content-Type": image.mime,
        "Cache-Control": "private, max-age=604800, immutable",
        "Content-Disposition": "inline",
      },
    });
  });
}

/** Upload durch die Lehrkraft direkt nach dem Erstellen des Quiz. */
export async function PUT(request: Request, ctx: Context) {
  return safe(async () => {
    sameOrigin(request);
    const { id, question } = await ctx.params;
    const n = index(question);
    const { mime, data } = parseImage(await body(request, 700_000));
    await saveQuizImage(id, n, mime, data, (row) =>
      demand(
        validHostKey(request.headers.get("x-host-key"), row.hostHash),
        403,
        "Nur die Lehrkraft darf Bilder hochladen.",
      ),
    );
    return json({ ok: true });
  });
}
