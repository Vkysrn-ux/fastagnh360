"use client";
import { useState } from "react";

const ROLES = [
  { label: "Super Admin", value: "admin" },
  { label: "Accountant / HR", value: "employee" },
  { label: "Manager", value: "manager" },
  { label: "Team Lead", value: "team-leader" },
  { label: "Agent", value: "agent" },
];

const DASHBOARDS = [
  { label: "Admin Dashboard - Super Admin sees everything", value: "admin" },
  { label: "Employee Dashboard - Accountant/HR sees financial data", value: "employee" },
  { label: "Agent Dashboard - Manager/TeamLead/Agents see operations", value: "agent" },
];

interface RegisterUserFormProps {
  onSuccess?: () => void;
}

export default function RegisterUserForm({ onSuccess }: RegisterUserFormProps) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "admin",
    password: "",
    confirmPassword: "",
    dashboard: "admin",
  });
  const [message, setMessage] = useState("");

  // Field change handler
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value } as typeof prev;
      if (name === "role") {
        if (value === "admin") next.dashboard = "admin";
        else if (value === "employee") next.dashboard = "employee";
        else next.dashboard = "agent";
      }
      if (name === "dashboard") {
        if (value === "admin") next.role = "admin";
        else if (value === "employee") next.role = "employee";
        else if (value === "agent" && (prev.role === "admin" || prev.role === "employee")) next.role = "agent";
      }
      return next;
    });
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (form.password !== form.confirmPassword) {
      setMessage("Error: Passwords do not match");
      return;
    }

    if (form.password.length < 8) {
      setMessage("Error: Password must be at least 8 characters long");
      return;
    }

    try {
      const response = await fetch("/api/portal-users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          role: form.role,
          password: form.password,
          status: "active",
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage(`Success: User registered successfully! ID: ${data.userId}`);
        setForm({
          name: "",
          email: "",
          phone: "",
          role: "admin",
          password: "",
          confirmPassword: "",
          dashboard: "admin",
        });
        
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setMessage(`Error: ${data.error || "Registration failed"}`);
      }
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : "Registration failed"}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 max-w-xl p-6 bg-white rounded shadow">
      <h2 className="text-xl font-bold">Register New User</h2>
      
      <div className="grid gap-3">
        <input
          name="name"
          placeholder="Full Name"
          value={form.name}
          onChange={handleChange}
          required
          className="border rounded px-3 py-2"
        />
        
        <input
          name="email"
          type="email"
          placeholder="Email Address"
          value={form.email}
          onChange={handleChange}
          required
          className="border rounded px-3 py-2"
        />
        
        <input
          name="phone"
          placeholder="Phone Number"
          value={form.phone}
          onChange={handleChange}
          className="border rounded px-3 py-2"
        />

        <select
          name="role"
          value={form.role}
          onChange={handleChange}
          className="border rounded px-3 py-2"
        >
          {ROLES.map(role => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>

        <select
          name="dashboard"
          value={form.dashboard}
          onChange={handleChange}
          className="border rounded px-3 py-2"
        >
          {DASHBOARDS.map(dashboard => (
            <option key={dashboard.value} value={dashboard.value}>
              {dashboard.label}
            </option>
          ))}
        </select>

        <input
          name="password"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          required
          minLength={8}
          className="border rounded px-3 py-2"
        />

        <input
          name="confirmPassword"
          type="password"
          placeholder="Confirm Password"
          value={form.confirmPassword}
          onChange={handleChange}
          required
          minLength={8}
          className="border rounded px-3 py-2"
        />
      </div>

      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
        Register User
      </button>

      {message && (
        <p className={`text-sm mt-2 ${message.startsWith('Success:') ? 'text-green-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}
    </form>
  );
}
