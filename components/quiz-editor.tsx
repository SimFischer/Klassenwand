"use client";
import { tileColors, tileLetters } from "./quiz";

export type DraftQuestion = {
  text: string;
  options: string[];
  correct: number;
  seconds: number;
};
export const emptyQuestion = (): DraftQuestion => ({
  text: "",
  options: ["", "", "", ""],
  correct: 0,
  seconds: 20,
});

/** Prüft die Entwürfe und entfernt leere Antwortfelder. Wirft eine verständliche Fehlermeldung. */
export function quizPayload(drafts: DraftQuestion[]) {
  const questions = drafts
    .filter((q) => q.text.trim() || q.options.some((o) => o.trim()))
    .map((q, n) => {
      const filled = q.options
        .map((text, i) => ({ text: text.trim(), i }))
        .filter((o) => o.text);
      if (!q.text.trim())
        throw new Error(`Frage ${n + 1}: Bitte Fragetext eingeben.`);
      if (filled.length < 2)
        throw new Error(
          `Frage ${n + 1}: Bitte mindestens zwei Antworten eingeben.`,
        );
      const correct = filled.findIndex((o) => o.i === q.correct);
      if (correct < 0)
        throw new Error(
          `Frage ${n + 1}: Die markierte richtige Antwort ist leer.`,
        );
      return {
        text: q.text.trim(),
        options: filled.map((o) => o.text),
        correct,
        seconds: q.seconds,
      };
    });
  if (!questions.length)
    throw new Error("Bitte lege mindestens eine Frage an.");
  return questions;
}

export function QuizEditor({
  questions,
  onChange,
}: {
  questions: DraftQuestion[];
  onChange: (questions: DraftQuestion[]) => void;
}) {
  const update = (n: number, change: Partial<DraftQuestion>) =>
    onChange(questions.map((q, i) => (i === n ? { ...q, ...change } : q)));
  return (
    <div className="quiz-editor">
      {questions.map((q, n) => (
        <fieldset key={n} className="quiz-editor-question">
          <legend>
            Frage {n + 1}
            {questions.length > 1 && (
              <button
                type="button"
                className="subtle"
                aria-label={`Frage ${n + 1} entfernen`}
                onClick={() => onChange(questions.filter((_, i) => i !== n))}
              >
                entfernen ×
              </button>
            )}
          </legend>
          <input
            aria-label={`Fragetext ${n + 1}`}
            value={q.text}
            maxLength={200}
            placeholder={
              n === 0 ? "Wie heißt die Hauptstadt von Frankreich?" : "Fragetext"
            }
            onChange={(e) => update(n, { text: e.target.value })}
          />
          <div className="quiz-editor-options">
            {q.options.map((option, i) => (
              <div
                key={i}
                className={`quiz-editor-option ${q.correct === i ? "is-correct" : ""}`}
                style={{ "--tile": tileColors[i] } as React.CSSProperties}
              >
                <span className="letter">{tileLetters[i]}</span>
                <input
                  aria-label={`Frage ${n + 1}, Antwort ${tileLetters[i]}`}
                  value={option}
                  maxLength={80}
                  placeholder={i < 2 ? "Antwort" : "optional"}
                  onChange={(e) =>
                    update(n, {
                      options: q.options.map((o, k) =>
                        k === i ? e.target.value : o,
                      ),
                    })
                  }
                />
                <label title="Richtige Antwort">
                  <input
                    type="radio"
                    name={`correct-${n}`}
                    checked={q.correct === i}
                    onChange={() => update(n, { correct: i })}
                  />
                  <span>richtig</span>
                </label>
              </div>
            ))}
          </div>
          <label className="quiz-editor-time">
            Zeit
            <select
              value={q.seconds}
              onChange={(e) => update(n, { seconds: Number(e.target.value) })}
            >
              {[10, 20, 30, 45, 60, 90].map((s) => (
                <option key={s} value={s}>
                  {s} Sekunden
                </option>
              ))}
            </select>
          </label>
        </fieldset>
      ))}
      {questions.length < 30 && (
        <button
          type="button"
          onClick={() => onChange([...questions, emptyQuestion()])}
        >
          + Frage hinzufügen
        </button>
      )}
    </div>
  );
}
