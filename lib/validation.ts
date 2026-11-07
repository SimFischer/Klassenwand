import { z } from "zod";
const text = z.string().trim().min(1).max(500);
export const participantSchema = z.string().uuid();
export const createSchema = z.object({
  kind: z.enum(["w", "t"]),
  title: z.string().trim().min(1).max(180),
  maxWords: z.number().int().min(1).max(20).default(3),
  maxLength: z.number().int().min(1).max(80).default(30),
  columns: z
    .array(z.string().trim().min(1).max(180))
    .min(1)
    .max(12)
    .default(["Erste Gedanken"]),
  participantId: participantSchema,
});
const id = z.string().min(1).max(64);
export const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("word"),
    text: z.string().trim().min(1).max(160),
  }),
  z.object({
    action: z.literal("blacklist"),
    word: z.string().min(1).max(160),
    restore: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("settings"),
    paused: z.boolean().optional(),
    showCloud: z.boolean().optional(),
    approval: z.boolean().optional(),
  }),
  z.object({ action: z.literal("reset") }),
  z.object({
    action: z.literal("column-add"),
    title: z.string().trim().min(1).max(180),
  }),
  z.object({
    action: z.literal("column-update"),
    id,
    title: z.string().trim().min(1).max(180).optional(),
    closed: z.boolean().optional(),
  }),
  z.object({ action: z.literal("column-delete"), id }),
  z.object({
    action: z.literal("column-move"),
    id,
    direction: z.union([z.literal(-1), z.literal(1)]),
  }),
  z.object({
    action: z.literal("post"),
    columnId: id,
    text,
    author: z.string().trim().max(40).default(""),
    parentId: id.optional(),
    referenceId: id.optional(),
    replyTo: id.optional(),
  }),
  z.object({ action: z.literal("post-edit"), id, text }),
  z.object({ action: z.literal("post-delete"), id }),
  z.object({
    action: z.literal("post-moderate"),
    id,
    hidden: z.boolean().optional(),
    approved: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("post-move"),
    id,
    columnId: id,
    beforeId: id.optional(),
  }),
]);
export type Action = z.infer<typeof actionSchema>;
