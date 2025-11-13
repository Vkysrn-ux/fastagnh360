"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { getAuthSessionCached } from "@/lib/client/cache";
import { toast } from "sonner";

type OnlineUser = { id: number; name: string; displayRole?: string };
type RecentUser = OnlineUser & { lastActiveTs?: number; lastAt?: string };
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
  const [recents, setRecents] = useState<RecentUser[]>([]);
  const [self, setSelf] = useState<{ id: number; name: string } | null>(null);
  const [activeUserId, setActiveUserId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [convo, setConvo] = useState<Record<number, ChatMessage[]>>({});
  const socketRef = useRef<Socket | null>(null);
  // Refs to avoid stale closures inside socket handlers
  const selfRef = useRef<{ id: number; name: string } | null>(null);
  const activeUserIdRef = useRef<number | null>(null);
  const openRef = useRef<boolean>(false);
  const windowFocusedRef = useRef<boolean>(true);
  const documentVisibleRef = useRef<boolean>(true);
  const listRef = useRef<HTMLDivElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [windowFocused, setWindowFocused] = useState<boolean>(true);
  const [documentVisible, setDocumentVisible] = useState<boolean>(true);
  const [notifSupported, setNotifSupported] = useState<boolean>(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');

  const activeMessages = useMemo(() => {
    return activeUserId ? (convo[activeUserId] || []) : [];
  }, [convo, activeUserId]);

  // If self resolves later and the currently selected conversation is self, clear it
  useEffect(() => {
    if (self && activeUserId === self.id) {
      setActiveUserId(null);
    }
  }, [self, activeUserId]);

  useEffect(() => {
    // Track window focus/visibility for conditional notifications
    if (typeof window !== 'undefined') {
      setNotifSupported('Notification' in window);
      try { setNotifPermission((window as any).Notification?.permission || 'default'); } catch {}
      const onFocus = () => { setWindowFocused(true); windowFocusedRef.current = true; };
      const onBlur = () => { setWindowFocused(false); windowFocusedRef.current = false; };
      const onVisibility = () => { const v = !document.hidden; setDocumentVisible(v); documentVisibleRef.current = v; };
      setWindowFocused(document.hasFocus());
      windowFocusedRef.current = document.hasFocus();
      setDocumentVisible(!document.hidden);
      documentVisibleRef.current = !document.hidden;
      window.addEventListener('focus', onFocus);
      window.addEventListener('blur', onBlur);
      document.addEventListener('visibilitychange', onVisibility);
      return () => {
        window.removeEventListener('focus', onFocus);
        window.removeEventListener('blur', onBlur);
        document.removeEventListener('visibilitychange', onVisibility);
      };
    }
  }, []);

  const requestNotifications = async () => {
    try {
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      const perm = await (window as any).Notification.requestPermission();
      setNotifPermission(perm);
      if (perm === 'granted') {
        toast.success('Desktop notifications enabled');
      } else if (perm === 'denied') {
        toast.error('Notifications blocked in browser settings');
      }
    } catch {
      // ignore
    }
  };

  const playBeep = () => {
    try {
      if (typeof window === 'undefined') return;
      // @ts-ignore - support Safari
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx: AudioContext = audioCtxRef.current || new Ctx();
      audioCtxRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880; // Hz
      gain.gain.value = 0.05;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => {
        try { osc.stop(); osc.disconnect(); gain.disconnect(); } catch {}
      }, 150);
    } catch {}
  };

  const formatAgo = (ts: number): string => {
    try {
      const now = Date.now();
      const diffMs = Math.max(0, now - ts);
      const sec = Math.floor(diffMs / 1000);
      const min = Math.floor(sec / 60);
      const hr = Math.floor(min / 60);
      const day = Math.floor(hr / 24);
      if (day >= 2) return `${day}days ago`;
      if (day === 1) return `1day ago`;
      if (hr >= 2) return `${hr}hrs ago`;
      if (hr === 1) return `1hr ago`;
      if (min >= 2) return `${min}mins ago`;
      if (min === 1) return `1min ago`;
      return `just now`;
    } catch { return ""; }
  };
  
  useEffect(() => {
    // Keep refs in sync for handlers
    selfRef.current = self;
  }, [self]);

  useEffect(() => {
    activeUserIdRef.current = activeUserId;
  }, [activeUserId]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    // Initialize Socket.IO server
    fetch("/api/socket").then(() => {
      if (DEBUG) console.log("[chat] initialized /api/socket");
    }).catch((e) => { if (DEBUG) console.warn("[chat] /api/socket init failed", e); });

    let cancelled = false;
    (async () => {
      let auth: any = {};
      try {
        const data = await getAuthSessionCached();
        const sess = data?.session;
        const uid = Number(sess?.id || 0);
        if (uid) {
          auth = { id: uid, name: String(sess?.name || sess?.email || `User #${uid}`) };
          // Prime self early so first echo threads correctly
          if (!self) setSelf({ id: uid, name: auth.name });
        }
      } catch {}

      if (cancelled) return;
      const s = io(undefined, { path: "/api/socket-io", transports: ["websocket", "polling"], auth });
      socketRef.current = s;

      s.on("connect", () => { if (DEBUG) console.log("[chat] socket connected", s.id); });
      s.on("disconnect", (reason) => { if (DEBUG) console.log("[chat] socket disconnected", reason); });
      s.on("connect_error", (err) => { if (DEBUG) console.warn("[chat] connect_error", err?.message || err); });

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
          // Use refs to avoid stale closures. Thread key is always the peer id.
          const me = selfRef.current?.id || 0;
          let key: number;
          if (me) {
            key = (msg.fromUserId === me) ? msg.toUserId : msg.fromUserId;
          } else {
            const act = activeUserIdRef.current || 0;
            if (act && (msg.toUserId === act || msg.fromUserId === act)) key = act;
            else key = msg.fromUserId; // fallback
          }
          const list = prev[key] ? [...prev[key]] : [];
          list.push(msg);
          return { ...prev, [key]: list };
        });
        // Refresh recents when a message arrives
        try { fetch("/api/chat/recents", { cache: "no-store" }).then(r => r.json()).then((arr) => setRecents(Array.isArray(arr) ? arr : [])); } catch {}
        // Determine incoming/outgoing robustly even if `self` not resolved yet
        let isIncoming: boolean;
        const me = selfRef.current?.id || 0;
        if (me) {
          isIncoming = msg.fromUserId !== me;
        } else if (activeUserId) {
          // If current thread is the recipient, treat as outgoing; if it's the sender, treat as incoming
          if (activeUserId === msg.toUserId) isIncoming = false;
          else if (activeUserId === msg.fromUserId) isIncoming = true;
          else isIncoming = true;
        } else {
          isIncoming = true;
        }
        const isActiveConversation = openRef.current && activeUserIdRef.current === (isIncoming ? msg.fromUserId : msg.toUserId);
        if (isIncoming) {
          const shouldToast = !isActiveConversation || !windowFocusedRef.current || !documentVisibleRef.current;
          if (shouldToast) {
          const title = `Message from ${msg.fromName || "User"}`;
          toast(title, {
            description: msg.text,
            duration: 5000,
            onClick: () => {
              setActiveUserId(msg.fromUserId);
              if (!openRef.current) setOpen(true);
            },
          });
          // If chat is open and user is viewing a different thread, auto-switch to sender
          if (!isActiveConversation) {
            setActiveUserId(msg.fromUserId);
            if (!openRef.current) setOpen(true);
          }
        }
        // Play gentle beep for any incoming not in active view
        if (!isActiveConversation || !windowFocusedRef.current || !documentVisibleRef.current) {
          playBeep();
        }
        // Optional: system notification if page hidden and permission granted
        try {
          if (typeof window !== 'undefined' && 'Notification' in window && document.hidden && (window as any).Notification?.permission === 'granted') {
            // eslint-disable-next-line no-new
            new (window as any).Notification(`Message from ${msg.fromName || 'User'}`, { body: msg.text });
          }
        } catch {}
      } else {
        // If it's our own message, ensure panel opens to show it
        if (!open) setOpen(true);
      }
      if (DEBUG) console.log("[chat] msg:", msg);
    });

      if (DEBUG) {
        // @ts-ignore - expose for quick inspection
        (window as any).__chat = s;
      }

      return () => {
        s.disconnect();
      };
    })();

    return () => { cancelled = true; };
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

  // Load recent chats list periodically
  useEffect(() => {
    let alive = true;
    let timer: any;
    const load = async () => {
      try {
        const res = await fetch("/api/chat/recents", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (alive) {
          const mapped: RecentUser[] = Array.isArray(data)
            ? data.map((r: any) => ({
                id: Number(r.id),
                name: String(r.name || `User #${r.id}`),
                lastAt: r.lastAt,
                lastActiveTs: r.lastActive ? new Date(r.lastActive).getTime() : (r.lastAt ? new Date(r.lastAt).getTime() : undefined),
              }))
            : [];
          setRecents(mapped);
        }
      } catch {}
    };
    load();
    timer = setInterval(load, 30000);
    return () => { alive = false; if (timer) clearInterval(timer); };
  }, []);

  // When switching conversation, load history from server so messages persist
  useEffect(() => {
    const peer = activeUserId ? Number(activeUserId) : 0;
    if (!peer) return;
    let alive = true;
    (async () => {
      try {
        const qs = new URLSearchParams();
        qs.set('peerId', String(peer));
        if (ticketId != null && ticketId !== undefined && String(ticketId).trim() !== '') {
          qs.set('ticketId', String(ticketId));
        }
        const res = await fetch(`/api/chat/messages?${qs.toString()}`, { cache: 'no-store' });
        const data: ChatMessage[] = await res.json();
        if (!alive) return;
        setConvo((prev) => ({ ...prev, [peer]: Array.isArray(data) ? data : [] }));
      } catch {}
    })();
    return () => { alive = false; };
  }, [activeUserId, ticketId]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [activeMessages.length, open]);

  const send = () => {
    const toUserId = activeUserId ? Number(activeUserId) : 0;
    const text = input.trim();
    if (!toUserId) {
      if (DEBUG) console.warn('[chat] send aborted: invalid toUserId', { activeUserId });
      return;
    }
    if (!text) return;
    if (!socketRef.current) {
      if (DEBUG) console.warn('[chat] send aborted: no socket');
      toast.error('Chat connection not ready.');
      return;
    }
    socketRef.current.emit("chat:message", { toUserId, text, ticketId });
    setInput("");
  };

  const clearConversation = async () => {
    const peer = activeUserId ? Number(activeUserId) : 0;
    if (!peer) return;
    try {
      if (!window.confirm('Clear this conversation from your view?')) return;
      const res = await fetch('/api/chat/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId: peer, ticketId }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.ok) {
        setConvo((prev) => ({ ...prev, [peer]: [] }));
        try { fetch('/api/chat/recents', { cache: 'no-store' }).then(r => r.json()).then((arr) => setRecents(Array.isArray(arr) ? arr : [])); } catch {}
        toast.success('Conversation cleared');
      } else {
        toast.error('Unable to clear conversation');
      }
    } catch {
      toast.error('Unable to clear conversation');
    }
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
                {/* Left column: Recents + Online */}
                <div className="w-48 border-r bg-gray-50 flex flex-col">
                  <div className="p-2 font-semibold text-sm border-b">Recent</div>
                  <div className="overflow-y-auto max-h-[10rem]">
                    {recents.length === 0 && (
                      <div className="p-2 text-xs text-gray-500">No recent chats</div>
                    )}
                    {(() => { const onlineSet = new Set(online.map((o) => o.id)); return recents.map((u) => {
                      const disabled = self ? u.id === self.id : false;
                      const isOnline = onlineSet.has(u.id);
                      const suffix = !isOnline && u.lastActiveTs ? ` (Active ${formatAgo(u.lastActiveTs)})` : "";
                      return (
                        <button
                          key={`r-${u.id}`}
                          onClick={() => { if (!disabled) setActiveUserId(u.id); }}
                          disabled={disabled}
                          className={`flex w-full items-center gap-2 p-2 text-left text-sm hover:bg-gray-100 ${
                            activeUserId === u.id ? "bg-gray-100" : ""
                          } ${disabled ? "opacity-60 cursor-default hover:bg-transparent" : ""}`}
                          aria-disabled={disabled}
                        >
                          <span className="inline-block h-2 w-2 rounded-full bg-gray-400"></span>
                          <span className="truncate">{u.name}{suffix}</span>
                        </button>
                      );
                    })})()}
                  </div>
                  <div className="p-2 font-semibold text-sm border-y">Online</div>
                  <div className="overflow-y-auto max-h-[12rem]">
                    {online.length === 0 && (
                      <div className="p-2 text-xs text-gray-500">No users online</div>
                    )}
                    {online.map((u) => {
                      const isSelf = self && u.id === self.id;
                      const label = isSelf ? `${u.name} (You)` : u.name;
                      const disabled = !!isSelf;
                      return (
                        <button
                          key={`o-${u.id}`}
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
                  <div className="p-2 border-b text-sm font-medium flex items-center justify-between gap-2">
                    <div>
                      {activeUserId
                        ? online.find((u) => u.id === activeUserId)?.name || recents.find((u) => u.id === activeUserId)?.name || `User #${activeUserId}`
                        : "Select a user"}
                    </div>
                    <div>
                      <button
                        onClick={clearConversation}
                        disabled={!activeUserId}
                        className="rounded px-2 py-1 text-xs border hover:bg-gray-50 disabled:opacity-50"
                        title="Clear this conversation"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {(notifSupported && notifPermission !== 'granted') && (
                    <div className="px-3 py-2 text-[12px] bg-amber-50 text-amber-900 border-b border-amber-200 flex items-center justify-between gap-2">
                      <span>
                        {notifPermission === 'denied'
                          ? 'Notifications are blocked in your browser. Enable them in site settings to get alerts.'
                          : 'Enable desktop notifications to get alerts when messages arrive.'}
                      </span>
                      {notifPermission !== 'denied' && (
                        <button
                          onClick={requestNotifications}
                          className="shrink-0 rounded bg-amber-600 text-white px-2 py-1 text-xs hover:bg-amber-700"
                        >
                          Enable
                        </button>
                      )}
                    </div>
                  )}

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
