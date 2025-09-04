import { useEffect, useState } from "react";

// Helper: Get prefix from serial number
function getPrefix(serial) {
  if (!serial) return "";
  const parts = serial.split("-");
  return parts.length >= 2 ? `${parts[0]}-${parts[1]}` : serial;
}

export default function AgentDetailModal({ agent, onClose }) {
  const [fastags, setFastags] = useState([]);
  const [filters, setFilters] = useState({ bank: "", classType: "", status: "" });

  useEffect(() => {
    fetch(`/api/fastags?assigned_to=${agent.id}`)
      .then(res => res.json())
      .then(setFastags);
  }, [agent]);

  // Step 1: Filter for selected bank and classType
  const filtered = fastags.filter(tag =>
    (!filters.bank || tag.bank_name === filters.bank) &&
    (!filters.classType || tag.fastag_class === filters.classType) &&
    (tag.status === "assigned" || tag.status === "available" || tag.status === "in_stock")
  );

  // Step 2: Count by prefix
  const prefixCounts = {};
  filtered.forEach(tag => {
    const prefix = getPrefix(tag.tag_number);
    if (!prefixCounts[prefix]) prefixCounts[prefix] = 0;
    prefixCounts[prefix]++;
  });

  // To show as a summary list (not dropdown)
  const summaryList = Object.entries(prefixCounts); // [[prefix, count], ...]

  // Your other stats and filter controls (no change)
  // ...

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 shadow-lg max-w-2xl w-full">
        <button onClick={onClose} className="float-right text-gray-500 hover:text-red-600">&times;</button>
        <h3 className="text-xl font-bold mb-2">{agent.name} (Agent Details)</h3>
        {/* ... agent details ... */}
        <div className="mb-4">
          <b>FASTag Serial Available Count (by Prefix):</b>
          <ul className="list-disc ml-5">
            {summaryList.length === 0 && <li>No tags available for this bank/class</li>}
            {summaryList.map(([prefix, count]) =>
              <li key={prefix}>{prefix} (available: {count})</li>
            )}
          </ul>
        </div>
        {/* ... rest of your modal ... */}
      </div>
    </div>
  );
}
