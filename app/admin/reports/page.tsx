"use client";

export default function ReportsHome() {
  return (
    <div className="container py-10">
      <h1 className="text-2xl font-bold mb-4">Reports</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <a href="/admin/reports/money-flow" className="border rounded p-4 hover:bg-gray-50">Money Flow</a>
        <a href="/admin/reports/inventory-flow" className="border rounded p-4 hover:bg-gray-50">Inventory Flow</a>
      </div>
    </div>
  );
}

