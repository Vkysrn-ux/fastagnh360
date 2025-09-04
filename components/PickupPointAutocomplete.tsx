import React, { useEffect, useRef, useState } from "react";

export type PickupPoint = { id: number; name: string; type: string };

export default function PickupPointAutocomplete({
  value,
  onSelect,
  placeholder = "Type pick-up point name",
  minChars = 1,
}: {
  value: PickupPoint | null;
  onSelect: (p: PickupPoint | null) => void;
  placeholder?: string;
  minChars?: number;
}) {
  const [input, setInput] = useState(value ? value.name : "");
  const [list, setList] = useState<PickupPoint[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    setInput(value ? value.name : "");
  }, [value?.id]);

  useEffect(() => {
    const term = input.trim();
    if (term.length >= minChars) {
      fetch(`/api/pickup-points?name=${encodeURIComponent(term)}`)
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
  }, [input, minChars, focused]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function select(p: PickupPoint) {
    onSelect(p);
    setInput(p.name);
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
      select(list[highlight]);
      e.preventDefault();
    }
  }

  function typeLabel(type: string) {
    if (type === "warehouse") return "Warehouse";
    if (type === "toll-agent") return "Toll Agent";
    return type ? type.charAt(0).toUpperCase() + type.slice(1) : "";
  }

  return (
    <div className="relative" ref={boxRef}>
      <input
        type="text"
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
          {list.map((p, i) => (
            <div
              key={`${p.type}-${p.id}`}
              className={`px-3 py-2 cursor-pointer border-b last:border-b-0 ${
                i === highlight ? "bg-orange-100" : "hover:bg-orange-50"
              }`}
              onMouseDown={() => select(p)}
              onMouseEnter={() => setHighlight(i)}
            >
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-xs text-gray-500">{typeLabel(p.type)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
