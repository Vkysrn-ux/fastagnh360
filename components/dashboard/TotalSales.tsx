import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TotalSales() {
  return (
    <Card className="col-span-1">
      <CardHeader>
        <CardTitle>Total Sales</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between">
            <span>Monthly Sales</span>
            <span className="font-bold">₹5,00,000</span>
          </div>
          <div className="flex justify-between">
            <span>Total FASTag Sold</span>
            <span className="font-bold">250</span>
          </div>
          <div className="flex justify-between">
            <span>Commission Earned</span>
            <span className="font-bold text-green-600">₹25,000</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
