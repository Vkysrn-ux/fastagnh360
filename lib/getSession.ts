// lib/getSession.ts
import { cookies } from 'next/headers'

export async function getUserSession() {
  const cookieStore = await cookies()
  const session = cookieStore.get('user-session')?.value
  if (!session) return null
  try {
    return JSON.parse(session) // { userId, userType }
  } catch {
    return null
  }
}
