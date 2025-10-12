import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { Readable } from 'stream';

function loadEnvFile(p) {
  if (!fs.existsSync(p)) return;
  const raw = fs.readFileSync(p, 'utf8');
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

async function ensureChildFolder(drive, childName, parentId) {
  const q = [
    `name = '${childName.replace(/'/g, "\\'")}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    `'${parentId}' in parents`,
    'trashed = false',
  ].join(' and ');
  const list = await drive.files.list({ q, fields: 'files(id)', supportsAllDrives: true, includeItemsFromAllDrives: true, pageSize: 1 });
  const existing = list.data.files?.[0]?.id;
  if (existing) return existing;
  const created = await drive.files.create({ requestBody: { name: childName, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }, fields: 'id', supportsAllDrives: true });
  return String(created.data.id);
}

async function main() {
  loadEnvFile('.env.local');
  const [,, filePathArg, ticketArg] = process.argv;
  if (!filePathArg || !ticketArg) {
    console.log('Usage: node scripts/upload-test-oauth.mjs <filePath> <ticket>');
    process.exit(1);
  }
  const filePath = path.resolve(filePathArg);
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }
  const rootId = process.env.GDRIVE_ROOT_FOLDER_ID;
  const cid = process.env.GDRIVE_OAUTH_CLIENT_ID;
  const secret = process.env.GDRIVE_OAUTH_CLIENT_SECRET;
  const refresh = process.env.GDRIVE_OAUTH_REFRESH_TOKEN;
  if (!rootId || !cid || !secret || !refresh) {
    console.error('Missing env vars for OAuth Drive upload');
    process.exit(1);
  }
  const oauth2 = new google.auth.OAuth2({ clientId: cid, clientSecret: secret });
  oauth2.setCredentials({ refresh_token: refresh });
  const drive = google.drive({ version: 'v3', auth: oauth2 });

  const safeTicket = String(ticketArg || 'misc').replace(/[^A-Za-z0-9_\-]/g, '') || 'misc';
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, '0');

  const ticketsFolderId = await ensureChildFolder(drive, 'tickets', rootId);
  const ticketFolderId = await ensureChildFolder(drive, safeTicket, ticketsFolderId);
  const yearFolderId = await ensureChildFolder(drive, y, ticketFolderId);
  const monthFolderId = await ensureChildFolder(drive, m, yearFolderId);

  const fileName = path.basename(filePath);
  const mimeType = 'application/octet-stream';
  const created = await drive.files.create({
    requestBody: { name: fileName, parents: [monthFolderId] },
    media: { mimeType, body: Readable.from(fs.readFileSync(filePath)) },
    fields: 'id, webViewLink, webContentLink'
  });
  const fileId = created.data.id;
  if (String(process.env.GDRIVE_PUBLIC || '').toLowerCase() === 'true') {
    try { await drive.permissions.create({ fileId, requestBody: { role: 'reader', type: 'anyone' } }); } catch {}
  }
  const url = String(process.env.GDRIVE_PUBLIC || '').toLowerCase() === 'true'
    ? `https://drive.google.com/uc?id=${fileId}&export=download`
    : created.data.webViewLink || created.data.webContentLink || `https://drive.google.com/file/d/${fileId}/view`;
  console.log(JSON.stringify({ ok: true, ticket: safeTicket, folder: `tickets/${safeTicket}/${y}/${m}`, id: fileId, url }, null, 2));
}

main();

