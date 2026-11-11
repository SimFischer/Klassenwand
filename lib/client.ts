"use client";
export type Saved = {
  title: string;
  kind: "w" | "t" | "u" | "q";
  link: string;
  date: number;
};
export function participantId() {
  let id = localStorage.getItem("klassenwand-participant");
  if (!id) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
      "",
    );
    id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    localStorage.setItem("klassenwand-participant", id);
  }
  return id;
}
export function savedActivities(): Saved[] {
  try {
    const value = JSON.parse(
      localStorage.getItem("klassenwand-activities") || "[]",
    );
    return Array.isArray(value)
      ? value.filter(
          (x: Saved) =>
            typeof x.title === "string" &&
            /^\/(w|t|u|q)\/[\w-]+\/host\?key=[\w-]+$/.test(x.link) &&
            Date.now() - x.date < 7 * 86400000,
        )
      : [];
  } catch {
    return [];
  }
}
export function remember(item: Saved) {
  localStorage.setItem(
    "klassenwand-activities",
    JSON.stringify([
      item,
      ...savedActivities().filter((x) => x.link !== item.link),
    ]),
  );
}
export function forget(link: string) {
  localStorage.setItem(
    "klassenwand-activities",
    JSON.stringify(savedActivities().filter((x) => x.link !== link)),
  );
}
