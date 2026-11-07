"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/modal";
import {
  participantId,
  remember,
  savedActivities,
  forget,
  type Saved,
} from "@/lib/client";
export default function Home() {
  const [tool, setTool] = useState<"w" | "t" | null>(null),
    [saved, setSaved] = useState<Saved[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => setSaved(savedActivities()), []);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const title = String(form.get("title"));
      const response = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: tool,
          title,
          participantId: participantId(),
          maxWords: Number(form.get("maxWords") || 3),
          maxLength: Number(form.get("maxLength") || 30),
          columns: String(form.get("columns") || "Erste Gedanken")
            .split("\n")
            .filter((x) => x.trim()),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      remember({ title, kind: tool!, link: result.hostUrl, date: Date.now() });
      window.location.assign(result.hostUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erstellen fehlgeschlagen.");
      setBusy(false);
    }
  }
  return (
    <main className="home">
      <section className="intro">
        <p className="eyebrow">
          <span /> DER UNTERRICHT LEBT VOM MITMACHEN
        </p>
        <h1>
          Viele Köpfe.
          <br />
          <span>Eine Klassenwand.</span>
        </h1>
        <p className="lead">
          Mach Gedanken sichtbar. Sammle Ideen, stelle Fragen und bring deine
          Klasse ins Gespräch – ganz ohne Anmeldung.
        </p>
        <div className="benefits">
          <span>✓ Kein Konto nötig</span>
          <span>✓ Per QR-Code dabei</span>
          <span>✓ Nach 7 Tagen gelöscht</span>
        </div>
      </section>
      <section aria-labelledby="tools-title">
        <div className="section-heading">
          <h2 id="tools-title">Was hast du heute vor?</h2>
          <span>Dein Werkzeug für die nächste Unterrichtsidee</span>
        </div>
        <div className="tool-grid">
          <button
            className="tool-card cloud-card"
            onClick={() => {
              setTool("w");
              setError("");
            }}
          >
            <span className="tool-number">01 / IDEEN SAMMELN</span>
            <div className="cloud-illustration" aria-hidden="true">
              <span>Neugier</span>
              <strong>Zusammen</strong>
              <span>Vielfalt</span>
              <b>Ideen</b>
              <em>Mitmachen</em>
              <small>Mut</small>
            </div>
            <h3>
              Wortwolke <span>↗</span>
            </h3>
            <p>
              Eine Frage, viele Gedanken. Lass aus den Begriffen deiner Klasse
              ein gemeinsames Bild entstehen.
            </p>
            <span className="card-action">
              Wortwolke erstellen <span>→</span>
            </span>
          </button>
          <button
            className="tool-card board-card"
            onClick={() => {
              setTool("t");
              setError("");
            }}
          >
            <span className="tool-number">02 / GEDANKEN VERTIEFEN</span>
            <div className="board-illustration" aria-hidden="true">
              <i>
                <b />
                <span />
                <span />
              </i>
              <i>
                <b />
                <span />
              </i>
              <i>
                <b />
                <span />
                <span />
              </i>
            </div>
            <h3>
              Text-Pinnwand <span>↗</span>
            </h3>
            <p>
              Platz für Thesen, Fragen und Diskussionen. Sammelt Beiträge und
              nehmt aufeinander Bezug.
            </p>
            <span className="card-action">
              Pinnwand erstellen <span>→</span>
            </span>
          </button>
          <article className="tool-card soon-card">
            <span className="tool-number">03 / INHALTE VERBINDEN</span>
            <div className="file-illustration" aria-hidden="true">
              <span>▧</span>
              <span>≡</span>
              <span>⌁</span>
            </div>
            <h3>Datei-Pinnwand</h3>
            <p>
              Bilder, PDFs und Materialien auf einer freien Fläche sammeln,
              anordnen und verbinden.
            </p>
            <span className="soon-label">Kommt bald</span>
          </article>
        </div>
      </section>
      <section className="saved-section">
        <div className="section-heading">
          <h2>
            Deine Aktivitäten <span className="count">{saved.length}</span>
          </h2>
          <span>Nur in diesem Browser gespeichert</span>
        </div>
        {saved.length ? (
          <ul className="saved-list">
            {saved.map((item) => (
              <li key={item.link}>
                <a href={item.link}>
                  <span className="activity-icon">
                    {item.kind === "w" ? "☁" : "▤"}
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {item.kind === "w" ? "Wortwolke" : "Text-Pinnwand"} ·{" "}
                      {new Date(item.date).toLocaleDateString("de-DE")}
                    </small>
                  </span>
                  <span>Öffnen →</span>
                </a>
                <button
                  className="subtle"
                  onClick={() => {
                    forget(item.link);
                    setSaved(savedActivities());
                  }}
                  aria-label={`${item.title} aus Verlauf entfernen`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">
            <span>↗</span>
            <div>
              <strong>Hier ist Platz für deine nächste gute Idee.</strong>
              <p>
                Erstelle eine Aktivität. Du findest sie anschließend hier
                wieder.
              </p>
            </div>
          </div>
        )}
      </section>
      <aside className="privacy-note">
        <span>◈</span>
        <p>
          <strong>Wenig Daten. Viel Austausch.</strong> Keine Konten, kein
          Tracking, keine externen Inhalte. Alle Aktivitäten werden nach 7 Tagen
          automatisch gelöscht.
        </p>
      </aside>
      {tool && (
        <Modal labelledBy="create-title" onClose={() => setTool(null)}>
          <button
            className="close"
            aria-label="Schließen"
            onClick={() => setTool(null)}
          >
            ×
          </button>
          <p className="eyebrow">LOS GEHT’S</p>
          <h2 id="create-title">
            {tool === "w" ? "Eine Frage für alle." : "Raum für eure Gedanken."}
          </h2>
          <form onSubmit={create}>
            <label>
              {tool === "w" ? "Deine Frage" : "Titel der Pinnwand"}
              <input
                autoFocus
                required
                name="title"
                maxLength={180}
                placeholder={
                  tool === "w"
                    ? "Was macht eine gute Klassengemeinschaft aus?"
                    : "Unsere Ideen zur Projektwoche"
                }
              />
            </label>
            {tool === "w" ? (
              <div className="form-row">
                <label>
                  Begriffe pro Person
                  <input
                    type="number"
                    name="maxWords"
                    min={1}
                    max={20}
                    defaultValue={3}
                    required
                  />
                </label>
                <label>
                  Zeichen pro Begriff
                  <input
                    type="number"
                    name="maxLength"
                    min={1}
                    max={80}
                    defaultValue={30}
                    required
                  />
                </label>
              </div>
            ) : (
              <label>
                Spalten · eine pro Zeile
                <textarea
                  name="columns"
                  required
                  rows={4}
                  defaultValue={
                    "Das wissen wir schon\nDas fragen wir uns\nUnsere Ideen"
                  }
                />
              </label>
            )}
            <p className="hint">
              Gleich erhältst du deinen geheimen Lehrkraft-Link und den QR-Code
              für deine Klasse.
            </p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "Wird erstellt …" : "Aktivität erstellen →"}
            </button>
          </form>
        </Modal>
      )}
    </main>
  );
}
