// lib/getSession.ts
import { cookies } from 'next/headers'

export function getUserSession() {
  const session = cookies().get('user-session')?.value
  if (!session) return null
  try {
    return JSON.parse(session) // { userId, userType }
  } catch {
    return null
  }
}
