'use server'

import { pool } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { getUserDashboardPermissions } from '@/types/dashboard'

// DB-only login using your users table
export async function loginUserServer(email: string, password: string) {
  const cookieStore = await cookies()

  if (!email || !password) {
    return { success: false, message: 'Email and password are required.' }
  }

  email = String(email).toLowerCase()

  try {
    console.log('Login attempt for email:', email)
    const [rows]: any = await pool.query(
      'SELECT id, name, email, role, password FROM users WHERE email = ? LIMIT 1',
      [email]
    )
    console.log('Database query result:', rows ? rows.length : 'no rows')
    
    if (!rows || rows.length === 0) {
      console.log('No user found with email:', email)
      return { success: false, message: 'Invalid email or password.' }
    }

    const u = rows[0]
    console.log('User found with role:', u.role)
    const stored = u.password ? String(u.password) : ''

    if (!stored) {
      console.log('No password stored for user')
      return { success: false, message: 'Account not fully setup. Please contact administrator.' }
    }

    let ok = false
    try {
      console.log('Attempting password verification')
      ok = await bcrypt.compare(password, stored)
      console.log('Password verification result:', ok)
    } catch (e) {
      console.error('Password comparison error:', e)
      ok = false
    }

    if (!ok) {
      return { success: false, message: 'Invalid email or password.' }
    }

    // Map DB role to app userType and dashboard role
    const role = String(u.role || '').toLowerCase()
    
    type RoleMapType = {
      [key: string]: { 
        type: 'admin' | 'employee' | 'agent' | 'user'; 
        displayRole: 'Super Admin' | 'Accountant/HR' | 'Manager' | 'TeamLead' | 'Agent';
      }
    }
    
    const roleMapping: RoleMapType = {
      // Admins
      'admin':        { type: 'admin',    displayRole: 'Admin' },
      'super admin':  { type: 'admin',    displayRole: 'Super Admin' },

      // Employees (Accountant/HR)
      'employee':     { type: 'employee', displayRole: 'Accountant/HR' },
      'accountant':   { type: 'employee', displayRole: 'Accountant/HR' },
      'hr':           { type: 'employee', displayRole: 'Accountant/HR' },
      'accounts':     { type: 'employee', displayRole: 'Accountant/HR' },

      // Agent-portal roles (Manager, TL, Agents, ASM, etc.)
      'manager':      { type: 'agent',    displayRole: 'Manager' },
      'team-leader':  { type: 'agent',    displayRole: 'TeamLead' },
      'team lead':    { type: 'agent',    displayRole: 'TeamLead' },
      'tl':           { type: 'agent',    displayRole: 'TeamLead' },
      'asm':          { type: 'agent',    displayRole: 'Manager' },
      'toll-agent':   { type: 'agent',    displayRole: 'Agent' },
      'agent':        { type: 'agent',    displayRole: 'Agent' },
      'shop':         { type: 'agent',    displayRole: 'Agent' },
      'shop_owner':   { type: 'agent',    displayRole: 'Agent' },
      'showroom':     { type: 'agent',    displayRole: 'Agent' },
      'fse':          { type: 'agent',    displayRole: 'Agent' },
      'executive':    { type: 'agent',    displayRole: 'Agent' },
      'channel-partner': { type: 'agent', displayRole: 'Agent' },
      'office':       { type: 'agent',    displayRole: 'Agent' },
    }
    
    const mappedRole = roleMapping[role] || { type: 'agent', displayRole: 'Agent' }
    const userType = mappedRole.type
    const displayRole = mappedRole.displayRole

    // Set session cookie
    const sessionData = {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      displayRole,
      userType,
      dashboardPermissions: getUserDashboardPermissions(displayRole),
      lastLogin: new Date().toISOString()
    };

    // Best-effort: persist last login if column exists
    try {
      await pool.query("UPDATE users SET last_login = NOW() WHERE id = ?", [u.id])
    } catch (e) {
      // ignore if column doesn't exist
    }

    await cookieStore.set('user-session', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/'
    });

    return {
      success: true,
      user: sessionData
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'Server error. Please try again later.' };
  }
}


