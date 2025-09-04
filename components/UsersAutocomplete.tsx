"use client";

import React, { useEffect, useRef, useState } from "react";

export type UserOption = { id: number; name: string };

export default function UsersAutocomplete({
  value,
  onSelect,
  role,
  placeholder = "Type user name",
  minChars = 1,
}: {
  value: UserOption | null;
  onSelect: (u: UserOption | null) => void;
  role?: string;
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
      if (role) q.set("role", role.toLowerCase());
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
  }, [input, role, minChars, focused]);

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
              {u.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
