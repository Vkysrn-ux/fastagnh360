"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const banks = ["ICICI", "SBI", "HDFC", "AXIS", "KVB"];

export default function NewFastagSalePage() {
  const router = useRouter();
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [rcFile, setRcFile] = useState<File | null>(null);
  const [bank, setBank] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [aadharFile, setAadharFile] = useState<File | null>(null);
  const [paymentMode, setPaymentMode] = useState("Online");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successOrderId, setSuccessOrderId] = useState("");

  // Prices
  const tagPrice = 500, convFee = 50, total = tagPrice + convFee;

  // Handle form submission
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setIsSubmitting(true);

    // TODO: Integrate with your backend API to save sale, deduct inventory, upload docs, process payment
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccessOrderId("ORD" + Date.now());
    }, 1200);
  };

  return (
    <div className="max-w-xl mx-auto mt-10 bg-white rounded-2xl shadow-lg p-8">
      <h2 className="text-2xl font-bold mb-1">FASTag Sale (Admin)</h2>
      <p className="text-gray-500 mb-4">Issue FASTag directly to customer from admin inventory.</p>

      {successOrderId ? (
        <div className="p-6 bg-green-50 text-green-800 rounded-xl text-center">
          <div className="text-xl mb-2">🎉 Sale Recorded!</div>
          <div>FASTag order created and inventory updated.</div>
          <div className="font-bold mt-2">Order ID: {successOrderId}</div>
          <button className="btn mt-4" onClick={() => router.push("/admin/sales")}>Go to Sales</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm mb-1 font-medium">Customer Name</label>
            <input className="input w-full" value={customerName} onChange={e => setCustomerName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm mb-1 font-medium">Mobile</label>
            <input className="input w-full" value={customerMobile} onChange={e => setCustomerMobile(e.target.value)} required maxLength={10} />
          </div>
          <div>
            <label className="block text-sm mb-1 font-medium">Email</label>
            <input className="input w-full" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1 font-medium">Address</label>
            <input className="input w-full" value={address} onChange={e => setAddress(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm mb-1 font-medium">Pincode</label>
            <input className="input w-full" value={pincode} onChange={e => setPincode(e.target.value)} required maxLength={6} />
          </div>
          <div>
            <label className="block text-sm mb-1 font-medium">Vehicle Number</label>
            <input className="input w-full" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm mb-1 font-medium">Vehicle Type</label>
            <select className="input w-full" value={vehicleType} onChange={e => setVehicleType(e.target.value)} required>
              <option value="">Select Type</option>
              <option>Car</option>
              <option>Truck</option>
              <option>Bus</option>
              <option>Bike</option>
              <option>Others</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1 font-medium">Bank</label>
            <select className="input w-full" value={bank} onChange={e => setBank(e.target.value)} required>
              <option value="">Select Bank</option>
              {banks.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1 font-medium">RC Upload</label>
            <input type="file" className="input w-full" onChange={e => setRcFile(e.target.files?.[0] ?? null)} required />
          </div>
          <div>
            <label className="block text-sm mb-1 font-medium">Aadhar Upload (optional)</label>
            <input type="file" className="input w-full" onChange={e => setAadharFile(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <label className="block text-sm mb-1 font-medium">Payment Mode</label>
            <select className="input w-full" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
              <option value="Online">Online</option>
              <option value="COD">Collect at Delivery</option>
            </select>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl flex items-center justify-between">
            <div>
              <div>FASTag Price: <b>₹{tagPrice}</b></div>
              <div>Convenience Fee: <b>₹{convFee}</b></div>
            </div>
            <div className="font-bold text-lg">Total: ₹{total}</div>
          </div>

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Record FASTag Sale"}
          </button>
        </form>
      )}

      <style jsx>{`
        .input {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 10px;
          margin-bottom: 6px;
          font-size: 1rem;
        }
        .btn-primary {
          border-radius: 8px;
          padding: 12px 0;
          border: none;
          font-weight: 700;
          background: #fb8500;
          color: #fff;
          font-size: 1.1rem;
          transition: background 0.2s;
        }
        .btn-primary[disabled] {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .btn {
          background: #eee;
          border-radius: 8px;
          padding: 10px 20px;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
