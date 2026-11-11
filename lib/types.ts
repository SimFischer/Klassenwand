export type Kind = "w" | "t" | "u";
export type Word = { text: string; normalized: string; participant: string };
export type Column = { id: string; title: string; closed: boolean };
export type Post = {
  id: string;
  columnId: string;
  text: string;
  author: string;
  participant: string;
  createdAt: number;
  parentId?: string;
  referenceId?: string;
  replyTo?: string;
  hidden: boolean;
  approved: boolean;
};
export type PollOption = { id: string; text: string };
export type ChartType = "bar" | "pie";
export type Participant = { count: number; recent: number[] };
export type ActivityData = {
  paused: boolean;
  /** Wortwolke: Wolke für Schüler sichtbar. Umfrage: Ergebnisse für Schüler sichtbar. */
  showCloud: boolean;
  maxWords: number;
  maxLength: number;
  words: Word[];
  blacklist: string[];
  columns: Column[];
  posts: Post[];
  approval: boolean;
  participants: Record<string, Participant>;
  /** Umfrage: Antwortmöglichkeiten, Mehrfachauswahl, Diagrammart und Stimmen je Gerät. */
  options?: PollOption[];
  multiple?: boolean;
  chart?: ChartType;
  ballots?: Record<string, string[]>;
};
export type Activity = {
  id: string;
  kind: Kind;
  title: string;
  revision: number;
  createdAt: number;
  expiresAt: number;
  data: ActivityData;
};
export type PublicPost = Omit<Post, "participant"> & { own: boolean };
export type PollResult = PollOption & { count: number };
export type Snapshot = Omit<Activity, "data"> & {
  host: boolean;
  data: Omit<ActivityData, "participants" | "words" | "posts" | "ballots"> & {
    words: { text: string; count: number; normalized: string }[];
    posts: PublicPost[];
    ownCount: number;
    total: number;
    /** Umfrage: Stimmen je Antwort; für Schüler leer, solange die Ergebnisse verborgen sind. */
    results: PollResult[];
    ownVotes: string[];
  };
};
