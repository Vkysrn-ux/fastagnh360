'use server'

import { pool } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'

// DB-only login using your users table
export async function loginUserServer(email: string, password: string) {
  const cookieStore = await cookies()

  if (!email || !password) {
    return { success: false, message: 'Email and password are required.' }
  }

  email = String(email).toLowerCase()

  try {
    const [rows]: any = await pool.query(
      'SELECT id, name, email, role, password FROM users WHERE email = ? LIMIT 1',
      [email]
    )
    if (!rows || rows.length === 0) {
      return { success: false, message: 'Invalid email or password.' }
    }

    const u = rows[0]
    const stored = u.password ? String(u.password) : ''

    let ok = false
    if (stored) {
      // prefer bcrypt compare; if not a hash, fall back to plain equality
      try { ok = await bcrypt.compare(password, stored) } catch { ok = false }
      if (!ok && stored === password) ok = true
    }

    if (!ok) {
      return { success: false, message: 'Invalid email or password.' }
    }

    // Map DB role to app userType for routing
    const role = String(u.role || '').toLowerCase()
    const agentRoles = new Set([
      'agent','toll-agent','asm','team-leader','manager','shop','shop_owner','fse','showroom','executive','channel-partner'
    ])
    let userType: 'admin' | 'employee' | 'agent' | 'user' = 'user'
    if (role === 'admin') userType = 'admin'
    else if (role === 'employee') userType = 'employee'
    else if (agentRoles.has(role)) userType = 'agent'

    await cookieStore.set(
      'user-session',
      JSON.stringify({ id: u.id, name: u.name, email, role: u.role, userType }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      }
    )

    return { success: true, userType }
  } catch (error) {
    console.error('Login error:', error)
    return { success: false, message: 'Server error. Please try again later.' }
  }
}

