import { safe, json } from "@/lib/api";
import { validSecret } from "@/lib/auth";
import { demand } from "@/lib/errors";
import { cleanup } from "@/lib/db/repository";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return safe(async () => {
    demand(
      validSecret(
        request.headers.get("authorization")?.replace(/^Bearer /, "") ?? null,
        process.env.CRON_SECRET,
      ),
      403,
      "Nicht erlaubt.",
    );
    return json({ deleted: await cleanup() });
  });
}
// Vercel Cron ruft die Route mit GET und demselben Bearer-Secret auf.
export const GET = POST;
