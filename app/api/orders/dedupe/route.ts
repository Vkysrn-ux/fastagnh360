import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUserSession } from "@/lib/getSession";

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dispatch_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      request_number VARCHAR(64) NOT NULL,
      requester_type VARCHAR(32) NOT NULL,
      requester_name VARCHAR(255) NOT NULL,
      packed_state VARCHAR(64) NOT NULL,
      dispatch_via VARCHAR(64) NOT NULL,
      tracking_id VARCHAR(128) NULL,
      status VARCHAR(32) NOT NULL,
      packed_by VARCHAR(255) NULL,
      created_by VARCHAR(255) NULL,
      requested_at DATETIME NOT NULL,
      eta DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dispatch_order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      bank VARCHAR(128) NOT NULL,
      class_type VARCHAR(32) NOT NULL,
      qty INT NOT NULL,
      CONSTRAINT fk_dispatch_order_items_order
        FOREIGN KEY (order_id) REFERENCES dispatch_orders(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

export async function POST(req: NextRequest) {
  const session = await getUserSession();
  const role = String((session as any)?.displayRole || '').toLowerCase();
  const isAdmin = role.includes('super') || role.includes('admin');
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await ensureTables();

  const [dups]: any = await pool.query(`
    SELECT request_number, COUNT(*) AS c,
           MIN(id) AS keep_id,
           GROUP_CONCAT(id ORDER BY id ASC) AS ids
    FROM dispatch_orders
    GROUP BY request_number
    HAVING c > 1
  `);

  const duplicates = Array.isArray(dups) ? dups : [];
  if (!duplicates.length) return NextResponse.json({ removed: 0, groups: 0 });

  // Delete all but the smallest id per request_number
  let removed = 0;
  for (const d of duplicates) {
    const requestNumber = d.request_number;
    const keepId = Number(d.keep_id);
    await pool.query(
      `DELETE o FROM dispatch_orders o
       WHERE o.request_number = ? AND o.id <> ?`,
      [requestNumber, keepId]
    );
    // affectedRows counts child rows as well sometimes; fetch precise count if needed
    removed += (Number(d.c) - 1) || 0;
  }

  return NextResponse.json({ removed, groups: duplicates.length });
}

