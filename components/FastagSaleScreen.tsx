"use client";
import React, { useState } from "react";

const banks = ["ICICI", "SBI", "HDFC", "AXIS", "KVB"];

export default function FastagSaleScreen({ user }: { user: any }) {
  const [step, setStep] = useState(1);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [rcFile, setRcFile] = useState<File | null>(null);
  const [bank, setBank] = useState("");
  const [name, setName] = useState(user?.name || "");
  const [mobile, setMobile] = useState(user?.mobile || "");
  const [email, setEmail] = useState(user?.email || "");
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [aadharFile, setAadharFile] = useState<File | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderId, setOrderId] = useState("");

  // Simulated prices (replace with API call)
  const tagPrice = 500, convFee = 50, total = tagPrice + convFee;

  // Handle Payment (dummy function for now)
  const handlePayment = async () => {
    setIsPaying(true);
    // ---- Payment API call here ----
    // For demo, we'll just fake success after 2s
    setTimeout(() => {
      setOrderId("ORD" + Date.now());
      setOrderSuccess(true);
      setIsPaying(false);
    }, 2000);
  };

  // Render
  return (
    <div className="max-w-lg mx-auto mt-8 p-6 rounded-2xl shadow-xl bg-white">
      <h2 className="text-2xl font-bold mb-2">Buy FASTag</h2>
      <p className="mb-6 text-sm text-gray-600">Welcome, {user?.name || "User"}!</p>
      {orderSuccess ? (
        <div className="p-6 bg-green-50 text-green-800 rounded-xl text-center">
          <div className="text-xl mb-2">🎉 Order Successful!</div>
          <div>Your FASTag order is placed.</div>
          <div className="font-bold mt-2">Order ID: {orderId}</div>
          <a href="/orders" className="mt-4 inline-block text-blue-600 underline">View Order Status</a>
        </div>
      ) : (
        <>
          {/* Step 1 */}
          {step === 1 && (
            <div>
              <h3 className="font-semibold mb-2">1. Vehicle Details</h3>
              <input className="input mb-2 w-full" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="Vehicle Number" />
              <select className="input mb-2 w-full" value={vehicleType} onChange={e => setVehicleType(e.target.value)}>
                <option value="">Vehicle Type</option>
                <option>Car</option>
                <option>Truck</option>
                <option>Bus</option>
                <option>Bike</option>
                <option>Others</option>
              </select>
              <input type="file" className="mb-4 block" onChange={e => setRcFile(e.target.files?.[0] ?? null)} />
              <button className="btn-primary w-full mt-2" disabled={!vehicleNumber || !vehicleType || !rcFile} onClick={() => setStep(2)}>Next</button>
            </div>
          )}
          {/* Step 2 */}
          {step === 2 && (
            <div>
              <h3 className="font-semibold mb-2">2. Select Bank</h3>
              <select className="input mb-4 w-full" value={bank} onChange={e => setBank(e.target.value)}>
                <option value="">Choose Bank</option>
                {banks.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <button className="btn w-full mb-2" onClick={() => setStep(1)}>Back</button>
              <button className="btn-primary w-full" disabled={!bank} onClick={() => setStep(3)}>Next</button>
            </div>
          )}
          {/* Step 3 */}
          {step === 3 && (
            <div>
              <h3 className="font-semibold mb-2">3. Your Details</h3>
              <input className="input mb-2 w-full" value={name} onChange={e => setName(e.target.value)} placeholder="Name" />
              <input className="input mb-2 w-full" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="Mobile" />
              <input className="input mb-2 w-full" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
              <input className="input mb-2 w-full" value={address} onChange={e => setAddress(e.target.value)} placeholder="Address" />
              <input className="input mb-2 w-full" value={pincode} onChange={e => setPincode(e.target.value)} placeholder="Pincode" />
              <div className="mb-2 text-xs text-gray-600">Aadhar upload (optional):</div>
              <input type="file" className="mb-4 block" onChange={e => setAadharFile(e.target.files?.[0] ?? null)} />
              <button className="btn w-full mb-2" onClick={() => setStep(2)}>Back</button>
              <button className="btn-primary w-full" disabled={!name || !mobile || !address || !pincode} onClick={() => setStep(4)}>Next</button>
            </div>
          )}
          {/* Step 4 */}
          {step === 4 && (
            <div>
              <h3 className="font-semibold mb-2">4. Payment & Summary</h3>
              <div className="mb-2">FASTag Price: <b>₹{tagPrice}</b></div>
              <div className="mb-2">Convenience Fee: <b>₹{convFee}</b></div>
              <div className="mb-4 text-lg font-bold">Total: ₹{total}</div>
              <button className="btn w-full mb-2" onClick={() => setStep(3)}>Back</button>
              <button
                className={`btn-primary w-full ${isPaying ? "opacity-60" : ""}`}
                disabled={isPaying}
                onClick={handlePayment}
              >
                {isPaying ? "Processing..." : "Pay Now"}
              </button>
            </div>
          )}
        </>
      )}
      <style jsx>{`
        .input { border: 1px solid #ddd; border-radius: 8px; padding: 10px; margin-bottom: 6px; }
        .btn, .btn-primary {
          border-radius: 8px; padding: 10px 20px; border: none; font-weight: 600;
          background: #e2e8f0; color: #1e293b; cursor: pointer;
        }
        .btn-primary { background: #fb8500; color: #fff; }
        .btn[disabled], .btn-primary[disabled] { opacity: 0.6; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
