"use client";

// Lightweight client-side caches to reduce duplicate network calls.

let banksPromise: Promise<string[]> | null = null;
let banksData: string[] | null = null;

export async function getBanksCached(): Promise<string[]> {
  if (banksData) return banksData;
  if (!banksPromise) {
    banksPromise = fetch("/api/banks", { cache: "force-cache" })
      .then((r) => r.json())
      .then((d) => (Array.isArray(d) ? d : []))
      .catch(() => [] as string[])
      .then((arr) => {
        banksData = arr;
        return arr;
      });
  }
  return banksPromise;
}

const usersById = new Map<number, any>();
const inflightUser = new Map<number, Promise<any>>();

export async function getUserByIdCached(id: number) {
  const key = Number(id);
  if (!key) return null;
  if (usersById.has(key)) return usersById.get(key);
  const existing = inflightUser.get(key);
  if (existing) return existing;
  const p = fetch(`/api/users?id=${encodeURIComponent(String(key))}`, { cache: "force-cache" })
    .then((r) => r.json())
    .then((row) => {
      const arr = Array.isArray(row) ? row : row ? [row] : [];
      const first = arr[0] || null;
      if (first) usersById.set(key, first);
      inflightUser.delete(key);
      return first;
    })
    .catch(() => {
      inflightUser.delete(key);
      return null;
    });
  inflightUser.set(key, p);
  return p;
}

// Dedup + cache for ticket duplicate checks by VRN/phone
const existsCache = new Map<string, any>();

export async function checkTicketExistsCached(kind: 'vrn' | 'phone', value: string, opts: { signal?: AbortSignal } = {}) {
  const key = `${kind}:${String(value || '').trim().toLowerCase()}`;
  if (!value || String(value).trim() === '') return [] as any[];
  if (existsCache.has(key)) return existsCache.get(key);
  const qs = new URLSearchParams();
  qs.set('check', 'exists');
  qs.set(kind, value);
  const rows = await fetch(`/api/tickets?${qs.toString()}`, { cache: 'force-cache', signal: opts.signal })
    .then((r) => r.json())
    .then((d) => (Array.isArray(d) ? d : []))
    .catch(() => [] as any[]);
  existsCache.set(key, rows);
  return rows;
}

// Cache auth session for this tab
let sessionPromise: Promise<any> | null = null;
let sessionData: any | null = null;
export async function getAuthSessionCached(): Promise<any> {
  if (sessionData) return sessionData;
  if (!sessionPromise) {
    sessionPromise = fetch('/api/auth/session', { cache: 'no-store' })
      .then((r) => r.json())
      .catch(() => ({}))
      .then((d) => { sessionData = d; return d; });
  }
  return sessionPromise;
}
