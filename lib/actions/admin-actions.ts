"use server";

import { pool } from "@/lib/db";
import type {
  AgentPerformanceData,
  CommissionSettings,
  CommissionSummaryData,
  PortalDashboard,
  PortalUser,
} from "@/lib/types";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

// ======================
// Roles + Constants
// ======================

const PORTAL_ROLES = [
  "admin",
  "asm",
  "manager",
  "employee",
  "agent",
  "team-leader",
  "tl",
  "toll-agent",
  "channel-partner",
  "fse",
  "shop",
  "shop_owner",
  "showroom",
  "executive",
  "office",
];

const AGENT_PORTAL_ROLES = new Set<string>([
  "agent",
  "asm",
  "manager",
  "team-leader",
  "tl",
  "toll-agent",
  "channel-partner",
  "fse",
  "shop",
  "shop_owner",
  "showroom",
  "executive",
  "office",
]);

const PORTAL_ROLE_SET = new Set(PORTAL_ROLES);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ======================
// Types
// ======================

type UserRow = RowDataPacket & {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  status: string | null;
  dashboard?: string | null;
  parent_id?: number | null;
  created_at?: Date | string | null;
};

const DB_STATUS_BY_KEY: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  pending: "Pending",
};

// ======================
// Helpers + Retry Logic
// ======================

function normalizeRole(role: string | null | undefined): string {
  return (role ?? "").trim().toLowerCase();
}

function resolveDashboard(role: string | null | undefined): PortalDashboard {
  const normalized = normalizeRole(role);
  if (normalized === "admin") return "admin";
  if (normalized === "employee") return "employee";
  if (AGENT_PORTAL_ROLES.has(normalized)) return "agent";
  return "agent";
}

function mapUserRow(row: UserRow): PortalUser {
  const normalizedRole = normalizeRole(row.role);
  const rawStatus = row.status ?? null;
  const statusValue = rawStatus ? rawStatus.trim() : null;

  const created = row.created_at;
  let createdAt: string | null = null;
  if (created instanceof Date) {
    createdAt = created.toISOString();
  } else if (typeof created === "string" && created) {
    const parsed = new Date(created);
    createdAt = Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  return {
    id: Number(row.id),
    name: row.name ?? "",
    email: row.email ?? null,
    phone: row.phone ?? null,
    role: normalizedRole,
    status: statusValue,
    dashboard: (row.dashboard as PortalDashboard) ?? resolveDashboard(normalizedRole),
    parent_id: row.parent_id ?? null,
    created_at: createdAt,
  };
}

function toDbStatus(status: string | null | undefined): string {
  const key = normalizeRole(status);
  return DB_STATUS_BY_KEY[key] ?? DB_STATUS_BY_KEY.active;
}

function generatePortalPassword(): string {
  const seed = randomBytes(6).toString("base64url").replace(/[^a-zA-Z0-9]/g, "");
  const base = (seed + "NH360FASTAG").slice(0, 8);
  return `Nh${base}#1`;
}

async function withRetry<T>(operation: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if (retries === 0 || !isRetryableError(error)) {
      throw error;
    }
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(operation, retries - 1, delay * 2);
  }
}

function isRetryableError(error: any): boolean {
  const retryableCodes = new Set([
    'ECONNREFUSED',
    'EHOSTUNREACH',
    'ETIMEDOUT',
    'ENOTFOUND',
    'PROTOCOL_CONNECTION_LOST',
    'ER_CON_COUNT_ERROR'
  ]);
  return retryableCodes.has(error.code);
}

async function executeQuery<T>(query: string, params?: any[]): Promise<T> {
  return withRetry(async () => {
    const conn = await pool.getConnection();
    try {
      const [result] = await conn.query<T>(query, params);
      return result;
    } finally {
      conn.release();
    }
  });
}

// ======================
// Create Portal User
// ======================

export interface CreatePortalUserInput {
  name: string;
  email: string;
  phone?: string;
  role: string;
  status?: string;
  password?: string;
  parent_id?: number | null;
}

export type CreatePortalUserResult =
  | { success: true; user: PortalUser; generatedPassword?: string }
  | { success: false, error: string };

export async function createPortalUser(input: CreatePortalUserInput): Promise<CreatePortalUserResult> {
  const name = (input.name ?? "").trim();
  const email = (input.email ?? "").trim().toLowerCase();
  const phone = (input.phone ?? "").trim();
  const role = normalizeRole(input.role);
  const status = (input.status ?? "active").trim();
  const rawPassword = (input.password ?? "").trim();

  if (!name) return { success: false, error: "Name is required." };
  if (!email) return { success: false, error: "Email is required." };
  if (!EMAIL_PATTERN.test(email)) return { success: false, error: "Enter a valid email address." };
  if (!PORTAL_ROLE_SET.has(role)) return { success: false, error: "Unsupported role for portal access." };

  const passwordToUse = rawPassword || generatePortalPassword();
  const hashedPassword = await bcrypt.hash(passwordToUse, 10);
  const dbStatus = toDbStatus(status);
  const phoneValue = phone || null;
  const dashboard = resolveDashboard(role);

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [result] = await conn.query<ResultSetHeader>(
      "INSERT INTO users (name, email, phone, role, status, password, dashboard, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [name, email, phoneValue, role, dbStatus, hashedPassword, dashboard, input.parent_id ?? null],
    );

    const userId = Number((result as ResultSetHeader).insertId);
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT id, name, email, phone, role, status, dashboard, parent_id, created_at FROM users WHERE id = ?",
      [userId],
    );

    await conn.commit();

    const userRow = (rows as UserRow[])[0];
    if (!userRow) return { success: false, error: "Unable to read user after creation." };

    return {
      success: true,
      user: mapUserRow(userRow),
      generatedPassword: rawPassword ? undefined : passwordToUse,
    };
  } catch (error: any) {
    await conn.rollback();
    if (error?.code === "ER_DUP_ENTRY") {
      return { success: false, error: "Email or phone already exists." };
    }
    console.error("createPortalUser error:", error);
    return { success: false, error: "Unable to create user. Please try again." };
  } finally {
    conn.release();
  }
}

// ======================
// Users
// ======================

export async function getAllUsers(): Promise<PortalUser[]> {
  try {
    const rows = await executeQuery<RowDataPacket[]>(
      "SELECT id, name, email, phone, role, status, dashboard, parent_id, created_at FROM users"
    );
    return (rows as UserRow[]).map(mapUserRow);
  } catch (error) {
    console.error("Failed to get users:", error);
    throw new Error("Unable to fetch users. Please try again later.");
  }
}

export async function getScopedUsers(currentUserId: number, currentRole: string): Promise<PortalUser[]> {
  try {
    if (currentRole === "admin") {
      return getAllUsers();
    }

    if (currentRole === "asm") {
      const rows = await executeQuery<RowDataPacket[]>(
        `WITH RECURSIVE user_hierarchy AS (
           SELECT id, name, email, phone, role, status, dashboard, parent_id, created_at
           FROM users WHERE id = ?
           UNION ALL
           SELECT u.id, u.name, u.email, u.phone, u.role, u.status, u.dashboard, u.parent_id, u.created_at
           FROM users u
           INNER JOIN user_hierarchy h ON u.parent_id = h.id
         )
         SELECT * FROM user_hierarchy`,
        [currentUserId]
      );
      return (rows as UserRow[]).map(mapUserRow);
    }

    const rows = await executeQuery<RowDataPacket[]>(
      "SELECT id, name, email, phone, role, status, dashboard, parent_id, created_at FROM users WHERE id = ?",
      [currentUserId]
    );
    return (rows as UserRow[]).map(mapUserRow);
  } catch (error) {
    console.error("Failed to get scoped users:", error);
    throw new Error("Unable to fetch users. Please try again later.");
  }
}

// ======================
// Update Portal User
// ======================

export interface UpdatePortalUserInput {
  id: number;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  status?: string;
  dashboard?: PortalDashboard;
  parent_id?: number | null;
}

export type UpdatePortalUserResult = 
  | { success: true; user: PortalUser }
  | { success: false, error: string };

export async function updatePortalUser(input: UpdatePortalUserInput): Promise<UpdatePortalUserResult> {
  const id = Number(input.id);
  if (!id || isNaN(id)) {
    return { success: false, error: "Invalid user ID." };
  }

  // Validate email if provided
  if (input.email && !EMAIL_PATTERN.test(input.email.trim())) {
    return { success: false, error: "Enter a valid email address." };
  }

  // Validate role if provided
  if (input.role && !PORTAL_ROLE_SET.has(normalizeRole(input.role))) {
    return { success: false, error: "Unsupported role for portal access." };
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: any[] = [];

    if (input.name !== undefined) {
      updates.push("name = ?");
      values.push(input.name.trim());
    }
    if (input.email !== undefined) {
      updates.push("email = ?");
      values.push(input.email.trim().toLowerCase());
    }
    if (input.phone !== undefined) {
      updates.push("phone = ?");
      values.push(input.phone.trim() || null);
    }
    if (input.role !== undefined) {
      updates.push("role = ?");
      values.push(normalizeRole(input.role));
    }
    if (input.status !== undefined) {
      updates.push("status = ?");
      values.push(toDbStatus(input.status));
    }
    if (input.dashboard !== undefined) {
      updates.push("dashboard = ?");
      values.push(input.dashboard);
    }
    if (input.parent_id !== undefined) {
      updates.push("parent_id = ?");
      values.push(input.parent_id);
    }

    if (updates.length === 0) {
      return { success: false, error: "No fields to update." };
    }

    // Add ID to values array
    values.push(id);

    // Execute update
    await conn.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    // Fetch updated user
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT id, name, email, phone, role, status, dashboard, parent_id, created_at FROM users WHERE id = ?",
      [id]
    );

    await conn.commit();

    const userRow = (rows as UserRow[])[0];
    if (!userRow) return { success: false, error: "User not found." };

    return {
      success: true,
      user: mapUserRow(userRow)
    };

  } catch (error: any) {
    await conn.rollback();
    if (error?.code === "ER_DUP_ENTRY") {
      return { success: false, error: "Email or phone already exists." };
    }
    console.error("updatePortalUser error:", error);
    return { success: false, error: "Unable to update user. Please try again." };
  } finally {
    conn.release();
  }
}

// ======================
// FASTags
// ======================

export async function getScopedFastags(currentUserId: number, currentRole: string) {
  if (currentRole === "admin") {
    const [rows] = await pool.query("SELECT * FROM fastags");
    return rows;
  }

  if (currentRole === "asm") {
    const [userIds] = await pool.query<RowDataPacket[]>(
      `WITH RECURSIVE user_hierarchy AS (
         SELECT id FROM users WHERE id = ?
         UNION ALL
         SELECT u.id FROM users u INNER JOIN user_hierarchy h ON u.parent_id = h.id
       )
       SELECT id FROM user_hierarchy`,
      [currentUserId]
    );

    const ids = (userIds as any[]).map((u) => u.id);
    if (!ids.length) return [];

    const [rows] = await pool.query("SELECT * FROM fastags WHERE assigned_user_id IN (?)", [ids]);
    return rows;
  }

  const [rows] = await pool.query("SELECT * FROM fastags WHERE assigned_user_id = ?", [currentUserId]);
  return rows;
}

// ======================
// Stats
// ======================

export type ScopedStats = {
  totalFastags: number;
  activeFastags: number;
  totalAgents: number;
  totalEmployees: number;
  totalSuppliers?: number;
  monthlyRevenue: number;
};

export async function getScopedStats(currentUserId: number, currentRole: string): Promise<ScopedStats> {
  if (currentRole === "admin") {
    const [fastagRows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) as totalFastags FROM fastags");
    const [activeFastagRows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) as activeFastags FROM fastags WHERE status='in_stock' OR status='assigned'"
    );
    const [agentRows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) as totalAgents FROM users WHERE role='agent'");
    const [employeeRows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) as totalEmployees FROM users WHERE role='employee'");
    const [supplierRows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) as totalSuppliers FROM suppliers");
    const [revenueRows] = await pool.query<RowDataPacket[]>(`
      SELECT IFNULL(SUM(sale_price), 0) as monthlyRevenue
      FROM sales
      WHERE MONTH(sale_date) = MONTH(CURRENT_DATE()) AND YEAR(sale_date) = YEAR(CURRENT_DATE())
    `);

    return {
      totalFastags: fastagRows[0].totalFastags,
      activeFastags: activeFastagRows[0].activeFastags,
      totalAgents: agentRows[0].totalAgents,
      totalEmployees: employeeRows[0].totalEmployees,
      totalSuppliers: supplierRows[0].totalSuppliers,
      monthlyRevenue: revenueRows[0].monthlyRevenue,
    };
  }

  if (currentRole === "asm") {
    const [userIds] = await pool.query<RowDataPacket[]>(
      `WITH RECURSIVE user_hierarchy AS (
         SELECT id FROM users WHERE id = ?
         UNION ALL
         SELECT u.id FROM users u INNER JOIN user_hierarchy h ON u.parent_id = h.id
       )
       SELECT id FROM user_hierarchy`,
      [currentUserId]
    );
    const ids = (userIds as any[]).map((u) => u.id);
    if (!ids.length) return { totalFastags: 0, activeFastags: 0, totalAgents: 0, totalEmployees: 0, monthlyRevenue: 0 };

    const [fastagRows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) as totalFastags FROM fastags WHERE assigned_user_id IN (?)", [ids]);
    const [activeFastagRows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) as activeFastags FROM fastags WHERE (status='in_stock' OR status='assigned') AND assigned_user_id IN (?)", [ids]);
    const [agentRows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) as totalAgents FROM users WHERE role='agent' AND id IN (?)", [ids]);
    const [employeeRows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) as totalEmployees FROM users WHERE role='employee' AND id IN (?)", [ids]);
    const [revenueRows] = await pool.query<RowDataPacket[]>(`
      SELECT IFNULL(SUM(s.sale_price), 0) as monthlyRevenue
      FROM sales s
      JOIN fastags f ON s.fastag_id = f.id
      WHERE f.assigned_user_id IN (?)
        AND MONTH(s.sale_date) = MONTH(CURRENT_DATE())
        AND YEAR(s.sale_date) = YEAR(CURRENT_DATE())
    `, [ids]);

    return {
      totalFastags: fastagRows[0].totalFastags,
      activeFastags: activeFastagRows[0].activeFastags,
      totalAgents: agentRows[0].totalAgents,
      totalEmployees: employeeRows[0].totalEmployees,
      monthlyRevenue: revenueRows[0].monthlyRevenue,
    };
  }

  const [fastagRows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) as totalFastags FROM fastags WHERE assigned_user_id = ?", [currentUserId]);
  const [activeFastagRows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) as activeFastags FROM fastags WHERE (status='in_stock' OR status='assigned') AND assigned_user_id = ?", [currentUserId]);
  const [revenueRows] = await pool.query<RowDataPacket[]>(`
    SELECT IFNULL(SUM(s.sale_price), 0) as monthlyRevenue
    FROM sales s
    JOIN fastags f ON s.fastag_id = f.id
    WHERE f.assigned_user_id = ?
      AND MONTH(s.sale_date) = MONTH(CURRENT_DATE())
      AND YEAR(s.sale_date) = YEAR(CURRENT_DATE())
  `, [currentUserId]);

  return {
    totalFastags: fastagRows[0].totalFastags,
    activeFastags: activeFastagRows[0].activeFastags,
    totalAgents: 0,
    totalEmployees: 0,
    monthlyRevenue: revenueRows[0].monthlyRevenue,
  };
}

// ======================
// Commission (Static)
// ======================

const commissionSummaryData: CommissionSummaryData[] = [
  { fastagType: "Class 4 (Car/Jeep/Van)", unitsSold: 132, totalRevenue: 548000, agentCommission: 38400, userCommission: 19200, netProfit: 490400 },
  { fastagType: "Class 5 (LCV)", unitsSold: 84, totalRevenue: 436800, agentCommission: 30576, userCommission: 15360, netProfit: 390864 },
  { fastagType: "Class 6 (Bus/Truck)", unitsSold: 58, totalRevenue: 417600, agentCommission: 33408, userCommission: 20880, netProfit: 363312 },
];

const agentPerformanceData: AgentPerformanceData[] = [
  { id: 1, name: "Sandeep Kumar", fastagsSold: 56, revenue: 224000, commission: 16800, performance: "Excellent" },
  { id: 2, name: "Priya Shah", fastagsSold: 42, revenue: 168000, commission: 11760, performance: "Good" },
  { id: 3, name: "Mohit Reddy", fastagsSold: 31, revenue: 124000, commission: 8680, performance: "Average" },
  { id: 4, name: "Anita Dsouza", fastagsSold: 28, revenue: 117600, commission: 9408, performance: "Needs Attention" },
];

let commissionSettingsState: CommissionSettings = {
  defaultAgentCommission: 7.5,
  defaultUserCommission: 3,
  agentCommissions: [
    { fastagType: "Class 4 (Car/Jeep/Van)", rate: 7.5 },
    { fastagType: "Class 5 (LCV)", rate: 7.0 },
    { fastagType: "Class 6 (Bus/Truck)", rate: 8.0 },
    { fastagType: "Class 7 (Multi-Axle)", rate: 8.5 },
  ],
  userCommissions: [
    { fastagType: "Class 4 (Car/Jeep/Van)", rate: 3.0 },
    { fastagType: "Class 5 (LCV)", rate: 2.5 },
    { fastagType: "Class 6 (Bus/Truck)", rate: 2.75 },
    { fastagType: "Class 7 (Multi-Axle)", rate: 3.25 },
  ],
};

export async function getCommissionSummary(): Promise<CommissionSummaryData[]> {
  return commissionSummaryData.map((row) => ({ ...row }));
}

export async function getAgentPerformance(): Promise<AgentPerformanceData[]> {
  return agentPerformanceData.map((row) => ({ ...row }));
}

export async function getCommissionSettings(): Promise<CommissionSettings> {
  return {
    ...commissionSettingsState,
    agentCommissions: commissionSettingsState.agentCommissions.map((row) => ({ ...row })),
    userCommissions: commissionSettingsState.userCommissions.map((row) => ({ ...row })),
  };
}

export async function updateCommissionSettings(settings: CommissionSettings): Promise<void> {
  commissionSettingsState = {
    ...settings,
    agentCommissions: settings.agentCommissions.map((row) => ({ ...row })),
    userCommissions: settings.userCommissions.map((row) => ({ ...row })),
  };
}

// ======================
// Update User
// ======================

export interface UpdateUserInput {
  id: number;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  status?: string;
  dashboard?: PortalDashboard;
  parent_id?: number | null;
}

export type UpdateUserResult = 
  | { success: true; user: PortalUser }
  | { success: false, error: string };

export async function updateUser(input: UpdateUserInput): Promise<UpdateUserResult> {
  const id = Number(input.id);
  if (!id || isNaN(id)) {
    return { success: false, error: "Invalid user ID" };
  }

  // Validate email if provided
  if (input.email && !EMAIL_PATTERN.test(input.email.trim())) {
    return { success: false, error: "Invalid email format" };
  }

  // Validate role if provided
  if (input.role && !PORTAL_ROLE_SET.has(normalizeRole(input.role))) {
    return { success: false, error: "Invalid role" };
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: any[] = [];

    if (input.name !== undefined) {
      updates.push("name = ?");
      values.push(input.name.trim());
    }
    if (input.email !== undefined) {
      updates.push("email = ?");
      values.push(input.email.trim().toLowerCase());
    }
    if (input.phone !== undefined) {
      updates.push("phone = ?");
      values.push(input.phone.trim());
    }
    if (input.role !== undefined) {
      updates.push("role = ?");
      values.push(normalizeRole(input.role));
    }
    if (input.status !== undefined) {
      updates.push("status = ?");
      values.push(toDbStatus(input.status));
    }
    if (input.dashboard !== undefined) {
      updates.push("dashboard = ?");
      values.push(input.dashboard);
    }
    if (input.parent_id !== undefined) {
      updates.push("parent_id = ?");
      values.push(input.parent_id);
    }

    if (updates.length === 0) {
      return { success: false, error: "No fields to update" };
    }

    // Add ID to values array
    values.push(id);

    // Execute update
    await conn.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    // Fetch updated user
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT id, name, email, phone, role, status, dashboard, parent_id, created_at FROM users WHERE id = ?",
      [id]
    );

    await conn.commit();

    const userRow = (rows as UserRow[])[0];
    if (!userRow) {
      return { success: false, error: "User not found" };
    }

    return {
      success: true,
      user: mapUserRow(userRow)
    };

  } catch (error: any) {
    await conn.rollback();
    if (error?.code === "ER_DUP_ENTRY") {
      return { success: false, error: "Email or phone already exists" };
    }
    console.error("Update user error:", error);
    return { success: false, error: "Failed to update user" };
  } finally {
    conn.release();
  }
}


