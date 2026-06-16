require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const multer = require('multer');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { createCanvas } = require('canvas');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'urdu-secret',
  resave: false, saveUninitialized: false,
  cookie: { secure: true, httpOnly: true, sameSite: 'none', maxAge: 24 * 60 * 60 * 1000 }
}));

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB for 1000 pages
  fileFilter: (req, file, cb) => {
    const ok = ['application/pdf','image/jpeg','image/jpg','image/png','image/webp'];
    ok.includes(file.mimetype) ? cb(null, true) : cb(new Error('Sirf PDF ya Image allowed hai'));
  }
});

// ─── OAuth ───────────────────────────────────────────────────────────────────
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/auth/google/callback'
);
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

app.get('/auth/google', (req, res) => {
  res.redirect(oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' }));
});
app.get('/auth/google/callback', async (req, res) => {
  try {
    const { tokens } = await oauth2Client.getToken(req.query.code);
    oauth2Client.setCredentials(tokens);
    const { data: u } = await google.oauth2({ version: 'v2', auth: oauth2Client }).userinfo.get();
    req.session.tokens = tokens;
    req.session.user = { id: u.id, name: u.name, email: u.email, picture: u.picture };
    const userData = Buffer.from(JSON.stringify(req.session.user)).toString('base64');
    const tokenData = Buffer.from(JSON.stringify(tokens)).toString('base64');
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?login=success&user=${userData}&token=${tokenData}`);
  } catch (e) {
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?login=error`);
  }
});
app.get('/auth/user', (req, res) =>
  req.session.user ? res.json({ loggedIn: true, user: req.session.user }) : res.json({ loggedIn: false }));
app.post('/auth/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });

const requireAuth = (req, res, next) => {
  const tokenHeader = req.headers['x-tokens'] || req.get('X-Tokens');
  if (!req.session.tokens && !req.session.user && !tokenHeader) {
    return res.status(401).json({ error: 'Login karo' });
  }
  if (tokenHeader) {
    try {
      const tokens = JSON.parse(tokenHeader);
      req.session.tokens = tokens;
    } catch (e) {
      console.error('Failed to parse tokens:', e.message);
    }
  }
  if (req.session.tokens) oauth2Client.setCredentials(req.session.tokens);
  next();
};

// ─── PDF Search & Extract Cache ──────────────────────────────────────────────
const pdfCache = new Map();
const PDF_CACHE_TTL = 3600000; // 1 hour

async function extractPdfText(pdfData) {
  const pdfDoc = await pdfjsLib.getDocument({
    data: pdfData, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true
  }).promise;
  const pageCount = pdfDoc.numPages;
  const pages = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items.map(item => item.str || '').join(' ');
    pages.push({ pageNum: i, text });
  }
  return pages;
}

app.post('/api/pdf/extract', requireAuth, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'PDF upload karo' });
    const pdfData = fs.readFileSync(req.file.path);
    const pdfId = uuidv4();

    const pages = await extractPdfText(pdfData);
    pdfCache.set(pdfId, { pages, uploadedAt: Date.now() });
    setTimeout(() => pdfCache.delete(pdfId), PDF_CACHE_TTL);

    fs.unlinkSync(req.file.path);
    res.json({ pdfId, pageCount: pages.length });
  } catch (e) {
    res.status(500).json({ error: 'PDF extract mein error: ' + e.message });
  }
});

app.post('/api/pdf/search', requireAuth, (req, res) => {
  try {
    const { pdfId, searchTerm, caseSensitive = false, wholeWord = false } = req.body;
    if (!pdfId || !searchTerm) return res.status(400).json({ error: 'pdfId aur searchTerm chahiye' });

    const cached = pdfCache.get(pdfId);
    if (!cached) return res.status(404).json({ error: 'PDF cache expire hogaya, dobara upload karo' });

    const pattern = wholeWord
      ? new RegExp(`\\b${searchTerm}\\b`, caseSensitive ? 'g' : 'gi')
      : new RegExp(searchTerm, caseSensitive ? 'g' : 'gi');

    const results = [];
    cached.pages.forEach(({ pageNum, text }) => {
      const matches = text.match(pattern);
      if (matches) {
        const startIdx = Math.max(0, text.toLowerCase().indexOf(searchTerm.toLowerCase()) - 80);
        const endIdx = Math.min(text.length, startIdx + 160);
        const snippet = text.substring(startIdx, endIdx).trim();
        results.push({ pageNum, matchCount: matches.length, snippet: `...${snippet}...` });
      }
    });

    res.json({ searchTerm, totalMatches: results.reduce((sum, r) => sum + r.matchCount, 0), results });
  } catch (e) {
    res.status(500).json({ error: 'Search error: ' + e.message });
  }
});

// ─── Progress SSE ─────────────────────────────────────────────────────────────
const progressMap = new Map();
app.get('/api/progress/:jobId', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const send = d => res.write(`data: ${JSON.stringify(d)}\n\n`);
  const iv = setInterval(() => {
    const p = progressMap.get(req.params.jobId);
    if (p) {
      send(p);
      if (p.status === 'done' || p.status === 'error') { clearInterval(iv); res.end(); }
    }
  }, 400);
  req.on('close', () => clearInterval(iv));
});

// ─── PDF → PNG (parallel batch) ──────────────────────────────────────────────
async function pdfPageToImage(pdfData, pageNum, outputPath) {
  const pdfDoc = await pdfjsLib.getDocument({
    data: pdfData, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true
  }).promise;
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));
}

async function convertPagesParallel(pdfData, totalPages, tempDir, update) {
  const CONCURRENT = 6; // 6 pages at once for speed
  const imagePaths = new Array(totalPages).fill(null);
  let done = 0;

  for (let start = 0; start < totalPages; start += CONCURRENT) {
    const batch = [];
    for (let i = start; i < Math.min(start + CONCURRENT, totalPages); i++) {
      const imgPath = path.join(tempDir, `page_${i + 1}.png`);
      batch.push(
        pdfPageToImage(pdfData, i + 1, imgPath)
          .then(() => { imagePaths[i] = { path: imgPath, mime: 'image/png' }; })
          .catch(e => console.error(`Page ${i+1} error:`, e.message))
      );
    }
    await Promise.all(batch);
    done = Math.min(start + CONCURRENT, totalPages);
    update(2, Math.round(10 + (done / totalPages) * 35), `Images: ${done} / ${totalPages} pages...`);
  }
  return imagePaths.filter(Boolean);
}

// ─── OCR parallel batches ─────────────────────────────────────────────────────
async function ocrBatch(drive, folderId, pages, onProgress) {
  const CONCURRENT = 5;
  const results = new Array(pages.length).fill({ page: 0, text: '' });
  let done = 0;

  for (let start = 0; start < pages.length; start += CONCURRENT) {
    const batch = pages.slice(start, start + CONCURRENT).map(async ({ path: imgPath, mime, pageNum }, idx) => {
      try {
        const up = await drive.files.create({
          requestBody: { name: `p${pageNum}`, parents: [folderId], mimeType: 'application/vnd.google-apps.document' },
          media: { mimeType: mime, body: fs.createReadStream(imgPath) },
          fields: 'id'
        });
        const docId = up.data.id;
        const txt = await drive.files.export({ fileId: docId, mimeType: 'text/plain' });
        await drive.files.delete({ fileId: docId }).catch(() => {});
        results[start + idx] = { page: pageNum, text: typeof txt.data === 'string' ? txt.data : '' };
      } catch (e) {
        console.error(`OCR page ${pageNum}:`, e.message);
        results[start + idx] = { page: pageNum, text: '' };
      }
    });
    await Promise.all(batch);
    done = Math.min(start + CONCURRENT, pages.length);
    onProgress(done);
  }
  return results;
}

// ─── Clean text ───────────────────────────────────────────────────────────────
function cleanText(raw) {
  if (!raw) return [];
  return raw.split('\n')
    .map(l => l.trim())
    .filter(l => l.length >= 2)
    .filter(l => !/^[\s\.\-\–\—\|_\d،؟!]+$/.test(l));
}

// ─── Build Word doc ───────────────────────────────────────────────────────────
async function buildWordDoc(extractedTexts, outputPath) {
  const { Document, Paragraph, TextRun, AlignmentType, PageBreak, convertInchesToTwip } = require('docx');
  const FONT = 'Jameel Noori Nastaleeq';
  const SIZE = 34;
  const NS = { before: 0, after: 0, line: 240, lineRule: 'auto' };

  const makePara = text => new Paragraph({
    children: [new TextRun({ text, font: FONT, size: SIZE, color: '000000', bold: false, rightToLeft: true })],
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    spacing: NS,
  });

  const children = [];
  for (let i = 0; i < extractedTexts.length; i++) {
    if (i > 0) children.push(new Paragraph({ children: [new PageBreak()], spacing: NS }));
    const lines = cleanText(extractedTexts[i].text);
    if (lines.length === 0) { children.push(makePara(' ')); continue; }
    for (const line of lines) children.push(makePara(line));
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: SIZE, color: '000000', bold: false },
          paragraph: { alignment: AlignmentType.RIGHT, bidirectional: true, spacing: NS }
        }
      }
    },
    sections: [{
      properties: { page: { margin: { top: convertInchesToTwip(1), right: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1) } } },
      children
    }]
  });
  const { Packer } = require('docx');
  fs.writeFileSync(outputPath, await Packer.toBuffer(doc));
}

// ─── Convert Route ────────────────────────────────────────────────────────────
app.post('/api/convert', (req, res, next) => {
  const tokenHeader = req.headers['x-tokens'] || req.get('X-Tokens');
  if (!req.session.tokens && !req.session.user && !tokenHeader) {
    console.log('Auth failed - no tokens. Headers:', req.headers);
    return res.status(401).json({ error: 'Login karo' });
  }
  if (tokenHeader) {
    try {
      const tokens = JSON.parse(tokenHeader);
      req.session.tokens = tokens;
    } catch (e) {
      console.error('Failed to parse tokens from header:', e.message);
    }
  }
  next();
}, upload.single('pdf'), async (req, res) => {
  const jobId = uuidv4();
  res.json({ jobId });

  const update = (step, percent, message) =>
    progressMap.set(jobId, { step, percent, message, status: 'processing' });

  const filePath = req.file.path;
  const originalName = req.file.originalname.replace(/\.(pdf|jpg|jpeg|png|webp)$/i, '');
  const fileMime = req.file.mimetype;
  const tempDir = path.join('uploads', `tmp_${jobId}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const { data: { id: folderId } } = await drive.files.create({
      requestBody: { name: `OCR_${Date.now()}`, mimeType: 'application/vnd.google-apps.folder' },
      fields: 'id'
    });

    let ocrPages = [];

    if (fileMime === 'application/pdf') {
      update(1, 5, 'PDF load ho raha hai...');
      const pdfData = new Uint8Array(fs.readFileSync(filePath));
      const pdfDoc = await pdfjsLib.getDocument({ data: pdfData, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
      const totalPages = Math.min(pdfDoc.numPages, 1000); // max 1000
      console.log(`Pages: ${totalPages}`);
      update(1, 8, `${totalPages} pages milein. Fast conversion shuru...`);

      const imagePaths = await convertPagesParallel(pdfData, totalPages, tempDir, update);
      ocrPages = imagePaths.map((p, i) => ({ ...p, pageNum: i + 1 }));
    } else {
      update(1, 20, 'Image ready. OCR shuru...');
      ocrPages = [{ path: filePath, mime: fileMime, pageNum: 1 }];
    }

    if (ocrPages.length === 0) throw new Error('Koi page process nahi hua');
    update(2, 47, `${ocrPages.length} pages OCR ke liye ready...`);

    const extractedTexts = await ocrBatch(drive, folderId, ocrPages, done => {
      update(3, Math.round(47 + (done / ocrPages.length) * 43), `OCR: ${done} / ${ocrPages.length} pages...`);
    });

    await drive.files.delete({ fileId: folderId }).catch(() => {});
    update(4, 93, 'Word file ban rahi hai...');

    const outputPath = path.join('uploads', `${jobId}_out.docx`);
    await buildWordDoc(extractedTexts, outputPath);

    progressMap.set(jobId, {
      status: 'done', percent: 100,
      message: 'Tayyar! Word file download karo.',
      downloadUrl: `/api/download/${jobId}/${encodeURIComponent(originalName)}`
    });

    fs.rmSync(tempDir, { recursive: true, force: true });
    try { fs.unlinkSync(filePath); } catch {}

  } catch (err) {
    console.error('Error:', err);
    progressMap.set(jobId, { status: 'error', percent: 0, message: `Error: ${err.message}` });
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    try { fs.unlinkSync(filePath); } catch {}
  }
});

// ─── Download ─────────────────────────────────────────────────────────────────
app.get('/api/download/:jobId/:filename', (req, res) => {
  const fp = path.join('uploads', `${req.params.jobId}_out.docx`);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'File nahi mili' });
  res.download(fp, `${decodeURIComponent(req.params.filename)}_urdu.docx`, () => fs.unlink(fp, () => {}));
});

fs.mkdirSync('uploads', { recursive: true });
app.listen(PORT, () => console.log(`✅ Server: http://localhost:${PORT}`));
