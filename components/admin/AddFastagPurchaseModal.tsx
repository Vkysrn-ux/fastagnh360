import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

function expandSerials({ serialType, singleSerial, startSerial, endSerial }) {
  if (serialType === "single") {
    return [singleSerial.trim()];
  } else {
    const startMatch = startSerial.trim().match(/(.*?)(\d+)$/);
    const endMatch = endSerial.trim().match(/(.*?)(\d+)$/);

    if (startMatch && endMatch && startMatch[1] === endMatch[1]) {
      const prefix = startMatch[1];
      const startNum = parseInt(startMatch[2], 10);
      const endNum = parseInt(endMatch[2], 10);
      const padLength = startMatch[2].length;
      if (startNum > endNum) return [];
      return Array.from({ length: endNum - startNum + 1 }, (_, i) =>
        `${prefix}${String(startNum + i).padStart(padLength, "0")}`
      );
    }
    return [];
  }
}

function AddFastagPurchaseModal({ open, onClose, supplier, onSaved }) {
  const [fastagClass, setFastagClass] = useState("");
  const [bank, setBank] = useState("");
  const [batch, setBatch] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [paymentType, setPaymentType] = useState("paid");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().substring(0, 10));
  const [banks, setBanks] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [serialType, setSerialType] = useState("single");
  const [singleSerial, setSingleSerial] = useState("");
  const [startSerial, setStartSerial] = useState("");
  const [endSerial, setEndSerial] = useState("");

  // Fetch banks
  useEffect(() => {
    fetch("/api/banks")
      .then(res => res.json())
      .then(data => setBanks(data));
  }, []);

  // Auto-generate batch number
  useEffect(() => {
    if (supplier?.name && bank && purchaseDate) {
      const supplierCode = supplier.name.split(" ")[0]?.toUpperCase(); // "M2P"
      const bankCode = bank.split(" ")[0]?.toUpperCase(); // "IDFC"
      const [yyyy, mm, dd] = purchaseDate.split("-");
      const shortDate = `${dd}${mm}${yyyy.slice(2)}`; // "080625"
      setBatch(`${supplierCode}-${bankCode}-${shortDate}`);
    }
  }, [supplier, bank, purchaseDate]);

  async function handleSave() {
    const serials = expandSerials({ serialType, singleSerial, startSerial, endSerial });
    if (!serials.length || !serials[0]) {
      alert("Please enter valid serial numbers.");
      return;
    }
    if (!fastagClass || !bank || !batch || !purchasePrice || !paymentType || !purchaseDate) {
      alert("Please fill all fields.");
      return;
    }
    setIsSaving(true);
    const res = await fetch("/api/fastags/bulk-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplier_id: supplier.id,
        fastag_class: fastagClass,
        bank_name: bank,
        batch_number: batch,
        purchase_price: purchasePrice,
        payment_type: paymentType,
        purchase_date: purchaseDate,
        serials,
      }),
    });
    setIsSaving(false);
    if (res.ok) {
      onSaved?.();
      onClose();
    } else {
      alert("Error saving FASTags. Please try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add FASTag Purchase for {supplier?.name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <Label>FASTag Class</Label>
            <Select value={fastagClass} onValueChange={setFastagClass}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="class4">Class 4</SelectItem>
                <SelectItem value="class5">Class 5</SelectItem>
                <SelectItem value="class6">Class 6</SelectItem>
                <SelectItem value="class7">Class 7</SelectItem>
                <SelectItem value="class12">Class 12</SelectItem>
                <SelectItem value="class15">Class 15</SelectItem>
                <SelectItem value="class16">Class 16</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Bank</Label>
            <Select value={bank} onValueChange={setBank}>
              <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
              <SelectContent>
                {banks.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Serial Input Type</Label>
            <Select value={serialType} onValueChange={setSerialType}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single FASTag</SelectItem>
                <SelectItem value="range">Serial Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {serialType === "single" ? (
            <div>
              <Label>Serial Number</Label>
              <Input
                value={singleSerial}
                onChange={e => setSingleSerial(e.target.value)}
                placeholder="Eg: 608116-030-0912712"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Start Serial</Label>
                <Input
                  value={startSerial}
                  onChange={e => setStartSerial(e.target.value)}
                  placeholder="Eg: 608116-030-0912712"
                />
              </div>
              <div>
                <Label>End Serial</Label>
                <Input
                  value={endSerial}
                  onChange={e => setEndSerial(e.target.value)}
                  placeholder="Eg: 608116-030-0912736"
                />
              </div>
            </div>
          )}

          <div>
            <Label>Batch Number</Label>
            <Input value={batch} readOnly placeholder="Auto-generated batch number" />
          </div>

          <div>
            <Label>Purchase Price per Tag (₹)</Label>
            <Input type="number" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} />
          </div>

          <div>
            <Label>Payment Type</Label>
            <Select value={paymentType} onValueChange={setPaymentType}>
              <SelectTrigger><SelectValue placeholder="Select payment type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="credit">Credit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Purchase Date</Label>
            <Input
              type="date"
              value={purchaseDate}
              onChange={e => setPurchaseDate(e.target.value)}
            />
          </div>

          <Button className="mt-2" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Purchase"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AddFastagPurchaseModal;
