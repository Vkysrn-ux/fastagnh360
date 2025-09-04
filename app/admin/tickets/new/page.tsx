"use client";
import { useState, useEffect } from "react";
import ShopAutocomplete from "@/components/ShopAutocomplete"; // Correct path

const initialForm = {
  vehicle_reg_no: "",
  subject: "",
  details: "",
  phone: "",
  alt_phone: "",
  assigned_to: "",
  lead_received_from: "",
  lead_by: "",
  status: "open",
  customer_name: "",
  comments: "",
};

export default function TicketForm() {
  const [form, setForm] = useState(initialForm);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedShop, setSelectedShop] = useState(null);
  const [message, setMessage] = useState("");
  const currentUserId = 1; // TODO: Replace with actual user id from session

  // Load staff users for dropdown when lead_received_from is staff role
  useEffect(() => {
    if (
      ["Toll-agent", "ASM", "TL", "Manager"].includes(form.lead_received_from)
    ) {
      setLoadingUsers(true);
      fetch(`/api/users?role=${form.lead_received_from.toLowerCase()}`)
        .then((res) => res.json())
        .then((data) => setUsers(data || []))
        .catch(() => setUsers([]))
        .finally(() => setLoadingUsers(false));
    } else {
      setUsers([]);
      setForm((f) => ({ ...f, role_user_id: "" }));
    }
    // Shop is handled by ShopAutocomplete
  }, [form.lead_received_from]);

  // Update form when shop is selected
  useEffect(() => {
    setForm(f => ({
      ...f,
      role_user_id: selectedShop ? selectedShop.id : "",
    }));
  }, [selectedShop]);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    // Set assigned_to to an integer or null, depending on selection
    let assigned_to_value = form.assigned_to;
    if (assigned_to_value === "" || assigned_to_value === "self") {
      assigned_to_value = currentUserId;
    } else if (!isNaN(assigned_to_value)) {
      assigned_to_value = parseInt(assigned_to_value, 10);
    } else {
      assigned_to_value = null;
    }

    const data = {
      vehicle_reg_no: form.vehicle_reg_no,
      subject: form.subject,
      details: form.details,
      phone: form.phone,
      alt_phone: form.alt_phone,
      assigned_to: assigned_to_value,
      lead_received_from: form.lead_received_from,
      lead_by: form.lead_by,
      status: form.status,
      customer_name: form.customer_name,
      comments: form.comments,
    };

    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setMessage("Ticket created successfully!");
      setForm(initialForm);
      setUsers([]);
      setSelectedShop(null);
    } else {
      setMessage("Error: " + (await res.text()));
    }
  };

  return (
    <div className="w-full max-w-screen-2xl mx-auto mt-10 px-8">
      <form
        className="bg-white rounded-2xl shadow-lg p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6"
        onSubmit={handleSubmit}
      >
        <div>
          <label className="block font-semibold mb-1">Vehicle Reg. No (VRN)</label>
          <input name="vehicle_reg_no" required value={form.vehicle_reg_no} onChange={handleChange}
            className="w-full border p-2 rounded focus:outline-orange-500" />
        </div>
        <div>
          <label className="block font-semibold mb-1">Phone</label>
          <input name="phone" required value={form.phone} onChange={handleChange}
            className="w-full border p-2 rounded focus:outline-orange-500" />
        </div>
        <div>
          <label className="block font-semibold mb-1">FASTag Reg. No (if different)</label>
          <input name="alt_phone" value={form.alt_phone} onChange={handleChange}
            className="w-full border p-2 rounded focus:outline-orange-500" />
        </div>
        <div>
          <label className="block font-semibold mb-1">Subject</label>
          <select name="subject" required value={form.subject} onChange={handleChange}
            className="w-full border p-2 rounded focus:outline-orange-500">
            <option value="">Select Subject</option>
            <option value="new_fastag">New FASTag</option>
            <option value="replacement_fastag">Replacement FASTag</option>
            <option value="hotlisted_fastag">Hotlisted FASTag</option>
            <option value="kyc_related">KYC Related</option>
            <option value="mobile_update">Mobile Number Updation</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block font-semibold mb-1">Assigned To</label>
          <select
            name="assigned_to"
            value={form.assigned_to}
            onChange={e =>
              setForm(f => ({
                ...f,
                assigned_to: e.target.value === "self" ? currentUserId : e.target.value,
              }))
            }
            className="w-full border p-2 rounded focus:outline-orange-500"
          >
            <option value="self">Self</option>
            {/* Replace with user IDs for TL, Manager, etc. */}
            <option value="2">Team Leader</option>
            <option value="3">Manager</option>
          </select>
        </div>
        <div>
          <label className="block font-semibold mb-1">Status</label>
          <select name="status" value={form.status} onChange={handleChange}
            className="w-full border p-2 rounded focus:outline-orange-500">
            <option value="open">Open</option>
            <option value="processing">Processing</option>
            <option value="kyc_pending">KYC Pending</option>
            <option value="done">Done</option>
            <option value="waiting">Waiting</option>
            <option value="closed">Closed</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div>
          <label className="block font-semibold mb-1">Lead Received From</label>
          <select
            name="lead_received_from"
            value={form.lead_received_from}
            onChange={handleChange}
            className="w-full border p-2 rounded focus:outline-orange-500"
            required
          >
            <option value="">Select Source</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Facebook">Facebook</option>
            <option value="Social Media">Social Media</option>
            <option value="Google Map">Google Map</option>
            <option value="Other">Other</option>
            <option value="Toll-agent">Toll-agent</option>
            <option value="ASM">ASM</option>
            <option value="Shop">Shop</option>
            <option value="Showroom">Showroom</option>
            <option value="TL">TL</option>
            <option value="Manager">Manager</option>
          </select>
          {/* Shop autocomplete */}
          {form.lead_received_from === "Shop" && (
            <ShopAutocomplete
              value={selectedShop}
              onSelect={shop => {
                setSelectedShop(shop);
                setForm(f => ({ ...f, role_user_id: shop ? shop.id : "" }));
              }}
            />
          )}
          {/* Staff role dropdown */}
          {["Toll-agent", "ASM", "TL", "Manager"].includes(form.lead_received_from) && (
            <select
              name="role_user_id"
              value={form.role_user_id}
              onChange={handleChange}
              className="w-full border p-2 rounded mt-2 focus:outline-orange-500"
              required
            >
              <option value="">
                {loadingUsers
                  ? "Loading..."
                  : `Select ${form.lead_received_from} Name`}
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="block font-semibold mb-1">Customer Name</label>
          <input
            name="customer_name"
            value={form.customer_name}
            onChange={handleChange}
            className="w-full border p-2 rounded focus:outline-orange-500"
          />
        </div>
        <div className="col-span-4">
          <label className="block font-semibold mb-1">Details</label>
          <textarea
            name="details"
            value={form.details}
            onChange={handleChange}
            className="w-full border p-2 rounded focus:outline-orange-500"
            rows={3}
          />
        </div>
        <div className="col-span-4 flex justify-center mt-2">
          <button
            type="submit"
            className="bg-orange-500 text-white px-10 py-3 rounded shadow hover:bg-orange-600 text-lg font-semibold"
          >
            Create Ticket
          </button>
        </div>
        {message && (
          <div className="col-span-4 text-center mt-4 font-bold text-green-600">
            {message}
          </div>
        )}
      </form>
    </div>
  );
}
