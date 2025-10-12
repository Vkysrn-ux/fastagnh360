import fs from 'fs';
import { google } from 'googleapis';
import { Readable } from 'stream';

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return;
  const raw = fs.readFileSync(path, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    let v = line.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[k] = v;
  }
}

async function main() {
  loadEnvFile('.env.local');
  const rootId = process.env.GDRIVE_ROOT_FOLDER_ID;
  const cid = process.env.GDRIVE_OAUTH_CLIENT_ID;
  const secret = process.env.GDRIVE_OAUTH_CLIENT_SECRET;
  const refresh = process.env.GDRIVE_OAUTH_REFRESH_TOKEN;
  if (!rootId || !cid || !secret || !refresh) {
    console.log(JSON.stringify({ ok: false, error: 'Missing env vars', present: { rootId: !!rootId, cid: !!cid, secret: !!secret, refresh: !!refresh } }, null, 2));
    process.exit(1);
  }
  try {
    const oauth2 = new google.auth.OAuth2({ clientId: cid, clientSecret: secret });
    oauth2.setCredentials({ refresh_token: refresh });
    const drive = google.drive({ version: 'v3', auth: oauth2 });
    const meta = await drive.files.get({ fileId: rootId, fields: 'id, name', supportsAllDrives: true });
    const listed = await drive.files.list({ q: `'${rootId}' in parents and trashed = false`, fields: 'files(id,name)', supportsAllDrives: true, pageSize: 3 });

    const content = Buffer.from(`drive oauth health: ${new Date().toISOString()}\n`);
    const created = await drive.files.create({ requestBody: { name: `health-${Date.now()}.txt`, parents: [rootId] }, media: { mimeType: 'text/plain', body: Readable.from(content) }, fields: 'id, webViewLink' });
    const fileId = created.data.id;
    try { await drive.permissions.create({ fileId, requestBody: { role: 'reader', type: 'anyone' } }); } catch {}
    try { await drive.files.delete({ fileId }); } catch {}
    console.log(JSON.stringify({ ok: true, root: meta.data, children: (listed.data.files||[]).length, created: { id: fileId } }, null, 2));
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: e?.message || e?.response?.data || String(e) }, null, 2));
    process.exit(1);
  }
}

main();

