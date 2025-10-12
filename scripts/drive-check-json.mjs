import fs from 'fs';
import { google } from 'googleapis';

const jsonPath = 'C:/Users/Admin/Downloads/review-465007-c9798f19dd2e.json';
if (!fs.existsSync(jsonPath)) {
  console.error('Key JSON not found at', jsonPath);
  process.exit(1);
}
const j = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const email = j.client_email;
const key = j.private_key;
const root = process.env.GDRIVE_ROOT_FOLDER_ID || '1Bpucv3VhdjWr95SkUouW7-7-9bmUaNl6';

(async () => {
  try {
    const auth = new google.auth.JWT({ email, key, scopes: ['https://www.googleapis.com/auth/drive.file'] });
    const drive = google.drive({ version: 'v3', auth });
    const meta = await drive.files.get({ fileId: root, fields: 'id,name', supportsAllDrives: true });
    console.log(JSON.stringify({ ok: true, root: meta.data }, null, 2));
  } catch (e) {
    console.error(JSON.stringify({ ok: false, error: e?.message || e?.response?.data || String(e) }, null, 2));
    process.exitCode = 1;
  }
})();

