// app/admin/fastags/transfer/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getAdminSession } from "@/lib/actions/auth-actions";

export default function FastagTransferPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<any[]>([]);
  const [fromAgent, setFromAgent] = useState("");
  const [toAgent, setToAgent] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [classType, setClassType] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      const session = await getAdminSession();
      if (!session) return router.push("/admin/login");
      const res = await fetch("/api/agents");
      const data = await res.json();
      setAgents(data);
    };
    load();
  }, [router]);

  const handleTransfer = async () => {
    if (!fromAgent || !toAgent || !classType || !batchNumber) {
      setMessage("All fields are required.");
      return;
    }

    const res = await fetch("/api/fastags/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_agent_id: fromAgent,
        to_agent_id: toAgent,
        class_type: classType,
        batch_number: batchNumber,
      }),
    });

    const result = await res.json();
    if (result.success) {
      setMessage(`Successfully transferred ${result.transferred} FASTag(s).`);
    } else {
      setMessage(result.error || "Transfer failed.");
    }
  };

  return (
    <div className="container py-10">
      <Card>
        <CardHeader>
          <CardTitle>Transfer FASTags Between Agents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>From Agent</Label>
            <Select onValueChange={setFromAgent}>
              <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
              <SelectContent>
                {agents.map(agent => (
                  <SelectItem key={agent.id} value={agent.id.toString()}>{agent.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>To Agent</Label>
            <Select onValueChange={setToAgent}>
              <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
              <SelectContent>
                {agents.map(agent => (
                  <SelectItem key={agent.id} value={agent.id.toString()}>{agent.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>FASTag Class</Label>
            <Input placeholder="e.g., Class 4" value={classType} onChange={(e) => setClassType(e.target.value)} />
          </div>

          <div>
            <Label>Batch Number</Label>
            <Input placeholder="e.g., BATCH-001" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} />
          </div>

          <Button onClick={handleTransfer}>Transfer FASTags</Button>
          {message && <p className="text-sm text-muted-foreground pt-2">{message}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
