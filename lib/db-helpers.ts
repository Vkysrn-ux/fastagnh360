import type { RowDataPacket } from "mysql2"
import type { PoolConnection } from "mysql2/promise"

import { pool } from "./db"

const columnCache = new Map<string, boolean>()

export async function hasTableColumn(
  table: string,
  column: string,
  conn?: PoolConnection | null,
): Promise<boolean> {
  const cacheKey = `${table}.${column}`
  if (columnCache.has(cacheKey)) {
    return columnCache.get(cacheKey) as boolean
  }

  const runner = conn ?? pool
  const [rows] = await runner.query<RowDataPacket[]>(`SHOW COLUMNS FROM ${table} LIKE ?`, [column])
  const exists = Array.isArray(rows) && rows.length > 0
  columnCache.set(cacheKey, exists)
  return exists
}
