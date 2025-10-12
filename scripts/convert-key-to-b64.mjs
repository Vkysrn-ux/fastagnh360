import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
// Try to capture multiline quoted value for GDRIVE_PRIVATE_KEY
const m = env.match(/GDRIVE_PRIVATE_KEY\s*=\s*([\s\S]*)/);
if (!m) {
  console.error('GDRIVE_PRIVATE_KEY not found');
  process.exit(1);
}
let raw = m[1].trim();
// Stop at next env var if not quoted
const nextIdx = raw.indexOf('\nG');
if (!raw.startsWith('"') && nextIdx !== -1) raw = raw.slice(0, nextIdx).trim();
// Strip surrounding quotes
if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
  raw = raw.slice(1, -1);
}
// Unescape \n into real newlines
const pem = raw.replace(/\\n/g, '\n');
const b64 = Buffer.from(pem, 'utf8').toString('base64');
console.log(b64);

