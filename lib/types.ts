// @/lib/types.ts

// User roles in the system
export type UserRole =
  | "admin"
  | "agent"
  | "asm"
  | "channel-partner"
  | "employee"
  | "executive"
  | "fse"
  | "manager"
  | "office"
  | "shop"
  | "shop_owner"
  | "showroom"
  | "team-leader"
  | "tl"
  | "toll-agent";

// Status options for users
export type UserStatus = "active" | "inactive";

// Base user/agent/shop definition
export interface Agent {
  id: number;
  name: string;
  email?: string | null;
  phone: string;
  pincode: string;
  address?: string | null;
  role: UserRole;
  status: UserStatus;
  parent_user_id?: number | null; // For hierarchy
  parent_name?: string | null;    // For UI
  parent_role?: UserRole | null;  // For UI
  fastags_available?: number;     // Optional: Count of FASTags
  commission_rate?: number;       // Optional: Custom commission %
  created_at?: string;            // ISO date string
  updated_at?: string;            // ISO date string
}

// FASTag status
export type FastagStatus = "in_stock" | "assigned" | "sold" | "deactivated";

// FASTag item/record definition
export interface FastagItem {
  id: number;
  tag_serial: string;
  status: FastagStatus;
  purchase_price: number;
  assigned_to_agent_id?: number | null;
  assigned_to_user_id?: number | null;         // Assigned to any user (agent, shop, etc.)
  assigned_to_user_name?: string | null;      // For UI
  assigned_to_role?: UserRole | null;         // For logic/UI
  assigned_date?: string | null;              // ISO date string
  current_holder?: string | null;             // Optional for UI: who currently holds this tag
}

export interface CommissionSummaryData {
  fastagType: string;
  unitsSold: number;
  totalRevenue: number;
  agentCommission: number;
  userCommission: number;
  netProfit: number;
}

export interface AgentPerformanceData {
  id: number;
  name: string;
  fastagsSold: number;
  revenue: number;
  commission: number;
  performance: "Excellent" | "Good" | "Average" | "Needs Attention";
}

export interface CommissionRate {
  fastagType: string;
  rate: number;
}

export interface CommissionSettings {
  defaultAgentCommission: number;
  defaultUserCommission: number;
  agentCommissions: CommissionRate[];
  userCommissions: CommissionRate[];
}
export type PortalDashboard = "admin" | "agent" | "employee";

export interface PortalUser {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string | null;
  dashboard: PortalDashboard;
  parent_id?: number | null;
  created_at?: string | null;
}

// Agent dashboard stats
export interface AgentStats {
  totalInventory: number;      // current assigned stock
  availableFastags: number;    // alias of assigned stock for now
  soldFastags: number;         // total sold handled by this agent
  totalCustomers: number;      // distinct customers served
  monthlySales: number;        // sum of sales value this month
}

