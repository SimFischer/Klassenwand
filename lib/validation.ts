import { z } from "zod";
const text = z.string().trim().min(1).max(500);
export const participantSchema = z.string().uuid();
export const createSchema = z
  .object({
    kind: z.enum(["w", "t", "u", "q"]),
    title: z.string().trim().min(1).max(180),
    maxWords: z.number().int().min(1).max(20).default(3),
    maxLength: z.number().int().min(1).max(80).default(30),
    columns: z
      .array(z.string().trim().min(1).max(180))
      .min(1)
      .max(12)
      .default(["Erste Gedanken"]),
    options: z.array(z.string().trim().min(1).max(120)).max(10).default([]),
    multiple: z.boolean().default(false),
    chart: z.enum(["bar", "pie"]).default("bar"),
    questions: z
      .array(
        z
          .object({
            text: z.string().trim().min(1).max(200),
            options: z.array(z.string().trim().min(1).max(80)).min(2).max(4),
            correct: z.number().int().min(0).max(3),
            seconds: z.number().int().min(5).max(120).default(20),
            kind: z.literal("tf").optional(),
          })
          .refine((q) => q.correct < q.options.length, {
            message: "Bitte markiere die richtige Antwort.",
          })
          .refine((q) => q.kind !== "tf" || q.options.length === 2, {
            message: "Wahr/Falsch-Fragen haben genau zwei Antworten.",
          }),
      )
      .max(30)
      .default([]),
    participantId: participantSchema,
  })
  .refine((input) => input.kind !== "u" || input.options.length >= 2, {
    message: "Bitte gib mindestens zwei Antwortmöglichkeiten an.",
    path: ["options"],
  })
  .refine((input) => input.kind !== "q" || input.questions.length >= 1, {
    message: "Bitte lege mindestens eine Frage an.",
    path: ["questions"],
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
    chart: z.enum(["bar", "pie"]).optional(),
  }),
  z.object({ action: z.literal("round2") }),
  z.object({
    action: z.literal("join"),
    name: z.string().trim().min(1).max(40),
  }),
  z.object({
    action: z.literal("answer"),
    choice: z.number().int().min(0).max(3),
  }),
  z.object({
    action: z.literal("quiz"),
    step: z.enum(["start", "reveal", "next", "restart"]),
  }),
  z.object({ action: z.literal("kick"), player: id }),
  z.object({
    action: z.literal("vote"),
    options: z.array(id).min(1).max(10),
  }),
  z.object({ action: z.literal("reset") }),
  z.object({
    action: z.literal("merge"),
    words: z.array(z.string().min(1).max(160)).min(2).max(50),
  }),
  z.object({ action: z.literal("unmerge"), word: z.string().min(1).max(160) }),
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
