import { pool } from './db';

export async function getTickets() {
  const [rows] = await pool.query('SELECT * FROM tickets_nh ORDER BY created_at DESC');
  return rows;
}

export async function getTicket(id: number) {
  const [rows] = await pool.query('SELECT * FROM tickets_nh WHERE id = ?', [id]);
  return rows[0];
}

export async function createTicket(data: any) {
  const { customer_name, mobile, vehicle_number, address, source } = data;
  const [result] = await pool.query(
    'INSERT INTO tickets_nh (customer_name, mobile, vehicle_number, address, source) VALUES (?, ?, ?, ?, ?)',
    [customer_name, mobile, vehicle_number, address, source]
  );
  return result.insertId;
}

export async function updateTicket(id: number, data: any) {
  const { status, assigned_to, remarks } = data;
  await pool.query(
    'UPDATE tickets SET status=?, assigned_to=?, remarks=? WHERE id=?',
    [status, assigned_to, remarks, id]
  );
}
