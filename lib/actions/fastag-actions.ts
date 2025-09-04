"use server";

import { pool } from "@/lib/db";

export async function getAllFastags() {
  const [rows] = await pool.query(`
    SELECT 
      id,
      tag_serial,
      purchase_price,
      status,
      assigned_to_agent_id,
      CASE 
        WHEN status = 'sold' THEN 'sold'
        WHEN assigned_to_agent_id IS NOT NULL THEN 'agent'
        ELSE 'admin'
      END AS assigned_to_role
    FROM fastags
    ORDER BY created_at DESC
  `);
console.log("🚀 Fetched FASTags:", rows);
return rows as {
  id: number;
  tag_serial: string;
  purchase_price: number;
  status: string;
  assigned_to_agent_id: number | null;
  assigned_to_role: "admin" | "agent" | "sold";
}[];

}