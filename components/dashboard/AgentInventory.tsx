import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AgentInventory() {
  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle>My Inventory</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between">
            <span>Available FASTag</span>
            <span className="font-bold">50</span>
          </div>
          <div className="flex justify-between">
            <span>Assigned FASTag</span>
            <span className="font-bold">150</span>
          </div>
          <div className="flex justify-between">
            <span>Sold FASTag</span>
            <span className="font-bold text-green-600">100</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}