'use server'

import { cookies } from "next/headers"

export async function getUserSession() {
  const cookieStore = await cookies()
  console.log("🧾 Reading Session...")

  const session = cookieStore.get("user-session")
  console.log("📦 Session Value:", session?.value)

  if (!session) return null

  try {
    return JSON.parse(session.value)
  } catch {
    return null
  }
}

export async function logoutUser() {
  const cookieStore = await cookies()
  cookieStore.delete("user-session")
  return { success: true }
}
