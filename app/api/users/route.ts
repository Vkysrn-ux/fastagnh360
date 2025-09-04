// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const role = searchParams.get('role')
    const name = searchParams.get('name')

    let sql = 'SELECT id, name FROM users WHERE 1'
    const params: any[] = []

    if (role) {
      sql += ' AND role = ?'
      params.push(role)
    }

    if (name) {
      sql += ' AND name LIKE ?'
      params.push(`%${name}%`)
    }

    sql += ' ORDER BY name LIMIT 10' // (Optional) limit results for performance

    const [rows] = await pool.query(sql, params)
    return NextResponse.json(rows)
  } catch (error: any) {
    console.error("Error fetching users:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}
