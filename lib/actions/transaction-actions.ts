"use server"

import type { Transaction } from "../types"

// Mock transaction data
const mockTransactions: Transaction[] = [
  {
    id: "txn-1",
    customerName: "Rahul Sharma",
    bankName: "HDFC Bank",
    fastagType: "Car/Jeep/Van",
    amount: 500,
    date: new Date(2023, 11, 15).toISOString(),
    status: "Completed",
  },
  {
    id: "txn-2",
    customerName: "Priya Patel",
    bankName: "ICICI Bank",
    fastagType: "Car/Jeep/Van",
    amount: 499,
    date: new Date(2023, 11, 18).toISOString(),
    status: "Completed",
  },
  {
    id: "txn-3",
    customerName: "Amit Kumar",
    bankName: "SBI",
    fastagType: "Bus/Truck",
    amount: 650,
    date: new Date(2023, 11, 20).toISOString(),
    status: "Completed",
  },
  {
    id: "txn-4",
    customerName: "Sneha Gupta",
    bankName: "Axis Bank",
    fastagType: "LCV",
    amount: 550,
    date: new Date(2023, 11, 25).toISOString(),
    status: "Pending",
  },
  {
    id: "txn-5",
    customerName: "Vikram Singh",
    bankName: "Paytm Payments Bank",
    fastagType: "Car/Jeep/Van",
    amount: 475,
    date: new Date(2023, 11, 28).toISOString(),
    status: "Completed",
  },
  {
    id: "txn-6",
    customerName: "Neha Verma",
    bankName: "HDFC Bank",
    fastagType: "Multi-Axle Vehicle",
    amount: 750,
    date: new Date(2024, 0, 2).toISOString(),
    status: "Failed",
  },
  {
    id: "txn-7",
    customerName: "Rajesh Khanna",
    bankName: "Kotak Mahindra Bank",
    fastagType: "Car/Jeep/Van",
    amount: 525,
    date: new Date(2024, 0, 5).toISOString(),
    status: "Completed",
  },
]

export async function getRecentTransactions(): Promise<Transaction[]> {
  // Simulate a delay for API call
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // Sort by date (newest first) and return the most recent transactions
  return [...mockTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
