export type Kind = "w" | "t" | "u" | "q";
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
  /** Umfrage: aktuelle Runde und Summen der ersten Runde für den Vergleich. */
  round?: number;
  firstRound?: { voters: number; counts: Record<string, number> };
  /** Wortwolke: zusammengefasste Begriffe, normalisiert → Hauptbegriff. */
  merges?: Record<string, string>;
  /** Quiz: Fragen, Spielphase und Spitznamen mit Punkten. */
  quiz?: QuizState;
};
export type QuizQuestion = {
  id: string;
  text: string;
  options: string[];
  correct: number;
  seconds: number;
};
export type QuizPhase = "lobby" | "question" | "reveal" | "finished";
export type QuizPlayer = {
  /** Zufällige öffentliche Kennung, unabhängig von der Gerätekennung. */
  id: string;
  name: string;
  score: number;
  answers: Record<string, { choice: number; correct: boolean; points: number }>;
};
export type QuizState = {
  questions: QuizQuestion[];
  phase: QuizPhase;
  current: number;
  startedAt: number;
  players: Record<string, QuizPlayer>;
};
export type QuizView = {
  phase: QuizPhase;
  current: number;
  count: number;
  question?: {
    text: string;
    options: string[];
    seconds: number;
    correct?: number;
  };
  remainingMs: number;
  answered: number;
  players: number;
  distribution?: number[];
  leaderboard: { id: string; name: string; score: number }[];
  me?: {
    name: string;
    score: number;
    rank: number;
    answer?: { choice: number; correct?: boolean; points?: number };
  };
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
export type PollResult = PollOption & { count: number; firstCount?: number };
export type Snapshot = Omit<Activity, "data"> & {
  host: boolean;
  data: Omit<
    ActivityData,
    "participants" | "words" | "posts" | "ballots" | "quiz"
  > & {
    words: { text: string; count: number; normalized: string }[];
    posts: PublicPost[];
    ownCount: number;
    total: number;
    /** Umfrage: Stimmen je Antwort; für Schüler leer, solange die Ergebnisse verborgen sind. */
    results: PollResult[];
    ownVotes: string[];
    quiz?: QuizView;
  };
};
