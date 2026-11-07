import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import type { ActivityData, Kind } from "../types";
export const activities = pgTable(
  "activities",
  {
    id: text("id").primaryKey(),
    kind: text("kind").$type<Kind>().notNull(),
    title: text("title").notNull(),
    hostHash: text("host_hash").notNull(),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    data: jsonb("data").$type<ActivityData>().notNull(),
  },
  (t) => [index("activities_expiry_idx").on(t.expiresAt)],
);
export const creationLimits = pgTable("creation_limits", {
  id: text("id").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
