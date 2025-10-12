import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { put } from '@vercel/blob';
import { Storage } from '@google-cloud/storage';
import { google } from 'googleapis';
import { Readable } from 'stream';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const ticketRaw = (formData.get('ticket') as string | null) || '';
    if (!file) {
      return NextResponse.json({ error: 'No file provided (field name should be "file")' }, { status: 400 });
    }

    // Basic size guard (e.g., 25MB)
    const maxBytes = 25 * 1024 * 1024;
    // @ts-ignore size available on Edge runtime File
    const size = (file as any).size ? Number((file as any).size) : undefined;
    if (typeof size === 'number' && size > maxBytes) {
      return NextResponse.json({ error: `File too large. Max allowed is ${Math.round(maxBytes / (1024 * 1024))}MB` }, { status: 413 });
    }

    // Build a safe filename
    const origName = (file as any).name ? String((file as any).name) : 'upload.bin';
    const ext = path.extname(origName) || '';
    const rand = crypto.randomBytes(6).toString('hex');
    const filename = `${Date.now()}-${rand}${ext}`;

    // Preferred: Google Drive if explicitly selected, else Google Cloud Storage
    const target = String(process.env.UPLOAD_TARGET || '').toLowerCase();
    const useDriveSa = target === 'gdrive';
    const useDriveOauth = target === 'gdrive_oauth';
    const hasGcs = !!(process.env.GCS_BUCKET && process.env.GCS_CLIENT_EMAIL && process.env.GCS_PRIVATE_KEY);
    const hasDriveSa = !!(
      process.env.GDRIVE_ROOT_FOLDER_ID &&
      process.env.GDRIVE_CLIENT_EMAIL &&
      (process.env.GDRIVE_PRIVATE_KEY || process.env.GDRIVE_PRIVATE_KEY_B64)
    );
    const hasDriveOauth = !!(
      process.env.GDRIVE_ROOT_FOLDER_ID &&
      process.env.GDRIVE_OAUTH_CLIENT_ID &&
      process.env.GDRIVE_OAUTH_CLIENT_SECRET &&
      process.env.GDRIVE_OAUTH_REFRESH_TOKEN
    );

    // Google Drive via OAuth (personal My Drive)
    if (useDriveOauth && hasDriveOauth) {
      try {
        const safeTicket = String(ticketRaw || 'misc').replace(/[^A-Za-z0-9_\-]/g, '') || 'misc';
        const now = new Date();
        const y = String(now.getFullYear());
        const m = String(now.getMonth() + 1).padStart(2, '0');

        const oauth2 = new google.auth.OAuth2({
          clientId: process.env.GDRIVE_OAUTH_CLIENT_ID,
          clientSecret: process.env.GDRIVE_OAUTH_CLIENT_SECRET,
        } as any);
        oauth2.setCredentials({ refresh_token: process.env.GDRIVE_OAUTH_REFRESH_TOKEN });
        const drive = google.drive({ version: 'v3', auth: oauth2 });

        const rootId = process.env.GDRIVE_ROOT_FOLDER_ID as string;

        async function ensureChildFolder(childName: string, parentId: string) {
          const q = [
            `name = '${childName.replace(/'/g, "\\'")}'`,
            "mimeType = 'application/vnd.google-apps.folder'",
            `'${parentId}' in parents`,
            'trashed = false',
          ].join(' and ');
          const list = await drive.files.list({ q, fields: 'files(id)', includeItemsFromAllDrives: true, supportsAllDrives: true, pageSize: 1 } as any);
          const existing = list.data.files?.[0]?.id;
          if (existing) return existing;
          const created = await drive.files.create({
            requestBody: { name: childName, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
            fields: 'id',
            supportsAllDrives: true,
          } as any);
          return String(created.data.id);
        }

        const ticketsFolderId = await ensureChildFolder('tickets', rootId);
        const ticketFolderId = await ensureChildFolder(safeTicket, ticketsFolderId);
        const yearFolderId = await ensureChildFolder(y, ticketFolderId);
        const monthFolderId = await ensureChildFolder(m, yearFolderId);

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const createdFile = await drive.files.create({
          requestBody: { name: filename, parents: [monthFolderId] },
          media: { mimeType: (file as any).type || 'application/octet-stream', body: Readable.from(buffer) as any },
          fields: 'id, webViewLink, webContentLink',
          supportsAllDrives: true,
        } as any);
        const fileId = String(createdFile.data.id);

        const makePublic = String(process.env.GDRIVE_PUBLIC || '').toLowerCase() === 'true';
        if (makePublic) {
          try {
            await drive.permissions.create({ fileId, requestBody: { role: 'reader', type: 'anyone' }, supportsAllDrives: true } as any);
          } catch {}
        }

        const url = makePublic
          ? `https://drive.google.com/uc?id=${fileId}&export=download`
          : createdFile.data.webViewLink || createdFile.data.webContentLink || `https://drive.google.com/file/d/${fileId}/view`;

        return NextResponse.json({ url });
      } catch (gdriveErr: any) {
        return NextResponse.json({ error: gdriveErr?.message || 'Google Drive (OAuth) upload failed' }, { status: 500 });
      }
    }

    if (useDriveSa && hasDriveSa) {
      try {
        const safeTicket = String(ticketRaw || 'misc').replace(/[^A-Za-z0-9_\-]/g, '') || 'misc';
        const now = new Date();
        const y = String(now.getFullYear());
        const m = String(now.getMonth() + 1).padStart(2, '0');

        // Normalize private key from env: supports \n-escaped, raw multiline, or base64-encoded
        function normalizePemFromEnv(v?: string, b64?: string): string {
          if (b64 && b64.trim()) {
            try { return Buffer.from(b64.trim(), 'base64').toString('utf8'); } catch {}
          }
          let s = String(v || '');
          // Strip BOM, wrapping quotes, and stray trailing commas/semicolons
          s = s.replace(/^\uFEFF/, '').trim();
          if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith('\'') && s.endsWith('\''))) {
            s = s.slice(1, -1).trim();
          }
          s = s.replace(/[;,]+$/g, '').trim();
          // Unescape \n to real newlines
          s = s.replace(/\\n/g, '\n');
          // If it looks base64 and doesn't include BEGIN, try decode
          const looksLikeBase64 = !s.includes('BEGIN') && /^[A-Za-z0-9+/=\r\n]+$/.test(s);
          if (looksLikeBase64) {
            try { s = Buffer.from(s, 'base64').toString('utf8'); } catch {}
          }
          // Normalize line endings
          s = s.replace(/\r\n/g, '\n');
          return s.trim();
        }

        const auth = new google.auth.JWT({
          email: process.env.GDRIVE_CLIENT_EMAIL,
          key: normalizePemFromEnv(process.env.GDRIVE_PRIVATE_KEY, process.env.GDRIVE_PRIVATE_KEY_B64),
          scopes: ['https://www.googleapis.com/auth/drive'],
        });
        const drive = google.drive({ version: 'v3', auth });

        // Create/find the intermediate folders in order under the configured root
        const rootId = process.env.GDRIVE_ROOT_FOLDER_ID as string; // Must be accessible by the service account

        async function ensureChildFolder(childName: string, parentId: string) {
          const q = [
            `name = '${childName.replace(/'/g, "\\'")}'`,
            "mimeType = 'application/vnd.google-apps.folder'",
            `'${parentId}' in parents`,
            'trashed = false',
          ].join(' and ');
          const list = await drive.files.list({ q, fields: 'files(id)', includeItemsFromAllDrives: true, supportsAllDrives: true, pageSize: 1 } as any);
          const existing = list.data.files?.[0]?.id;
          if (existing) return existing;
          const created = await drive.files.create({
            requestBody: { name: childName, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
            fields: 'id',
            supportsAllDrives: true,
          } as any);
          return String(created.data.id);
        }

        const ticketsFolderId = await ensureChildFolder('tickets', rootId);
        const ticketFolderId = await ensureChildFolder(safeTicket, ticketsFolderId);
        const yearFolderId = await ensureChildFolder(y, ticketFolderId);
        const monthFolderId = await ensureChildFolder(m, yearFolderId);

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mime = (file as any).type || 'application/octet-stream';

        const createdFile = await drive.files.create({
          requestBody: { name: filename, parents: [monthFolderId] },
          media: { mimeType: mime, body: Readable.from(buffer) as any },
          fields: 'id, webViewLink, webContentLink',
          supportsAllDrives: true,
        } as any);

        const fileId = String(createdFile.data.id);

        // Optionally make public for direct linking
        const makePublic = String(process.env.GDRIVE_PUBLIC || '').toLowerCase() === 'true';
        if (makePublic) {
          try {
            await drive.permissions.create({
              fileId,
              requestBody: { role: 'reader', type: 'anyone' },
              supportsAllDrives: true,
            } as any);
          } catch {}
        }

        const directUrl = makePublic
          ? `https://drive.google.com/uc?id=${fileId}&export=download`
          : createdFile.data.webViewLink || createdFile.data.webContentLink || `https://drive.google.com/file/d/${fileId}/view`;

        return NextResponse.json({ url: directUrl, id: fileId });
      } catch (gdriveErr: any) {
        return NextResponse.json({ error: gdriveErr?.message || 'Google Drive upload failed' }, { status: 500 });
      }
    }

    // Google Cloud Storage if configured
    if (hasGcs) {
      try {
        const safeTicket = String(ticketRaw || 'misc').replace(/[^A-Za-z0-9_\-]/g, '') || 'misc';
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const key = `tickets/${safeTicket}/${y}/${m}/${filename}`;
        // Normalize GCS private key similarly for robustness
        const normalizePem = (v?: string, b64?: string) => {
          if (b64 && b64.trim()) {
            try { return Buffer.from(b64.trim(), 'base64').toString('utf8'); } catch {}
          }
          let s = String(v || '');
          s = s.replace(/^\uFEFF/, '').trim();
          if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith('\'') && s.endsWith('\''))) {
            s = s.slice(1, -1).trim();
          }
          s = s.replace(/[;,]+$/g, '').trim();
          s = s.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
          const looksLikeBase64 = !s.includes('BEGIN') && /^[A-Za-z0-9+/=\r\n]+$/.test(s);
          if (looksLikeBase64) {
            try { s = Buffer.from(s, 'base64').toString('utf8'); } catch {}
          }
          return s.trim();
        };
        const storage = new Storage({
          projectId: process.env.GCS_PROJECT_ID,
          credentials: {
            client_email: process.env.GCS_CLIENT_EMAIL,
            private_key: normalizePem(process.env.GCS_PRIVATE_KEY, process.env.GCS_PRIVATE_KEY_B64),
          },
        });
        const bucket = storage.bucket(process.env.GCS_BUCKET as string);
        const fileRef = bucket.file(key);
        const arrayBuffer = await file.arrayBuffer();
        await fileRef.save(Buffer.from(arrayBuffer), {
          resumable: false,
          contentType: (file as any).type || 'application/octet-stream',
          cacheControl: 'public, max-age=31536000',
        });
        const url = `https://storage.googleapis.com/${process.env.GCS_BUCKET}/${key}`;
        return NextResponse.json({ url });
      } catch (gcsErr: any) {
        // If GCS configured but failed, surface error for faster diagnosis
        return NextResponse.json({ error: gcsErr?.message || 'GCS upload failed' }, { status: 500 });
      }
    }

    // Try Vercel Blob (primary path on Vercel if GCS not configured)
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const safeTicket = String(ticketRaw || 'misc').replace(/[^A-Za-z0-9_\-]/g, '') || 'misc';
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const key = `tickets/${safeTicket}/${y}/${m}/${filename}`;
      const res = await put(key, buffer, {
        access: 'public',
        contentType: (file as any).type || undefined,
        token: process.env.BLOB_READ_WRITE_TOKEN, // optional locally; set on Vercel via integration
      } as any);
      return NextResponse.json({ url: res.url });
    } catch (blobErr) {
      // On Vercel, filesystem is read-only. If Blob failed, surface a clear error.
      if (process.env.VERCEL) {
        const message =
          'Vercel Blob is not configured. Install the Vercel Blob integration for this project or set BLOB_READ_WRITE_TOKEN.';
        return NextResponse.json({ error: message, details: String((blobErr as any)?.message || blobErr) }, { status: 500 });
      }
      // Fallback to local public/uploads when running locally (non-Vercel)
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadDir, { recursive: true });
        const outPath = path.join(uploadDir, filename);
        await writeFile(outPath, buffer);
        const urlPath = `/uploads/${filename}`;
        return NextResponse.json({ url: urlPath });
      } catch (fallbackErr: any) {
        const message = (fallbackErr?.message || (blobErr as any)?.message || 'Upload failed');
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Upload failed' }, { status: 500 });
  }
}

