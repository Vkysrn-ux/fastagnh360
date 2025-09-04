import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

// Helpers for FASTag serial handling
function findFullSerial(serials, unique) {
  const found = serials.find(s => s.tag_serial.split("-").pop() === unique);
  return found ? found.tag_serial : unique;
}
function getPrefixes(serials) {
  const set = new Set(serials.map(s => s.tag_serial.split("-").slice(0, 2).join("-")));
  return Array.from(set);
}
function sortedSerials(serials, prefix = "") {
  return serials
    .filter(s => (!prefix || s.tag_serial.startsWith(prefix)))
    .map(s => ({ full: s.tag_serial, num: Number(s.tag_serial.split("-").pop()) }))
    .filter(s => !isNaN(s.num))
    .sort((a, b) => a.num - b.num);
}
function getDynamicAvailable(rows, allSerialsCache, row, rowIdx, transferFromUser) {
  const key = `${row.bank}-${row.fastagClass}-${transferFromUser}`;
  let allSerials = allSerialsCache[key] || [];
  rows.forEach((r, i) => {
    if (
      i !== rowIdx &&
      r.bank === row.bank &&
      r.fastagClass === row.fastagClass &&
      r.prefix === row.prefix &&
      r.startSerial &&
      r.quantity > 0 &&
      r.availableSerials.length
    ) {
      const serialObjs = sortedSerials(r.availableSerials, r.prefix);
      const startIdx = serialObjs.findIndex(s => s.full === r.startSerial);
      if (startIdx !== -1) {
        for (let j = startIdx; j < startIdx + r.quantity; j++) {
          if (serialObjs[j]) {
            allSerials = allSerials.filter(s => s.tag_serial !== serialObjs[j].full);
          }
        }
      }
    }
  });
  if (row.prefix) {
    allSerials = allSerials.filter(s => s.tag_serial.startsWith(row.prefix));
  }
  return allSerials.length;
}
function getAvailableShortCodesForRow(rows, row, rowIdx) {
  const { bank, fastagClass, prefix } = row;
  const allShortCodes = sortedSerials(row.availableSerials, prefix).map(s => s.full.split("-").pop());
  let pickedShortCodes = [];
  rows.forEach((r, idx) => {
    if (
      idx !== rowIdx &&
      r.bank === bank &&
      r.fastagClass === fastagClass &&
      r.prefix === prefix &&
      r.startSerial &&
      r.quantity > 0 &&
      r.availableSerials.length
    ) {
      const serialObjs = sortedSerials(r.availableSerials, prefix);
      const startIdx = serialObjs.findIndex(s => s.full === r.startSerial);
      if (startIdx !== -1) {
        for (let j = startIdx; j < startIdx + r.quantity; j++) {
          if (serialObjs[j]) pickedShortCodes.push(serialObjs[j].full.split("-").pop());
        }
      }
    }
  });
  return allShortCodes.filter(sc => !pickedShortCodes.includes(sc));
}
function getAvailableEndShortCodesForRow(rows, row, rowIdx) {
  const prefix = row.prefix;
  const serialObjs = sortedSerials(row.availableSerials, prefix);
  let pickedSerials = [];
  rows.forEach((r, idx) => {
    if (
      idx !== rowIdx &&
      r.bank === row.bank &&
      r.fastagClass === row.fastagClass &&
      r.prefix === prefix &&
      r.startSerial &&
      r.quantity > 0 &&
      r.availableSerials.length
    ) {
      const otherSerialObjs = sortedSerials(r.availableSerials, prefix);
      const startIdx = otherSerialObjs.findIndex(s => s.full === r.startSerial);
      if (startIdx !== -1) {
        for (let j = startIdx; j < startIdx + r.quantity; j++) {
          if (otherSerialObjs[j]) pickedSerials.push(otherSerialObjs[j].full);
        }
      }
    }
  });
  const filteredSerialObjs = serialObjs.filter(s => !pickedSerials.includes(s.full));
  if (!row.startSerial) {
    return filteredSerialObjs.map(s => s.full.split("-").pop());
  }
  const startIdx = filteredSerialObjs.findIndex(s => s.full === row.startSerial);
  if (startIdx === -1) return [];
  const qty = Math.max(1, Number(row.quantity) || 1);
  return [filteredSerialObjs[startIdx + qty - 1]?.full.split("-").pop()].filter(Boolean);
}

export default function BulkTransferModal({ open, onClose, banks, classes, users, onSuccess }) {
  // Roles you support (edit as needed)
  const roles = [
    { label: "Admin", value: "admin" },
    { label: "ASM", value: "asm" },
    { label: "Team Leader", value: "team-leader" },
    { label: "Manager", value: "manager" },
    { label: "Shop", value: "shop" },
    { label: "Showroom", value: "showroom" },
    { label: "Toll Agent", value: "toll-agent" }
  ];

  // Modal state
  const [transferFromRole, setTransferFromRole] = useState("admin");
  const [transferFromUser, setTransferFromUser] = useState("");
  const [transferToRole, setTransferToRole] = useState("");
  const [transferToUser, setTransferToUser] = useState("");

  const [rows, setRows] = useState([
    { bank: "", fastagClass: "", prefix: "", availableSerials: [], startSerial: "", endSerial: "", quantity: 1 }
  ]);
  const [loading, setLoading] = useState(false);
  const [allSerialsCache, setAllSerialsCache] = useState({});

  // Load serials when FROM changes
  useEffect(() => {
    rows.forEach((row, i) => {
      const fromKey = transferFromRole === "admin" ? "admin" : transferFromUser;
      if (row.bank && row.fastagClass && fromKey) {
        const key = `${row.bank}-${row.fastagClass}-${fromKey}`;
        if (allSerialsCache[key]) {
          setRows(rows =>
            rows.map((r, idx) => idx === i
              ? { ...r, availableSerials: allSerialsCache[key] }
              : r
            )
          );
        } else {
          let url = `/api/fastags/available?bank=${row.bank}&class=${row.fastagClass}`;
          if (fromKey !== "admin") url += `&assigned_to=${fromKey}`;
          fetch(url)
            .then(async res => {
              if (!res.ok) return [];
              try { return await res.json(); } catch { return []; }
            })
            .then(data => {
              setAllSerialsCache(cache => ({ ...cache, [key]: Array.isArray(data) ? data : [] }));
              setRows(rows =>
                rows.map((r, idx) => idx === i
                  ? { ...r, availableSerials: Array.isArray(data) ? data : [] }
                  : r
                )
              );
            });
        }
      }
    });
    // eslint-disable-next-line
  }, [rows.map(r => r.bank + r.fastagClass).join(","), transferFromRole, transferFromUser]);

  // Row handlers
  const getSelectedSerials = (bank, fastagClass, prefix, excludeIdx) => {
    let serials = [];
    rows.forEach((row, idx) => {
      if (
        idx !== excludeIdx &&
        row.bank === bank &&
        row.fastagClass === fastagClass &&
        row.prefix === prefix &&
        row.startSerial &&
        row.quantity > 0 &&
        row.availableSerials.length
      ) {
        const serialObjs = sortedSerials(row.availableSerials, prefix);
        const startIdx = serialObjs.findIndex(s => s.full === row.startSerial);
        if (startIdx !== -1) {
          for (let i = startIdx; i < startIdx + row.quantity; i++) {
            if (serialObjs[i]) serials.push(serialObjs[i].full);
          }
        }
      }
    });
    return serials;
  };

  const handleRowChange = (i, field, value) => {
    const fromKey = transferFromRole === "admin" ? "admin" : transferFromUser;
    setRows(rows => rows.map((row, idx) => {
      if (idx !== i) return row;
      const key = `${row.bank}-${row.fastagClass}-${fromKey}`;
      const allSerials = allSerialsCache[key] || [];
      const prefix = field === "prefix" ? value : row.prefix;
      const otherSelected = getSelectedSerials(row.bank, row.fastagClass, prefix, i);
      const availableSerials = allSerials.filter(s => !otherSelected.includes(s.tag_serial));
      const serialObjs = sortedSerials(availableSerials, prefix);

      if (field === "bank" || field === "fastagClass") {
        return {
          ...row,
          [field]: value,
          prefix: "",
          availableSerials: [],
          startSerial: "",
          endSerial: "",
          quantity: 1
        };
      }
      if (field === "prefix") {
        return {
          ...row,
          prefix: value,
          startSerial: "",
          endSerial: "",
          quantity: 1
        };
      }
      if (field === "startSerial") {
        const startFull = findFullSerial(availableSerials.filter(s => s.tag_serial.startsWith(prefix)), value);
        const startIdx = serialObjs.findIndex(s => s.full === startFull);
        let qty = row.quantity;
        if (startIdx === -1 || qty < 1) return { ...row, startSerial: startFull, endSerial: "", quantity: 1, availableSerials, prefix };
        const maxQty = serialObjs.length - startIdx;
        qty = Math.min(qty, maxQty);
        const endSerial = serialObjs[startIdx + qty - 1]?.full || startFull;
        return { ...row, startSerial: startFull, quantity: qty, endSerial, availableSerials, prefix };
      }
      if (field === "quantity") {
        let qty = Math.max(1, Number(value));
        const startShort = row.startSerial.split("-").pop();
        const startFull = findFullSerial(availableSerials.filter(s => s.tag_serial.startsWith(prefix)), startShort);
        const startIdx = serialObjs.findIndex(s => s.full === startFull);
        if (startIdx === -1) return { ...row, quantity: qty, endSerial: "", availableSerials, prefix };
        const maxQty = serialObjs.length - startIdx;
        qty = Math.min(qty, maxQty);
        const endSerial = serialObjs[startIdx + qty - 1]?.full || startFull;
        return { ...row, quantity: qty, endSerial, availableSerials, prefix };
      }
      if (field === "endSerial") {
        const endFull = findFullSerial(availableSerials.filter(s => s.tag_serial.startsWith(prefix)), value);
        return { ...row, endSerial: endFull, availableSerials, prefix };
      }
      return { ...row, [field]: value, availableSerials, prefix };
    }));
  };

  const addRow = () => setRows(r => [...r, { bank: "", fastagClass: "", prefix: "", availableSerials: [], startSerial: "", endSerial: "", quantity: 1 }]);
  const removeRow = i => setRows(r => r.length === 1 ? r : r.filter((_, idx) => idx !== i));

  // Validation for transfer allowed
  const canTransfer =
    !!transferFromRole &&
    (transferFromRole === "admin" || !!transferFromUser) &&
    !!transferToRole &&
    (transferToRole === "admin" || !!transferToUser) &&
    !(
      transferFromRole === transferToRole &&
      transferFromRole !== "admin" &&
      transferFromUser &&
      transferFromUser === transferToUser
    ) &&
    rows.every(row =>
      row.bank &&
      row.fastagClass &&
      row.prefix &&
      row.startSerial &&
      row.quantity > 0 &&
      row.endSerial
    );

  const handleTransfer = async () => {
    setLoading(true);
    try {
      const fromKey = transferFromRole === "admin" ? "admin" : transferFromUser;
      const toKey = transferToRole === "admin" ? "admin" : transferToUser;
      const assignments = rows
        .map(row => {
          const serialObjs = sortedSerials(row.availableSerials, row.prefix);
          const startIdx = serialObjs.findIndex(s => s.full === row.startSerial);
          const serials = (startIdx !== -1 && row.quantity > 0)
            ? serialObjs.slice(startIdx, startIdx + row.quantity).map(s => s.full)
            : [];
          return {
            bank: row.bank,
            fastagClass: row.fastagClass,
            prefix: row.prefix,
            fromRole: transferFromRole,
            from: fromKey,
            toRole: transferToRole,
            agentId: toKey,
            to: toKey,
            serials
          };
        })
        .filter(a => a.from && a.to && Array.isArray(a.serials) && a.serials.length > 0);
      if (assignments.length === 0) {
        alert("Please fill all required fields and select at least one serial for each transfer.");
        setLoading(false);
        return;
      }
      const res = await fetch("/api/fastags/bulk-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assignments)
      });
      const result = await res.json();
      if (result.success) {
        alert(`Total ${assignments.reduce((sum, a) => sum + a.serials.length, 0)} FASTags transferred.`);
        setRows([{ bank: "", fastagClass: "", prefix: "", availableSerials: [], startSerial: "", endSerial: "", quantity: 1 }]);
        onSuccess && onSuccess();
        onClose();
      } else {
        alert(result.error || "Transfer failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bulk Transfer FASTags</DialogTitle>
        </DialogHeader>
        <div className="flex gap-3 mb-4 flex-wrap">
          {/* Transfer From Role */}
          <Select value={transferFromRole} onValueChange={val => {
            setTransferFromRole(val);
            setTransferFromUser("");
            setRows([{ bank: "", fastagClass: "", prefix: "", availableSerials: [], startSerial: "", endSerial: "", quantity: 1 }]);
            setAllSerialsCache({});
          }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Transfer From Role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map(role => (
                <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Transfer From Name */}
          {transferFromRole !== "admin" && (
            <Select
              value={transferFromUser}
              onValueChange={val => setTransferFromUser(val)}
              disabled={!transferFromRole}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select Name" />
              </SelectTrigger>
              <SelectContent>
                {(users || [])
                  .filter(u => u.role === transferFromRole)
                  .map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          )}
          {/* Transfer To Role */}
          <Select value={transferToRole} onValueChange={val => {
            setTransferToRole(val);
            setTransferToUser("");
          }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Transfer To Role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map(role => (
                <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Transfer To Name */}
          {transferToRole !== "admin" && (
            <Select
              value={transferToUser}
              onValueChange={val => setTransferToUser(val)}
              disabled={!transferToRole}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select Name" />
              </SelectTrigger>
              <SelectContent>
                {(users || [])
                  .filter(u => u.role === transferToRole)
                  // Prevent picking the same user as source and destination
                  .filter(u => !(transferFromRole === transferToRole && transferFromUser === String(u.id)))
                  .map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex flex-col gap-4">
          {rows.map((row, i) => {
            const fromKey = transferFromRole === "admin" ? "admin" : transferFromUser;
            const serialObjs = sortedSerials(row.availableSerials, row.prefix);
            const prefixOptions = getPrefixes(row.availableSerials);
            const dynamicAvailable = row.bank && row.fastagClass && row.prefix
              ? getDynamicAvailable(rows, allSerialsCache, row, i, fromKey)
              : row.availableSerials.length;

            return (
              <div key={i} className="flex flex-wrap items-center gap-3">
                <Select value={row.bank} onValueChange={val => handleRowChange(i, "bank", val)}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="Bank" /></SelectTrigger>
                  <SelectContent>
                    {banks.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={row.fastagClass} onValueChange={val => handleRowChange(i, "fastagClass", val)}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="Class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={row.prefix} onValueChange={val => handleRowChange(i, "prefix", val)}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="Select Prefix" /></SelectTrigger>
                  <SelectContent>
                    {prefixOptions.map(pfx => {
                      const availableCount = getDynamicAvailable(
                        rows, allSerialsCache, { ...row, prefix: pfx }, i, fromKey
                      );
                      return (
                        <SelectItem key={pfx} value={pfx}>
                          {pfx} (available: {availableCount})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Input
                  className="w-36"
                  value={row.startSerial ? row.startSerial.split("-").pop() : ""}
                  onChange={e => handleRowChange(i, "startSerial", e.target.value)}
                  placeholder="Start Serial"
                  list={`start-serials-list-${i}`}
                  disabled={!row.prefix}
                />
                <datalist id={`start-serials-list-${i}`}>
                  {getAvailableShortCodesForRow(rows, row, i).map(unique => (
                    <option key={unique} value={unique} />
                  ))}
                </datalist>
                <Input
                  className="w-16"
                  type="number"
                  min={1}
                  max={dynamicAvailable}
                  value={row.quantity}
                  onChange={e => handleRowChange(i, "quantity", e.target.value)}
                  placeholder="Qty"
                  disabled={!row.prefix}
                />
                <Input
                  className="w-36"
                  value={row.endSerial ? row.endSerial.split("-").pop() : ""}
                  onChange={e => handleRowChange(i, "endSerial", e.target.value)}
                  placeholder="End Serial"
                  list={`end-serials-list-${i}`}
                  readOnly
                  style={{ background: "#f8fafc" }}
                  disabled={!row.prefix}
                />
                <datalist id={`end-serials-list-${i}`}>
                  {getAvailableEndShortCodesForRow(rows, row, i).map(unique => (
                    <option key={unique} value={unique} />
                  ))}
                </datalist>
                {rows.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-red-500"
                    onClick={() => removeRow(i)}
                  >🗑</Button>
                )}
              </div>
            );
          })}
          <Button type="button" variant="outline" onClick={addRow}>+ Add Row</Button>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button onClick={handleTransfer} disabled={loading || !canTransfer}>
              {loading ? "Transferring..." : "Transfer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
