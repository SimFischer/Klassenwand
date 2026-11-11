import type { Activity, Snapshot } from "./types";
import type { Action } from "./validation";
import { demand } from "./errors";
import { aggregate, cleanWord, normalizeWord } from "./wordcloud/words";
import { boardAction } from "./board/actions";
import { pollAction, tally } from "./poll/votes";
export function applyAction(
  activity: Activity,
  a: Action,
  host: boolean,
  participant: string,
  now = Date.now(),
) {
  const d = activity.data;
  if (!host) {
    const bucket = d.participants[participant] ?? { count: 0, recent: [] };
    demand(
      Object.keys(d.participants).length < 1000 || d.participants[participant],
      429,
      "Diese Aktivität ist voll.",
    );
    bucket.recent = bucket.recent.filter((t) => now - t < 60000);
    demand(
      bucket.recent.length < 20,
      429,
      "Bitte warte einen Moment, bevor du weitermachst.",
    );
    bucket.recent.push(now);
    d.participants[participant] = bucket;
    if (a.action === "word" || a.action === "post") {
      demand(
        bucket.count < (activity.kind === "w" ? d.maxWords : 100),
        429,
        activity.kind === "w"
          ? "Du hast alle deine Begriffe gesendet. Vielen Dank!"
          : "Du hast das Beitragslimit erreicht.",
      );
      bucket.count++;
    }
  }
  if (a.action === "settings") {
    demand(host, 403, "Nur die Lehrkraft darf Einstellungen ändern.");
    if (a.paused !== undefined) d.paused = a.paused;
    if (a.showCloud !== undefined) d.showCloud = a.showCloud;
    if (a.approval !== undefined) d.approval = a.approval;
    if (a.chart !== undefined) d.chart = a.chart;
    return;
  }
  if (activity.kind === "w") {
    if (a.action === "word") {
      demand(!d.paused, 409, "Die Eingabe ist gerade pausiert.");
      const text = cleanWord(a.text),
        normalized = normalizeWord(text);
      demand(
        text.length > 0 && text.length <= d.maxLength,
        400,
        `Bitte verwende 1 bis ${d.maxLength} Zeichen.`,
      );
      demand(d.words.length < 10000, 429, "Diese Wortwolke ist voll.");
      if (!d.blacklist.includes(normalized))
        d.words.push({ text, normalized, participant });
      return;
    }
    demand(host, 403, "Nur die Lehrkraft darf moderieren.");
    if (a.action === "blacklist") {
      const word = normalizeWord(a.word);
      demand(word, 400, "Leerer Begriff.");
      d.blacklist = a.restore
        ? d.blacklist.filter((w) => w !== word)
        : [...new Set([...d.blacklist, word])];
      return;
    }
    if (a.action === "reset") {
      d.words = [];
      d.blacklist = [];
      Object.values(d.participants).forEach((p) => (p.count = 0));
      return;
    }
    demand(false, 400, "Aktion passt nicht zur Wortwolke.");
  }
  if (activity.kind === "u") return pollAction(d, a, host, participant);
  boardAction(d, a, host, participant, now);
}
export function snapshot(
  activity: Activity,
  host: boolean,
  participant: string,
): Snapshot {
  const { participants, words, posts, ballots, ...rest } = activity.data;
  const visible = posts.filter(
    (p) => host || (!p.hidden && p.approved) || p.participant === participant,
  );
  const roots = new Set(visible.filter((p) => !p.parentId).map((p) => p.id));
  return {
    id: activity.id,
    kind: activity.kind,
    title: activity.title,
    revision: activity.revision,
    createdAt: activity.createdAt,
    expiresAt: activity.expiresAt,
    host,
    data: {
      ...rest,
      blacklist: host ? rest.blacklist : [],
      words: host || rest.showCloud ? aggregate(words, rest.blacklist) : [],
      posts: visible
        .filter((p) => !p.parentId || roots.has(p.parentId))
        .map(({ participant: owner, ...p }) => ({
          ...p,
          own: owner === participant,
        })),
      ownCount: participants[participant]?.count ?? 0,
      total:
        activity.kind === "w"
          ? words.length
          : activity.kind === "u"
            ? Object.keys(ballots ?? {}).length
            : posts.length,
      results: host || rest.showCloud ? tally(activity.data) : [],
      ownVotes: ballots?.[participant] ?? [],
    },
  };
}
