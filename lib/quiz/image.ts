import { z } from "zod";
import { demand } from "../errors";

/** Höchstgröße eines Bildes nach dem Verkleinern im Browser. */
export const MAX_IMAGE_BYTES = 450_000;

const imageSchema = z.object({
  data: z
    .string()
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/),
});

/** Prüft eine Data-URL und liefert MIME-Typ und Base64-Inhalt. Nur Rasterbilder, kein SVG. */
export function parseImage(input: unknown) {
  const { data } = imageSchema.parse(input);
  const [head, base64] = data.split(",");
  const mime = head.slice(5, head.indexOf(";"));
  const bytes = Buffer.from(base64, "base64");
  demand(
    bytes.length > 0 && bytes.length <= MAX_IMAGE_BYTES,
    413,
    "Das Bild ist zu groß.",
  );
  const signature =
    mime === "image/jpeg"
      ? bytes[0] === 0xff && bytes[1] === 0xd8
      : mime === "image/png"
        ? bytes[0] === 0x89 && bytes[1] === 0x50
        : bytes.subarray(8, 12).toString("ascii") === "WEBP";
  demand(signature, 400, "Das ist kein gültiges Bild.");
  return { mime, data: base64 };
}
