import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

// Example color palette
const COLORS = ["#2ecc40", "#0074d9", "#ff4136", "#ffb347", "#a569bd", "#5dade2"];

export default function FastagDashboard({ fastags }) {
  // Stat cards
  const stats = useMemo(() => {
    const total = fastags.length;
    const inStock = fastags.filter(f => f.status === "in_stock").length;
    const assigned = fastags.filter(f => f.status === "assigned").length;
    const sold = fastags.filter(f => f.status === "sold").length;
    return { total, inStock, assigned, sold };
  }, [fastags]);

  // By Status
  const statusData = useMemo(() => {
    const map = {};
    fastags.forEach(f => {
      map[f.status] = (map[f.status] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [fastags]);

  // By Bank
  const bankData = useMemo(() => {
    const map = {};
    fastags.forEach(f => {
      map[f.bank_name] = (map[f.bank_name] || 0) + 1;
    });
    return Object.entries(map).map(([bank, count]) => ({ bank, count }));
  }, [fastags]);

  // By Class/Type
  const classData = useMemo(() => {
    const map = {};
    fastags.forEach(f => {
      map[f.fastag_class] = (map[f.fastag_class] || 0) + 1;
    });
    return Object.entries(map).map(([type, count]) => ({ type, count }));
  }, [fastags]);

  // Stat Card component
  const StatCard = ({ label, value, color }) => (
    <div className="rounded-lg shadow p-4 flex-1 text-center" style={{ background: color, color: "#fff" }}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm mt-2">{label}</div>
    </div>
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">FASTag Inventory Dashboard</h1>
      <p className="text-gray-500 mb-6">Visual overview of FASTags in the system.</p>

      {/* Stat cards */}
      <div className="flex flex-wrap gap-4 mb-8">
        <StatCard label="Total FASTags" value={stats.total} color="#0074d9" />
        <StatCard label="In Stock" value={stats.inStock} color="#2ecc40" />
        <StatCard label="Assigned" value={stats.assigned} color="#ffb347" />
        <StatCard label="Sold" value={stats.sold} color="#ff4136" />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Pie Chart by Status */}
        <div className="bg-white p-6 rounded-lg shadow flex flex-col items-center">
          <h2 className="font-semibold text-lg mb-3">FASTags by Status</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {statusData.map((entry, idx) => (
                  <Cell key={entry.name} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart by Bank */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="font-semibold text-lg mb-3">FASTags by Bank</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={bankData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bank" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#0074d9" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Add bar by Type/Class if desired */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="font-semibold text-lg mb-3">FASTags by Type</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={classData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#a569bd" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
