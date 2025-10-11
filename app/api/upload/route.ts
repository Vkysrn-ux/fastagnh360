import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { put } from '@vercel/blob';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
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

    // Try Vercel Blob first (primary path when deployed on Vercel)
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const key = `uploads/${filename}`;
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

