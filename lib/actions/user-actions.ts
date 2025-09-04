"use server"

export async function getUserDashboardData(userId: string) {
  // Simulate a delay for API call
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // Return mock data
  return {
    name: "Regular User",
    vehicleNumber: "DL01AB1234",
    activeFastags: 1,
    lastRecharge: { amount: 500, date: new Date(2023, 11, 15).toISOString() },
    balance: 350,
    recentTransactions: [
      {
        id: "txn-1",
        date: new Date(2023, 11, 15).toISOString(),
        amount: 500,
        type: "Recharge",
        status: "Completed",
      },
      {
        id: "txn-2",
        date: new Date(2023, 11, 20).toISOString(),
        amount: 75,
        type: "Toll Payment",
        location: "Delhi-Jaipur Highway",
        status: "Completed",
      },
      {
        id: "txn-3",
        date: new Date(2023, 11, 25).toISOString(),
        amount: 50,
        type: "Toll Payment",
        location: "Mumbai-Pune Expressway",
        status: "Completed",
      },
      {
        id: "txn-4",
        date: new Date(2023, 12, 1).toISOString(),
        amount: 25,
        type: "Toll Payment",
        location: "Bangalore Ring Road",
        status: "Completed",
      },
    ],
  }
}
