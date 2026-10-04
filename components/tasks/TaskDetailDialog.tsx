"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, MessageSquare, PhoneCall, UserCog } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  CALLER_TYPES, STUCK_REASONS, TASK_CHECKS, TASK_STAGES, callerTypeLabel, stageLabel,
} from "@/lib/task-constants";
import {
  Staff, TaskActivity, TaskCard, fetchJson, formatDateTime, formatVrn, isStale, selectClass, timeAgo, toYmd,
} from "./task-ui";

type Mode = "call" | "note" | "stuck" | "resolve";

export default function TaskDetailDialog({
  cardId,
  onClose,
  staff,
  ticketBasePath,
  onChanged,
}: {
  cardId: number | null;
  onClose: () => void;
  staff: Staff[];
  ticketBasePath: string;
  onChanged: () => void;
}) {
  const [card, setCard] = useState<TaskCard | null>(null);
  const [activity, setActivity] = useState<TaskActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("call");
  const [form, setForm] = useState({
    caller_type: "", caller_phone: "", note: "", stuck_reason: "", next_action: "", follow_up_date: "",
  });

  const load = useCallback(async () => {
    if (!cardId) return;
    setLoading(true);
    try {
      const d = await fetchJson<{ card: TaskCard; activity: TaskActivity[] }>(`/api/tasks/${cardId}`);
      setCard(d.card);
      setActivity(d.activity);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    setCard(null);
    setActivity([]);
    setMode("call");
    setForm({ caller_type: "", caller_phone: "", note: "", stuck_reason: "", next_action: "", follow_up_date: "" });
    load();
  }, [load]);

  async function patch(body: Record<string, any>, success?: string) {
    if (!card) return false;
    setBusy(true);
    try {
      await fetchJson(`/api/tasks/${card.id}`, { method: "PATCH", body: JSON.stringify(body) });
      if (success) toast.success(success);
      await load();
      onChanged();
      return true;
    } catch (e: any) {
      toast.error(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitAction() {
    if (!card) return;
    const note = form.note.trim();
    if (mode === "call") {
      if (!form.caller_type) return toast.error("Select who called");
      if (!note) return toast.error("Write what was discussed");
      setBusy(true);
      try {
        await fetchJson(`/api/tasks/${card.id}/calls`, {
          method: "POST",
          body: JSON.stringify({ caller_type: form.caller_type, caller_phone: form.caller_phone, note }),
        });
        toast.success("Call logged");
        setForm((f) => ({ ...f, note: "", caller_phone: "" }));
        await load();
        onChanged();
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!note) return toast.error("A note is required");
    let ok = false;
    if (mode === "note") ok = await patch({ note }, "Note added");
    if (mode === "stuck") {
      if (!form.stuck_reason) return toast.error("Select why it is stuck");
      ok = await patch(
        { stuck_reason: form.stuck_reason, next_action: form.next_action, follow_up_date: form.follow_up_date || null, note },
        "Marked as stuck"
      );
    }
    if (mode === "resolve") ok = await patch({ stuck_reason: null, note }, "Marked as resolved");
    if (ok) {
      setForm((f) => ({ ...f, note: "", stuck_reason: "", next_action: "", follow_up_date: "" }));
      setMode("call");
    }
  }

  const stageIdx = card ? TASK_STAGES.findIndex((s) => s.key === card.stage) : -1;
  const nextStage = stageIdx >= 0 && stageIdx < TASK_STAGES.length - 1 ? TASK_STAGES[stageIdx + 1] : null;

  return (
    <Dialog open={cardId !== null} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[94vh] w-[calc(100%-1rem)] max-w-3xl overflow-y-auto p-4 sm:p-6">
        {!card ? (
          <>
            <DialogHeader><DialogTitle>Task</DialogTitle></DialogHeader>
            <div className="py-10 text-center text-sm text-muted-foreground">{loading ? "Loading…" : "Not found"}</div>
          </>
        ) : (
          <div className="space-y-4">
            <DialogHeader className="space-y-1 pr-6">
              <DialogTitle className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-2xl font-bold tracking-wide">{formatVrn(card.vehicle_reg_no)}</span>
                <span className="text-base font-medium text-muted-foreground">#{card.id} · {card.purpose}</span>
              </DialogTitle>
              <div className="text-xs text-muted-foreground">
                {callerTypeLabel(card.caller_type)}
                {card.caller_name ? ` · ${card.caller_name}` : ""}
                {card.caller_phone ? ` · ${card.caller_phone}` : ""}
                {card.customer_name || card.customer_phone
                  ? ` · Customer: ${[card.customer_name, card.customer_phone].filter(Boolean).join(" ")}`
                  : ""}
                {` · Opened by ${card.created_by_name || "-"} ${timeAgo(card.created_at)}`}
                {card.ticket_id ? (
                  <> · <Link className="text-primary underline" href={`${ticketBasePath}/${card.ticket_id}`}>Ticket #{card.ticket_id}</Link></>
                ) : null}
              </div>
            </DialogHeader>

            {card.stuck_reason && (
              <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950">
                <div className="flex items-center gap-2 font-semibold text-red-700 dark:text-red-300">
                  <AlertTriangle className="h-4 w-4" /> Stuck: {card.stuck_reason}
                </div>
                {card.next_action && <div className="mt-1"><b>Next action:</b> {card.next_action}</div>}
                {card.follow_up_date && <div><b>Follow up on:</b> {toYmd(card.follow_up_date)}</div>}
              </div>
            )}
            {!card.stuck_reason && isStale(card) && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                <Clock className="mr-1 inline h-4 w-4" /> No update for {timeAgo(card.last_activity_at).replace(" ago", "")}.
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Stage</Label>
                <div className="flex gap-2">
                  <select
                    className={selectClass}
                    value={card.stage}
                    disabled={busy}
                    onChange={(e) => patch({ stage: e.target.value }, `Moved to ${stageLabel(e.target.value)}`)}
                  >
                    {TASK_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    <option value="cancelled">Cancelled</option>
                  </select>
                  {nextStage && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 shrink-0"
                      disabled={busy}
                      onClick={() => patch({ stage: nextStage.key }, `Moved to ${nextStage.label}`)}
                    >
                      {nextStage.label} <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <Label>Assigned to</Label>
                <select
                  className={selectClass}
                  value={card.assigned_to ?? ""}
                  disabled={busy}
                  onChange={(e) => patch({ assigned_to: e.target.value ? Number(e.target.value) : null }, "Reassigned")}
                >
                  <option value="">Unassigned</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <Label>Status checklist (tap to change)</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {TASK_CHECKS.map((c) => {
                  const done = Number((card as any)[c.key]) === 1;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      disabled={busy}
                      onClick={() => patch({ [c.key]: !done })}
                      className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                        done
                          ? "border-green-400 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
                          : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                      }`}
                    >
                      {done ? "✓" : "✗"} {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action panel */}
            <div className="rounded-md border p-3">
              <div className="mb-3 flex flex-wrap gap-2">
                <Button size="sm" variant={mode === "call" ? "default" : "outline"} onClick={() => setMode("call")}>
                  <PhoneCall className="mr-1 h-4 w-4" /> Log call
                </Button>
                <Button size="sm" variant={mode === "note" ? "default" : "outline"} onClick={() => setMode("note")}>
                  <MessageSquare className="mr-1 h-4 w-4" /> Add note
                </Button>
                {card.stuck_reason ? (
                  <Button size="sm" variant={mode === "resolve" ? "default" : "outline"} onClick={() => setMode("resolve")}>
                    <CheckCircle2 className="mr-1 h-4 w-4" /> Mark resolved
                  </Button>
                ) : (
                  <Button size="sm" variant={mode === "stuck" ? "destructive" : "outline"} onClick={() => setMode("stuck")}>
                    <AlertTriangle className="mr-1 h-4 w-4" /> Mark stuck
                  </Button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {mode === "call" && (
                  <>
                    <div>
                      <Label>Who called</Label>
                      <select
                        className={selectClass}
                        value={form.caller_type}
                        onChange={(e) => setForm((f) => ({ ...f, caller_type: e.target.value }))}
                      >
                        <option value="">Select…</option>
                        {CALLER_TYPES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>Caller mobile</Label>
                      <Input
                        inputMode="tel"
                        value={form.caller_phone}
                        onChange={(e) => setForm((f) => ({ ...f, caller_phone: e.target.value }))}
                      />
                    </div>
                  </>
                )}
                {mode === "stuck" && (
                  <>
                    <div>
                      <Label>Why is it stuck? *</Label>
                      <select
                        className={selectClass}
                        value={form.stuck_reason}
                        onChange={(e) => setForm((f) => ({ ...f, stuck_reason: e.target.value }))}
                      >
                        <option value="">Select…</option>
                        {STUCK_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>Follow up on</Label>
                      <Input
                        type="date"
                        value={form.follow_up_date}
                        onChange={(e) => setForm((f) => ({ ...f, follow_up_date: e.target.value }))}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Next action</Label>
                      <Input
                        value={form.next_action}
                        placeholder="e.g. Customer to send clear RC photo on WhatsApp"
                        onChange={(e) => setForm((f) => ({ ...f, next_action: e.target.value }))}
                      />
                    </div>
                  </>
                )}
                <div className="sm:col-span-2">
                  <Label>
                    {mode === "call" ? "What was discussed? *" : mode === "stuck" ? "Details *" : mode === "resolve" ? "How was it resolved? *" : "Note *"}
                  </Label>
                  <Textarea
                    rows={2}
                    value={form.note}
                    onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <Button disabled={busy} onClick={submitAction}>{busy ? "Saving…" : "Save"}</Button>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <div className="mb-2 text-sm font-semibold">History ({activity.length})</div>
              <ol className="space-y-2">
                {activity.map((a) => (
                  <li key={a.id} className="rounded-md border p-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-x-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <ActivityIcon kind={a.kind} /> {describe(a)}
                      </span>
                      <span>{a.actor_name || "-"} · {formatDateTime(a.created_at)}</span>
                    </div>
                    {a.note && <div className="mt-1 whitespace-pre-wrap">{a.note}</div>}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ActivityIcon({ kind }: { kind: string }) {
  const cls = "h-3.5 w-3.5";
  if (kind === "call" || kind === "create") return <PhoneCall className={cls} />;
  if (kind === "assign") return <UserCog className={cls} />;
  if (kind === "stuck") return <AlertTriangle className={`${cls} text-red-600`} />;
  if (kind === "unstuck" || kind === "check") return <CheckCircle2 className={cls} />;
  if (kind === "stage") return <ArrowRight className={cls} />;
  return <MessageSquare className={cls} />;
}

function describe(a: TaskActivity): string {
  const who = a.caller_type ? callerTypeLabel(a.caller_type) : "";
  const phone = a.caller_phone ? ` (${a.caller_phone})` : "";
  switch (a.kind) {
    case "create": return `First call – ${who}${phone}${a.purpose ? ` · ${a.purpose}` : ""}`;
    case "call": return `Call – ${who}${phone}`;
    case "stage": return `Stage: ${a.from_value} → ${a.to_value}`;
    case "assign": return a.from_value ? `Reassigned: ${a.from_value} → ${a.to_value}` : `Assigned to ${a.to_value}`;
    case "check": return `${a.from_value}: ${a.to_value}`;
    case "stuck": return `Marked stuck: ${a.to_value}`;
    case "unstuck": return `Resolved: ${a.from_value}`;
    case "edit": return `${a.from_value}: ${a.to_value}`;
    default: return "Note";
  }
}
