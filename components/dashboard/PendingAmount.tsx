import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PendingAmount() {
  return (
    <Card className="col-span-1">
      <CardHeader>
        <CardTitle>Pending Amounts</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between">
            <span>Total Pending</span>
            <span className="font-bold text-orange-600">₹1,50,000</span>
          </div>
          <div className="flex justify-between">
            <span>Pending Orders</span>
            <span className="font-bold">25</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
