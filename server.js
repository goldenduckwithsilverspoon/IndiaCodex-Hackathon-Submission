import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import morgan from 'morgan';
import cors from 'cors';
import mime from 'mime-types';

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.resolve('data');
const META_FILE = path.join(DATA_DIR, 'index.json');
const PUBLIC_DIR = path.resolve('public');

// Ensure directories exist
await fsp.mkdir(DATA_DIR, { recursive: true });
await fsp.mkdir(PUBLIC_DIR, { recursive: true });

// Load or init metadata index
let index = {};
try {
  const raw = await fsp.readFile(META_FILE, 'utf8');
  index = JSON.parse(raw);
} catch {
  index = { files: {} };
}

function toHexSha256(buffer) {
  const hash = crypto.createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex');
}

function cidToPath(cid) {
  const prefix = cid.slice(0, 2);
  return path.join(DATA_DIR, prefix, cid);
}

async function saveIndex() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.writeFile(META_FILE, JSON.stringify(index, null, 2));
}

const storage = multer.memoryStorage();
const upload = multer({ storage });

const app = express();
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Static dashboard
app.use('/', express.static(PUBLIC_DIR));

// Upload endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });
    const { buffer, originalname } = req.file;
    const cid = toHexSha256(buffer);
    const filePath = cidToPath(cid);
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    // If not exists, write; otherwise skip
    try {
      await fsp.access(filePath, fs.constants.F_OK);
    } catch {
      await fsp.writeFile(filePath, buffer);
    }
    const size = buffer.length;
    const contentType = mime.lookup(originalname) || 'application/octet-stream';
    const now = new Date().toISOString();
    index.files[cid] = {
      name: originalname,
      size,
      contentType,
      createdAt: index.files[cid]?.createdAt ?? now,
      updatedAt: now
    };
    await saveIndex();
    res.json({ cid, url: `/content/${cid}`, size, contentType });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'upload failed' });
  }
});

// List files
app.get('/api/files', (req, res) => {
  const files = Object.entries(index.files).map(([cid, meta]) => ({ cid, ...meta }));
  // sort by updatedAt desc
  files.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  res.json({ files });
});

// File metadata
app.get('/api/meta/:cid', (req, res) => {
  const cid = req.params.cid;
  const meta = index.files[cid];
  if (!meta) return res.status(404).json({ error: 'not found' });
  res.json({ cid, ...meta });
});

// Serve content by CID
app.get('/content/:cid', async (req, res) => {
  const cid = req.params.cid;
  const meta = index.files[cid];
  const filePath = cidToPath(cid);
  try {
    await fsp.access(filePath, fs.constants.R_OK);
  } catch {
    return res.status(404).send('Not found');
  }
  const contentType = meta?.contentType || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  fs.createReadStream(filePath).pipe(res);
});

// Basic health
app.get('/health', (req, res) => {
  res.json({ ok: true, files: Object.keys(index.files).length });
});

app.listen(PORT, () => {
  console.log(`CardanoStream Lite running on http://localhost:${PORT}`);
});
