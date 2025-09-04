"use server"

import type { CustomerSummaryData } from "../types"

export async function getEmployeeStats() {
  // Simulate a delay for API call
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // Return mock data
  return {
    assignedFastags: 75,
    availableFastags: 45,
    totalCustomers: 30,
    monthlySales: 15000,
  }
}

export async function getCustomerSummary(): Promise<CustomerSummaryData[]> {
  // Simulate a delay for API call
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // Return mock data
  return [
    {
      name: "Rahul Sharma",
      vehicleNumber: "DL01AB1234",
      fastagType: "Car/Jeep/Van",
      purchaseDate: new Date(2023, 11, 15).toISOString(),
      amount: 500,
      status: "Active",
    },
    {
      name: "Priya Patel",
      vehicleNumber: "MH02CD5678",
      fastagType: "Car/Jeep/Van",
      purchaseDate: new Date(2023, 11, 18).toISOString(),
      amount: 499,
      status: "Active",
    },
    {
      name: "Amit Kumar",
      vehicleNumber: "KA03EF9012",
      fastagType: "Bus/Truck",
      purchaseDate: new Date(2023, 11, 20).toISOString(),
      amount: 650,
      status: "Active",
    },
    {
      name: "Sneha Gupta",
      vehicleNumber: "TN04GH3456",
      fastagType: "LCV",
      purchaseDate: new Date(2023, 11, 25).toISOString(),
      amount: 550,
      status: "Pending",
    },
    {
      name: "Vikram Singh",
      vehicleNumber: "UP05IJ7890",
      fastagType: "Car/Jeep/Van",
      purchaseDate: new Date(2023, 11, 28).toISOString(),
      amount: 475,
      status: "Active",
    },
  ]
}
