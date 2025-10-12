# nh360

## File uploads

This project supports file uploads via Google Cloud Storage (when configured), Google Drive (optional), Vercel Blob (default on Vercel), or local `public/uploads` during local development.

### Use Google Drive (per-ticket folders)

The upload API can save files to Google Drive under `tickets/<ticket>/<YYYY>/<MM>/` when the `UPLOAD_TARGET=gdrive` environment variable is set and Drive credentials are provided.

1) Create and configure a Service Account

- In Google Cloud Console, create a Service Account for Drive uploads.
- Create a JSON key and note the `client_email` and `private_key`.
- Give the service account access to a Shared Drive or a specific folder in your personal "My Drive" by sharing that drive/folder with the service account email.
  - Recommended: use a Shared Drive and add the service account as Content manager.

2) Create or choose a root folder in Drive

- Create a folder that will act as the root for uploads (e.g., `fastag-uploads`).
- Copy its Folder ID from the URL. Example:
  - `https://drive.google.com/drive/folders/1AbCdEf...` → Folder ID is `1AbCdEf...`

3) Set environment variables

Add these to `.env.local` (escape newlines in the key with `\n`) and to your hosting environment:

```
UPLOAD_TARGET=gdrive
GDRIVE_ROOT_FOLDER_ID=<Drive folder ID>
GDRIVE_CLIENT_EMAIL=<service account client_email>

# Option A: PEM in env (escape newlines with \n)
GDRIVE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Option B: Base64 of the PEM (avoids newline issues)
# Run: base64 -w0 key.pem  (or use any base64 tool)
# Then set:
# GDRIVE_PRIVATE_KEY_B64=<base64 string>

# Optional: make uploaded files publicly readable and return a direct link
GDRIVE_PUBLIC=true
```

4) Install dependency

```
npm install googleapis
```

5) Test

- Upload via UI, or run:
```
curl -F "file=@/path/to/photo.jpg" -F "ticket=TK12345" http://localhost:3000/api/upload
```
- The API responds with `{ url: "..." }`. When `GDRIVE_PUBLIC=true`, the URL is a public, direct link suitable for embedding.

Notes:
- Service accounts cannot access your personal Drive unless you explicitly share a folder or use a Shared Drive.
- If you keep `GDRIVE_PUBLIC` unset/false, the returned link will require a Google account with access.

Troubleshooting:
- Use `/api/drive-health?debug=1` to verify access and see key diagnostics (no secrets shown).
- If you see `DECODER routines::unsupported`, prefer `GDRIVE_PRIVATE_KEY_B64`.
