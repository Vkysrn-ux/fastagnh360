import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AgentInventory() {
  const [data, setData] = React.useState({ availableFastags: 0, totalInventory: 0, soldFastags: 0 });
  React.useEffect(() => {
    fetch('/api/agent/stats')
      .then(r => r.json())
      .then(d => setData({
        availableFastags: Number(d?.availableFastags || 0),
        totalInventory: Number(d?.totalInventory || 0),
        soldFastags: Number(d?.soldFastags || 0),
      }))
      .catch(() => setData({ availableFastags: 0, totalInventory: 0, soldFastags: 0 }));
  }, []);

  return (
    <Card className="col-span-1">
      <CardHeader>
        <CardTitle>My Inventory</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between">
            <span>Available FASTag</span>
            <span className="font-bold">{data.availableFastags}</span>
          </div>
          <div className="flex justify-between">
            <span>Assigned FASTag</span>
            <span className="font-bold">{data.totalInventory}</span>
          </div>
          <div className="flex justify-between">
            <span>Sold FASTag</span>
            <span className="font-bold text-green-600">{data.soldFastags}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
