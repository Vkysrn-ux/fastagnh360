import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const dbName = process.env.DB_NAME;

    // Get all tables in the database
    const [tables] = await pool.query<any[]>(
      `SELECT TABLE_NAME, TABLE_ROWS, ENGINE, TABLE_COMMENT
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME`,
      [dbName]
    );

    // Get all columns for all tables
    const [columns] = await pool.query<any[]>(
      `SELECT TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION, COLUMN_DEFAULT,
              IS_NULLABLE, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH,
              NUMERIC_PRECISION, NUMERIC_SCALE, COLUMN_TYPE,
              COLUMN_KEY, EXTRA, COLUMN_COMMENT
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [dbName]
    );

    // Get all indexes
    const [indexes] = await pool.query<any[]>(
      `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, COLUMN_NAME, SEQ_IN_INDEX
       FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
      [dbName]
    );

    // Group columns and indexes by table
    const columnsByTable: Record<string, any[]> = {};
    for (const col of columns) {
      if (!columnsByTable[col.TABLE_NAME]) columnsByTable[col.TABLE_NAME] = [];
      columnsByTable[col.TABLE_NAME].push({
        name: col.COLUMN_NAME,
        position: col.ORDINAL_POSITION,
        type: col.COLUMN_TYPE,
        nullable: col.IS_NULLABLE === 'YES',
        default: col.COLUMN_DEFAULT,
        key: col.COLUMN_KEY,   // PRI / UNI / MUL
        extra: col.EXTRA,       // auto_increment / on update ...
        comment: col.COLUMN_COMMENT || undefined,
      });
    }

    const indexesByTable: Record<string, any[]> = {};
    for (const idx of indexes) {
      if (!indexesByTable[idx.TABLE_NAME]) indexesByTable[idx.TABLE_NAME] = [];
      indexesByTable[idx.TABLE_NAME].push({
        name: idx.INDEX_NAME,
        column: idx.COLUMN_NAME,
        unique: idx.NON_UNIQUE === 0,
        seq: idx.SEQ_IN_INDEX,
      });
    }

    // Build final schema response
    const schema = tables.map((t: any) => ({
      table: t.TABLE_NAME,
      engine: t.ENGINE,
      approx_rows: t.TABLE_ROWS,
      columns: columnsByTable[t.TABLE_NAME] ?? [],
      indexes: indexesByTable[t.TABLE_NAME] ?? [],
    }));

    return NextResponse.json({
      database: dbName,
      host: process.env.DB_HOST,
      table_count: tables.length,
      tables: schema,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
