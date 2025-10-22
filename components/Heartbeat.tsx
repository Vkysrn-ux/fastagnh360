"use client";

import { useCallback, useEffect, useRef } from "react";

const INTERVAL_MS = Number(process.env.NEXT_PUBLIC_HEARTBEAT_INTERVAL_MS || 60000);

export default function Heartbeat() {
  const timerRef = useRef<number | null>(null);
  const inflightRef = useRef(false);

  const send = useCallback((isVisible: boolean, opts: { keepalive?: boolean } = {}) => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    fetch("/api/activity/heartbeat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isVisible }),
      keepalive: !!opts.keepalive,
      cache: "no-store",
    }).catch(() => {}).finally(() => {
      inflightRef.current = false;
    });
  }, []);

  useEffect(() => {
    const visible = document.visibilityState === "visible";
    send(visible);

    const onVis = () => send(document.visibilityState === "visible");
    const onUnload = () => send(false, { keepalive: true });
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", onUnload);

    timerRef.current = window.setInterval(() => {
      send(document.visibilityState === "visible");
    }, INTERVAL_MS) as unknown as number;

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", onUnload);
      if (timerRef.current) window.clearInterval(timerRef.current);
      // best effort close
      send(false, { keepalive: true });
    };
  }, [send]);

  return null;
}

