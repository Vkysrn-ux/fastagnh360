import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';

export const runtime = 'nodejs';

function normalizePemFromEnv(v?: string, b64?: string): string {
  if (b64 && b64.trim()) {
    try { return Buffer.from(b64.trim(), 'base64').toString('utf8'); } catch {}
  }
  let s = String(v || '');
  s = s.replace(/^\uFEFF/, '').trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  s = s.replace(/[;,]+$/g, '').trim();
  s = s.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
  const looksLikeBase64 = !s.includes('BEGIN') && /^[A-Za-z0-9+/=\r\n]+$/.test(s);
  if (looksLikeBase64) {
    try { s = Buffer.from(s, 'base64').toString('utf8'); } catch {}
  }
  return s.trim();
}

async function ensureFolder(drive: any, name: string, parentId: string): Promise<string> {
  const q = [
    `name = '${name.replace(/'/g, "\\'")}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    `'${parentId}' in parents`,
    'trashed = false',
  ].join(' and ');
  const list = await drive.files.list({ q, fields: 'files(id)', includeItemsFromAllDrives: true, supportsAllDrives: true, pageSize: 1 } as any);
  const existing = list.data.files?.[0]?.id;
  if (existing) return existing;
  const created = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
    supportsAllDrives: true,
  } as any);
  return String(created.data.id);
}

export async function GET(req: NextRequest) {
  try {
    const target = (process.env.UPLOAD_TARGET || '').toLowerCase();
    const rootId = process.env.GDRIVE_ROOT_FOLDER_ID as string;
    if (!rootId) return NextResponse.json({ ok: false, error: 'Missing GDRIVE_ROOT_FOLDER_ID' }, { status: 400 });

    const useOauth = target === 'gdrive_oauth';
    const useSa = target === 'gdrive';

    let drive: any;
    let authInfo: any = {};
    if (useOauth) {
      const cid = process.env.GDRIVE_OAUTH_CLIENT_ID;
      const secret = process.env.GDRIVE_OAUTH_CLIENT_SECRET;
      const refresh = process.env.GDRIVE_OAUTH_REFRESH_TOKEN;
      if (!cid || !secret || !refresh) {
        return NextResponse.json({ ok: false, error: 'Missing OAuth env vars' }, { status: 400 });
      }
      const oauth2 = new google.auth.OAuth2({ clientId: cid, clientSecret: secret } as any);
      oauth2.setCredentials({ refresh_token: refresh });
      drive = google.drive({ version: 'v3', auth: oauth2 });
      authInfo = { mode: 'oauth' };
    } else if (useSa) {
      const email = process.env.GDRIVE_CLIENT_EMAIL as string;
      const keyRaw = process.env.GDRIVE_PRIVATE_KEY;
      const keyB64 = process.env.GDRIVE_PRIVATE_KEY_B64;
      const key = normalizePemFromEnv(keyRaw, keyB64);
      if (!email || !key) {
        return NextResponse.json({ ok: false, error: 'Missing GDRIVE_* env vars' }, { status: 400 });
      }
      const auth = new google.auth.JWT({ email, key, scopes: ['https://www.googleapis.com/auth/drive'] });
      drive = google.drive({ version: 'v3', auth });
      authInfo = { mode: 'service_account' };
    } else {
      return NextResponse.json({ ok: false, error: 'UPLOAD_TARGET must be gdrive or gdrive_oauth' }, { status: 400 });
    }

    const url = new URL(req.url);
    const ticketRaw = url.searchParams.get('ticket') || 'HEALTHCHECK';
    const keep = url.searchParams.get('keep') === '1';
    const debug = url.searchParams.get('debug') === '1';

    // Confirm root folder is accessible
    const meta = await drive.files.get({ fileId: rootId, fields: 'id, name, driveId, capabilities', supportsAllDrives: true } as any);

    // Try listing children
    const listed = await drive.files.list({
      q: `'${rootId}' in parents and trashed = false`,
      fields: 'files(id,name,mimeType)',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      pageSize: 5,
    } as any);

    // Create nested ticket path like upload API (tickets/<ticket>/<YYYY>/<MM>/)
    const safeTicket = String(ticketRaw || 'misc').replace(/[^A-Za-z0-9_\-]/g, '') || 'misc';
    const now = new Date();
    const y = String(now.getFullYear());
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const ticketsFolderId = await ensureFolder(drive, 'tickets', rootId);
    const ticketFolderId = await ensureFolder(drive, safeTicket, ticketsFolderId);
    const yearFolderId = await ensureFolder(drive, y, ticketFolderId);
    const monthFolderId = await ensureFolder(drive, m, yearFolderId);

    // Upload a small test file
    const content = Buffer.from(`drive health check: ${new Date().toISOString()}\n`);
    const created = await drive.files.create({
      requestBody: { name: `health-${Date.now()}.txt`, parents: [monthFolderId] },
      media: { mimeType: 'text/plain', body: Readable.from(content) as any },
      fields: 'id, webViewLink, webContentLink',
      supportsAllDrives: true,
    } as any);
    const fileId = String(created.data.id);

    if (!keep) {
      try { await drive.files.delete({ fileId, supportsAllDrives: true } as any); } catch {}
    }

    return NextResponse.json({
      ok: true,
      root: { id: rootId, name: meta.data.name },
      listSampleCount: (listed.data.files || []).length,
      ticketPath: `tickets/${safeTicket}/${y}/${m}`,
      createdFileId: fileId,
      kept: keep,
      viewLink: created.data.webViewLink || null,
      auth: authInfo,
      ...(debug ? {
        keyDiagnostics: {
          // Only meaningful for service account; omitted for OAuth
        }
      } : {}),
    });
  } catch (e: any) {
    const msg = e?.response?.data || e?.message || 'Drive health failed';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
