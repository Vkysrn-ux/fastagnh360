"use client";

import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SupplierProductTable({ supplierId }) {
  const [products, setProducts] = useState([]);
  const [filterBank, setFilterBank] = useState("all");
  const [filterClass, setFilterClass] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/suppliers/${supplierId}/products`)
      .then(res => res.json())
      .then(data => setProducts(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
      
  }, [supplierId]);

  // Extract unique banks and classes for filters
  const uniqueBanks = Array.from(new Set(products.map(p => p.bank_name))).filter(Boolean);
  const uniqueClasses = Array.from(new Set(products.map(p => p.fastag_class))).filter(Boolean);

  // Filtered products
  const filtered = products.filter(p =>
    (filterBank === "all" || p.bank_name === filterBank) &&
    (filterClass === "all" || p.fastag_class === filterClass)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Supplier FASTag Products</CardTitle>
        <div className="flex flex-wrap gap-4 mt-4">
          <div>
            <Select value={filterBank} onValueChange={setFilterBank}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Banks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Banks</SelectItem>
                {uniqueBanks.map(b => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {uniqueClasses.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No products found.</div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serial</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Purchase Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Purchase Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(tag => (
                  <TableRow key={tag.id}>
                    <TableCell>{tag.tag_serial}</TableCell>
                    <TableCell>{tag.bank_name}</TableCell>
                    <TableCell>{tag.fastag_class}</TableCell>
                    <TableCell>{tag.batch_number}</TableCell>
                    <TableCell>{tag.purchase_price}</TableCell>
                    <TableCell>{tag.status}</TableCell>
                    <TableCell>{tag.purchase_date ? tag.purchase_date.slice(0, 10) : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
