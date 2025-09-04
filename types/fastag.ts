// types/fastag.ts

export type Fastag = {
  id: number;
  tag_serial: string;
  supplier_id: number;
  purchase_date: string; // ISO date
  purchase_price: number;
  status: 'in_stock' | 'assigned' | 'sold' | 'deactivated';
  assigned_to_agent_id: number | null;
  assigned_date: string | null;
  remarks: string | null;
  created_at: string;
};
