"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function fmtSeconds(total: number) {
  const s = Math.max(0, Math.floor(total || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

export default function AdminUsageReport() {
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(() => rows.reduce((acc, r) => acc + Number(r.seconds || 0), 0), [rows]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/usage?role=admin&date=${date}`, { cache: "no-store" });
      const data = await res.json();
      if (!data?.ok) {
        setError(data?.error || "Failed to load usage");
        setRows([]);
      } else {
        setRows(Array.isArray(data.data) ? data.data : []);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load usage");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container py-8 space-y-4">
      <Link href="/admin/reports" className="text-sm px-3 py-2 border rounded hover:bg-gray-50">← Back to Reports</Link>
      <Card>
        <CardHeader>
          <CardTitle>ERP Usage (Admins)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <label className="text-sm">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
            <Button onClick={load} disabled={loading}>{loading ? "Loading..." : "Refresh"}</Button>
            <div className="ml-auto text-sm text-muted-foreground">Total: {fmtSeconds(total)}</div>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Usage (HH:MM:SS)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.user_id}>
                  <TableCell>{r.name || "—"}</TableCell>
                  <TableCell>{r.email || "—"}</TableCell>
                  <TableCell className="text-right">{fmtSeconds(Number(r.seconds || 0))}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">No data</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

