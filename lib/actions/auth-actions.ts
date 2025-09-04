"use server"

import { cookies } from "next/headers"
import { loginUserServer } from "@/lib/server/login-user"

// Mock agent data
const mockAgents = [
  {
    id: "agent-1",
    email: "agent@example.com",
    password: "password123", // In a real app, this would be hashed
    name: "John Doe",
    phone: "9876543210",
    address: "123 Agent Street, Delhi",
    status: "Active",
    commissionRate: 10,
  },
]

// Mock admin data
const mockAdmins = [
  {
    id: "admin-1",
    email: "admin@nh360fastag.com",
    password: "admin123", // In a real app, this would be hashed
    name: "Admin User",
    role: "Super Admin",
  },
]

// Mock employee data
const mockEmployees = [
  {
    id: "emp-1",
    email: "employee@nh360fastag.com",
    password: "employee123", // In a real app, this would be hashed
    name: "Employee User",
    phone: "8765432109",
    role: "Sales Executive",
    status: "Active",
  },
]

// Mock user data
const mockUsers = [
  {
    id: "user-1",
    email: "user@example.com",
    password: "user123", // In a real app, this would be hashed
    name: "Regular User",
    phone: "7654321098",
    vehicleNumber: "DL01AB1234",
    status: "Active",
  },
]

// Unified login function
export async function loginUser(email: string, password: string) {
  // Simulate a delay for API call
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // Only real DB-backed login (no mock fallback)
  const dbRes = await loginUserServer(email, password)
  return dbRes
}

export async function logoutUser() {
  const cookieStore = cookies()
  cookieStore.delete("user-session")
  return { success: true }
}

export async function getUserSession() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get("user-session")

  if (!sessionCookie) {
    return null
  }

  try {
    return JSON.parse(sessionCookie.value)
  } catch (error) {
    return null
  }
}

// Legacy functions for backward compatibility
export async function loginAgent(email: string, password: string) {
  const result = await loginUser(email, password)
  if (result.success && result.userType === "agent") {
    return { success: true, agent: { id: "agent-1", name: "John Doe", email: email } }
  }
  return { success: false, message: "Invalid agent credentials" }
}

export async function loginAdmin(email: string, password: string) {
  const result = await loginUser(email, password)
  if (result.success && result.userType === "admin") {
    return { success: true, admin: { id: "admin-1", name: "Admin User", email: email, role: "Super Admin" } }
  }
  return { success: false, message: "Invalid admin credentials" }
}

export async function loginEmployee(email: string, password: string) {
  const result = await loginUser(email, password)
  if (result.success && result.userType === "employee") {
    return {
      success: true,
      employee: { id: "emp-1", name: "Employee User", email: email, role: "Sales Executive" },
    }
  }
  return { success: false, message: "Invalid employee credentials" }
}

export async function logoutAgent() {
  return logoutUser()
}

export async function logoutAdmin() {
  return logoutUser()
}

export async function logoutEmployee() {
  return logoutUser()
}

export async function getAgentSession() {
  const session = await getUserSession()
  return session?.userType === "agent" ? session : null
}

export async function getAdminSession() {
  const session = await getUserSession()
  return session?.userType === "admin" ? session : null
}

export async function getEmployeeSession() {
  const session = await getUserSession()
  return session?.userType === "employee" ? session : null
}
