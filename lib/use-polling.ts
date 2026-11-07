"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Snapshot } from "./types";
import { participantId } from "./client";
export function usePolling(
  url: string,
  hostKey: string | null,
  ready: boolean,
) {
  const [data, setData] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [terminal, setTerminal] = useState(false);
  const revision = useRef(0);
  const refreshRef = useRef<() => void>(() => {});
  const refresh = useCallback(() => refreshRef.current(), []);
  useEffect(() => {
    if (!ready) return;
    let stopped = false,
      running = false,
      timer: ReturnType<typeof setTimeout>,
      delay = 2500;
    const controller = new AbortController();
    async function poll() {
      clearTimeout(timer);
      if (stopped || document.hidden || running) return;
      running = true;
      try {
        const response = await fetch(`${url}?since=${revision.current}`, {
          headers: {
            "x-participant-id": participantId(),
            ...(hostKey ? { "x-host-key": hostKey } : {}),
          },
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) {
          if (response.status === 404 || response.status === 403) {
            setTerminal(true);
            stopped = true;
          }
          throw new Error(payload.error);
        }
        if (!stopped) {
          if (!payload.unchanged) {
            revision.current = payload.revision;
            setData(payload);
          }
          setError("");
          delay = 2500;
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "Verbindung unterbrochen.");
          delay = Math.min(delay * 2, 30000);
        }
      } finally {
        running = false;
        if (!stopped && !document.hidden) timer = setTimeout(poll, delay);
      }
    }
    refreshRef.current = () => {
      void poll();
    };
    const visibility = () => {
      clearTimeout(timer);
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", visibility);
    void poll();
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibility);
      revision.current = 0;
    };
  }, [url, hostKey, ready]);
  return { data, error, terminal, refresh, setData };
}
