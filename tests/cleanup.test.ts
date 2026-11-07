import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";

describe("Render-Aufräumjob", () => {
  it.each([
    { status: 200, result: { deleted: 3 }, exit: 0 },
    { status: 403, result: { error: "Nicht erlaubt" }, exit: 1 },
    { status: 200, result: { deleted: -1 }, exit: 1 },
  ])(
    "prüft HTTP-Status und Ergebnis: $status / $result",
    ({ status, result, exit }) => {
      const script = new URL("../scripts/cleanup.mjs", import.meta.url).href;
      const testSecret = "test-secret-".repeat(4);
      const run = spawnSync(
        process.execPath,
        [
          "--input-type=module",
          "--eval",
          `
      globalThis.fetch = async (url, options) => {
        if (url !== 'http://qa.internal:10000/api/cron/cleanup' ||
            options.method !== 'POST' ||
            options.headers.Authorization !== 'Bearer ' + process.env.CRON_SECRET ||
            options.redirect !== 'error' || !options.signal) throw new Error('Ungültiger Aufruf');
        return Response.json(${JSON.stringify(result)}, { status: ${status} });
      };
      await import(${JSON.stringify(script)});
    `,
        ],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            APP_HOSTPORT: "qa.internal:10000",
            CRON_SECRET: testSecret,
          },
        },
      );
      expect(run.status).toBe(exit);
      expect(run.stdout + run.stderr).not.toContain(testSecret);
      expect(run.stdout + run.stderr).not.toContain("qa.internal");
      if (exit === 0) expect(run.stdout).toContain("3 Aktivitäten gelöscht");
    },
  );
});
