// lib/push.ts
// Push notifications to the NH360 Staff app via Firebase Cloud Messaging (HTTP v1).
// Service account JSON comes from FIREBASE_SERVICE_ACCOUNT_B64 (base64). Sending
// never throws: a failed push must not break the request that triggered it.
import { google } from "googleapis";
import { pool } from "@/lib/db";

let tablesReady = false;
let cachedToken: { value: string; exp: number } | null = null;

export async function ensurePushTables() {
  if (tablesReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_devices (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT          NOT NULL,
      token      VARCHAR(512) NOT NULL,
      platform   VARCHAR(16)  NULL,
      created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_push_token (token(255)),
      KEY idx_push_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  // One row per notification that must only go out once (reminders, follow-ups)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_log (
      event_key  VARCHAR(191) NOT NULL PRIMARY KEY,
      user_id    INT          NULL,
      sent_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  // Last seen assignee/closed state per ticket, to detect changes made anywhere
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ticket_push_state (
      ticket_id   INT        NOT NULL PRIMARY KEY,
      assigned_to INT        NULL,
      closed      TINYINT(1) NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  tablesReady = true;
}

function serviceAccount(): { client_email: string; private_key: string; project_id: string } | null {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) return null;
  try {
    return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

async function accessToken(sa: { client_email: string; private_key: string }) {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.value;
  const jwt = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  });
  const res = await jwt.authorize();
  cachedToken = { value: String(res.access_token), exp: Number(res.expiry_date) || Date.now() + 50 * 60_000 };
  return cachedToken.value;
}

export type PushMessage = {
  title: string;
  body: string;
  // Opened by the app on tap: type = task | ticket | tasks | tickets
  data?: Record<string, string>;
};

/** Sends to every registered phone of one user. Returns how many phones accepted it. */
export async function pushToUser(userId: number | null | undefined, msg: PushMessage): Promise<number> {
  if (!userId) return 0;
  const sa = serviceAccount();
  if (!sa) return 0;
  try {
    await ensurePushTables();
    const [rows]: any = await pool.query(`SELECT id, token FROM push_devices WHERE user_id = ?`, [userId]);
    if (!rows?.length) return 0;
    const bearer = await accessToken(sa);
    let ok = 0;
    for (const d of rows) {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token: d.token,
            notification: { title: msg.title, body: msg.body },
            data: msg.data ?? {},
            android: { priority: "HIGH", notification: { channel_id: "nh360_alerts", sound: "default" } },
          },
        }),
      });
      if (res.ok) {
        ok++;
      } else {
        const text = await res.text().catch(() => "");
        // App uninstalled or token replaced: forget this phone
        if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT.*token/i.test(text)) {
          await pool.query(`DELETE FROM push_devices WHERE id = ?`, [d.id]);
        }
      }
    }
    return ok;
  } catch {
    return 0;
  }
}

/** Sends at most once per event key (e.g. "remind:2026-10-04:12"). */
export async function pushOnce(eventKey: string, userId: number, msg: PushMessage): Promise<boolean> {
  try {
    await ensurePushTables();
    const [res]: any = await pool.query(`INSERT IGNORE INTO push_log (event_key, user_id) VALUES (?, ?)`, [eventKey, userId]);
    if (!res?.affectedRows) return false;
    await pushToUser(userId, msg);
    return true;
  } catch {
    return false;
  }
}
