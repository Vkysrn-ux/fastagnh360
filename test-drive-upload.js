import { google } from 'googleapis';
import fs from 'fs';
import { Readable } from 'stream';

/** Load .env.local manually */
function loadEnvFile(filepath) {
  if (!fs.existsSync(filepath)) return;
  const raw = fs.readFileSync(filepath, 'utf8');
  raw.split(/\r?\n/).forEach(line => {
    if (!line.trim() || line.trim().startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  });
}

/** Normalize service account private key */
function normalizePem(v, b64) {
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

async function testUpload() {
  loadEnvFile('.env.local');

  const rootId = process.env.GDRIVE_ROOT_FOLDER_ID;
  const email = process.env.GDRIVE_CLIENT_EMAIL;
  const key = normalizePem(process.env.GDRIVE_PRIVATE_KEY, process.env.GDRIVE_PRIVATE_KEY_B64);
  const makePublic = String(process.env.GDRIVE_PUBLIC || '').toLowerCase() === 'true';

  if (!rootId || !email || !key) {
    console.log('❌ Missing env vars:', { rootId, email, keyExists: !!key });
    return;
  }

  const auth = new google.auth.JWT({
    email: email,
    key: key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const drive = google.drive({ version: 'v3', auth });

  try {
    // ✅ Check access
    const rootInfo = await drive.files.get({
      fileId: rootId,
      fields: 'id, name',
    });
    console.log('✅ Connected to folder:', rootInfo.data.name, rootInfo.data.id);

    // ✅ Create a test file
    const testContent = `Test Upload at ${new Date().toISOString()}`;
    const created = await drive.files.create({
      requestBody: {
        name: `test-${Date.now()}.txt`,
        parents: [rootId],
      },
      media: {
        mimeType: 'text/plain',
        body: Readable.from(testContent),
      },
      fields: 'id, webViewLink, webContentLink',
    });

    const fileId = created.data.id;
    console.log('✅ File created:', fileId);

    // ✅ Make it public if needed
    if (makePublic) {
      await drive.permissions.create({
        fileId,
        requestBody: { role: 'reader', type: 'anyone' },
      });
      console.log('✅ Made public.');
    }

    // ✅ Print link
    const link = makePublic
      ? `https://drive.google.com/uc?id=${fileId}&export=download`
      : created.data.webViewLink;

    console.log('✅ File Link:', link);

    // ✅ Cleanup
    await drive.files.delete({ fileId });
    console.log('✅ Cleaned up (file deleted).');

  } catch (err) {
    console.error('❌ Error:', err.message || err);
  }
}

testUpload();
