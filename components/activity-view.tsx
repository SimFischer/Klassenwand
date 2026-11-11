"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Kind } from "@/lib/types";
import type { Action } from "@/lib/validation";
import { participantId, remember, forget } from "@/lib/client";
import { usePolling } from "@/lib/use-polling";
import { QRPanel } from "./qr-panel";
import { WordCloud } from "./word-cloud";
import { TextBoard } from "./text-board";
import { PollChart } from "./poll-chart";
import { PollVote } from "./poll-vote";
import { WordMerge } from "./word-merge";
import { QuizHost, QuizPlayer } from "./quiz";
const kindLabel = {
  w: "WORTWOLKE",
  t: "TEXT-PINNWAND",
  u: "UMFRAGE",
  q: "QUIZ",
};
export function ActivityView({
  id,
  kind,
  hostMode,
}: {
  id: string;
  kind: Kind;
  hostMode: boolean;
}) {
  const [key, setKey] = useState<string | null>(null),
    [ready, setReady] = useState(false),
    [url, setUrl] = useState(""),
    [qr, setQr] = useState(hostMode),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [actionError, setActionError] = useState(""),
    [missingKey, setMissingKey] = useState(false),
    [cloudOnly, setCloudOnly] = useState(false);
  const presentationButton = useRef<HTMLButtonElement>(null);
  const exitPresentationButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!cloudOnly) return;
    const header = document.querySelector<HTMLElement>(".site-header");
    const previousInert = header?.inert ?? false;
    const previousOverflow = document.body.style.overflow;
    if (header) header.inert = true;
    document.body.style.overflow = "hidden";
    exitPresentationButton.current?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setCloudOnly(false);
      }
    }
    function fullscreenChanged() {
      if (!document.fullscreenElement) setCloudOnly(false);
    }
    document.addEventListener("keydown", keyboard);
    document.addEventListener("fullscreenchange", fullscreenChanged);
    return () => {
      document.removeEventListener("keydown", keyboard);
      document.removeEventListener("fullscreenchange", fullscreenChanged);
      if (header) header.inert = previousInert;
      document.body.style.overflow = previousOverflow;
      presentationButton.current?.focus();
    };
  }, [cloudOnly]);
  useEffect(() => {
    try {
      participantId();
      const hostKey = hostMode
        ? new URLSearchParams(location.search).get("key")
        : null;
      setMissingKey(hostMode && !hostKey);
      setKey(hostKey);
      setUrl(`${location.origin}/${kind}/${id}`);
      setReady(!hostMode || !!hostKey);
    } catch {
      setActionError(
        "Bitte erlaube den lokalen Browserspeicher, um mitzumachen.",
      );
    }
  }, [hostMode, id, kind]);
  const api = `/api/${kind}/${id}`,
    { data, error, terminal, refresh, setData } = usePolling(api, key, ready);
  useEffect(() => {
    if (data?.host && key) {
      try {
        remember({
          title: data.title,
          kind,
          link: `/${kind}/${id}/host?key=${key}`,
          date: data.createdAt,
        });
      } catch {
        /* The current activity remains usable. */
      }
    }
  }, [data?.title, data?.createdAt, data?.host, id, key, kind]);
  async function send(action: Action) {
    if (busy) return false;
    const previous = data;
    const optimistic =
      action.action === "blacklist" && !action.restore && data?.host;
    if (optimistic && action.action === "blacklist") {
      setData((current) =>
        current
          ? {
              ...current,
              data: {
                ...current.data,
                words: current.data.words.filter(
                  (w) => w.normalized !== action.word,
                ),
                blacklist: [
                  ...new Set([...current.data.blacklist, action.word]),
                ],
              },
            }
          : current,
      );
    }
    setBusy(true);
    setActionError("");
    setMessage("");
    try {
      const response = await fetch(api, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-participant-id": participantId(),
          ...(key ? { "x-host-key": key } : {}),
        },
        body: JSON.stringify(action),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      refresh();
      return true;
    } catch (e) {
      if (optimistic)
        setData((current) =>
          current && previous && current.revision <= previous.revision
            ? previous
            : current,
        );
      setActionError(
        e instanceof Error ? e.message : "Speichern fehlgeschlagen.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function submitWord(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (
      await send({
        action: "word",
        text: String(new FormData(form).get("word")),
      })
    ) {
      form.reset();
      setMessage("Danke, dein Begriff ist angekommen!");
    }
  }
  async function remove() {
    if (!confirm("Diese Aktivität und alle Beiträge endgültig löschen?"))
      return;
    setBusy(true);
    try {
      const response = await fetch(api, {
        method: "DELETE",
        headers: { "x-host-key": key! },
      });
      if (!response.ok) throw new Error((await response.json()).error);
      try {
        forget(`/${kind}/${id}/host?key=${key}`);
      } catch {}
      location.assign("/");
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Löschen fehlgeschlagen.",
      );
      setBusy(false);
    }
  }
  if (missingKey || terminal)
    return (
      <main className="activity">
        <h1>{missingKey ? "Lehrkraft-Link unvollständig" : error}</h1>
        <p>
          Bitte verwende den vollständigen Link oder erstelle eine neue
          Aktivität.
        </p>
        <a href="/">Zur Startseite →</a>
      </main>
    );
  if (!data)
    return (
      <main className="activity">
        <p role="status">
          {error || actionError || "Deine Klassenwand wird geladen …"}
        </p>
      </main>
    );
  const d = data.data;
  if (cloudOnly && data.host && kind !== "t") {
    return (
      <main
        className={`cloud-presentation ${kind === "u" ? "poll-presentation" : kind === "q" ? "quiz-presentation" : ""}`}
        aria-label={
          kind === "u"
            ? "Umfrage-Ergebnis für die Tafel"
            : "Wortwolke für die Tafel"
        }
      >
        {kind === "q" && d.quiz ? (
          <QuizHost quiz={d.quiz} busy={busy} send={send} />
        ) : kind === "u" ? (
          <>
            <h1>{data.title}</h1>
            <PollChart
              results={d.results}
              chart={d.chart ?? "bar"}
              voters={d.total}
              firstVoters={d.firstRound?.voters}
            />
          </>
        ) : (
          <WordCloud words={d.words} />
        )}
        <button
          ref={exitPresentationButton}
          className="presentation-exit"
          aria-label="Zur Lehrkraftansicht zurückkehren (Esc)"
          title="Zurück zur Lehrkraftansicht (Esc)"
          onClick={() => setCloudOnly(false)}
        >
          <span aria-hidden="true">×</span>
        </button>
        {error && (
          <p role="alert" className="presentation-error">
            {error}
          </p>
        )}
      </main>
    );
  }
  return (
    <main className={`activity ${hostMode ? "host-view" : "student-view"}`}>
      <div className="activity-heading">
        <div>
          <p className="eyebrow">
            {kindLabel[kind]}{" "}
            <span className={`live-dot ${d.paused ? "paused" : ""}`} />
            {d.paused
              ? kind === "u"
                ? " ABSTIMMUNG GESCHLOSSEN"
                : " EINGABE PAUSIERT"
              : " LIVE"}
            {kind === "u" && (d.round ?? 1) === 2 ? " · RUNDE 2" : ""}
            {data.host ? " · LEHRKRAFT-ANSICHT" : ""}
          </p>
          <h1>{data.title}</h1>
        </div>
        <span className="contribution-count">
          <b>{d.total}</b>{" "}
          {kind === "u"
            ? "Teilnehmende"
            : kind === "q"
              ? "Mitspielende"
              : "Beiträge"}
        </span>
      </div>
      {data.host && (
        <div className="toolbar no-print">
          <button onClick={() => setQr(!qr)}>
            {qr ? "QR-Code ausblenden" : "QR-Code anzeigen"}
          </button>
          {kind === "q" ? (
            <>
              <button
                ref={presentationButton}
                onClick={() => setCloudOnly(true)}
                aria-label="Quiz groß ohne Bedienleiste anzeigen"
              >
                ⛶ Tafelansicht
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      "Quiz neu starten? Alle Punkte werden gelöscht, die Spitznamen bleiben.",
                    )
                  )
                    void send({ action: "quiz", step: "restart" });
                }}
              >
                ↻ Quiz neu starten
              </button>
            </>
          ) : (
            <button
              disabled={busy}
              onClick={() =>
                void send({ action: "settings", paused: !d.paused })
              }
            >
              {kind === "u"
                ? d.paused
                  ? "▶ Abstimmung öffnen"
                  : "Ⅱ Abstimmung schließen"
                : d.paused
                  ? "▶ Eingaben öffnen"
                  : "Ⅱ Eingaben pausieren"}
            </button>
          )}
          {kind === "q" ? null : kind === "u" ? (
            <>
              <button
                ref={presentationButton}
                onClick={() => setCloudOnly(true)}
                aria-label="Nur das Diagramm groß anzeigen"
              >
                ⛶ Nur Diagramm
              </button>
              <div className="segmented" role="group" aria-label="Diagrammart">
                {(
                  [
                    ["bar", "▤ Balken"],
                    ["pie", "◔ Torte"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    disabled={busy}
                    aria-pressed={(d.chart ?? "bar") === value}
                    onClick={() =>
                      void send({ action: "settings", chart: value })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                disabled={busy}
                onClick={() =>
                  void send({ action: "settings", showCloud: !d.showCloud })
                }
              >
                {d.showCloud
                  ? "Ergebnis für Schüler verbergen"
                  : "Ergebnis für Schüler zeigen"}
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      "Alle Stimmen beider Runden löschen und neu beginnen?",
                    )
                  )
                    void send({ action: "reset" });
                }}
              >
                Stimmen zurücksetzen
              </button>
              {(d.round ?? 1) === 1 && (
                <button
                  disabled={busy || d.total === 0}
                  title="Ergebnis der ersten Runde sichern und alle erneut abstimmen lassen"
                  onClick={() => {
                    if (
                      confirm(
                        "Zweite Runde starten? Das Ergebnis der ersten Runde bleibt zum Vergleich erhalten, alle stimmen neu ab. Das Ergebnis wird für Schüler zunächst verborgen.",
                      )
                    )
                      void send({ action: "round2" });
                  }}
                >
                  ↻ Zweite Runde starten
                </button>
              )}
            </>
          ) : kind === "w" ? (
            <>
              <button
                ref={presentationButton}
                onClick={() => setCloudOnly(true)}
                aria-label="Nur die Wortwolke groß anzeigen"
              >
                ⛶ Nur Wortwolke
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void send({ action: "settings", showCloud: !d.showCloud })
                }
              >
                {d.showCloud
                  ? "Wolke für Schüler verbergen"
                  : "Wolke für Schüler zeigen"}
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      "Alle Begriffe, zusammengefassten Wörter und die Blacklist zurücksetzen?",
                    )
                  )
                    void send({ action: "reset" });
                }}
              >
                Zurücksetzen
              </button>
            </>
          ) : (
            <>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={d.approval}
                  disabled={busy}
                  onChange={(e) =>
                    void send({
                      action: "settings",
                      approval: e.target.checked,
                    })
                  }
                />
                Freigabe-Modus
              </label>
              <button onClick={() => window.print()}>↓ Drucken / PDF</button>
            </>
          )}
          <button
            onClick={async () => {
              try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else await document.documentElement.requestFullscreen();
              } catch {
                setActionError(
                  "Vollbild ist in diesem Browser nicht verfügbar.",
                );
              }
            }}
          >
            ⛶ Vollbild
          </button>
          <button className="danger" disabled={busy} onClick={remove}>
            Aktivität löschen
          </button>
        </div>
      )}
      {(error || actionError) && (
        <p role="alert" className="error no-print">
          {actionError || error}
        </p>
      )}
      {message && (
        <p role="status" className="success">
          {message}
        </p>
      )}
      <div className={`activity-content ${qr ? "with-qr" : ""}`}>
        <section className="activity-workspace">
          {kind === "q" ? (
            d.quiz &&
            (data.host ? (
              <QuizHost quiz={d.quiz} busy={busy} send={send} />
            ) : (
              <QuizPlayer quiz={d.quiz} busy={busy} send={send} />
            ))
          ) : kind === "u" ? (
            <>
              {!data.host && (
                <PollVote
                  options={d.options ?? []}
                  multiple={!!d.multiple}
                  ownVotes={d.ownVotes}
                  paused={d.paused}
                  round={d.round ?? 1}
                  busy={busy}
                  onVote={async (options) => {
                    const ok = await send({ action: "vote", options });
                    if (ok) setMessage("Danke, deine Stimme ist angekommen!");
                    return ok;
                  }}
                />
              )}
              {data.host || d.showCloud ? (
                <PollChart
                  results={d.results}
                  chart={d.chart ?? "bar"}
                  voters={d.total}
                  firstVoters={d.firstRound?.voters}
                  ownVotes={data.host ? [] : d.ownVotes}
                />
              ) : (
                d.ownVotes.length > 0 && (
                  <p className="hint poll-wait">
                    Die Lehrkraft zeigt das Ergebnis gleich an der Tafel.
                  </p>
                )
              )}
            </>
          ) : kind === "w" ? (
            <>
              {!data.host && (
                <form className="word-form" onSubmit={submitWord}>
                  <label>
                    Dein Begriff
                    <input
                      name="word"
                      required
                      maxLength={d.maxLength}
                      disabled={busy || d.paused || d.ownCount >= d.maxWords}
                      placeholder="Was fällt dir dazu ein?"
                      autoComplete="off"
                    />
                  </label>
                  <button
                    className="primary"
                    disabled={busy || d.paused || d.ownCount >= d.maxWords}
                  >
                    Begriff senden →
                  </button>
                  <p className="hint">
                    {d.paused
                      ? "Die Lehrkraft hat die Eingabe gerade pausiert."
                      : d.ownCount >= d.maxWords
                        ? "Du hast alle deine Begriffe gesendet. Vielen Dank!"
                        : `Noch ${d.maxWords - d.ownCount} ${d.maxWords - d.ownCount === 1 ? "Begriff" : "Begriffe"} · maximal ${d.maxLength} Zeichen`}
                  </p>
                </form>
              )}
              {(data.host || d.showCloud) && (
                <WordCloud
                  words={d.words}
                  onHide={
                    data.host
                      ? (word) => {
                          void send({
                            action: "blacklist",
                            word,
                            restore: false,
                          });
                        }
                      : undefined
                  }
                />
              )}
              {data.host && (
                <WordMerge
                  words={d.words}
                  merges={d.merges ?? {}}
                  busy={busy}
                  send={send}
                />
              )}
              {data.host && (
                <details className="blacklist no-print">
                  <summary>Ausgeblendete Wörter ({d.blacklist.length})</summary>
                  <p className="hint">Zum Wiederherstellen anklicken.</p>
                  {d.blacklist.map((word) => (
                    <button
                      disabled={busy}
                      key={word}
                      onClick={() =>
                        void send({ action: "blacklist", word, restore: true })
                      }
                    >
                      {word} ↶
                    </button>
                  ))}
                </details>
              )}
            </>
          ) : (
            <TextBoard data={data} send={send} busy={busy} />
          )}
        </section>
        {qr && <QRPanel url={url} />}
      </div>
      <p className="expiry">
        Automatische Löschung am{" "}
        {new Date(data.expiresAt).toLocaleString("de-DE", {
          dateStyle: "medium",
          timeStyle: "short",
        })}
        .
      </p>
    </main>
  );
}
