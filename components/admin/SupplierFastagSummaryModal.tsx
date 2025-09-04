import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as XLSX from "xlsx";

// Utility function to format ₹
const formatCurrency = (n: number | string) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

// --- Export functions ---
function exportGroupedToCSV(grouped: any[], supplierName: string) {
  if (!grouped || !grouped.length) return;
  const header = ['Bank', 'Class', 'Total Count'];
  const rows = grouped.map(row =>
    [row.bank_name, row.fastag_class, row.total_count]
  );
  const csvContent = [
    header.join(','),
    ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `FASTag-Summary-${supplierName || 'Supplier'}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportGroupedToExcel(grouped: any[], supplierName: string) {
  if (!grouped || !grouped.length) return;
  const wsData = [
    ['Bank', 'Class', 'Total Count'],
    ...grouped.map(row => [row.bank_name, row.fastag_class, row.total_count])
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Summary");
  XLSX.writeFile(wb, `FASTag-Summary-${supplierName || "Supplier"}.xlsx`);
}

// ---- FIXED PDF EXPORT ----
async function exportGroupedToPDF(grouped: any[], supplierName: string) {
  if (!grouped || !grouped.length) return;
  const jsPDFModule = await import('jspdf');
  const autoTable = await import('jspdf-autotable');
  const jsPDF = jsPDFModule.default;

  // Register autotable on this jsPDF instance (safeguard for some setups)
  // @ts-ignore
  if (typeof window !== "undefined" && jsPDF.API && !jsPDF.API.autoTable) {
    // @ts-ignore
    autoTable.default(jsPDF);
  }

  const doc = new jsPDF();
  doc.text(`FASTag Summary: ${supplierName || "Supplier"}`, 14, 15);
  // @ts-ignore
  doc.autoTable({
    startY: 25,
    head: [['Bank', 'Class', 'Total Count']],
    body: grouped.map(row => [row.bank_name, row.fastag_class, row.total_count]),
  });
  doc.save(`FASTag-Summary-${supplierName || "Supplier"}.pdf`);
}

// --- Main component ---
export default function SupplierFastagSummaryModal({
  open,
  onClose,
  supplier,
  data
}: {
  open: boolean,
  onClose: () => void,
  supplier: { name?: string },
  data: { summary?: any, grouped: any[] }
}) {
  if (!data || !data.grouped) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              FASTag Summary: {supplier?.name || ""}
            </DialogTitle>
          </DialogHeader>
          <div className="p-10 text-center text-gray-500">Loading...</div>
        </DialogContent>
      </Dialog>
    );
  }

  // Quick stats from summary object
  const summary = data.summary || {};
  const totalCount = summary.total_fastags ?? 0;
  const inStockCount = summary.available_with_admin ?? 0;
  const assignedCount = summary.assigned_to_agent ?? 0;
  const soldCount = summary.sold_total ?? 0;
  const profit = summary.profit ?? 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            FASTag Inventory Summary: <span className="font-semibold">{supplier?.name || ""}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="p-2">
          {/* Stats Overview */}
          <div className="flex flex-wrap gap-5 mb-6">
            <div className="rounded bg-blue-50 text-blue-700 px-4 py-2 min-w-[130px] text-center">
              <div className="font-bold text-2xl">{totalCount}</div>
              <div className="text-xs">Total FASTags</div>
            </div>
            <div className="rounded bg-gray-50 text-gray-800 px-4 py-2 min-w-[130px] text-center">
              <div className="font-bold text-2xl">{inStockCount}</div>
              <div className="text-xs">In Stock (Admin)</div>
            </div>
            <div className="rounded bg-purple-50 text-purple-700 px-4 py-2 min-w-[130px] text-center">
              <div className="font-bold text-2xl">{assignedCount}</div>
              <div className="text-xs">Assigned to Agent</div>
            </div>
            <div className="rounded bg-red-50 text-red-700 px-4 py-2 min-w-[130px] text-center">
              <div className="font-bold text-2xl">{soldCount}</div>
              <div className="text-xs">Sold</div>
            </div>
            <div className="rounded bg-green-50 text-green-700 px-4 py-2 min-w-[130px] text-center">
              <div className="font-bold text-2xl">{formatCurrency(profit)}</div>
              <div className="text-xs">Profit</div>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex gap-3 justify-end mb-2">
            <button
              className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              onClick={() => exportGroupedToCSV(data.grouped, supplier?.name || "")}
            >
              Export CSV
            </button>
            <button
              className="px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition"
              onClick={() => exportGroupedToExcel(data.grouped, supplier?.name || "")}
            >
              Export Excel
            </button>
{/*            <button
              className="px-4 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition"
              onClick={async () => await exportGroupedToPDF(data.grouped, supplier?.name || "")}
            >
              Export PDF
            </button>*/}
          </div>

          {/* Grouped Summary Table */}
          <h2 className="font-semibold text-lg mb-2 mt-4">FASTag Count by Bank & Class</h2>
          <div className="overflow-x-auto max-h-[60vh] rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bank</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Total Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.grouped.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">
                      No data available.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.grouped.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.bank_name}</TableCell>
                      <TableCell>{item.fastag_class}</TableCell>
                      <TableCell>{item.total_count}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
