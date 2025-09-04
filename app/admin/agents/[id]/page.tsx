// Folder: /app/admin/agents/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AgentDetailsPage() {
  const { id } = useParams();
  const [agent, setAgent] = useState(null);
  const [summary, setSummary] = useState(null);
  const [tags, setTags] = useState([]);

  useEffect(() => {
    const loadAgentData = async () => {
      const [agentRes, summaryRes, tagsRes] = await Promise.all([
        fetch(`/api/agents/${id}`),
        fetch(`/api/agents/${id}/summary`),
        fetch(`/api/agents/${id}/fastags`)
      ]);
      setAgent(await agentRes.json());
      setSummary(await summaryRes.json());
      setTags(await tagsRes.json());
    };
    loadAgentData();
  }, [id]);

  if (!agent) return <p>Loading agent details...</p>;

  return (
    <div className="container py-10">
      <Card>
        <CardHeader>
          <CardTitle>{agent.name} - Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p>Email: {agent.email}</p>
          <p>Phone: {agent.phone}</p>
          <p>Status: <Badge>{agent.status}</Badge></p>
          <p>Commission: {agent.commission_rate}%</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 mt-6">
        <Card>
          <CardHeader><CardTitle>FASTag Summary</CardTitle></CardHeader>
          <CardContent>
            <ul>
              <li>Total Assigned: {summary.total}</li>
              <li>Sold: {summary.sold}</li>
              <li>Available: {summary.available}</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Commission</CardTitle></CardHeader>
          <CardContent>
            <ul>
              <li>Total Earned: ₹{summary.totalCommission}</li>
              <li>Pending: ₹{summary.pendingCommission}</li>
              <li>Paid: ₹{summary.paidCommission}</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Assigned FASTags</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serial</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Batch</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tags.map(tag => (
                  <TableRow key={tag.id}>
                    <TableCell>{tag.tag_serial}</TableCell>
                    <TableCell>{tag.fastag_class}</TableCell>
                    <TableCell><Badge>{tag.status}</Badge></TableCell>
                    <TableCell>{tag.batch_number}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
