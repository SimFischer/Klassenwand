import { and, eq, gt, lte, sql } from "drizzle-orm";
import { database } from "./index";
import { activities, creationLimits } from "./schema";
import { demand } from "../errors";
export async function createActivity(
  row: typeof activities.$inferInsert,
  participant: string,
) {
  return database().transaction(async (tx) => {
    // Durable creation buckets: one per device/hour plus a bounded global bucket. Never use IPs.
    for (const [id, max] of [
      [`device:${participant}:${Math.floor(Date.now() / 3600000)}`, 10],
      [`global:${Math.floor(Date.now() / 3600000)}`, 200],
    ] as const) {
      const [bucket] = await tx
        .insert(creationLimits)
        .values({ id, count: 1, expiresAt: new Date(Date.now() + 3600000) })
        .onConflictDoUpdate({
          target: creationLimits.id,
          set: { count: sql`${creationLimits.count} + 1` },
        })
        .returning();
      demand(
        bucket.count <= max,
        429,
        "Gerade werden viele Aktivitäten erstellt. Bitte versuche es später erneut.",
      );
    }
    await tx.insert(activities).values(row);
  });
}
export async function findActivity(id: string, kind: string) {
  const [row] = await database()
    .select()
    .from(activities)
    .where(
      and(
        eq(activities.id, id),
        eq(activities.kind, kind as "w" | "t"),
        gt(activities.expiresAt, new Date()),
      ),
    );
  demand(row, 404, "Diese Aktivität existiert nicht mehr.");
  return row;
}
export async function changeActivity(
  id: string,
  kind: string,
  change: (row: typeof activities.$inferSelect) => void | "delete",
) {
  return database().transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(activities)
      .where(and(eq(activities.id, id), eq(activities.kind, kind as "w" | "t")))
      .for("update");
    demand(
      row && row.expiresAt.getTime() > Date.now(),
      404,
      "Diese Aktivität existiert nicht mehr.",
    );
    if (change(row) === "delete")
      await tx.delete(activities).where(eq(activities.id, id));
    else
      await tx
        .update(activities)
        .set({ data: row.data, revision: row.revision + 1 })
        .where(eq(activities.id, id));
  });
}
export async function cleanup() {
  return database().transaction(async (tx) => {
    const deleted = await tx
      .delete(activities)
      .where(lte(activities.expiresAt, new Date()))
      .returning({ id: activities.id });
    await tx
      .delete(creationLimits)
      .where(lte(creationLimits.expiresAt, new Date()));
    return deleted.length;
  });
}
