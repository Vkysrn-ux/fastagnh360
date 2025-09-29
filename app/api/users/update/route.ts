import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'

function norm(v: any) { return typeof v === 'string' ? v.trim() : v }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(()=>({})) as any
    const id = Number(body?.id)
    if (!id || isNaN(id)) return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })

    const updates: string[] = []
    const vals: any[] = []

    if (body.name !== undefined) { updates.push('name = ?'); vals.push(norm(body.name) || '') }
    if (body.email !== undefined) { updates.push('email = ?'); vals.push(norm(body.email) || null) }
    if (body.phone !== undefined) { updates.push('phone = ?'); vals.push(norm(body.phone) || null) }
    if (body.role !== undefined) { updates.push('role = ?'); vals.push(String(body.role||'').toLowerCase()) }
    if (body.status !== undefined) { updates.push('status = ?'); vals.push(body.status) }
    if (body.dashboard !== undefined) { updates.push('dashboard = ?'); vals.push(body.dashboard) }
    if (body.parent_id !== undefined) { updates.push('parent_user_id = ?'); vals.push(body.parent_id ?? null) }

    if (updates.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

    vals.push(id)
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, vals)
    const [rows]: any = await pool.query(
      'SELECT id, name, email, phone, role, status, dashboard, parent_user_id, created_at FROM users WHERE id = ?',
      [id]
    )
    return NextResponse.json({ success: true, user: Array.isArray(rows) ? rows[0] : null })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update user' }, { status: 500 })
  }
}

