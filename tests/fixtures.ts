import type { Activity } from "../lib/types";
export function fixture(kind: "w" | "t" | "u" = "w"): Activity {
  return {
    id: "test",
    kind,
    title: "Testfrage",
    revision: 1,
    createdAt: 1000,
    expiresAt: Date.now() + 86400000,
    data: {
      paused: false,
      showCloud: true,
      maxWords: 3,
      maxLength: 30,
      words: [],
      blacklist: [],
      columns: [
        { id: "c1", title: "Erste Spalte", closed: false },
        { id: "c2", title: "Zweite Spalte", closed: false },
      ],
      posts: [],
      approval: false,
      participants: {},
    },
  };
}
