import { ZodError } from "zod";
import { AppError, demand } from "./errors";
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      Vary: "x-host-key, x-participant-id",
    },
  });
}
export async function safe(run: () => Promise<Response>) {
  try {
    return await run();
  } catch (e) {
    if (e instanceof AppError) return json({ error: e.message }, e.status);
    if (e instanceof ZodError || e instanceof SyntaxError)
      return json({ error: "Bitte überprüfe deine Eingaben." }, 400);
    return json(
      {
        error:
          "Der Server ist gerade nicht erreichbar. Bitte versuche es gleich erneut.",
      },
      503,
    );
  }
}
export async function body(request: Request) {
  demand(
    request.headers.get("content-type")?.includes("application/json"),
    415,
    "JSON erwartet.",
  );
  const reader = request.body?.getReader();
  demand(reader, 400, "Eingaben fehlen.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      demand(size <= 16384, 413, "Die Eingabe ist zu groß.");
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel();
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    all.set(chunk, at);
    at += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(all));
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  demand(
    !origin || origin === new URL(request.url).origin,
    403,
    "Dieser Zugriff ist nicht erlaubt.",
  );
}
