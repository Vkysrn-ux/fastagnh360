"use server"

import type { Customer } from "../types"

// Mock customer data
const mockCustomers: Customer[] = [
  {
    id: "cust-1",
    name: "Rahul Sharma",
    email: "rahul.sharma@example.com",
    phone: "9876543210",
    vehicleNumber: "DL01AB1234",
    status: "Active",
    createdAt: new Date(2023, 6, 15).toISOString(),
  },
  {
    id: "cust-2",
    name: "Priya Patel",
    email: "priya.patel@example.com",
    phone: "8765432109",
    vehicleNumber: "MH02CD5678",
    status: "Active",
    createdAt: new Date(2023, 7, 22).toISOString(),
  },
  {
    id: "cust-3",
    name: "Amit Kumar",
    email: "amit.kumar@example.com",
    phone: "7654321098",
    vehicleNumber: "KA03EF9012",
    status: "Active",
    createdAt: new Date(2023, 8, 10).toISOString(),
  },
  {
    id: "cust-4",
    name: "Sneha Gupta",
    email: "sneha.gupta@example.com",
    phone: "6543210987",
    vehicleNumber: "TN04GH3456",
    status: "Pending",
    createdAt: new Date(2023, 9, 5).toISOString(),
  },
  {
    id: "cust-5",
    name: "Vikram Singh",
    email: "vikram.singh@example.com",
    phone: "5432109876",
    vehicleNumber: "UP05IJ7890",
    status: "Active",
    createdAt: new Date(2023, 10, 18).toISOString(),
  },
  {
    id: "cust-6",
    name: "Neha Verma",
    email: "neha.verma@example.com",
    phone: "4321098765",
    vehicleNumber: "HR06KL1234",
    status: "Active",
    createdAt: new Date(2023, 11, 7).toISOString(),
  },
  {
    id: "cust-7",
    name: "Rajesh Khanna",
    email: "rajesh.khanna@example.com",
    phone: "3210987654",
    vehicleNumber: "PB07MN5678",
    status: "Pending",
    createdAt: new Date(2024, 0, 25).toISOString(),
  },
]

export async function getCustomers(): Promise<Customer[]> {
  // Simulate a delay for API call
  await new Promise((resolve) => setTimeout(resolve, 1000))

  return [...mockCustomers]
}
