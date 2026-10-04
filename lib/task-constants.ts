// lib/task-constants.ts
// Shared (client + server) constants for the Task Board.

export const TASK_STAGES = [
  { key: "new", label: "New" },
  { key: "kyc", label: "KYC" },
  { key: "kyv", label: "KYV" },
  { key: "payment", label: "Payment" },
  { key: "activation", label: "Activation" },
  { key: "delivery", label: "Delivery" },
  { key: "commission", label: "Commission" },
  { key: "done", label: "Done" },
] as const;

export const CLOSED_STAGES = ["done", "cancelled"] as const;
export const ALL_STAGE_KEYS = [...TASK_STAGES.map((s) => s.key), "cancelled"] as string[];

export const CALLER_TYPES = [
  { key: "customer", label: "Customer" },
  { key: "agent", label: "Agent" },
  { key: "shop", label: "Shopkeeper" },
] as const;

export const TASK_PURPOSES = [
  "New Tag",
  "Replacement Tag",
  "Hotlist / Blacklist",
  "Low Balance / Recharge",
  "KYC Update",
  "KYV Update",
  "Tag Closure / Refund",
  "Wrong Toll Deduction",
  "Other",
] as const;

export const STUCK_REASONS = [
  "KYC documents pending",
  "RC unclear / mismatch",
  "VRN linked to another tag",
  "Payment not received",
  "Bank portal issue",
  "Waiting for customer",
  "Tag not delivered",
  "Other",
] as const;

// Checklist items stored on task_cards as TINYINT columns
export const TASK_CHECKS = [
  { key: "kyc_done", label: "KYC" },
  { key: "kyv_done", label: "KYV" },
  { key: "payment_done", label: "Payment" },
  { key: "delivery_done", label: "Delivery" },
  { key: "commission_done", label: "Agent commission" },
] as const;

export type TaskCheckKey = (typeof TASK_CHECKS)[number]["key"];

// Cards with no activity for this many hours are flagged as "no update"
export const STALE_HOURS = 48;

export function normalizeVrn(v: any): string {
  return String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function stageLabel(key: string): string {
  if (key === "cancelled") return "Cancelled";
  return TASK_STAGES.find((s) => s.key === key)?.label ?? key;
}

export function callerTypeLabel(key: string | null | undefined): string {
  return CALLER_TYPES.find((c) => c.key === key)?.label ?? (key || "-");
}
