// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'

// Lightweight in-memory cache to reduce DB load for repeated lookups
type CacheRecord = { data: any; expires: number };
const cache = new Map<string, CacheRecord>();
function getCache(key: string): any | null {
  const rec = cache.get(key);
  if (rec && rec.expires > Date.now()) return rec.data;
  if (rec) cache.delete(key);
  return null;
}
function setCache(key: string, data: any, ttlMs: number) {
  cache.set(key, { data, expires: Date.now() + ttlMs });
}
import { hasTableColumn } from '@/lib/db-helpers'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const role = searchParams.get('role')
    const rolesParam = searchParams.get('roles')
    const name = searchParams.get('name')
    const id = searchParams.get('id')

    const hasNotes = await hasTableColumn('users', 'notes').catch(() => false)
    const selectFields = hasNotes ? 'id, name, notes' : 'id, name'

    let sql = `SELECT ${selectFields} FROM users WHERE 1`
    const params: any[] = []

    // Small retry helper for transient connection drops (e.g., ECONNRESET)
    async function queryWithRetry<T = any>(sqlQ: string, paramsQ: any[] = [], attempts = 1): Promise<[T, any]> {
      let lastErr: any = null
      for (let i = 0; i < Math.max(1, attempts + 1); i++) {
        try {
          // Using pool.query directly so the pool manages connections
          return await pool.query(sqlQ, paramsQ) as any
        } catch (err: any) {
          lastErr = err
          const code = String(err?.code || '')
          if (!['ECONNRESET','PROTOCOL_CONNECTION_LOST','PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR','PROTOCOL_ENQUEUE_AFTER_QUIT','ER_CON_COUNT_ERROR'].includes(code)) {
            break
          }
          // brief backoff before retry
          await new Promise(res => setTimeout(res, code === 'ER_CON_COUNT_ERROR' ? 500 : 200))
        }
      }
      throw lastErr
    }

    if (id) {
      sql += ' AND id = ?'
      params.push(Number(id))
      const cacheKey = `users:id:${Number(id)}`
      const cached = getCache(cacheKey)
      if (cached) return NextResponse.json(cached)
      const [rows]: any = await queryWithRetry(sql + ' LIMIT 1', params, 1)
      const result = Array.isArray(rows) ? rows : []
      // If notes missing or empty, omit it from response
      if (result.length && ('notes' in result[0])) {
        if (!result[0].notes || String(result[0].notes).trim() === '') {
          delete result[0].notes
        }
      }
      setCache(cacheKey, result, 30_000)
      return NextResponse.json(result)
    }

    if (rolesParam) {
      const list = rolesParam.split(',').map(s => s.trim()).filter(Boolean)
      if (list.length > 0) {
        sql += ` AND role IN (${list.map(() => '?').join(',')})`
        params.push(...list)
      }
    } else if (role) {
      sql += ' AND role = ?'
      params.push(role)
    }

    if (name) {
      sql += ' AND name LIKE ?'
      params.push(`%${name}%`)
    }

    sql += ' ORDER BY name LIMIT 10' // (Optional) limit results for performance

    const cacheKey = `users:list:${rolesParam || role || ''}:${name || ''}`
    const cachedList = getCache(cacheKey)
    if (cachedList) return NextResponse.json(cachedList)
    const [rows]: any = await queryWithRetry(sql, params, 1)
    const cleaned = (Array.isArray(rows) ? rows : []).map((r: any) => {
      if (hasNotes && ('notes' in r)) {
        if (!r.notes || String(r.notes).trim() === '') {
          const { notes, ...rest } = r
          return rest
        }
      }
      return r
    })
    setCache(cacheKey, cleaned, 15_000)
    return NextResponse.json(cleaned)
  } catch (error: any) {
    console.error("Error fetching users:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}
