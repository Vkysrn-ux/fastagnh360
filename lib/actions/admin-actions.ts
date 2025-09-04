"use server";

import { pool } from "@/lib/db";

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
