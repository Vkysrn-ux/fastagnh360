"use client";

import React, { useEffect, useRef, useState } from "react";

export default function AutocompleteInput({
  value,
  onChange,
  options,
  placeholder,
  minChars = 1,
}: {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  minChars?: number;
}) {
  const [input, setInput] = useState(value || "");
  const [filtered, setFiltered] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => setInput(value || ""), [value]);

  useEffect(() => {
    const t = input.trim();
    if (t.length >= minChars) {
      const f = options.filter((o) => o.toLowerCase().includes(t.toLowerCase()));
      setFiltered(f.slice(0, 20));
      setOpen(focused && f.length > 0);
      setHighlight(-1);
    } else {
      setFiltered([]);
      setOpen(false);
      setHighlight(-1);
    }
  }, [input, options, minChars, focused]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function choose(v: string) {
    onChange(v);
    setInput(v);
    setOpen(false);
    setFiltered([]);
    setHighlight(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown" && filtered.length) {
      setHighlight((h) => (h + 1) % filtered.length);
      e.preventDefault();
    } else if (e.key === "ArrowUp" && filtered.length) {
      setHighlight((h) => (h + filtered.length - 1) % filtered.length);
      e.preventDefault();
    } else if (e.key === "Enter" && highlight >= 0) {
      choose(filtered[highlight]);
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
          onChange(e.target.value);
        }}
        onFocus={() => {
          setFocused(true);
          if (input.trim().length >= minChars) setOpen(filtered.length > 0);
        }}
        onBlur={() => {
          // allow click selection before closing via mousedown handler
          setTimeout(() => setFocused(false), 100);
        }}
        onKeyDown={onKeyDown}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 left-0 right-0 bg-white border rounded mt-1 shadow">
          {filtered.map((o, i) => (
            <div
              key={o}
              className={`px-3 py-2 cursor-pointer border-b last:border-b-0 ${
                i === highlight ? "bg-orange-100" : "hover:bg-orange-50"
              }`}
              onMouseDown={() => choose(o)}
              onMouseEnter={() => setHighlight(i)}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
