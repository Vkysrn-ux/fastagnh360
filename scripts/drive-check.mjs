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
    let v = line.slice(idx + 1);
    // Trim surrounding quotes if present
    v = v.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[k] = v;
  }
}

function normalizePemFromEnv(v, b64) {
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

async function main() {
  loadEnvFile('.env.local');
  const target = (process.env.UPLOAD_TARGET || '').toLowerCase();
  if (target !== 'gdrive') {
    console.log(JSON.stringify({ ok: false, error: 'UPLOAD_TARGET is not gdrive', target }, null, 2));
    return;
  }
  const rootId = process.env.GDRIVE_ROOT_FOLDER_ID;
  const email = process.env.GDRIVE_CLIENT_EMAIL;
  const key = normalizePemFromEnv(process.env.GDRIVE_PRIVATE_KEY, process.env.GDRIVE_PRIVATE_KEY_B64);
  if (!rootId || !email || !key) {
    console.log(JSON.stringify({ ok: false, error: 'Missing GDRIVE_* env vars', present: { rootId: !!rootId, email: !!email, hasKey: !!key } }, null, 2));
    return;
  }
  try {
    const auth = new google.auth.JWT({ email, key, scopes: ['https://www.googleapis.com/auth/drive'] });
    const drive = google.drive({ version: 'v3', auth });
    const meta = await drive.files.get({ fileId: rootId, fields: 'id, name, driveId', supportsAllDrives: true });
    const list = await drive.files.list({ q: `'${rootId}' in parents and trashed = false`, fields: 'files(id,name)', includeItemsFromAllDrives: true, supportsAllDrives: true, pageSize: 3 });
    const content = Buffer.from(`drive health check: ${new Date().toISOString()}\n`);
    const created = await drive.files.create({ requestBody: { name: `health-${Date.now()}.txt`, parents: [rootId] }, media: { mimeType: 'text/plain', body: Readable.from(content) }, fields: 'id, webViewLink', supportsAllDrives: true });
    // Clean up
    const fileId = created.data.id;
    try { await drive.files.delete({ fileId, supportsAllDrives: true }); } catch {}
    console.log(JSON.stringify({ ok: true, root: meta.data, children: (list.data.files||[]).length, created: { id: fileId } }, null, 2));
  } catch (e) {
    const err = e && e.response && e.response.data ? e.response.data : e && e.message ? e.message : String(e);
    const diag = {
      keyLen: key.length,
      startsWithBegin: key.includes('BEGIN PRIVATE KEY'),
      endsWithEnd: key.includes('END PRIVATE KEY'),
      newlineCount: (key.match(/\n/g) || []).length,
    };
    console.log(JSON.stringify({ ok: false, error: err, diag }, null, 2));
    process.exitCode = 1;
  }
}

main();
