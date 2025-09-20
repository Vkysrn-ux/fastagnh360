"use server";

import { pool } from "@/lib/db";
import type { AgentPerformanceData, CommissionSettings, CommissionSummaryData } from "@/lib/types";


// Type for dashboard stats
export type AdminStats = {
  totalFastags: number;
  activeFastags: number;
  totalAgents: number;
  totalSuppliers: number;
  totalEmployees: number;
  monthlyRevenue: number;
};

export async function getAdminStats(): Promise<AdminStats> {
  // 1. Total FASTags
  const [fastagRows] = await pool.query("SELECT COUNT(*) as totalFastags FROM fastags");

  // 2. Active FASTags (in_stock or assigned)
  const [activeFastagRows] = await pool.query(
    "SELECT COUNT(*) as activeFastags FROM fastags WHERE status='in_stock' OR status='assigned'"
  );

  // 3. Total Agents
  const [agentRows] = await pool.query("SELECT COUNT(*) as totalAgents FROM users WHERE role='agent'");

  // // 4. Total Users
  // const [userRows] = await pool.query("SELECT COUNT(*) as totalUsers FROM users");

  // 5. Total Employees
  const [employeeRows] = await pool.query("SELECT COUNT(*) as totalEmployees FROM users WHERE role='employee'");

  // 6. Total Suppliers
  const [supplierRows] = await pool.query("SELECT COUNT(*) as totalSuppliers FROM suppliers");

  // 7. Monthly Revenue (sum of sale_price for current month)
  const [revenueRows] = await pool.query(`
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


const commissionSummaryData: CommissionSummaryData[] = [
  {
    fastagType: "Class 4 (Car/Jeep/Van)",
    unitsSold: 132,
    totalRevenue: 548000,
    agentCommission: 38400,
    userCommission: 19200,
    netProfit: 490400,
  },
  {
    fastagType: "Class 5 (LCV)",
    unitsSold: 84,
    totalRevenue: 436800,
    agentCommission: 30576,
    userCommission: 15360,
    netProfit: 390864,
  },
  {
    fastagType: "Class 6 (Bus/Truck)",
    unitsSold: 58,
    totalRevenue: 417600,
    agentCommission: 33408,
    userCommission: 20880,
    netProfit: 363312,
  },
];

const agentPerformanceData: AgentPerformanceData[] = [
  {
    id: 1,
    name: "Sandeep Kumar",
    fastagsSold: 56,
    revenue: 224000,
    commission: 16800,
    performance: "Excellent",
  },
  {
    id: 2,
    name: "Priya Shah",
    fastagsSold: 42,
    revenue: 168000,
    commission: 11760,
    performance: "Good",
  },
  {
    id: 3,
    name: "Mohit Reddy",
    fastagsSold: 31,
    revenue: 124000,
    commission: 8680,
    performance: "Average",
  },
  {
    id: 4,
    name: "Anita Dsouza",
    fastagsSold: 28,
    revenue: 117600,
    commission: 9408,
    performance: "Needs Attention",
  },
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
