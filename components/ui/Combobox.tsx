import * as React from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

// Generic combobox supporting both strings and {label, value}
export default function Combobox({
  options = [],
  value,
  onChange,
  placeholder = "Select…",
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  // Find the display label for the current value
  const currentLabel = React.useMemo(() => {
    if (!value) return "";
    const found = options.find(opt => (typeof opt === "string" ? opt === value : String(opt.value) === String(value)));
    return typeof found === "string" ? found : found?.label || "";
  }, [options, value]);

  // Filter options by search string
  const filtered = React.useMemo(
    () =>
      options.filter(opt => {
        const label = typeof opt === "string" ? opt : opt.label;
        return !search || label.toLowerCase().includes(search.toLowerCase());
      }),
    [options, search]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="justify-between w-full text-left">
          {currentLabel || <span className="text-muted-foreground">{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0">
        <Command>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={`Type to search...`}
            autoFocus
          />
          <CommandList>
            <CommandEmpty>No result.</CommandEmpty>
            <CommandGroup>
              {filtered.map(opt => {
                const label = typeof opt === "string" ? opt : opt.label;
                const val = typeof opt === "string" ? opt : opt.value;
                return (
                  <CommandItem
                    key={val}
                    value={val}
                    onSelect={() => {
                      onChange(val);
                      setOpen(false);
                    }}
                  >
                    {label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
