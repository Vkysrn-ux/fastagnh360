// lib/getSession.ts
import { cookies } from 'next/headers'

export async function getUserSession() {
  const cookieStore = await cookies()
  const session = cookieStore.get('user-session')?.value
  if (!session) return null
  try {
    // Some environments URI-encode cookie values; attempt decode first
    let raw = session
    try { raw = decodeURIComponent(session) } catch {}
    return JSON.parse(raw) // { id, name, email, displayRole, userType }
  } catch {
    return null
  }
}
