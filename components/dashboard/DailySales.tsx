import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DailySales() {
  return (
    <Card className="col-span-1">
      <CardHeader>
        <CardTitle>Daily Sales</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Add your daily sales chart/data here */}
        <div className="space-y-4">
          {/* Sample content - replace with actual data */}
          <div className="flex justify-between">
            <span>Today's Sales</span>
            <span className="font-bold">₹25,000</span>
          </div>
          <div className="flex justify-between">
            <span>Orders</span>
            <span className="font-bold">15</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
