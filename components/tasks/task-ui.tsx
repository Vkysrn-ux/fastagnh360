"use client";

import { TASK_CHECKS, STALE_HOURS } from "@/lib/task-constants";

export type TaskCard = {
  id: number;
  vehicle_reg_no: string;
  ticket_id: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  caller_type: string | null;
  caller_name: string | null;
  caller_phone: string | null;
  purpose: string;
  stage: string;
  assigned_to: number | null;
  assigned_to_name: string;
  created_by_name: string;
  kyc_done: number;
  kyv_done: number;
  payment_done: number;
  delivery_done: number;
  commission_done: number;
  stuck_reason: string | null;
  next_action: string | null;
  follow_up_date: string | null;
  created_at: string;
  last_activity_at: string;
  hours_since_activity: number;
  call_count: number;
};

export type TaskActivity = {
  id: number;
  kind: string;
  caller_type: string | null;
  caller_phone: string | null;
  purpose: string | null;
  note: string | null;
  from_value: string | null;
  to_value: string | null;
  actor_name: string;
  created_at: string;
};

export type Staff = { id: number; name: string };

export async function fetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

export function timeAgo(input: string | Date | null | undefined): string {
  if (!input) return "-";
  const d = new Date(input);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function formatDateTime(input: string | Date | null | undefined): string {
  if (!input) return "-";
  const d = new Date(input);
  if (isNaN(d.getTime())) return String(input);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
}

export function toYmd(input: string | Date | null | undefined): string {
  if (!input) return "";
  const d = new Date(input);
  if (isNaN(d.getTime())) return String(input).slice(0, 10);
  return d.toLocaleDateString("en-CA");
}

export function formatVrn(vrn: string): string {
  // TN38AB1234 -> TN 38 AB 1234 (best effort for standard Indian plates)
  const m = vrn.match(/^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/);
  return m ? [m[1], m[2], m[3], m[4]].filter(Boolean).join(" ") : vrn;
}

export function isStale(card: Pick<TaskCard, "stage" | "hours_since_activity">): boolean {
  return card.stage !== "done" && card.stage !== "cancelled" && Number(card.hours_since_activity) >= STALE_HOURS;
}

export function ChecklistPills({ card, size = "sm" }: { card: TaskCard; size?: "sm" | "md" }) {
  return (
    <div className="flex flex-wrap gap-1">
      {TASK_CHECKS.map((c) => {
        const done = Number((card as any)[c.key]) === 1;
        return (
          <span
            key={c.key}
            title={`${c.label}: ${done ? "done" : "pending"}`}
            className={`inline-flex items-center rounded border font-medium ${
              size === "sm" ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs"
            } ${
              done
                ? "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
                : "border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
            }`}
          >
            {done ? "✓" : "✗"} {c.label === "Agent commission" ? "Comm." : c.label}
          </span>
        );
      })}
    </div>
  );
}

export const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
