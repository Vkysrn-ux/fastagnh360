"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CALLER_TYPES, TASK_PURPOSES, normalizeVrn, stageLabel } from "@/lib/task-constants";
import { Staff, TaskCard, fetchJson, formatVrn, selectClass, timeAgo } from "./task-ui";

export type NewTaskPrefill = { vehicle_reg_no?: string; caller_phone?: string; ticket_id?: number | null };

const empty = {
  vehicle_reg_no: "",
  purpose: "",
  caller_type: "",
  caller_name: "",
  caller_phone: "",
  customer_name: "",
  customer_phone: "",
  assigned_to: "",
  note: "",
};

export default function NewTaskDialog({
  open,
  onOpenChange,
  staff,
  prefill,
  onCreated,
  onOpenExisting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  staff: Staff[];
  prefill?: NewTaskPrefill | null;
  onCreated: (id: number) => void;
  onOpenExisting: (id: number) => void;
}) {
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<TaskCard[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setExisting(null);
    setForm({
      ...empty,
      vehicle_reg_no: prefill?.vehicle_reg_no ? formatVrn(normalizeVrn(prefill.vehicle_reg_no)) : "",
      caller_phone: prefill?.caller_phone || "",
    });
  }, [open, prefill]);

  const up = (k: keyof typeof empty) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(force = false) {
    if (normalizeVrn(form.vehicle_reg_no).length < 4) return toast.error("Enter the vehicle number");
    if (!form.caller_type) return toast.error("Select who is calling");
    if (!form.purpose) return toast.error("Select the purpose of the call");
    if (!form.note.trim()) return toast.error("Write a short note about the call");
    setSaving(true);
    try {
      const res = await fetchJson<{ id: number }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
          ticket_id: prefill?.ticket_id ?? null,
          force,
        }),
      });
      toast.success("Task created");
      onOpenChange(false);
      onCreated(res.id);
    } catch (e: any) {
      if (e.status === 409 && Array.isArray(e.data?.existing)) setExisting(e.data.existing);
      else toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1rem)] max-w-xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>New call / task</DialogTitle>
        </DialogHeader>

        {existing ? (
          <div className="space-y-3">
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <b>{formatVrn(normalizeVrn(form.vehicle_reg_no))}</b> already has an open task. Open it and log this call
              there, so the history stays in one place.
            </div>
            {existing.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onOpenChange(false); onOpenExisting(c.id); }}
                className="w-full rounded-md border p-3 text-left hover:bg-muted"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">#{c.id} · {c.purpose}</span>
                  <span className="text-xs text-muted-foreground">{stageLabel(c.stage)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {c.assigned_to_name || "Unassigned"} · updated {timeAgo(c.last_activity_at)}
                  {c.stuck_reason ? ` · Stuck: ${c.stuck_reason}` : ""}
                </div>
              </button>
            ))}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setExisting(null)}>Back</Button>
              <Button variant="outline" disabled={saving} onClick={() => submit(true)}>
                It's a different request – create new
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => { e.preventDefault(); submit(false); }}
          >
            <div className="sm:col-span-2">
              <Label htmlFor="nt-vrn">Vehicle number *</Label>
              <Input
                id="nt-vrn"
                value={form.vehicle_reg_no}
                onChange={(e) => setForm((f) => ({ ...f, vehicle_reg_no: e.target.value.toUpperCase() }))}
                placeholder="TN 38 AB 1234"
                className="text-lg font-semibold tracking-wide"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="nt-ct">Who is calling *</Label>
              <select id="nt-ct" className={selectClass} value={form.caller_type} onChange={up("caller_type")}>
                <option value="">Select…</option>
                {CALLER_TYPES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="nt-p">Purpose *</Label>
              <select id="nt-p" className={selectClass} value={form.purpose} onChange={up("purpose")}>
                <option value="">Select…</option>
                {TASK_PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="nt-cn">Caller name</Label>
              <Input id="nt-cn" value={form.caller_name} onChange={up("caller_name")} placeholder="Agent / shop / person" />
            </div>
            <div>
              <Label htmlFor="nt-cp">Caller mobile</Label>
              <Input id="nt-cp" inputMode="tel" value={form.caller_phone} onChange={up("caller_phone")} />
            </div>
            {form.caller_type && form.caller_type !== "customer" && (
              <>
                <div>
                  <Label htmlFor="nt-cuname">Customer name</Label>
                  <Input id="nt-cuname" value={form.customer_name} onChange={up("customer_name")} />
                </div>
                <div>
                  <Label htmlFor="nt-cuphone">Customer mobile</Label>
                  <Input id="nt-cuphone" inputMode="tel" value={form.customer_phone} onChange={up("customer_phone")} />
                </div>
              </>
            )}
            <div className="sm:col-span-2">
              <Label htmlFor="nt-a">Assign to</Label>
              <select id="nt-a" className={selectClass} value={form.assigned_to} onChange={up("assigned_to")}>
                <option value="">Unassigned</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="nt-n">What did the caller say? *</Label>
              <Textarea
                id="nt-n"
                rows={3}
                value={form.note}
                onChange={up("note")}
                placeholder="e.g. Old tag damaged, needs replacement. RC photo will be sent on WhatsApp."
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create task"}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
