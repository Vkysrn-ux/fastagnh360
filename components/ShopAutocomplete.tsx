// components/user/ShopAutocomplete.tsx

import React, { useState, useRef, useEffect } from "react";

export interface Shop {
  id: number;
  name: string;
}

interface ShopAutocompleteProps {
  value: Shop | null;
  onSelect: (shop: Shop | null) => void;
}

const ShopAutocomplete: React.FC<ShopAutocompleteProps> = ({ value, onSelect }) => {
  const [input, setInput] = useState(value ? value.name : "");
  const [suggestions, setSuggestions] = useState<Shop[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  // Fetch shop suggestions on input
  useEffect(() => {
    if (input.length >= 2) {
      fetch(`/api/users?role=shop&name=${encodeURIComponent(input)}`)
        .then(res => res.json())
        .then(data => setSuggestions(data || []));
      setShowDropdown(true);
    } else {
      setSuggestions([]);
      setShowDropdown(false);
      setHighlight(-1);
    }
  }, [input]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      setHighlight(h => (h + 1) % suggestions.length);
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setHighlight(h => (h + suggestions.length - 1) % suggestions.length);
      e.preventDefault();
    } else if (e.key === "Enter" && highlight >= 0) {
      handleSelect(suggestions[highlight]);
      e.preventDefault();
    }
  }

  function handleSelect(shop: Shop) {
    setInput(shop.name);
    setShowDropdown(false);
    setHighlight(-1);
    setSuggestions([]);
    onSelect(shop); // Pass selected shop
  }

  return (
    <div className="relative" ref={boxRef}>
      <input
        type="text"
        className="w-full border-0 border-b-2 border-orange-400 focus:border-orange-600 focus:ring-0 rounded-none bg-transparent px-0 py-2 shadow-none outline-none"
        placeholder="Type shop name"
        value={input}
        onChange={e => {
          setInput(e.target.value);
          onSelect(null); // Clear selection when typing
        }}
        onFocus={() => input.length >= 2 && setShowDropdown(true)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-20 left-0 w-full bg-white mt-1">
          {suggestions.map((shop, i) => (
            <div
              key={shop.id}
              className={
                `px-4 py-2 cursor-pointer border-b border-gray-100 last:border-b-0 
                ${i === highlight ? "bg-orange-100 font-semibold text-orange-900" : "hover:bg-orange-50"}`
              }
              onMouseDown={() => handleSelect(shop)}
              onMouseEnter={() => setHighlight(i)}
            >
              {shop.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ShopAutocomplete;
