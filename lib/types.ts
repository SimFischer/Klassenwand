export type Kind = "w" | "t";
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
export type Participant = { count: number; recent: number[] };
export type ActivityData = {
  paused: boolean;
  showCloud: boolean;
  maxWords: number;
  maxLength: number;
  words: Word[];
  blacklist: string[];
  columns: Column[];
  posts: Post[];
  approval: boolean;
  participants: Record<string, Participant>;
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
export type Snapshot = Omit<Activity, "data"> & {
  host: boolean;
  data: Omit<ActivityData, "participants" | "words" | "posts"> & {
    words: { text: string; count: number; normalized: string }[];
    posts: PublicPost[];
    ownCount: number;
    total: number;
  };
};
