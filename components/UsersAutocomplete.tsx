"use client";

import React, { useEffect, useRef, useState } from "react";

export type UserOption = { id: number; name: string; notes?: string };

export default function UsersAutocomplete({
  value,
  onSelect,
  role,
  roles,
  placeholder = "Type user name",
  minChars = 1,
}: {
  value: UserOption | null;
  onSelect: (u: UserOption | null) => void;
  role?: string; // single-role filter (legacy)
  roles?: string[]; // multi-role filter
  placeholder?: string;
  minChars?: number;
}) {
  const [input, setInput] = useState(value ? value.name : "");
  const [list, setList] = useState<UserOption[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => setInput(value ? value.name : ""), [value?.id]);

  useEffect(() => {
    const term = input.trim();
    if (term.length >= minChars) {
      const q = new URLSearchParams();
      if (Array.isArray(roles) && roles.length > 0) {
        const normalize = (r: string): string[] => {
          const v = String(r || '').toLowerCase().trim()
          if (['super','super-admin','super_admin','super admin','superadmin'].includes(v)) {
            return ['super','super-admin','super_admin','super admin','superadmin']
          }
          if (['admin','administrator'].includes(v)) return ['admin','administrator']
          return [v]
        }
        const expanded = Array.from(new Set(roles.flatMap(r => normalize(String(r)))))
        q.set("roles", expanded.join(","));
      } else if (role) {
        const v = role.toLowerCase();
        if (['super','super-admin','super_admin','super admin','superadmin'].includes(v)) {
          q.set("roles", ['super','super-admin','super_admin','super admin','superadmin'].join(','))
        } else if (['admin','administrator'].includes(v)) {
          q.set("roles", ['admin','administrator'].join(','))
        } else {
          q.set("role", v);
        }
      }
      q.set("name", term);
      fetch(`/api/users?${q.toString()}`)
        .then((r) => r.json())
        .then((rows) => {
          setList(Array.isArray(rows) ? rows : []);
          setOpen(focused);
          setHighlight(-1);
        })
        .catch(() => {
          setList([]);
          setOpen(false);
          setHighlight(-1);
        });
    } else {
      setList([]);
      setOpen(false);
      setHighlight(-1);
    }
  }, [input, role, roles && roles.join(','), minChars, focused]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function pick(u: UserOption) {
    onSelect(u);
    setInput(u.name);
    setOpen(false);
    setList([]);
    setHighlight(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown" && list.length) {
      setHighlight((h) => (h + 1) % list.length);
      e.preventDefault();
    } else if (e.key === "ArrowUp" && list.length) {
      setHighlight((h) => (h + list.length - 1) % list.length);
      e.preventDefault();
    } else if (e.key === "Enter" && highlight >= 0) {
      pick(list[highlight]);
      e.preventDefault();
    }
  }

  return (
    <div className="relative" ref={ref}>
      <input
        className="w-full border p-2 rounded"
        value={input}
        placeholder={placeholder}
        onChange={(e) => {
          setInput(e.target.value);
          onSelect(null);
        }}
        onFocus={() => {
          setFocused(true);
          if (input.trim().length >= minChars) setOpen(true);
        }}
        onBlur={() => setTimeout(() => setFocused(false), 100)}
        onKeyDown={onKeyDown}
        autoComplete="off"
      />
      {open && list.length > 0 && (
        <div className="absolute z-20 left-0 right-0 bg-white border rounded mt-1 shadow">
          {list.map((u, i) => (
            <div
              key={u.id}
              className={`px-3 py-2 cursor-pointer border-b last:border-b-0 ${
                i === highlight ? "bg-orange-100" : "hover:bg-orange-50"
              }`}
              onMouseDown={() => pick(u)}
              onMouseEnter={() => setHighlight(i)}
            >
              <div className="font-medium">{u.name}</div>
              {u.notes && (
                <div className="text-xs text-gray-500 line-clamp-2 whitespace-pre-wrap">{u.notes}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
