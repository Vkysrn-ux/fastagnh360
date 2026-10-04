"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Clock, PhoneCall, Plus, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TASK_STAGES, normalizeVrn, stageLabel } from "@/lib/task-constants";
import NewTaskDialog, { NewTaskPrefill } from "./NewTaskDialog";
import TaskDetailDialog from "./TaskDetailDialog";
import { ChecklistPills, Staff, TaskCard, fetchJson, formatVrn, isStale, selectClass, timeAgo, toYmd } from "./task-ui";

type Filter = "open" | "mine" | "stuck" | "stale" | "unassigned";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "open", label: "All open" },
  { key: "mine", label: "My tasks" },
  { key: "stuck", label: "Stuck" },
  { key: "stale", label: "No update 2+ days" },
  { key: "unassigned", label: "Unassigned" },
];

type LookupTicket = {
  id: number; ticket_no: string | null; vehicle_reg_no: string | null; customer_name: string | null;
  subject: string | null; status: string | null; kyv_status: string | null; assigned_to_name: string;
  payment_received: number | null; payment_nil: number | null; delivery_done: number | null; delivery_nil: number | null;
  lead_commission_paid: number | null; lead_commission_nil: number | null; comments: string | null; created_at: string;
};

export default function TaskBoard({ ticketBasePath }: { ticketBasePath: string }) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [cards, setCards] = useState<TaskCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("open");
  const [staffFilter, setStaffFilter] = useState("");
  const [mobileStage, setMobileStage] = useState<string>("new");
  const [openId, setOpenId] = useState<number | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [prefill, setPrefill] = useState<NewTaskPrefill | null>(null);

  // Call Desk lookup
  const [q, setQ] = useState("");
  const [lookup, setLookup] = useState<{ q: string; cards: TaskCard[]; tickets: LookupTicket[] } | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchJson<{ staff: Staff[] }>("/api/tasks/staff").then((d) => setStaff(d.staff)).catch(() => {});
  }, []);

  const loadCards = useCallback(async () => {
    const p = new URLSearchParams({ stage: "open" });
    if (filter === "mine") p.set("assigned", "me");
    if (filter === "unassigned") p.set("assigned", "none");
    if (filter === "stuck") p.set("stuck", "1");
    if (filter === "stale") p.set("stale", "1");
    if (staffFilter && filter !== "mine" && filter !== "unassigned") p.set("assigned", staffFilter);
    try {
      setCards(await fetchJson<TaskCard[]>(`/api/tasks?${p}`));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [filter, staffFilter]);

  useEffect(() => { setLoading(true); loadCards(); }, [loadCards]);
  // Keep the board fresh while staff are on calls
  useEffect(() => {
    const t = setInterval(loadCards, 60_000);
    return () => clearInterval(t);
  }, [loadCards]);

  async function runLookup(term = q) {
    const t = term.trim();
    if (!t) { setLookup(null); return; }
    setSearching(true);
    try {
      const d = await fetchJson<{ cards: TaskCard[]; tickets: LookupTicket[] }>(`/api/tasks/lookup?q=${encodeURIComponent(t)}`);
      setLookup({ q: t, ...d });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSearching(false);
    }
  }

  function refreshAll() {
    loadCards();
    if (lookup) runLookup(lookup.q);
  }

  function startNew(p: NewTaskPrefill | null) {
    setPrefill(p);
    setNewOpen(true);
  }

  const byStage = useMemo(() => {
    const m: Record<string, TaskCard[]> = {};
    for (const s of TASK_STAGES) m[s.key] = [];
    for (const c of cards) (m[c.stage] ||= []).push(c);
    return m;
  }, [cards]);

  const counts = {
    stuck: cards.filter((c) => c.stuck_reason).length,
    stale: cards.filter((c) => isStale(c)).length,
  };

  const lookupIsPhone = lookup ? /^[\d\s+-]+$/.test(lookup.q) : false;
  const lookupHasOpen = lookup?.cards.some((c) => c.stage !== "done" && c.stage !== "cancelled");

  return (
    <div className="container space-y-4 px-4 py-4 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Task Board</h1>
          <p className="text-sm text-muted-foreground">Search the vehicle number first on every call.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={refreshAll} aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => startNew(null)}>
            <Plus className="mr-1 h-4 w-4" /> New call
          </Button>
        </div>
      </div>

      {/* Call Desk */}
      <div className="rounded-lg border bg-card p-3 sm:p-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => { e.preventDefault(); runLookup(); }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value.toUpperCase())}
              placeholder="Caller's vehicle number or mobile"
              className="h-12 pl-10 text-lg font-semibold tracking-wide"
            />
          </div>
          <Button type="submit" className="h-12 px-5" disabled={searching}>{searching ? "…" : "Search"}</Button>
          {lookup && (
            <Button type="button" variant="ghost" className="h-12" onClick={() => { setLookup(null); setQ(""); }} aria-label="Clear">
              <X className="h-5 w-5" />
            </Button>
          )}
        </form>

        {lookup && (
          <div className="mt-4 space-y-4">
            {lookup.cards.length === 0 && lookup.tickets.length === 0 && (
              <div className="text-sm text-muted-foreground">Nothing found for <b>{lookup.q}</b>. This is a new caller.</div>
            )}

            {lookup.cards.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-semibold">Tasks</div>
                <div className="grid gap-2 md:grid-cols-2">
                  {lookup.cards.map((c) => (
                    <CardTile key={c.id} card={c} showStage onClick={() => setOpenId(c.id)} />
                  ))}
                </div>
              </div>
            )}

            {lookup.tickets.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-semibold">Existing tickets</div>
                <div className="grid gap-2 md:grid-cols-2">
                  {lookup.tickets.map((t) => (
                    <div key={t.id} className="rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`${ticketBasePath}/${t.id}`} className="font-semibold text-primary underline">
                          {t.ticket_no || `Ticket #${t.id}`}
                        </Link>
                        <span className="text-xs capitalize text-muted-foreground">{String(t.status || "-").replace("_", " ")}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t.vehicle_reg_no || "-"} · {t.customer_name || "-"} · {t.assigned_to_name || "Unassigned"} · {toYmd(t.created_at)}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                        <Flag label="KYV" ok={String(t.kyv_status || "").toLowerCase().includes("success") || String(t.kyv_status || "").toLowerCase().includes("compliant")} />
                        <Flag label="Payment" ok={!!(t.payment_received || t.payment_nil)} />
                        <Flag label="Delivery" ok={!!(t.delivery_done || t.delivery_nil)} />
                        <Flag label="Comm." ok={!!(t.lead_commission_paid || t.lead_commission_nil)} />
                      </div>
                      {t.comments && <div className="mt-1 line-clamp-2 text-xs">{t.comments}</div>}
                      {!lookupHasOpen && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={() => startNew({ vehicle_reg_no: t.vehicle_reg_no || "", ticket_id: t.id })}
                        >
                          <PhoneCall className="mr-1 h-3.5 w-3.5" /> Start task for this ticket
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!lookupHasOpen && (
              <Button
                onClick={() =>
                  startNew(lookupIsPhone ? { caller_phone: lookup.q } : { vehicle_reg_no: normalizeVrn(lookup.q) })
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Create task for {lookupIsPhone ? lookup.q : formatVrn(normalizeVrn(lookup.q))}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-sm font-medium ${
              filter === f.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            {f.label}
            {f.key === "stuck" && filter === "open" && counts.stuck > 0 ? ` (${counts.stuck})` : ""}
            {f.key === "stale" && filter === "open" && counts.stale > 0 ? ` (${counts.stale})` : ""}
          </button>
        ))}
        {filter !== "mine" && filter !== "unassigned" && (
          <select className={`${selectClass} w-auto min-w-[10rem]`} value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
            <option value="">All staff</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {/* Mobile: one stage at a time */}
      <div className="lg:hidden">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
          {TASK_STAGES.filter((s) => s.key !== "done").map((s) => (
            <button
              key={s.key}
              onClick={() => setMobileStage(s.key)}
              className={`shrink-0 rounded-md border px-3 py-1.5 text-sm ${
                mobileStage === s.key ? "border-primary bg-primary/10 font-semibold text-primary" : ""
              }`}
            >
              {s.label} <span className="text-muted-foreground">{byStage[s.key]?.length ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {(byStage[mobileStage] || []).map((c) => <CardTile key={c.id} card={c} onClick={() => setOpenId(c.id)} />)}
          {!loading && (byStage[mobileStage] || []).length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">No tasks in {stageLabel(mobileStage)}</div>
          )}
        </div>
      </div>

      {/* Desktop: kanban columns */}
      <div className="hidden overflow-x-auto pb-2 lg:block">
        <div className="grid min-w-[1100px] grid-cols-7 gap-3">
          {TASK_STAGES.filter((s) => s.key !== "done").map((s) => (
            <div key={s.key} className="flex min-h-[200px] flex-col rounded-lg bg-muted/50 p-2">
              <div className="mb-2 flex items-center justify-between px-1 text-sm font-semibold">
                {s.label}
                <span className="rounded-full bg-background px-2 text-xs text-muted-foreground">{byStage[s.key]?.length ?? 0}</span>
              </div>
              <div className="space-y-2">
                {(byStage[s.key] || []).map((c) => <CardTile key={c.id} card={c} onClick={() => setOpenId(c.id)} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
      {loading && <div className="text-center text-sm text-muted-foreground">Loading…</div>}

      <NewTaskDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        staff={staff}
        prefill={prefill}
        onCreated={(id) => { refreshAll(); setOpenId(id); }}
        onOpenExisting={(id) => setOpenId(id)}
      />
      <TaskDetailDialog
        cardId={openId}
        onClose={() => setOpenId(null)}
        staff={staff}
        ticketBasePath={ticketBasePath}
        onChanged={refreshAll}
      />
    </div>
  );
}

function Flag({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`rounded border px-1.5 ${ok ? "border-green-300 text-green-700 dark:text-green-300" : "border-red-200 text-red-600 dark:text-red-300"}`}>
      {ok ? "✓" : "✗"} {label}
    </span>
  );
}

function CardTile({ card, onClick, showStage }: { card: TaskCard; onClick: () => void; showStage?: boolean }) {
  const stale = isStale(card);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-md border bg-background p-2.5 text-left shadow-sm transition-colors hover:border-primary ${
        card.stuck_reason ? "border-l-4 border-l-red-500" : stale ? "border-l-4 border-l-amber-500" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-bold tracking-wide">{formatVrn(card.vehicle_reg_no)}</span>
        {showStage && (
          <span className="shrink-0 rounded bg-muted px-1.5 text-[11px] font-medium">{stageLabel(card.stage)}</span>
        )}
      </div>
      <div className="text-xs text-muted-foreground">{card.purpose}</div>
      <div className="mt-1 text-xs">{card.assigned_to_name || <span className="text-amber-600">Unassigned</span>}</div>
      {card.stuck_reason && (
        <div className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
          <AlertTriangle className="h-3 w-3" /> {card.stuck_reason}
        </div>
      )}
      <div className="mt-1.5"><ChecklistPills card={card} /></div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className={stale ? "flex items-center gap-1 font-medium text-amber-600" : "flex items-center gap-1"}>
          <Clock className="h-3 w-3" /> {timeAgo(card.last_activity_at)}
        </span>
        <span className="flex items-center gap-1"><PhoneCall className="h-3 w-3" /> {card.call_count}</span>
      </div>
    </button>
  );
}
