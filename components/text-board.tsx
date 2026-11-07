"use client";
import { useState, type FormEvent } from "react";
import type { Snapshot, PublicPost } from "@/lib/types";
import type { Action } from "@/lib/validation";
import { Modal } from "./modal";
type Props = {
  data: Snapshot;
  send: (a: Action) => Promise<boolean>;
  busy: boolean;
};
export function TextBoard({ data, send, busy }: Props) {
  const d = data.data,
    host = data.host;
  const [composer, setComposer] = useState<{
      columnId: string;
      parentId?: string;
      replyTo?: string;
    } | null>(null),
    [editing, setEditing] = useState<PublicPost | null>(null),
    [reference, setReference] = useState(""),
    [dragged, setDragged] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (editing) {
      if (
        await send({
          action: "post-edit",
          id: editing.id,
          text: String(f.get("text")),
        })
      )
        setEditing(null);
    } else if (composer) {
      if (
        await send({
          action: "post",
          ...composer,
          text: String(f.get("text")),
          author: String(f.get("author")),
          referenceId: reference || undefined,
        })
      ) {
        setComposer(null);
        setReference("");
      }
    }
  }
  function jump(id: string) {
    const element = document.getElementById(`post-${id}`);
    element?.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center",
    });
    element?.classList.add("highlight");
    setTimeout(() => element?.classList.remove("highlight"), 1600);
  }
  function quote(id: string, label = "Bezug") {
    const p = d.posts.find((p) => p.id === id);
    return p ? (
      <button className="quote" onClick={() => jump(id)}>
        <small>
          {label} · {p.author}
        </small>
        {p.text.slice(0, 100)}
        {p.text.length > 100 ? "…" : ""}
      </button>
    ) : (
      <p className="hint">Bezug nicht mehr verfügbar</p>
    );
  }
  function postCard(p: PublicPost, reply = false): React.ReactNode {
    const editable = p.own && Date.now() - p.createdAt < 600000;
    return (
      <article
        id={`post-${p.id}`}
        key={p.id}
        className={`post-card ${reply ? "reply" : ""} ${p.hidden ? "hidden-post" : ""} ${!p.approved ? "pending-post" : ""}`}
        draggable={host && !reply}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", p.id);
          setDragged(p.id);
        }}
        onDragEnd={() => setDragged("")}
        onDragOver={(e) => {
          if (host && !reply) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onDrop={(e) => {
          if (host && !reply) {
            e.preventDefault();
            e.stopPropagation();
            const id = e.dataTransfer.getData("text/plain");
            if (id !== p.id)
              void send({
                action: "post-move",
                id,
                columnId: p.columnId,
                beforeId: p.id,
              });
          }
        }}
      >
        {p.referenceId && quote(p.referenceId)}
        {p.replyTo && quote(p.replyTo, "Antwort an")}
        <p className="post-text">{p.text}</p>
        <div className="post-meta">
          <strong>{p.author}</strong>
          <span>
            {p.own ? "Dein Beitrag · " : ""}
            {new Date(p.createdAt).toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        {p.hidden && <small className="status-tag">Ausgeblendet</small>}
        {!p.approved && (
          <small className="status-tag">Wartet auf Freigabe</small>
        )}
        <div className="post-actions no-print">
          <button
            onClick={() => {
              setEditing(null);
              setReference("");
              setComposer({
                columnId: p.columnId,
                parentId: p.parentId || p.id,
                replyTo: reply ? p.id : undefined,
              });
            }}
            disabled={
              busy ||
              (!host &&
                (d.paused ||
                  !!d.columns.find((c) => c.id === p.columnId)?.closed))
            }
          >
            ↳ Antworten
          </button>
          {editable && (
            <button
              onClick={() => {
                setComposer(null);
                setEditing(p);
              }}
            >
              Bearbeiten
            </button>
          )}
          {(host || editable) && (
            <button
              disabled={busy}
              onClick={() => void send({ action: "post-delete", id: p.id })}
            >
              Löschen
            </button>
          )}
          {host && (
            <>
              <button
                disabled={busy}
                onClick={() =>
                  void send({
                    action: "post-moderate",
                    id: p.id,
                    hidden: !p.hidden,
                  })
                }
              >
                {p.hidden ? "Einblenden" : "Ausblenden"}
              </button>
              {!p.approved && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void send({
                      action: "post-moderate",
                      id: p.id,
                      approved: true,
                    })
                  }
                >
                  ✓ Freigeben
                </button>
              )}
              {!reply && (
                <label className="move-select">
                  <span className="sr-only">Beitrag verschieben</span>
                  <select
                    aria-label="Beitrag verschieben"
                    value=""
                    disabled={busy}
                    onChange={(e) => {
                      const [columnId, beforeId] = e.target.value.split("|");
                      void send({
                        action: "post-move",
                        id: p.id,
                        columnId,
                        beforeId: beforeId || undefined,
                      });
                    }}
                  >
                    <option value="">Verschieben …</option>
                    {d.columns.flatMap((c) => [
                      <option key={c.id} value={c.id}>
                        {c.title} · ans Ende
                      </option>,
                      ...d.posts
                        .filter(
                          (x) =>
                            !x.parentId && x.columnId === c.id && x.id !== p.id,
                        )
                        .map((x) => (
                          <option key={x.id} value={`${c.id}|${x.id}`}>
                            {c.title} · vor „{x.text.slice(0, 25)}“
                          </option>
                        )),
                    ])}
                  </select>
                </label>
              )}
            </>
          )}
        </div>
        {!reply &&
          d.posts
            .filter((r) => r.parentId === p.id)
            .map((r) => postCard(r, true))}
      </article>
    );
  }
  return (
    <>
      <div className={`board-columns ${dragged ? "dragging" : ""}`}>
        {d.columns.map((column, index) => (
          <section
            className="board-column"
            key={column.id}
            onDragOver={(e) => {
              if (host) e.preventDefault();
            }}
            onDrop={(e) => {
              if (host) {
                e.preventDefault();
                void send({
                  action: "post-move",
                  id: e.dataTransfer.getData("text/plain"),
                  columnId: column.id,
                });
              }
            }}
          >
            <div className="column-heading">
              <span className="column-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h2>{column.title}</h2>
              <span className="count">
                {
                  d.posts.filter((p) => p.columnId === column.id && !p.parentId)
                    .length
                }
              </span>
            </div>
            {host && (
              <div className="column-controls no-print">
                <button
                  disabled={busy}
                  onClick={() => {
                    const title = prompt(
                      "Überschrift der Spalte",
                      column.title,
                    );
                    if (title?.trim())
                      void send({
                        action: "column-update",
                        id: column.id,
                        title,
                      });
                  }}
                >
                  Umbenennen
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void send({
                      action: "column-update",
                      id: column.id,
                      closed: !column.closed,
                    })
                  }
                >
                  {column.closed ? "Öffnen" : "Schließen"}
                </button>
                <button
                  aria-label="Spalte nach links"
                  disabled={busy || index === 0}
                  onClick={() =>
                    void send({
                      action: "column-move",
                      id: column.id,
                      direction: -1,
                    })
                  }
                >
                  ←
                </button>
                <button
                  aria-label="Spalte nach rechts"
                  disabled={busy || index === d.columns.length - 1}
                  onClick={() =>
                    void send({
                      action: "column-move",
                      id: column.id,
                      direction: 1,
                    })
                  }
                >
                  →
                </button>
                <button
                  disabled={busy || d.columns.length === 1}
                  onClick={() => {
                    if (
                      confirm("Spalte mit allen Beiträgen endgültig löschen?")
                    )
                      void send({ action: "column-delete", id: column.id });
                  }}
                >
                  Löschen
                </button>
              </div>
            )}
            {column.closed && (
              <p className="column-status">Für neue Beiträge geschlossen</p>
            )}
            <div className="column-posts">
              {d.posts
                .filter((p) => p.columnId === column.id && !p.parentId)
                .map((p) => postCard(p))}
            </div>
            <button
              className="add-post no-print"
              disabled={
                busy ||
                (!host && (column.closed || d.paused)) ||
                (!host && d.ownCount >= 100)
              }
              onClick={() => {
                setEditing(null);
                setReference("");
                setComposer({ columnId: column.id });
              }}
            >
              + Beitrag
            </button>
          </section>
        ))}
        {host && d.columns.length < 12 && (
          <button
            className="add-column no-print"
            disabled={busy}
            onClick={() => {
              const title = prompt("Frage oder Überschrift der neuen Spalte");
              if (title?.trim()) void send({ action: "column-add", title });
            }}
          >
            + Spalte
          </button>
        )}
      </div>
      {(composer || editing) && (
        <Modal
          labelledBy="post-dialog-title"
          onClose={() => {
            setComposer(null);
            setEditing(null);
          }}
        >
          <button
            className="close"
            aria-label="Schließen"
            onClick={() => {
              setComposer(null);
              setEditing(null);
            }}
          >
            ×
          </button>
          <h2 id="post-dialog-title">
            {editing
              ? "Beitrag bearbeiten"
              : composer?.parentId
                ? "Deine Antwort"
                : "Dein Gedanke zählt."}
          </h2>
          {composer?.parentId &&
            quote(composer.replyTo || composer.parentId, "Antwort an")}
          <form onSubmit={submit}>
            <label>
              Dein Text · maximal 500 Zeichen
              <textarea
                autoFocus
                name="text"
                required
                maxLength={500}
                rows={5}
                defaultValue={editing?.text || ""}
              />
            </label>
            {!editing && (
              <>
                <label>
                  Name/Kürzel{" "}
                  <span className="hint">
                    · freiwillig, bitte keinen vollen Namen
                  </span>
                  <input name="author" maxLength={40} placeholder="Anonym" />
                </label>
                <label>
                  Bezug auf einen Beitrag{" "}
                  <span className="hint">· freiwillig</span>
                  <select
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  >
                    <option value="">Ohne Bezug</option>
                    {d.posts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {d.columns.find((c) => c.id === p.columnId)?.title}:{" "}
                        {p.text.slice(0, 70)}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <button className="primary" disabled={busy}>
              {busy
                ? "Wird gespeichert …"
                : editing
                  ? "Änderung speichern"
                  : "Absenden →"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
