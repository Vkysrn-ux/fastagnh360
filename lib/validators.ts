export function parseIndianMobile(raw: string) {
  const input = String(raw || "").trim();
  const re = /^(?:\+?91[\-\s]?|0)?([6-9]\d{9})$/;
  const m = input.match(re);
  if (!m) return { ok: false, error: "Enter a valid 10-digit mobile (starts 6–9)" } as const;
  return { ok: true, value: m[1] } as const; // normalized to 10 digits
}

