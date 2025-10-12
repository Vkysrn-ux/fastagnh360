"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type FastagRow = {
  id: number;
  tag_serial: string;
  bank_name: string;
  fastag_class: string;
  status: string;
  bank_mapping_status?: string;
  mapping_done?: boolean;
};

export default function UserFastagsPage() {
  const [session, setSession] = useState<{ id: number; name?: string } | null>(null);
  const [rows, setRows] = useState<FastagRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Load user session
        const sres = await fetch('/api/auth/session', { cache: 'no-store' });
        const sdata = await sres.json();
        const s = sdata?.session;
        if (!s || s.userType !== 'user' || !s.id) { setSession(null); setLoading(false); return; }
        setSession({ id: s.id, name: s.name });

        // Fetch only mapping-done fastags belonging to this user
        const params = new URLSearchParams();
        params.set('owner', String(s.id));
        params.set('mapping', 'done');
        const fres = await fetch(`/api/fastags?${params.toString()}`, { cache: 'no-store' });
        const data = await fres.json();
        const list: FastagRow[] = Array.isArray(data) ? data : [];
        setRows(list);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(r =>
      r.tag_serial.toLowerCase().includes(term) ||
      r.bank_name.toLowerCase().includes(term) ||
      r.fastag_class.toLowerCase().includes(term) ||
      r.status.toLowerCase().includes(term)
    );
  }, [rows, q]);

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>My FASTags</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="text-sm text-muted-foreground">
              {loading ? 'Loading…' : `Showing ${filtered.length} FASTags (mapping done)`}
            </div>
            <Input
              placeholder="Search barcode, bank, class, status"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-72"
            />
          </div>
          {filtered.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              {loading ? 'Loading your FASTags…' : 'No FASTags found.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Barcode</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono">{r.tag_serial}</TableCell>
                      <TableCell>{r.bank_name}</TableCell>
                      <TableCell>{r.fastag_class}</TableCell>
                      <TableCell className="capitalize">{r.status?.replace('_',' ')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

