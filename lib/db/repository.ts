import { and, eq, gt, lte, sql } from "drizzle-orm";
import { database } from "./index";
import { activities, creationLimits, quizImages } from "./schema";
import { demand } from "../errors";
import type { Kind } from "../types";
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
        eq(activities.kind, kind as Kind),
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
      .where(and(eq(activities.id, id), eq(activities.kind, kind as Kind)))
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
/** Speichert ein Quiz-Bild und markiert die Frage, beides in einer Transaktion. */
export async function saveQuizImage(
  id: string,
  question: number,
  mime: string,
  data: string,
  authorize: (row: typeof activities.$inferSelect) => void,
) {
  return database().transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(activities)
      .where(and(eq(activities.id, id), eq(activities.kind, "q")))
      .for("update");
    demand(
      row && row.expiresAt.getTime() > Date.now(),
      404,
      "Diese Aktivität existiert nicht mehr.",
    );
    authorize(row);
    const q = row.data.quiz?.questions[question];
    demand(q, 404, "Diese Frage gibt es nicht.");
    q.image = true;
    await tx
      .insert(quizImages)
      .values({ activityId: id, question, mime, data })
      .onConflictDoUpdate({
        target: [quizImages.activityId, quizImages.question],
        set: { mime, data },
      });
    await tx
      .update(activities)
      .set({ data: row.data, revision: row.revision + 1 })
      .where(eq(activities.id, id));
  });
}
export async function findQuizImage(id: string, question: number) {
  const [image] = await database()
    .select({ mime: quizImages.mime, data: quizImages.data })
    .from(quizImages)
    .where(
      and(eq(quizImages.activityId, id), eq(quizImages.question, question)),
    );
  demand(image, 404, "Kein Bild vorhanden.");
  return image;
}
