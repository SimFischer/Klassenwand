"use client";
import { useState } from "react";
import { tileColors, tileLetters } from "./quiz";

export type DraftQuestion = {
  text: string;
  options: string[];
  correct: number;
  seconds: number;
  kind: "mc" | "tf";
  /** Verkleinertes Bild als Data-URL (nur im Browser bis zum Hochladen). */
  image?: string;
};
export const emptyQuestion = (): DraftQuestion => ({
  text: "",
  options: ["", "", "", ""],
  correct: 0,
  seconds: 20,
  kind: "mc",
});
export const trueFalse = ["Wahr", "Falsch"];

/** Prüft die Entwürfe und entfernt leere Antwortfelder. Wirft eine verständliche Fehlermeldung. */
export function quizPayload(drafts: DraftQuestion[]) {
  const used = drafts.filter(
    (q) =>
      q.text.trim() ||
      q.image ||
      (q.kind === "mc" && q.options.some((o) => o.trim())),
  );
  const questions = used.map((q, n) => {
    if (!q.text.trim())
      throw new Error(`Frage ${n + 1}: Bitte Fragetext eingeben.`);
    if (q.kind === "tf")
      return {
        text: q.text.trim(),
        options: trueFalse,
        correct: q.correct === 1 ? 1 : 0,
        seconds: q.seconds,
        kind: "tf" as const,
      };
    const filled = q.options
      .map((text, i) => ({ text: text.trim(), i }))
      .filter((o) => o.text);
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
  return { questions, images: used.map((q) => q.image) };
}

const MAX_BYTES = 430_000;
/** Verkleinert ein Foto im Browser auf höchstens 1200 px und ca. 400 KB (JPEG). */
async function shrink(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    let width = img.naturalWidth,
      height = img.naturalHeight;
    const scale = Math.min(1, 1200 / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);
    const canvas = document.createElement("canvas");
    for (let attempt = 0; attempt < 6; attempt++) {
      canvas.width = width;
      canvas.height = height;
      const c = canvas.getContext("2d")!;
      c.fillStyle = "#fff";
      c.fillRect(0, 0, width, height);
      c.drawImage(img, 0, 0, width, height);
      const data = canvas.toDataURL("image/jpeg", 0.82 - attempt * 0.08);
      if ((data.length - 23) * 0.75 <= MAX_BYTES) return data;
      width = Math.round(width * 0.8);
      height = Math.round(height * 0.8);
    }
    throw new Error("zu groß");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function QuizEditor({
  questions,
  onChange,
}: {
  questions: DraftQuestion[];
  onChange: (questions: DraftQuestion[]) => void;
}) {
  const [imageError, setImageError] = useState("");
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
          <div className="quiz-type" role="group" aria-label="Fragetyp">
            {(
              [
                ["mc", "A B C D · Auswahl"],
                ["tf", "✓ ✗ · Wahr oder falsch"],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                aria-pressed={q.kind === kind}
                onClick={() =>
                  update(n, {
                    kind,
                    correct: kind === "tf" ? Math.min(q.correct, 1) : q.correct,
                  })
                }
              >
                {label}
              </button>
            ))}
          </div>
          <input
            aria-label={`Fragetext ${n + 1}`}
            value={q.text}
            maxLength={200}
            placeholder={
              q.kind === "tf"
                ? "Die Erde ist eine Scheibe."
                : n === 0
                  ? "Wie heißt die Hauptstadt von Frankreich?"
                  : "Fragetext"
            }
            onChange={(e) => update(n, { text: e.target.value })}
          />
          <div className="quiz-editor-image">
            {q.image ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={q.image} alt={`Bild zu Frage ${n + 1}`} />
                <button
                  type="button"
                  className="subtle"
                  onClick={() => update(n, { image: undefined })}
                >
                  Bild entfernen ×
                </button>
              </>
            ) : (
              <label className="image-pick">
                🖼 Bild hinzufügen (optional)
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    setImageError("");
                    try {
                      update(n, { image: await shrink(file) });
                    } catch {
                      setImageError(
                        "Dieses Bild konnte nicht gelesen werden. Bitte ein JPG oder PNG verwenden.",
                      );
                    }
                  }}
                />
              </label>
            )}
          </div>
          <div className={`quiz-editor-options ${q.kind}`}>
            {(q.kind === "tf" ? trueFalse : q.options).map((option, i) => (
              <div
                key={i}
                className={`quiz-editor-option ${q.correct === i ? "is-correct" : ""}`}
                style={{ "--tile": tileColors[i] } as React.CSSProperties}
              >
                <span className="letter">
                  {q.kind === "tf" ? (i === 0 ? "✓" : "✗") : tileLetters[i]}
                </span>
                {q.kind === "tf" ? (
                  <span className="tf-label">{option}</span>
                ) : (
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
                )}
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
      {imageError && (
        <p role="alert" className="error">
          {imageError}
        </p>
      )}
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
