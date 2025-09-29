// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { hasTableColumn } from '@/lib/db-helpers'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const role = searchParams.get('role')
    const name = searchParams.get('name')
    const id = searchParams.get('id')

    const hasNotes = await hasTableColumn('users', 'notes').catch(() => false)
    const selectFields = hasNotes ? 'id, name, notes' : 'id, name'

    let sql = `SELECT ${selectFields} FROM users WHERE 1`
    const params: any[] = []

    if (id) {
      sql += ' AND id = ?'
      params.push(Number(id))
      const [rows]: any = await pool.query(sql + ' LIMIT 1', params)
      const result = Array.isArray(rows) ? rows : []
      // If notes missing or empty, omit it from response
      if (result.length && ('notes' in result[0])) {
        if (!result[0].notes || String(result[0].notes).trim() === '') {
          delete result[0].notes
        }
      }
      return NextResponse.json(result)
    }

    if (role) {
      sql += ' AND role = ?'
      params.push(role)
    }

    if (name) {
      sql += ' AND name LIKE ?'
      params.push(`%${name}%`)
    }

    sql += ' ORDER BY name LIMIT 10' // (Optional) limit results for performance

    const [rows]: any = await pool.query(sql, params)
    const cleaned = (Array.isArray(rows) ? rows : []).map((r: any) => {
      if (hasNotes && ('notes' in r)) {
        if (!r.notes || String(r.notes).trim() === '') {
          const { notes, ...rest } = r
          return rest
        }
      }
      return r
    })
    return NextResponse.json(cleaned)
  } catch (error: any) {
    console.error("Error fetching users:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}
