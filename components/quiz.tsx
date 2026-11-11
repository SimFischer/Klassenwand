"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { QuizView } from "@/lib/types";
import type { Action } from "@/lib/validation";

export const tileColors = ["#38634e", "#c9774d", "#6063a2", "#a16a14"];
export const tileLetters = ["A", "B", "C", "D"];

type Send = (action: Action) => Promise<boolean>;

/** Restzeit der laufenden Frage; startet bei jedem neuen Server-Stand neu. */
function useCountdown(quiz: QuizView) {
  // Das Ende wird je Server-Stand festgehalten. Ein veralteter „now“-Wert ergibt
  // höchstens zu viel Restzeit, nie fälschlich 0 (sonst würde vorzeitig aufgelöst).
  const [state, setState] = useState(() => ({
    source: quiz,
    end: Date.now() + quiz.remainingMs,
  }));
  const [now, setNow] = useState(() => Date.now());
  const current =
    state.source === quiz
      ? state
      : { source: quiz, end: Date.now() + quiz.remainingMs };
  if (state.source !== quiz) setState(current);
  useEffect(() => {
    if (quiz.phase !== "question") return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [quiz]);
  return quiz.phase === "question" ? Math.max(0, current.end - now) : 0;
}

function Countdown({ ms, seconds }: { ms: number; seconds: number }) {
  const s = Math.ceil(ms / 1000);
  return (
    <div
      className={`quiz-countdown ${s <= 5 ? "urgent" : ""}`}
      role="timer"
      aria-label={`${s} Sekunden übrig`}
    >
      <span>{s}</span>
      <i style={{ width: `${(ms / (seconds * 1000)) * 100}%` }} />
    </div>
  );
}

function Leaderboard({
  entries,
  highlight,
  offset = 0,
}: {
  entries: QuizView["leaderboard"];
  highlight?: string;
  offset?: number;
}) {
  if (!entries.length) return null;
  return (
    <ol className="quiz-leaderboard">
      {entries.map((p, i) => (
        <li key={p.id} className={p.name === highlight ? "me" : ""}>
          <span className="rank">{offset + i + 1}</span>
          <span className="name">{p.name}</span>
          <b>{p.score}</b>
        </li>
      ))}
    </ol>
  );
}

export function QuizHost({
  quiz,
  busy,
  send,
}: {
  quiz: QuizView;
  busy: boolean;
  send: Send;
}) {
  const left = useCountdown(quiz);
  const q = quiz.question;
  const auto = useRef("");
  // Automatisch auflösen, wenn die Zeit abläuft oder alle geantwortet haben.
  useEffect(() => {
    if (quiz.phase !== "question") {
      auto.current = ""; // nach Auflösung oder Neustart wieder scharf schalten
      return;
    }
    const key = `${quiz.current}`;
    const done =
      left <= 0 || (quiz.players > 0 && quiz.answered >= quiz.players);
    if (done && auto.current !== key) {
      auto.current = key;
      void send({ action: "quiz", step: "reveal" }).then((ok) => {
        if (!ok) auto.current = "";
      });
    }
  }, [left, quiz, send]);
  if (quiz.phase === "lobby")
    return (
      <div className="quiz-stage quiz-lobby">
        <p className="eyebrow">
          {quiz.count} {quiz.count === 1 ? "FRAGE" : "FRAGEN"} · QR-CODE SCANNEN
          UND SPITZNAMEN WÄHLEN
        </p>
        <h2>
          {quiz.players} {quiz.players === 1 ? "Person ist" : "Personen sind"}{" "}
          dabei
        </h2>
        <ul className="quiz-names">
          {quiz.leaderboard.map((p) => (
            <li key={p.id}>
              {p.name}
              <button
                className="subtle no-print"
                title="Spitzname entfernen"
                aria-label={`${p.name} entfernen`}
                disabled={busy}
                onClick={() => void send({ action: "kick", player: p.id })}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <button
          className="primary quiz-main-button"
          disabled={busy}
          onClick={() => void send({ action: "quiz", step: "start" })}
        >
          ▶ Quiz starten
        </button>
      </div>
    );
  if (quiz.phase === "finished")
    return (
      <div className="quiz-stage">
        <p className="eyebrow">ENDERGEBNIS</p>
        <div className="quiz-podium">
          {[1, 0, 2].map((i) =>
            quiz.leaderboard[i] ? (
              <div key={i} className={`place place-${i + 1}`}>
                <strong>{quiz.leaderboard[i].name}</strong>
                <span>{quiz.leaderboard[i].score} Punkte</span>
                <div>{i + 1}</div>
              </div>
            ) : null,
          )}
        </div>
        <Leaderboard entries={quiz.leaderboard.slice(3)} offset={3} />
      </div>
    );
  if (!q) return null;
  const revealed = quiz.phase === "reveal";
  const max = Math.max(...(quiz.distribution ?? [0]), 1);
  return (
    <div className="quiz-stage">
      <div className="quiz-stage-top">
        <span className="eyebrow">
          FRAGE {quiz.current + 1} / {quiz.count}
        </span>
        <span className="quiz-answered">
          <b>{quiz.answered}</b> / {quiz.players} geantwortet
        </span>
      </div>
      <h2 className="quiz-question">{q.text}</h2>
      {!revealed && <Countdown ms={left} seconds={q.seconds} />}
      <div className="quiz-tiles host">
        {q.options.map((option, i) => {
          const isCorrect = revealed && q.correct === i;
          const count = quiz.distribution?.[i] ?? 0;
          return (
            <div
              key={i}
              className={`quiz-tile ${revealed ? (isCorrect ? "correct" : "wrong") : ""}`}
              style={{ background: tileColors[i] }}
            >
              <span className="letter">{tileLetters[i]}</span>
              <span className="text">{option}</span>
              {revealed && (
                <span className="tile-count">
                  {isCorrect && "✓ "}
                  {count}
                  <i style={{ width: `${(count / max) * 100}%` }} />
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="quiz-controls no-print">
        {revealed ? (
          <button
            className="primary quiz-main-button"
            disabled={busy}
            onClick={() => void send({ action: "quiz", step: "next" })}
          >
            {quiz.current + 1 < quiz.count
              ? "Nächste Frage →"
              : "Endergebnis zeigen →"}
          </button>
        ) : (
          <button
            disabled={busy}
            onClick={() => void send({ action: "quiz", step: "reveal" })}
          >
            Jetzt auflösen
          </button>
        )}
      </div>
      {revealed && (
        <>
          <h3 className="quiz-subtitle">Zwischenstand</h3>
          <Leaderboard entries={quiz.leaderboard.slice(0, 5)} />
        </>
      )}
    </div>
  );
}

const adjectives = [
  "Flinker",
  "Kluger",
  "Mutiger",
  "Wilder",
  "Stiller",
  "Bunter",
  "Schlauer",
  "Fröhlicher",
];
const animals = [
  "Fuchs",
  "Dachs",
  "Luchs",
  "Biber",
  "Igel",
  "Otter",
  "Falke",
  "Wal",
];
const randomName = () =>
  `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${animals[Math.floor(Math.random() * animals.length)]}`;

export function QuizPlayer({
  quiz,
  busy,
  send,
}: {
  quiz: QuizView;
  busy: boolean;
  send: Send;
}) {
  const left = useCountdown(quiz);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => setPicked(null), [quiz.current, quiz.phase]);
  const me = quiz.me;
  if (!me)
    return (
      <form
        className="quiz-join"
        onSubmit={async (e: FormEvent) => {
          e.preventDefault();
          await send({ action: "join", name });
        }}
      >
        <label>
          Dein Spitzname
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            required
            autoComplete="off"
            placeholder="z. B. Flinker Fuchs"
          />
        </label>
        <button
          type="button"
          className="subtle"
          onClick={() => setName(randomName())}
        >
          🎲 Zufallsname
        </button>
        <button className="primary" disabled={busy || !name.trim()}>
          Mitspielen →
        </button>
        <p className="hint">
          Bitte keinen echten Namen verwenden. Es gibt kein Konto, und alles
          wird spätestens nach sieben Tagen automatisch gelöscht.
        </p>
      </form>
    );
  const q = quiz.question;
  const status = (
    <p className="quiz-me">
      <b>{me.name}</b> · {me.score} Punkte
      {(quiz.phase === "reveal" || quiz.phase === "finished") &&
        ` · Platz ${me.rank} von ${quiz.players}`}
    </p>
  );
  if (quiz.phase === "lobby")
    return (
      <div className="quiz-wait">
        {status}
        <h2>Du bist dabei!</h2>
        <p>Gleich geht es los. Schau nach vorne zur Tafel.</p>
      </div>
    );
  if (quiz.phase === "finished")
    return (
      <div className="quiz-wait">
        <h2>
          {me.rank <= 3 ? ["🥇", "🥈", "🥉"][me.rank - 1] + " " : ""}Platz{" "}
          {me.rank}
        </h2>
        <p>
          {me.score} Punkte · {quiz.players} Mitspielende
        </p>
        {status}
      </div>
    );
  if (!q) return null;
  const answer = me.answer;
  if (quiz.phase === "reveal")
    return (
      <div
        className={`quiz-result ${answer?.correct ? "right" : "wrong"}`}
        role="status"
      >
        <h2>
          {!answer
            ? "Keine Antwort"
            : answer.correct
              ? "Richtig! ✓"
              : "Leider falsch"}
        </h2>
        {answer?.correct && <p className="quiz-points">+{answer.points}</p>}
        {!answer?.correct && q.correct !== undefined && (
          <p>
            Richtig war {tileLetters[q.correct]}: {q.options[q.correct]}
          </p>
        )}
        {status}
      </div>
    );
  const chosen = answer?.choice ?? picked;
  const over = left <= 0;
  return (
    <div className="quiz-play">
      <div className="quiz-play-top">
        <span>
          Frage {quiz.current + 1} / {quiz.count}
        </span>
        <span className="quiz-play-time">{Math.ceil(left / 1000)} s</span>
      </div>
      <h2 className="quiz-question small">{q.text}</h2>
      {chosen !== null && chosen !== undefined ? (
        <div className="quiz-wait">
          <div
            className="quiz-tile chosen"
            style={{ background: tileColors[chosen] }}
          >
            <span className="letter">{tileLetters[chosen]}</span>
            <span className="text">{q.options[chosen]}</span>
          </div>
          <p>Antwort gespeichert. Warte auf die Auflösung …</p>
        </div>
      ) : over ? (
        <div className="quiz-wait">
          <h2>Zeit abgelaufen</h2>
        </div>
      ) : (
        <div className="quiz-tiles">
          {q.options.map((option, i) => (
            <button
              key={i}
              className="quiz-tile"
              style={{ background: tileColors[i] }}
              disabled={busy}
              onClick={async () => {
                setPicked(i);
                if (!(await send({ action: "answer", choice: i })))
                  setPicked(null);
              }}
            >
              <span className="letter">{tileLetters[i]}</span>
              <span className="text">{option}</span>
            </button>
          ))}
        </div>
      )}
      {status}
    </div>
  );
}
