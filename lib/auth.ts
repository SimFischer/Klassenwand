import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
export const newId = () => randomBytes(8).toString("base64url");
export const newHostKey = () => randomBytes(32).toString("base64url");
export const hashKey = (key: string) =>
  createHash("sha256").update(key).digest("hex");
export function validHostKey(key: string | null, storedHash: string): boolean {
  const supplied = Buffer.from(hashKey(key ?? ""), "hex");
  const expected = Buffer.from(storedHash, "hex");
  return (
    expected.length === supplied.length &&
    timingSafeEqual(supplied, expected) &&
    !!key
  );
}
export function validSecret(
  supplied: string | null,
  expected: string | undefined,
) {
  return (
    !!expected &&
    expected.length >= 32 &&
    validHostKey(supplied, hashKey(expected))
  );
}
export function mayEdit(
  participant: string,
  owner: string,
  createdAt: number,
  now = Date.now(),
) {
  return participant === owner && now >= createdAt && now - createdAt < 600_000;
}
