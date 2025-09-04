// @/lib/types.ts

// User roles in the system
export type UserRole =
  | "admin"
  | "manager"
  | "employee"
  | "agent"
  | "shop_owner"
  | "toll-agent"
  | "team-leader"
  | "executive"
  | "shop";

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
  assigned_to_user_id: number | null;         // Assigned to any user (agent, shop, etc.)
  assigned_to_user_name?: string | null;      // For UI
  assigned_to_role?: UserRole | null;         // For logic/UI
  assigned_date?: string | null;              // ISO date string
  current_holder?: string | null;             // Optional for UI: who currently holds this tag
}

