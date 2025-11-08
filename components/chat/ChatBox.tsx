"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { getAuthSessionCached } from "@/lib/client/cache";

type OnlineUser = { id: number; name: string; displayRole?: string };
type ChatMessage = {
  fromUserId: number;
  fromName: string;
  toUserId: number;
  text: string;
  ticketId?: string | number | null;
  ts: number;
};

export default function ChatBox({ ticketId, visible = true }: { ticketId?: string | number; visible?: boolean }) {
  const DEBUG = (typeof process !== 'undefined' && process.env && (process.env.NEXT_PUBLIC_CHAT_DEBUG === '1' || process.env.NEXT_PUBLIC_CHAT_DEBUG === 'true')) || false;
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState<OnlineUser[]>([]);
  const [self, setSelf] = useState<{ id: number; name: string } | null>(null);
  const [activeUserId, setActiveUserId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [convo, setConvo] = useState<Record<number, ChatMessage[]>>({});
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const activeMessages = useMemo(() => {
    return activeUserId ? (convo[activeUserId] || []) : [];
  }, [convo, activeUserId]);

  useEffect(() => {
    // Initialize Socket.IO server
    fetch("/api/socket").then(() => {
      if (DEBUG) console.log("[chat] initialized /api/socket");
    }).catch((e) => { if (DEBUG) console.warn("[chat] /api/socket init failed", e); });

    const s = io(undefined, { path: "/api/socket-io", transports: ["websocket", "polling"] });
    socketRef.current = s;

    s.on("connect", () => { if (DEBUG) console.log("[chat] socket connected", s.id); });
    s.on("disconnect", (reason) => { if (DEBUG) console.log("[chat] socket disconnected", reason); });

    s.on("self", (me: { id: number; name: string }) => {
      if (DEBUG) console.log("[chat] self:", me);
      setSelf(me)
    });
    s.on("online_users", (users: OnlineUser[]) => {
      if (DEBUG) console.log("[chat] online_users:", users);
      // Use server broadcast as a fast path; heartbeat polling will reconcile
      setOnline(users || []);
    });
    s.on("chat:message", (msg: ChatMessage) => {
      setConvo((prev) => {
        const key = msg.fromUserId === self?.id ? msg.toUserId : msg.fromUserId;
        const list = prev[key] ? [...prev[key]] : [];
        list.push(msg);
        return { ...prev, [key]: list };
      });
      if (!open) setOpen(true);
      if (DEBUG) console.log("[chat] msg:", msg);
    });

    if (DEBUG) {
      // @ts-ignore - expose for quick inspection
      (window as any).__chat = s;
    }

    return () => {
      s.disconnect();
    };
  }, []);

  // Poll available users by heartbeat (last activity)
  useEffect(() => {
    // Also fetch auth session as a fallback to identify self
    (async () => {
      try {
        const data = await getAuthSessionCached();
        const sess = data?.session;
        const sid = Number(sess?.id || 0);
        if (sid && !self) {
          setSelf({ id: sid, name: String(sess?.name || sess?.email || `User #${sid}`) });
        }
      } catch {}
    })();

    let timer: any;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/chat/available", { cache: "no-store" });
        if (!res.ok) return;
        const data: OnlineUser[] = await res.json();
        if (!alive) return;
        // Source of truth for availability is heartbeat API
        setOnline(data);
      } catch {}
    };
    load();
    timer = setInterval(load, 30000);
    return () => { alive = false; if (timer) clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [activeMessages.length, open]);

  const send = () => {
    const toUserId = activeUserId ? Number(activeUserId) : 0;
    const text = input.trim();
    if (!toUserId || !text || !socketRef.current) return;
    socketRef.current.emit("chat:message", { toUserId, text, ticketId });
    setInput("");
  };

  return (
    <div>
      {visible ? (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className="fixed bottom-4 right-4 z-40 rounded-full bg-blue-600 text-white px-4 py-3 shadow-lg hover:bg-blue-700"
            aria-label="Open Chat"
          >
            {open ? "Close Chat" : "Chat"}
          </button>

          {open ? (
            <div className="fixed bottom-20 right-4 z-40 w-[22rem] sm:w-[30rem] bg-white border shadow-xl rounded-lg overflow-hidden">
              <div className="flex h-96">
                {/* Online users */}
                <div className="w-40 border-r bg-gray-50">
                  <div className="p-2 font-semibold text-sm border-b">Online</div>
                  <div className="overflow-y-auto max-h-[22rem]">
                    {online.length === 0 && (
                      <div className="p-2 text-xs text-gray-500">No users online</div>
                    )}
                    {online.map((u) => {
                      const isSelf = self && u.id === self.id;
                      const label = isSelf ? `${u.name} (You)` : u.name;
                      const disabled = !!isSelf;
                      return (
                        <button
                          key={u.id}
                          onClick={() => { if (!disabled) setActiveUserId(u.id); }}
                          disabled={disabled}
                          className={`flex w-full items-center gap-2 p-2 text-left text-sm hover:bg-gray-100 ${
                            activeUserId === u.id ? "bg-gray-100" : ""
                          } ${disabled ? "opacity-60 cursor-default hover:bg-transparent" : ""}`}
                          aria-disabled={disabled}
                        >
                          <span className="inline-block h-2 w-2 rounded-full bg-green-500"></span>
                          <span className="truncate">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Conversation */}
                <div className="flex flex-1 flex-col">
                  <div className="p-2 border-b text-sm font-medium">
                    {activeUserId
                      ? online.find((u) => u.id === activeUserId)?.name || `User #${activeUserId}`
                      : "Select a user"}
                  </div>

                  <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-white">
                    {activeUserId ? (
                      activeMessages.length ? (
                        activeMessages.map((m, i) => {
                          const mine = m.fromUserId === self?.id;
                          return (
                            <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                              <div className={`rounded-md px-3 py-2 text-sm max-w-[70%] ${mine ? "bg-blue-600 text-white" : "bg-gray-100"}`}>
                                <div className="whitespace-pre-wrap break-words">{m.text}</div>
                                <div className="mt-1 text-[10px] opacity-70">
                                  {new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  {m.ticketId ? ` - Ticket ${m.ticketId}` : ""}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-xs text-gray-500">No messages yet</div>
                      )
                    ) : (
                      <div className="text-xs text-gray-500">Pick an online user to chat</div>
                    )}
                  </div>

                  <div className="p-2 border-t flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                      placeholder={activeUserId ? "Type a message..." : "Select a user to start"}
                      disabled={!activeUserId}
                      className="flex-1 rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={send}
                      disabled={!activeUserId || !input.trim()}
                      className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
