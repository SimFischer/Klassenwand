import type { ActivityData } from "../types";
import type { Action } from "../validation";
import { demand } from "../errors";
import { mayEdit, newId } from "../auth";
export function boardAction(
  d: ActivityData,
  a: Action,
  host: boolean,
  participant: string,
  now: number,
) {
  if (a.action.startsWith("column-")) {
    demand(host, 403, "Nur die Lehrkraft darf Spalten bearbeiten.");
    if (a.action === "column-add") {
      demand(d.columns.length < 12, 400, "Maximal 12 Spalten.");
      d.columns.push({ id: newId(), title: a.title, closed: false });
      return;
    }
    if (
      a.action === "column-update" ||
      a.action === "column-delete" ||
      a.action === "column-move"
    ) {
      const index = d.columns.findIndex((c) => c.id === a.id);
      demand(index >= 0, 404, "Spalte nicht gefunden.");
      if (a.action === "column-update")
        Object.assign(d.columns[index], {
          ...(a.title !== undefined ? { title: a.title } : {}),
          ...(a.closed !== undefined ? { closed: a.closed } : {}),
        });
      if (a.action === "column-delete") {
        demand(
          d.columns.length > 1,
          400,
          "Mindestens eine Spalte muss bleiben.",
        );
        d.columns.splice(index, 1);
        const removed = new Set(
          d.posts.filter((p) => p.columnId === a.id).map((p) => p.id),
        );
        d.posts = d.posts.filter((p) => !removed.has(p.id));
      }
      if (a.action === "column-move") {
        const target = index + a.direction;
        if (target >= 0 && target < d.columns.length)
          [d.columns[index], d.columns[target]] = [
            d.columns[target],
            d.columns[index],
          ];
      }
    }
    return;
  }
  if (a.action === "post") {
    const column = d.columns.find((c) => c.id === a.columnId);
    demand(column, 404, "Spalte nicht gefunden.");
    demand(
      host || (!d.paused && !column.closed),
      409,
      "Diese Spalte ist gerade geschlossen.",
    );
    demand(d.posts.length < 3000, 400, "Diese Pinnwand ist voll.");
    const visible = (id: string) =>
      d.posts.find(
        (p) =>
          p.id === id &&
          (host || (!p.hidden && p.approved) || p.participant === participant),
      );
    let parent = a.parentId ? visible(a.parentId) : undefined;
    demand(!a.parentId || parent, 404, "Beitrag nicht gefunden.");
    if (parent?.parentId) parent = visible(parent.parentId);
    if (a.parentId)
      demand(
        parent && parent.columnId === column.id,
        400,
        "Antwort und Beitrag müssen zur gleichen Spalte gehören.",
      );
    demand(
      !a.referenceId || visible(a.referenceId),
      404,
      "Bezug nicht gefunden.",
    );
    const reply = a.replyTo ? visible(a.replyTo) : undefined;
    demand(
      !a.replyTo ||
        (reply &&
          parent &&
          (reply.parentId === parent.id || reply.id === parent.id)),
      400,
      "Ungültiger Antwortbezug.",
    );
    d.posts.push({
      id: newId(),
      columnId: column.id,
      text: a.text,
      author: a.author || "Anonym",
      participant,
      createdAt: now,
      parentId: parent?.id,
      referenceId: a.referenceId,
      replyTo: a.replyTo,
      hidden: false,
      approved: host || !d.approval,
    });
    return;
  }
  if (
    a.action === "post-edit" ||
    a.action === "post-delete" ||
    a.action === "post-moderate" ||
    a.action === "post-move"
  ) {
    const post = d.posts.find((p) => p.id === a.id);
    demand(post, 404, "Beitrag nicht gefunden.");
    if (a.action === "post-edit" || a.action === "post-delete")
      demand(
        host || mayEdit(participant, post.participant, post.createdAt, now),
        403,
        "Eigene Beiträge lassen sich nur innerhalb von 10 Minuten ändern.",
      );
    else demand(host, 403, "Nur die Lehrkraft darf moderieren.");
    if (a.action === "post-edit") {
      post.text = a.text;
      if (!host && d.approval) post.approved = false;
    }
    if (a.action === "post-delete")
      d.posts = d.posts.filter(
        (p) => p.id !== post.id && p.parentId !== post.id,
      );
    if (a.action === "post-moderate") {
      if (a.hidden !== undefined) post.hidden = a.hidden;
      if (a.approved !== undefined) post.approved = a.approved;
    }
    if (a.action === "post-move") {
      demand(!post.parentId, 400, "Bitte den Hauptbeitrag verschieben.");
      demand(
        d.columns.some((c) => c.id === a.columnId),
        404,
        "Spalte nicht gefunden.",
      );
      const before = a.beforeId
        ? d.posts.find(
            (p) =>
              p.id === a.beforeId && !p.parentId && p.columnId === a.columnId,
          )
        : undefined;
      demand(!a.beforeId || before, 400, "Ungültige Zielposition.");
      if (before?.id === post.id) return;
      d.posts = d.posts.filter((p) => p.id !== post.id);
      post.columnId = a.columnId;
      d.posts
        .filter((p) => p.parentId === post.id)
        .forEach((p) => (p.columnId = a.columnId));
      const at = before
        ? d.posts.findIndex((p) => p.id === before.id)
        : d.posts.length;
      d.posts.splice(at, 0, post);
    }
    return;
  }
  demand(false, 400, "Aktion passt nicht zur Text-Pinnwand.");
}
