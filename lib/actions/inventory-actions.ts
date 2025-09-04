"use server"

import type { InventoryItem, InventorySummaryItem } from "../types"
import { v4 as uuidv4 } from "uuid"

// Mock inventory data
let mockInventory: InventoryItem[] = [
  {
    id: "inv-1",
    bankName: "HDFC Bank",
    fastagType: "Car/Jeep/Van",
    quantity: 50,
    price: 500,
    batchNumber: "HDC-2023-001",
    createdAt: new Date(2023, 5, 15).toISOString(),
    updatedAt: new Date(2023, 5, 15).toISOString(),
  },
  {
    id: "inv-2",
    bankName: "ICICI Bank",
    fastagType: "Car/Jeep/Van",
    quantity: 35,
    price: 499,
    batchNumber: "ICI-2023-001",
    createdAt: new Date(2023, 6, 10).toISOString(),
    updatedAt: new Date(2023, 6, 10).toISOString(),
  },
  {
    id: "inv-3",
    bankName: "SBI",
    fastagType: "Bus/Truck",
    quantity: 25,
    price: 650,
    batchNumber: "SBI-2023-001",
    createdAt: new Date(2023, 7, 5).toISOString(),
    updatedAt: new Date(2023, 7, 5).toISOString(),
  },
  {
    id: "inv-4",
    bankName: "Axis Bank",
    fastagType: "LCV",
    quantity: 40,
    price: 550,
    batchNumber: "AXS-2023-001",
    createdAt: new Date(2023, 8, 1).toISOString(),
    updatedAt: new Date(2023, 8, 1).toISOString(),
  },
  {
    id: "inv-5",
    bankName: "Paytm Payments Bank",
    fastagType: "Car/Jeep/Van",
    quantity: 60,
    price: 475,
    batchNumber: "PTM-2023-001",
    createdAt: new Date(2023, 9, 12).toISOString(),
    updatedAt: new Date(2023, 9, 12).toISOString(),
  },
  {
    id: "inv-6",
    bankName: "HDFC Bank",
    fastagType: "Multi-Axle Vehicle",
    quantity: 15,
    price: 750,
    batchNumber: "HDC-2023-002",
    createdAt: new Date(2023, 10, 8).toISOString(),
    updatedAt: new Date(2023, 10, 8).toISOString(),
  },
  {
    id: "inv-7",
    bankName: "Kotak Mahindra Bank",
    fastagType: "Car/Jeep/Van",
    quantity: 0,
    price: 525,
    batchNumber: "KTK-2023-001",
    createdAt: new Date(2023, 11, 3).toISOString(),
    updatedAt: new Date(2023, 11, 3).toISOString(),
  },
]

export async function getInventory(): Promise<InventoryItem[]> {
  // Simulate a delay for API call
  await new Promise((resolve) => setTimeout(resolve, 1000))

  return [...mockInventory]
}

export async function getInventorySummary(): Promise<InventorySummaryItem[]> {
  // Simulate a delay for API call
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // Group by bank and type
  const summary: InventorySummaryItem[] = []
  mockInventory.forEach((item) => {
    summary.push({
      bankName: item.bankName,
      fastagType: item.fastagType,
      quantity: item.quantity,
      price: item.price,
    })
  })

  return summary
}

export async function addInventoryItem(
  data: Omit<InventoryItem, "id" | "createdAt" | "updatedAt">,
): Promise<InventoryItem> {
  // Simulate a delay for API call
  await new Promise((resolve) => setTimeout(resolve, 1000))

  const now = new Date().toISOString()
  const newItem: InventoryItem = {
    id: `inv-${uuidv4().substring(0, 8)}`,
    ...data,
    createdAt: now,
    updatedAt: now,
  }

  mockInventory.push(newItem)
  return newItem
}

export async function updateInventoryItem(
  id: string,
  data: Partial<Omit<InventoryItem, "id" | "createdAt" | "updatedAt">>,
): Promise<InventoryItem> {
  // Simulate a delay for API call
  await new Promise((resolve) => setTimeout(resolve, 1000))

  const index = mockInventory.findIndex((item) => item.id === id)
  if (index === -1) {
    throw new Error("Inventory item not found")
  }

  const updatedItem: InventoryItem = {
    ...mockInventory[index],
    ...data,
    updatedAt: new Date().toISOString(),
  }

  mockInventory[index] = updatedItem
  return updatedItem
}

export async function deleteInventoryItem(id: string): Promise<void> {
  // Simulate a delay for API call
  await new Promise((resolve) => setTimeout(resolve, 1000))

  mockInventory = mockInventory.filter((item) => item.id !== id)
}
