require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const multer = require('multer');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { createCanvas, registerFont } = require('canvas');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

// Register bundled Urdu font for rendering Urdu text in generated PDFs.
// node-canvas uses HarfBuzz so it shapes/joins Urdu correctly (RTL aware).
try {
  registerFont(path.join(__dirname, 'fonts', 'Amiri-Regular.ttf'), { family: 'Amiri' });
} catch (e) { console.error('Font register error:', e.message); }

const app = express();
const PORT = process.env.PORT || 5000;
const SERVER_START = Date.now();

// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS ENGINE
// ═══════════════════════════════════════════════════════════════════════════
// DATA_DIR is configurable so it can point to a persistent Railway Volume
// (e.g. DATA_DIR=/data). Defaults to local ./data for development.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const ANALYTICS_PATH = path.join(DATA_DIR, 'analytics.json');

let analytics = { users: {}, dailyStats: {}, recentActivity: [] };

function loadAnalytics() {
  try {
    if (fs.existsSync(ANALYTICS_PATH)) {
      analytics = JSON.parse(fs.readFileSync(ANALYTICS_PATH, 'utf8'));
    }
  } catch (e) { console.error('Analytics load error:', e.message); }
}

function saveAnalytics() {
  try {
    const dir = path.dirname(ANALYTICS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ANALYTICS_PATH, JSON.stringify(analytics));
  } catch (e) { console.error('Analytics save error:', e.message); }
}

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

function ensureDay(key) {
  if (!analytics.dailyStats[key]) {
    analytics.dailyStats[key] = { converts: 0, searches: 0, indexes: 0, newUsers: 0 };
  }
}

function trackUser(user) {
  if (!user?.id) return;
  const today = todayKey();
  ensureDay(today);
  if (!analytics.users[user.id]) {
    analytics.users[user.id] = {
      name: user.name, email: user.email, picture: user.picture,
      firstSeen: Date.now(), lastSeen: Date.now(),
      converts: 0, searches: 0, indexes: 0
    };
    analytics.dailyStats[today].newUsers++;
  } else {
    analytics.users[user.id].lastSeen = Date.now();
    analytics.users[user.id].name    = user.name;
    analytics.users[user.id].picture = user.picture;
  }
  saveAnalytics();
}

function trackEvent(type, user, details = '') {
  const today = todayKey();
  ensureDay(today);
  if (analytics.dailyStats[today][type] !== undefined) analytics.dailyStats[today][type]++;
  if (user?.id && analytics.users[user.id]) analytics.users[user.id][type]++;

  analytics.recentActivity.unshift({
    type, userId: user?.id, userName: user?.name || 'Unknown',
    userPicture: user?.picture, timestamp: Date.now(), details
  });
  if (analytics.recentActivity.length > 300) analytics.recentActivity.length = 300;
  saveAnalytics();
}

loadAnalytics();

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM DICTIONARY (user-taught vocabulary for فہارس detection)
// User uploads word-lists so the system learns which words are personalities,
// places, books, languages — supplements the built-in lists.
// ═══════════════════════════════════════════════════════════════════════════
const DICT_PATH = path.join(DATA_DIR, 'dictionary.json');
const DICT_CATS = ['شخصیات', 'اماکن', 'کتابیں', 'زبانیں'];

let customDict = { شخصیات: [], اماکن: [], کتابیں: [], زبانیں: [] };

function loadDictionary() {
  try {
    if (fs.existsSync(DICT_PATH)) {
      const d = JSON.parse(fs.readFileSync(DICT_PATH, 'utf8'));
      for (const c of DICT_CATS) customDict[c] = Array.isArray(d[c]) ? d[c] : [];
    }
  } catch (e) { console.error('Dictionary load error:', e.message); }
}

function saveDictionary() {
  try {
    const dir = path.dirname(DICT_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DICT_PATH, JSON.stringify(customDict));
  } catch (e) { console.error('Dictionary save error:', e.message); }
}

// Add an array of terms to a category (dedupe, trim, drop blanks/too-short)
function addDictTerms(category, terms) {
  if (!DICT_CATS.includes(category)) return 0;
  const existing = new Set(customDict[category]);
  let added = 0;
  for (let t of terms) {
    if (typeof t !== 'string') continue;
    t = t.replace(/[۔،؟!:؛"'()\[\]{}]/g, '').trim().replace(/\s+/g, ' ');
    if (t.length < 2 || existing.has(t)) continue;
    existing.add(t);
    customDict[category].push(t);
    added++;
  }
  if (added > 0) saveDictionary();
  return added;
}

loadDictionary();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'urdu-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true, httpOnly: true, sameSite: 'none', maxAge: 24 * 60 * 60 * 1000 }
}));

const WORD_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword',                                                         // .doc
]);
const PDF_MIME  = 'application/pdf';
const IMG_MIMES = new Set(['image/jpeg','image/jpg','image/png','image/webp']);

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = PDF_MIME === file.mimetype || WORD_MIMES.has(file.mimetype) || IMG_MIMES.has(file.mimetype);
    ok ? cb(null, true) : cb(new Error('Sirf PDF, Word ya Image allowed hai'));
  }
});

// ─── OAuth Setup ─────────────────────────────────────────────────────────────
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
  res.redirect(oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  }));
});

app.get('/auth/google/callback', async (req, res) => {
  try {
    const { tokens } = await oauth2Client.getToken(req.query.code);
    oauth2Client.setCredentials(tokens);
    const { data: u } = await google.oauth2({ version: 'v2', auth: oauth2Client }).userinfo.get();
    req.session.tokens = tokens;
    req.session.user = { id: u.id, name: u.name, email: u.email, picture: u.picture };
    trackUser(req.session.user);
    const userData = Buffer.from(JSON.stringify(req.session.user)).toString('base64');
    const tokenData = Buffer.from(JSON.stringify(tokens)).toString('base64');
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?login=success&user=${userData}&token=${tokenData}`);
  } catch (e) {
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?login=error`);
  }
});

app.get('/auth/user', (req, res) =>
  req.session.user
    ? res.json({ loggedIn: true, user: req.session.user })
    : res.json({ loggedIn: false })
);

app.post('/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

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
      console.error('Parse error:', e.message);
    }
  }
  if (req.session.tokens) oauth2Client.setCredentials(req.session.tokens);
  next();
};

// ─── PDF Cache & Text Extraction ─────────────────────────────────────────────
const pdfCache = new Map();
const PDF_CACHE_TTL = 3600000; // 1 hour

async function extractPdfText(pdfData) {
  const pdfDoc = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfData),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true
  }).promise;

  const pageCount = pdfDoc.numPages;
  const pages = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();

    let text = '';
    let lastY = null;

    for (const item of textContent.items) {
      // Add spacing between lines
      if (lastY !== null && Math.abs(item.y - lastY) > 2) {
        text += '\n';
      }
      text += (item.str || '');
      lastY = item.y;
    }

    // Normalize: fix spaces and multiple lines
    text = text
      .replace(/\s+\n/g, '\n') // Remove trailing spaces
      .replace(/\n\s+/g, '\n') // Remove leading spaces
      .replace(/\n\n+/g, '\n') // Remove multiple newlines
      .trim();

    console.log(`Page ${i}: ${text.length} chars extracted`);
    pages.push({ pageNum: i, text });
  }

  return pages;
}

// ─── Word (.docx) Text Extraction ────────────────────────────────────────────
async function extractWordText(filePath) {
  const mammoth = require('mammoth');

  // Use HTML output so mammoth inserts <hr> tags at actual Word page breaks
  const result = await mammoth.convertToHtml({ path: filePath });
  const html   = result.value || '';

  // Strip all tags except <hr> (page breaks), replace block tags with newlines
  const normalized = html
    .replace(/<hr\s*\/?>/gi, '\x00PAGEBREAK\x00')  // mark real page breaks
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/div>|<\/li>|<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, '')                         // strip remaining tags
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');

  const sections = normalized.split('\x00PAGEBREAK\x00');
  const hasRealBreaks = sections.length > 1;

  if (hasRealBreaks) {
    // Exact page numbers from actual Word page breaks
    return sections
      .map((sec, i) => ({ pageNum: i + 1, text: sec.replace(/\n{3,}/g, '\n\n').trim() }))
      .filter(p => p.text.length > 0);
  }

  // Fallback: no explicit page breaks — estimate at ~40 lines per page
  // (40 lines is closer to a typical A4 Word page than the old 25)
  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [{ pageNum: 1, text: normalized.trim() }];

  const LINES_PER_PAGE = 40;
  const pages = [];
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
    pages.push({
      pageNum: Math.floor(i / LINES_PER_PAGE) + 1,
      text:    lines.slice(i, i + LINES_PER_PAGE).join('\n')
    });
  }
  return pages;
}

// ─── PDF Extract Endpoint ────────────────────────────────────────────────────
app.post('/api/pdf/extract', requireAuth, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file chahiye' });
    }

    const jobId = uuidv4();
    const pdfId = uuidv4();
    const filePath  = req.file.path;
    const fileMime  = req.file.mimetype;
    const fileName  = req.file.originalname;
    const pdfData   = WORD_MIMES.has(fileMime) ? null : fs.readFileSync(filePath);

    const update = (percent, message) => {
      progressMap.set(jobId, { percent, message, status: 'processing' });
    };

    // Start background process
    (async () => {
      try {
        let pages;
        let usedOcr = false;

        // ── Word file: extract text directly (fast, no OCR) ─────────────────
        if (WORD_MIMES.has(fileMime)) {
          update(10, '📝 Word file se text nikal raha hai...');
          pages = await extractWordText(filePath);
          try { fs.unlinkSync(filePath); } catch (e) {}
          update(90, `✅ ${pages.length} pages ready!`);

        // ── PDF file: try direct text, fall back to OCR ──────────────────────
        } else {
          try { fs.unlinkSync(filePath); } catch (e) {}
          update(5, '📄 PDF load ho rahi hai...');

          pages = await extractPdfText(pdfData);
          const totalChars = pages.reduce((sum, p) => sum + p.text.length, 0);
          const avgPerPage = pages.length ? totalChars / pages.length : 0;
          update(30, `📊 Text mila: ${totalChars} chars`);

          const needsOcr = avgPerPage < 120;
          usedOcr = needsOcr;

          if (needsOcr) {
            update(35, '🖼️ Image PDF detected — OCR shuru...');

            const pdfDoc = await pdfjsLib.getDocument({
              data: new Uint8Array(pdfData),
              useWorkerFetch: false,
              isEvalSupported: false,
              useSystemFonts: true
            }).promise;
            const totalPages = pdfDoc.numPages;

            const tempDir = path.join(__dirname, 'temp', pdfId);
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            const imagePaths = [];
            for (let i = 1; i <= totalPages; i++) {
              const imgPath = path.join(tempDir, `page_${i}.png`);
              try {
                await pdfPageToImage(pdfData, i, imgPath);
                imagePaths.push({ path: imgPath, mime: 'image/png', pageNum: i });
              } catch (e) {
                console.error(`Page ${i}:`, e.message);
              }
            }

            update(50, '🖼️ Pages converted to images');

            if (imagePaths.length > 0) {
              const drive = google.drive({ version: 'v3', auth: oauth2Client });
              const folder = await drive.files.create({
                requestBody: { name: `SEARCH-${pdfId}`, mimeType: 'application/vnd.google-apps.folder' },
                fields: 'id', timeout: 30000
              });
              const folderId = folder.data.id;
              update(55, '🔤 OCR ho rahi hai...');

              pages = Array.from({ length: totalPages }, (_, i) => ({ pageNum: i + 1, text: '' }));
              const ocr = await ocrBatch(drive, folderId, imagePaths, (done) => {
                update(55 + Math.round((done / imagePaths.length) * 40), `🔤 OCR: ${done}/${imagePaths.length} pages`);
              });
              ocr.forEach(({ page, text }) => {
                if (page > 0 && page <= totalPages) pages[page - 1] = { pageNum: page, text };
              });

              try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
            }
          }

          update(95, '✅ Search ke liye taiyaar!');
        }

        // Cache pages (pdfData may be null for Word files — filtered PDF won't work but search/index will)
        pdfCache.set(pdfId, {
          pages,
          pdfData,
          fileName,
          usedOcr,
          isWord: WORD_MIMES.has(fileMime),
          uploadedAt: Date.now()
        });
        setTimeout(() => pdfCache.delete(pdfId), PDF_CACHE_TTL);

        const finalChars = pages.reduce((sum, p) => sum + (p.text ? p.text.length : 0), 0);
        progressMap.set(jobId, {
          percent: 100,
          message: 'Done!',
          status: 'done',
          pdfId,
          pageCount: pages.length,
          extractedChars: finalChars
        });
      } catch (e) {
        console.error('Extract error:', e.message);
        progressMap.set(jobId, {
          percent: 0,
          message: `Error: ${e.message}`,
          status: 'error'
        });
      }
    })();

    res.json({ jobId, pdfId });
  } catch (e) {
    console.error('Extract error:', e);
    res.status(500).json({ error: 'PDF extract fail: ' + e.message });
  }
});

// Normalize Urdu/Arabic text so visually-identical letters match reliably.
function normalizeUrdu(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    // Unify letter variants (Arabic ↔ Urdu)
    .replace(/[يﻱﻲ]/g, 'ی')   // Arabic yeh → Urdu yeh
    .replace(/[كﻙﻚ]/g, 'ک')   // Arabic kaf → Urdu kaf
    .replace(/ۀ/g, 'ہ')
    .replace(/[ةه]/g, 'ہ')      // teh marbuta / arabic heh → urdu heh
    .replace(/[أإآ]/g, 'ا')     // alef variants → bare alef
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ی')
    // Strip diacritics (zer/zabar/pesh/etc.) and kashida
    .replace(/[ً-ْٰـ]/g, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// Reusable search over a cached document (used by the search endpoint + AI assistant)
function runSearch(cached, searchTerm) {
  const needle = normalizeUrdu(searchTerm);
  if (!needle) return { searchTerm, totalMatches: 0, results: [] };

  if (!cached.pageMap) cached.pageMap = buildPageNumberMap(cached.pages).map;
  const pageMap = cached.pageMap;

  const results = [];
  let totalMatches = 0;
  cached.pages.forEach(({ pageNum, text }) => {
    if (!text || text.length === 0) return;
    const hay = normalizeUrdu(text);
    let matchCount = 0, idx = 0;
    while ((idx = hay.indexOf(needle, idx)) !== -1) { matchCount++; idx += needle.length; }
    if (matchCount > 0) {
      const firstIdx = hay.indexOf(needle);
      const startIdx = Math.max(0, firstIdx - 50);
      const endIdx = Math.min(text.length, firstIdx + needle.length + 50);
      const snippet = text.substring(startIdx, endIdx).replace(/\s+/g, ' ').trim();
      results.push({
        pageNum: pageMap[pageNum] || pageNum,
        matchCount,
        snippet: snippet ? `…${snippet}…` : '[preview nahi]'
      });
      totalMatches += matchCount;
    }
  });
  return { searchTerm, totalMatches, results };
}

// Generate spelling/honorific variants of a term to help when nothing is found
function searchVariants(term) {
  const base = (term || '').trim();
  const set = new Set();
  const HONS = ['علامہ','حضرت','مولانا','مرزا','میر','سید','ڈاکٹر','شیخ','حافظ','مولوی','پروفیسر','سر','مسٹر','قاضی','مفتی','امام','خواجہ','پیر'];
  const words = base.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    if (HONS.includes(words[0])) set.add(words.slice(1).join(' '));     // drop leading title
    set.add(words[words.length - 1]);                                   // last name alone
    set.add(words[0]);                                                  // first word
    HONS.forEach(h => set.add(`${h} ${words[words.length - 1]}`));      // title + last name
  }
  return [...set].filter(v => v && v.length >= 2 && normalizeUrdu(v) !== normalizeUrdu(base));
}

// Search with automatic variant fallback (returns best result + what was tried)
function smartSearch(cached, term) {
  const direct = runSearch(cached, term);
  if (direct.totalMatches > 0) return { matchedTerm: term, viaVariant: false, ...direct };
  for (const v of searchVariants(term)) {
    const r = runSearch(cached, v);
    if (r.totalMatches > 0) return { matchedTerm: v, viaVariant: true, original: term, ...r };
  }
  return { matchedTerm: term, viaVariant: false, totalMatches: 0, results: [], triedVariants: searchVariants(term) };
}

// ─── PDF Search Endpoint ─────────────────────────────────────────────────────
app.post('/api/pdf/search', requireAuth, (req, res) => {
  try {
    const { pdfId, searchTerm } = req.body;
    if (!pdfId || !searchTerm) return res.status(400).json({ error: 'pdfId aur searchTerm chahiye' });

    const cached = pdfCache.get(pdfId);
    if (!cached) return res.status(404).json({ error: 'PDF cache expire hogaya' });

    console.log(`🔍 Searching "${searchTerm}" in ${cached.pages.length} pages`);
    const out = runSearch(cached, searchTerm);
    console.log(`✅ Found on ${out.results.length} pages, ${out.totalMatches} total matches`);
    trackEvent('searches', req.session.user, `"${searchTerm}" — ${out.totalMatches} matches`);
    res.json(out);
  } catch (e) {
    console.error('Search error:', e);
    res.status(500).json({ error: 'Search fail: ' + e.message });
  }
});

// ─── Filtered PDF (only the pages where the word was found) ──────────────────
app.post('/api/pdf/create-filtered', requireAuth, async (req, res) => {
  try {
    const { pdfId, pages } = req.body;
    console.log(`📄 create-filtered: pdfId=${pdfId}, pages=${JSON.stringify(pages)}`);

    if (!pdfId || !Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ error: 'pdfId aur pages chahiye' });
    }

    const cached = pdfCache.get(pdfId);
    if (!cached) {
      console.error('create-filtered: cache miss for', pdfId);
      return res.status(404).json({ error: 'PDF cache expire hogaya, dobara upload karo' });
    }
    if (!cached.pdfData) {
      console.error('create-filtered: pdfData missing in cache for', pdfId);
      return res.status(404).json({ error: 'PDF data cache mein nahi, dobara upload karo' });
    }

    console.log(`create-filtered: pdfData size=${cached.pdfData.length} bytes`);

    const { PDFDocument } = require('pdf-lib');
    const pdfBytes = cached.pdfData instanceof Buffer
      ? new Uint8Array(cached.pdfData.buffer, cached.pdfData.byteOffset, cached.pdfData.byteLength)
      : new Uint8Array(cached.pdfData);

    const srcDoc = await PDFDocument.load(pdfBytes);
    const outDoc = await PDFDocument.create();

    const total = srcDoc.getPageCount();
    console.log(`create-filtered: source has ${total} pages, requested: ${pages}`);

    // Unique, sorted, valid (0-based) page indices
    const indices = [...new Set(pages)]
      .map(n => n - 1)
      .filter(i => i >= 0 && i < total)
      .sort((a, b) => a - b);

    if (indices.length === 0) {
      return res.status(400).json({ error: `Koi valid page nahi (total=${total}, requested=${pages})` });
    }

    console.log(`create-filtered: copying indices: ${indices}`);
    const copied = await outDoc.copyPages(srcDoc, indices);
    copied.forEach(p => outDoc.addPage(p));

    const bytes = await outDoc.save();
    console.log(`create-filtered: output size=${bytes.length} bytes`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="matching-pages.pdf"');
    res.send(Buffer.from(bytes));
  } catch (e) {
    console.error('Filtered PDF error:', e.message, e.stack);
    res.status(500).json({ error: 'PDF create fail: ' + e.message });
  }
});

// ─── Details Report (.docx — Urdu-safe) ──────────────────────────────────────
app.post('/api/pdf/create-report', requireAuth, async (req, res) => {
  try {
    const { pdfId, searchTerm, results } = req.body;
    if (!pdfId || !searchTerm || !Array.isArray(results)) {
      return res.status(400).json({ error: 'pdfId, searchTerm aur results chahiye' });
    }

    const cached = pdfCache.get(pdfId);
    if (!cached) return res.status(404).json({ error: 'PDF cache expire' });

    const {
      Document, Paragraph, TextRun, AlignmentType, HeadingLevel, Packer, convertInchesToTwip
    } = require('docx');
    const FONT = 'Jameel Noori Nastaleeq';

    const totalMatches = results.reduce((s, r) => s + (r.matchCount || 0), 0);

    const children = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Search Report', bold: true, size: 40, color: '4361EE' })],
        spacing: { after: 120 }
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        children: [new TextRun({ text: `لفظ: ${searchTerm}`, font: FONT, size: 32, rightToLeft: true, bold: true })],
        spacing: { after: 80 }
      }),
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [new TextRun({
          text: `Found on ${results.length} page(s) — ${totalMatches} total match(es)`,
          size: 24, color: '64748B'
        })],
        spacing: { after: 240 }
      })
    ];

    results.forEach((r) => {
      children.push(new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({ text: `📄 Page ${r.pageNum}`, bold: true, size: 26, color: '1E293B' }),
          new TextRun({ text: `   —   ${r.matchCount} time(s)`, size: 22, color: 'F59E0B' })
        ],
        spacing: { before: 160, after: 40 }
      }));
      if (r.snippet) {
        children.push(new Paragraph({
          alignment: AlignmentType.RIGHT,
          bidirectional: true,
          children: [new TextRun({ text: r.snippet, font: FONT, size: 26, rightToLeft: true })],
          spacing: { after: 80 }
        }));
      }
    });

    const doc = new Document({
      sections: [{
        properties: { page: { margin: { top: convertInchesToTwip(1), right: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1) } } },
        children
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="search-report.docx"');
    res.send(buffer);
  } catch (e) {
    console.error('Report error:', e);
    res.status(500).json({ error: 'Report create fail: ' + e.message });
  }
});

// ─── Search Report as a real PDF (Urdu rendered via canvas/HarfBuzz) ─────────
async function buildSearchReportPdf(searchTerm, results, fileName) {
  const W = 1240, H = 1754, M = 96;       // A4 at 150 DPI
  const FAM = 'Amiri';
  const pages = [];                        // array of PNG buffers
  let canvas, ctx, y;

  const newPage = () => {
    canvas = createCanvas(W, H);
    ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    y = M;
  };
  const flush = () => { if (canvas) pages.push(canvas.toBuffer('image/png')); };

  // Right-aligned RTL text (for Urdu)
  const rtl = (text, size, color = '#1e293b', bold = false) => {
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${FAM}`;
    ctx.fillStyle = color;
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillText(text, W - M, y);
  };
  // Left-aligned LTR text (for English/labels)
  const ltr = (text, size, color = '#1e293b', bold = false) => {
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${FAM}`;
    ctx.fillStyle = color;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.fillText(text, M, y);
  };
  const wrapRtl = (text, size, maxW) => {
    ctx.font = `${size}px ${FAM}`;
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = []; let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  };
  const need = (h) => { if (y + h > H - M) { flush(); newPage(); } };

  newPage();

  // Header band
  ctx.fillStyle = '#4361ee'; ctx.fillRect(0, 0, W, 130);
  ctx.font = 'bold 46px Amiri'; ctx.fillStyle = '#ffffff';
  ctx.direction = 'rtl'; ctx.textAlign = 'right';
  ctx.fillText('تلاش رپورٹ', W - M, 85);
  ctx.direction = 'ltr'; ctx.textAlign = 'left';
  ctx.font = '26px Amiri';
  ctx.fillText('Search Report', M, 82);
  y = 130 + 70;

  const totalMatches = results.reduce((s, r) => s + (r.matchCount || 0), 0);

  // Searched word
  rtl(`تلاش شدہ لفظ:  ${searchTerm}`, 40, '#1e293b', true);
  y += 58;
  // Summary
  rtl(`کل ${toUrduNum(results.length)} صفحات پر ${toUrduNum(totalMatches)} بار ملا`, 30, '#475569');
  y += 44;
  if (fileName) { ltr(`File: ${fileName}`, 22, '#94a3b8'); y += 40; }

  // Divider
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(W - M, y); ctx.stroke();
  y += 50;

  // Results
  for (const r of results) {
    need(60);
    // Page label (Urdu, right) + match count
    rtl(`صفحہ ${toUrduNum(r.pageNum)}  —  ${toUrduNum(r.matchCount || 1)} بار`, 32, '#4361ee', true);
    y += 46;
    // Snippet wrapped
    if (r.snippet) {
      const lines = wrapRtl(r.snippet, 26, W - 2 * M - 40);
      for (const ln of lines) {
        need(40);
        rtl(ln, 26, '#475569');
        y += 40;
      }
    }
    y += 26;
  }

  flush();

  // Assemble into a PDF (one full-page image per canvas page)
  const { PDFDocument } = require('pdf-lib');
  const pdf = await PDFDocument.create();
  for (const png of pages) {
    const img = await pdf.embedPng(png);
    const page = pdf.addPage([595.28, 841.89]); // A4 in points
    page.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }
  return await pdf.save();
}

app.post('/api/pdf/create-report-pdf', requireAuth, async (req, res) => {
  try {
    const { pdfId, searchTerm, results } = req.body;
    if (!pdfId || !searchTerm || !Array.isArray(results)) {
      return res.status(400).json({ error: 'pdfId, searchTerm aur results chahiye' });
    }
    const cached = pdfCache.get(pdfId);
    const fileName = cached?.fileName || '';
    const bytes = await buildSearchReportPdf(searchTerm, results, fileName);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="search-report.pdf"');
    res.send(Buffer.from(bytes));
  } catch (e) {
    console.error('PDF report error:', e.message);
    res.status(500).json({ error: 'PDF report fail: ' + e.message });
  }
});

// ─── Progress SSE ────────────────────────────────────────────────────────────
const progressMap = new Map();

app.get('/api/progress/:jobId', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const interval = setInterval(() => {
    const progress = progressMap.get(req.params.jobId);
    if (progress) {
      send(progress);
      if (progress.status === 'done' || progress.status === 'error') {
        clearInterval(interval);
        res.end();
      }
    }
  }, 400);

  req.on('close', () => clearInterval(interval));
});

// ─── PDF to Image Conversion ─────────────────────────────────────────────────
// Takes already-loaded pdfDoc (not raw data) — avoids reloading PDF per page
async function pdfPageToImage(pdfDoc, pageNum, outputPath, scale = 2.0) {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));
  page.cleanup();
}

async function convertPagesParallel(pdfData, totalPages, tempDir, updateProgress) {
  const CONCURRENT = 4;
  const scale = totalPages > 80 ? 1.8 : 2.0; // smaller images for large docs

  // Load PDF once — reuse for every page
  const pdfDoc = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfData),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true
  }).promise;

  const imagePaths = new Array(totalPages).fill(null);
  let done = 0;

  for (let start = 0; start < totalPages; start += CONCURRENT) {
    const batch = [];
    for (let i = start; i < Math.min(start + CONCURRENT, totalPages); i++) {
      const imgPath = path.join(tempDir, `page_${i + 1}.png`);
      batch.push(
        pdfPageToImage(pdfDoc, i + 1, imgPath, scale)
          .then(() => { imagePaths[i] = { path: imgPath, mime: 'image/png' }; })
          .catch(e => { console.error(`Page ${i + 1}:`, e.message); imagePaths[i] = null; })
      );
    }
    await Promise.all(batch);
    done = Math.min(start + CONCURRENT, totalPages);
    updateProgress(Math.round(8 + (done / totalPages) * 30), `Pages: ${done}/${totalPages}`);
  }

  const converted = imagePaths.filter(Boolean);
  if (converted.length === 0) throw new Error('No pages converted successfully');
  return converted;
}

// ─── OCR Batch Processing (Optimized for Speed) ───────────────────────────────
async function ocrBatch(drive, folderId, pages, onProgress) {
  const CONCURRENT = 5;   // lower concurrency = fewer Google rate-limit errors
  const MAX_RETRIES = 4;  // more retries with backoff for big files
  const results = new Array(pages.length).fill({ page: 0, text: '' });
  let done = 0;

  const processPage = async ({ path: imgPath, mime, pageNum }, retryCount = 0) => {
    try {
      const up = await drive.files.create({
        requestBody: {
          name: `p${pageNum}`,
          parents: [folderId],
          mimeType: 'application/vnd.google-apps.document'
        },
        media: { mimeType: mime, body: fs.createReadStream(imgPath) },
        fields: 'id',
        timeout: 60000
      });

      const docId = up.data.id;

      // Minimal delay - Drive processes faster with less wait
      await new Promise(r => setTimeout(r, 200));

      const txt = await drive.files.export({
        fileId: docId,
        mimeType: 'text/plain',
        timeout: 60000
      });

      // Delete asynchronously without waiting
      drive.files.delete({ fileId: docId }).catch(() => {});

      return { text: (typeof txt.data === 'string' ? txt.data.trim() : '') };
    } catch (e) {
      const msg = `${e?.message || ''} ${e?.code || ''} ${e?.response?.status || ''}`;
      const rateLimited = /rate|quota|userRateLimit|403|429|500|503/i.test(msg);
      if (retryCount < MAX_RETRIES) {
        // Exponential backoff — longer waits when Google is throttling us
        const wait = rateLimited ? 1500 * Math.pow(2, retryCount) : 600; // 1.5s,3s,6s,12s
        await new Promise(r => setTimeout(r, wait));
        return processPage({ path: imgPath, mime, pageNum }, retryCount + 1);
      }
      console.error(`OCR page ${pageNum} failed:`, msg.trim());
      return { text: '' };
    }
  };

  for (let start = 0; start < pages.length; start += CONCURRENT) {
    const batch = pages.slice(start, start + CONCURRENT).map(async (page, idx) => {
      const result = await processPage(page);
      results[start + idx] = { page: page.pageNum, text: result.text };
    });

    await Promise.all(batch);
    done = Math.min(start + CONCURRENT, pages.length);
    onProgress(done);
  }

  // Cleanup folder asynchronously (don't wait)
  drive.files.delete({ fileId: folderId }).catch(() => {});

  return results;
}

// ─── Clean Text ──────────────────────────────────────────────────────────────
function cleanText(raw) {
  if (!raw) return [];

  return raw
    .split('\n')
    .map(l => {
      let line = l.trim();
      // Remove excessive whitespace
      line = line.replace(/\s+/g, ' ');
      // Remove common OCR artifacts
      line = line.replace(/[​-‍]/g, '');
      return line;
    })
    .filter(l => l.length > 0);
}

// ─── Build Word Document ─────────────────────────────────────────────────────
async function buildWordDoc(extractedTexts, outputPath) {
  const { Document, Paragraph, TextRun, AlignmentType, PageBreak, convertInchesToTwip } = require('docx');
  const FONT = 'Jameel Noori Nastaleeq';
  const SIZE = 34;
  const NS = { before: 0, after: 0, line: 240, lineRule: 'auto' };

  const makePara = (text) => new Paragraph({
    children: [
      new TextRun({
        text,
        font: FONT,
        size: SIZE,
        color: '000000',
        bold: false,
        rightToLeft: true
      })
    ],
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    spacing: NS
  });

  const children = [];

  for (let i = 0; i < extractedTexts.length; i++) {
    if (i > 0) children.push(new Paragraph({ children: [new PageBreak()], spacing: NS }));
    const lines = cleanText(extractedTexts[i].text);
    if (lines.length === 0) {
      children.push(makePara(' '));
      continue;
    }
    for (const line of lines) {
      children.push(makePara(line));
    }
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
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1)
            }
          }
        },
        children
      }
    ]
  });

  const { Packer } = require('docx');
  fs.writeFileSync(outputPath, await Packer.toBuffer(doc));
}

// ─── Convert Endpoint ────────────────────────────────────────────────────────
app.post('/api/convert', (req, res, next) => {
  const tokenHeader = req.headers['x-tokens'] || req.get('X-Tokens');
  if (!req.session.tokens && !req.session.user && !tokenHeader) {
    return res.status(401).json({ error: 'Login karo' });
  }
  if (tokenHeader) {
    try {
      const tokens = JSON.parse(tokenHeader);
      req.session.tokens = tokens;
    } catch (e) {
      console.error('Parse error:', e.message);
    }
  }
  if (req.session.tokens) oauth2Client.setCredentials(req.session.tokens);
  next();
}, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File chahiye' });

    const jobId    = uuidv4();
    const fileMime = req.file.mimetype;
    const filePath = req.file.path;
    const tempDir  = path.join(__dirname, 'temp', jobId);
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const update = (percent, message) => {
      progressMap.set(jobId, { percent, message, status: 'processing' });
    };

    (async () => {
      try {
        const outputPath = path.join(tempDir, 'output.docx');

        // ── Word file: extract text directly, re-format with Urdu font ──────
        if (WORD_MIMES.has(fileMime)) {
          update(10, '📝 Word file se text nikal raha hai...');
          const pages = await extractWordText(filePath);
          try { fs.unlinkSync(filePath); } catch (e) {}
          update(60, `📄 ${pages.length} pages mili — Word document ban raha hai...`);
          const texts = pages.map(p => ({ text: p.text }));
          await buildWordDoc(texts, outputPath);

        // ── PDF / Image: OCR pipeline (every page → Drive → Docs OCR) ─────
        } else {
          if (!req.session.tokens || !req.session.tokens.access_token) {
            throw new Error('Google authorization required. Please login again.');
          }
          const drive = google.drive({ version: 'v3', auth: oauth2Client });
          const folder = await drive.files.create({
            requestBody: { name: `OCR-${jobId}`, mimeType: 'application/vnd.google-apps.folder' },
            fields: 'id', timeout: 30000
          });
          const folderId = folder.data.id;
          let finalTexts = [];

          if (IMG_MIMES.has(fileMime)) {
            // Single image
            update(5, '🖼️ Image loaded — OCR shuru...');
            const imgDest = path.join(tempDir, 'page_1' + path.extname(req.file.originalname || '.png'));
            fs.renameSync(filePath, imgDest);
            const imgRes = await ocrBatch(drive, folderId, [{ path: imgDest, mime: fileMime, pageNum: 1 }], () => {});
            finalTexts = [{ text: imgRes[0]?.text || '' }];
          } else {
            const pdfData = fs.readFileSync(filePath);
            fs.unlinkSync(filePath);
            const pdfDoc = await pdfjsLib.getDocument({
              data: new Uint8Array(pdfData),
              useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true
            }).promise;
            const totalPages = pdfDoc.numPages;
            update(2, `📄 PDF loaded: ${totalPages} pages`);

            // Every page → image → Drive → Google Docs OCR (clean Urdu).
            // Chunked so memory stays bounded for very large files.
            const PAGE_CHUNK    = 30;
            const CONV_PARALLEL = 4;
            const scale = totalPages > 100 ? 1.7 : 2.0;
            finalTexts = new Array(totalPages).fill(null).map(() => ({ text: '' }));
            let ocrDone = 0;

            for (let cs = 0; cs < totalPages; cs += PAGE_CHUNK) {
              const ce = Math.min(cs + PAGE_CHUNK, totalPages);
              const chunkImgs = [];

              for (let i = cs; i < ce; i += CONV_PARALLEL) {
                const batch = [];
                for (let j = i; j < Math.min(i + CONV_PARALLEL, ce); j++) {
                  const imgPath = path.join(tempDir, `p${j + 1}.png`);
                  batch.push(
                    pdfPageToImage(pdfDoc, j + 1, imgPath, scale)
                      .then(() => chunkImgs.push({ path: imgPath, mime: 'image/png', pageNum: j + 1 }))
                      .catch(e => console.error(`Render page ${j + 1}:`, e.message))
                  );
                }
                await Promise.all(batch);
              }

              update(Math.round(5 + (ce / totalPages) * 38), `🖼️ Converted ${ce}/${totalPages} pages`);

              if (chunkImgs.length > 0) {
                const chunkRes = await ocrBatch(drive, folderId, chunkImgs, (d) => {
                  update(
                    Math.round(43 + ((ocrDone + d) / totalPages) * 50),
                    `🔤 OCR: ${ocrDone + d}/${totalPages} pages`
                  );
                });
                chunkRes.forEach(({ page, text }) => {
                  if (page >= 1 && page <= totalPages) finalTexts[page - 1] = { text };
                });
                ocrDone += chunkImgs.length;
              }

              for (const img of chunkImgs) try { fs.unlinkSync(img.path); } catch (e) {}
            }

            console.log(`OCR done: ${finalTexts.filter(t => t.text).length}/${finalTexts.length} pages`);
          }

          drive.files.delete({ fileId: folderId }).catch(() => {});

          update(94, '✍️ Building Word document...');
          await buildWordDoc(finalTexts, outputPath);
        }

        update(97, '✅ Finalizing...');

        const downloadUrl = `/download/${jobId}/output.docx`;
        const fileSize = fs.statSync(path.join(tempDir, 'output.docx')).size;

        progressMap.set(jobId, {
          percent: 100,
          message: `✅ Complete! (${(fileSize / 1024).toFixed(1)} KB)`,
          status: 'done',
          downloadUrl
        });

        trackEvent('converts', req.session.user, `${req.file?.originalname || 'file'} (${(fileSize/1024).toFixed(0)} KB)`);
        console.log(`Convert completed: ${jobId} - ${fileSize} bytes`);

        setTimeout(() => {
          try {
            fs.rmSync(tempDir, { recursive: true, force: true });
          } catch (e) {
            console.error('Cleanup error:', e.message);
          }
        }, 300000);
      } catch (e) {
        console.error('Convert error:', e.message);
        progressMap.set(jobId, {
          percent: 0,
          message: `❌ Error: ${e.message}`,
          status: 'error'
        });
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (err) {
          console.error('Cleanup error:', err.message);
        }
      }
    })();

    res.json({ jobId });
  } catch (e) {
    console.error('Convert start error:', e);
    res.status(500).json({ error: 'Convert start fail' });
  }
});

// ─── Download Endpoint ───────────────────────────────────────────────────────
app.get('/download/:jobId/:filename', (req, res) => {
  const { jobId, filename } = req.params;
  const file = path.join(__dirname, 'temp', jobId, filename);

  if (!fs.existsSync(file)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(file, filename, (err) => {
    if (err) console.error('Download error:', err);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// فہارس — Rule-Based Urdu NER (free, no API key needed)
// ═══════════════════════════════════════════════════════════════════════════

// Honorific prefixes that appear before personality names in Urdu text
const HONORIFICS = [
  'حضرت','مولانا','علامہ','شیخ','امیر','حافظ','قاری','میر','مرزا','خواجہ',
  'ڈاکٹر','پروفیسر','سر','راجہ','ملک','سید','ابن','مولوی','پیر','میاں',
  'چودھری','بیگم','خاتون','منشی','لالہ','رانا','سردار','نواب','بابا','آغا',
  'قاضی','مفتی','محدث','فقیہ','عارف','غوث','قطب','خلیفہ','صاحب','جناب',
  'برادر','والد','والدہ','استاد','شاگرد','امام','خطیب','مشیر','وزیر',
  'جنرل','کرنل','کیپٹن','میجر','لیفٹیننٹ','مسٹر','مس','محترم','محترمہ',
  'شہنشاہ','بادشاہ','نبی','رسول','صحابی','تابعی','ولی','صوفی','مجاہد'
];

// Urdu stop words — don't include these as part of a name
const NAME_STOP = new Set([
  'کا','کی','کے','میں','سے','پر','کو','نے','ہے','ہیں','تھا','تھی','تھے',
  'اور','یا','لیکن','مگر','بلکہ','جو','جب','جس','جہاں','جن','کہ','تو',
  'بھی','ہی','تک','ابھی','اب','پھر','وہ','یہ','اس','ان','اپنا','اپنی',
  'اپنے','اس','ان','جیسے','جیسا','جیسی','ایسے','ایسا','ایسی','بڑا','بڑی',
  'چھوٹا','پہلا','پہلی','آخری','نہیں','نہ','مت','گیا','آیا','کیا','ہوا',
  'ہوئی','ہوئے','رہا','رہی','رہے','لیا','دیا','مل','کر','ہو','جا','آ',
]);

// Well-known places (cities, countries, regions)
const KNOWN_PLACES = new Set([
  // Pakistan
  'لاہور','کراچی','اسلام آباد','پشاور','کوئٹہ','ملتان','فیصل آباد',
  'راولپنڈی','سیالکوٹ','گوجرانوالہ','حیدرآباد','سکھر','لاڑکانہ',
  'بہاولپور','سرگودھا','شیخوپورہ','جھنگ','گجرات','قصور','مردان',
  'پاکستان','پنجاب','سندھ','بلوچستان','سرحد','خیبر','کشمیر','آزاد کشمیر',
  // India
  'دہلی','ممبئی','کلکتہ','چنئی','آگرہ','لکھنؤ','علی گڑھ','حیدرآباد دکن',
  'الہ آباد','بنارس','پٹنہ','امرتسر','جالندھر','ہندوستان','بھارت','انڈیا',
  // Arab / Middle East
  'مکہ','مدینہ','بغداد','دمشق','قاہرہ','استنبول','تہران','بیروت',
  'عرب','سعودی عرب','ایران','عراق','شام','مصر','ترکی','اردن','یمن',
  'فلسطین','اسرائیل','کویت','بحرین','قطر','عمان','امارات',
  // Central Asia & Other
  'افغانستان','ایران','روس','چین','برطانیہ','امریکہ','فرانس','جرمنی',
  'کابل','قندہار','ہرات','بخارا','سمرقند','تاشقند','ترکستان',
  // Institutions / Organizations
  'پاکستان','حکومت','وزارت','یونیورسٹی','کالج','اسکول','مدرسہ','دار الحکوم',
]);

// Words with these suffixes are likely place names
const PLACE_SUFFIXES = ['آباد','پور','گڑھ','نگر','وال','شہر','پوری','کوٹ','گاہ'];

// Words before a place name
const PLACE_PREFIXES = new Set([
  'شہر','ضلع','صوبہ','ریاست','قصبہ','گاؤں','تحصیل','موضع','مقام','علاقہ',
  'ملک','خطہ','دارالحکومت','دار','بندرگاہ','دریا','پہاڑ','ندی','وادی',
]);

// Known religious / classic texts
const KNOWN_BOOKS = [
  'قرآن مجید','قرآن کریم','قرآن','بائبل','توریت','انجیل','زبور',
  'صحیح بخاری','صحیح مسلم','سنن ترمذی','سنن ابن ماجہ','سنن ابو داؤد',
  'موطا امام مالک','حدیث','شاہنامہ','گلستان سعدی','بوستان سعدی',
  'دیوان غالب','دیوان اقبال','بانگ درا','بال جبریل','ارمغان حجاز',
  'شکوہ','جواب شکوہ','اسرار خودی','رموز بے خودی','پس چہ باید کرد',
  'میر کی غزلیں','کلیات میر','رحمت اللہ علیہ','تاریخ ابن خلدون',
];

// Patterns that signal a book name follows
const BOOK_SIGNALS = [
  'کتاب','دیوان','رسالہ','تذکرہ','تاریخ','مجموعہ','نامہ','خزانہ',
  'گنجینہ','مقالہ','دستاویز','ناول','افسانہ','نظم','غزل','قصیدہ',
  'مثنوی','مرثیہ','مجلہ','رسالہ','جریدہ','اخبار',
];

// Fixed set of language names
const LANGUAGE_NAMES = new Set([
  'اردو','عربی','فارسی','پنجابی','سندھی','بلوچی','پشتو','ہندی',
  'انگریزی','ترکی','ہندوستانی','گجراتی','بنگالی','تامل','تیلگو',
  'چینی','روسی','فرانسیسی','جرمن','جاپانی','کوریائی','ملائی',
  'سنسکرت','پالی','تبتی','کردی','دری','سواحلی','ہیبرو','لاطینی',
  'یونانی','اطالوی','ہسپانوی','پرتگیزی','ڈچ','سویڈش','ناروے',
]);

// Well-known personalities — detected even WITHOUT an honorific prefix.
// (single-word names like اقبال، غالب appear constantly in Urdu books)
const FAMOUS_NAMES = new Set([
  // Poets / literary
  'اقبال','غالب','میر','فیض','فراز','جوش','حالی','اکبر الہ آبادی','داغ',
  'ذوق','مومن','انیس','دبیر','نظیر','جگر','ناصر','منٹو','پریم چند','فردوسی',
  'سعدی','حافظ','رومی','خیام','جامی','عطار','نظامی','امیر خسرو','بیدل',
  // Religious / historical figures
  'ابوبکر','عمر','عثمان','علی','حسن','حسین','فاطمہ','عائشہ','خدیجہ','بلال',
  'ابوحنیفہ','امام شافعی','امام مالک','احمد بن حنبل','بخاری','امام مسلم',
  'غزالی','ابن تیمیہ','ابن خلدون','ابن سینا','رازی','فارابی','طبری','ابن رشد',
  'شاہ ولی اللہ','سرسید','مودودی','اشرف علی تھانوی','اقبال لاہوری',
  // Rulers / politicians
  'جناح','قائداعظم','لیاقت علی خان','بابر','ہمایوں','اکبر','جہانگیر',
  'شاہجہاں','اورنگزیب','ٹیپو سلطان','محمود غزنوی','محمد بن قاسم',
  'صلاح الدین','نور الدین زنگی','ہارون الرشید','مامون الرشید',
]);

// Words that come AFTER a name (so the word before is a personality)
const HONORIFIC_SUFFIX = new Set([
  'صاحب','شہید','مرحوم','رحمہ','رحمۃ','علیہ','رضی','قدس','نوراللہ',
  'دامت','مدظلہ','سلمہ','بادشاہ','سلطان','خان','شاہ','بیگ','الدین',
]);

// ─── Extract entities from a single page's text (rule-based) ─────────────────
function extractFromPage(text, pageNum) {
  if (!text || text.length < 10) return null;

  const words = text.split(/\s+/).map(w => w.replace(/[۔،؟!:؛\-\.,"'()[\]{}]/g, '').trim()).filter(Boolean);
  const found = { شخصیات: new Set(), اماکن: new Set(), کتابیں: new Set(), زبانیں: new Set() };

  // Normalized forms for reliable matching (handles diacritics & letter variants
  // e.g. اُنس → انس, عربى → عربی). This makes known-list/dictionary matching exact.
  const normText  = normalizeUrdu(text);
  const normWords = words.map(w => normalizeUrdu(w)).filter(Boolean);
  const normWordSet = new Set(normWords);

  // Match a known term against the page using normalized text (recall + accuracy)
  const matchKnown = (term, cat) => {
    const nt = normalizeUrdu(term);
    if (!nt || nt.length < 2) return;
    if (nt.includes(' ')) {
      if (normText.includes(nt)) found[cat].add(term);
    } else if (normWordSet.has(nt)) {
      found[cat].add(term);
    }
  };

  // ── 1a. Personalities via honorific PREFIX (e.g. علامہ اقبال) ─────────────
  for (let i = 0; i < words.length; i++) {
    if (HONORIFICS.includes(words[i])) {
      const parts = [words[i]];
      for (let j = i + 1; j <= Math.min(i + 4, words.length - 1); j++) {
        const w = words[j];
        if (!w || NAME_STOP.has(w) || HONORIFICS.includes(w) || w.length < 2) break;
        parts.push(w);
        if (parts.length >= 4) break;
      }
      if (parts.length >= 2) found.شخصیات.add(parts.join(' '));
    }
  }

  // ── 1b. Personalities via honorific SUFFIX (e.g. اقبال صاحب، علی رضی) ─────
  for (let i = 1; i < words.length; i++) {
    if (HONORIFIC_SUFFIX.has(words[i])) {
      const prev = words[i - 1];
      if (prev && !NAME_STOP.has(prev) && prev.length >= 3 && !HONORIFICS.includes(prev)) {
        // include the word before prev too, if it's also a name-like token
        const prev2 = words[i - 2];
        const name = (prev2 && !NAME_STOP.has(prev2) && prev2.length >= 3 && !HONORIFICS.includes(prev2))
          ? `${prev2} ${prev}` : prev;
        found.شخصیات.add(name);
      }
    }
  }

  // ── 1d. "Name، Title" comma pattern (محمد اقبال، علامہ / شولز، مسٹر) ──────
  // Very common in Urdu prose & indexes: a name followed by ، then a title.
  {
    const clauses = text.split(/[\n۔؛]/);
    for (const clause of clauses) {
      const segs = clause.split('،');
      for (let s = 1; s < segs.length; s++) {
        const firstTok = (segs[s].trim().split(/\s+/)[0] || '').replace(/[^؀-ۿ]/g, '');
        if (firstTok && HONORIFICS.includes(firstTok)) {
          const prevWords = segs[s - 1].trim().split(/\s+/)
            .map(w => w.replace(/[۔،؟!:؛"'()\[\]{}]/g, '')).filter(Boolean);
          const nameParts = [];
          for (let p = prevWords.length - 1; p >= 0 && nameParts.length < 3; p--) {
            const w = prevWords[p];
            if (!w || NAME_STOP.has(w) || HONORIFICS.includes(w) || w.length < 2) break;
            nameParts.unshift(w);
          }
          if (nameParts.length >= 1) found.شخصیات.add(`${nameParts.join(' ')}، ${firstTok}`);
        }
      }
    }
  }

  // ── 1e. Patronymic names (X بن Y / X ابن Y — اسد اللہ بن ...) ─────────────
  for (let i = 1; i < words.length - 1; i++) {
    if (words[i] === 'بن' || words[i] === 'ابن' || words[i] === 'ولد') {
      const before = words[i - 1], after = words[i + 1];
      if (before && after && !NAME_STOP.has(before) && !NAME_STOP.has(after)
          && before.length >= 2 && after.length >= 2) {
        const pre = words[i - 2];
        const head = (pre && !NAME_STOP.has(pre) && !HONORIFICS.includes(pre) && pre.length >= 2)
          ? `${pre} ${before}` : before;
        found.شخصیات.add(`${head} ${words[i]} ${after}`);
      }
    }
  }

  // ── 1c. Well-known personalities (normalized match, no honorific needed) ──
  for (const name of FAMOUS_NAMES) matchKnown(name, 'شخصیات');

  // ── 2. Known places (normalized match) ────────────────────────────────────
  for (const place of KNOWN_PLACES) matchKnown(place, 'اماکن');

  // ── 3. Place-suffix detection (e.g. گوجرانوالہ, فیصل آباد suffix) ───────
  for (const w of words) {
    for (const sfx of PLACE_SUFFIXES) {
      if (w.endsWith(sfx) && w.length > sfx.length + 1 && !KNOWN_PLACES.has(w)) {
        found.اماکن.add(w);
      }
    }
  }

  // ── 4. Place-prefix detection (e.g. "شہر لاہور", "ضلع سرگودھا") ──────────
  for (let i = 0; i < words.length - 1; i++) {
    if (PLACE_PREFIXES.has(words[i]) && words[i + 1] && words[i + 1].length > 2 && !NAME_STOP.has(words[i + 1])) {
      found.اماکن.add(`${words[i]} ${words[i + 1]}`);
    }
  }

  // ── 5. Known books (normalized match) ─────────────────────────────────────
  for (const book of KNOWN_BOOKS) matchKnown(book, 'کتابیں');

  // ── 6. Book-signal detection (e.g. "کتاب المنطق", "دیوان غالب") ──────────
  for (let i = 0; i < words.length - 1; i++) {
    if (BOOK_SIGNALS.includes(words[i])) {
      const parts = [];
      for (let j = i + 1; j <= Math.min(i + 4, words.length - 1); j++) {
        const w = words[j];
        if (!w || NAME_STOP.has(w) || w.length < 2) break;
        parts.push(w);
      }
      if (parts.length >= 1) found.کتابیں.add(`${words[i]} ${parts.join(' ')}`);
    }
  }

  // ── 7. Languages (normalized match) ───────────────────────────────────────
  for (const lang of LANGUAGE_NAMES) matchKnown(lang, 'زبانیں');

  // ── 8. Custom dictionary (user-taught vocabulary) — THE 100% path ────────
  // Whatever the user teaches is matched on every page with normalized text,
  // so spelling/diacritic variants still match exactly.
  for (const cat of ['شخصیات', 'اماکن', 'کتابیں', 'زبانیں']) {
    for (const term of customDict[cat]) matchKnown(term, cat);
  }

  return found;
}

// ─── Aggregate entities from all pages ───────────────────────────────────────
function buildEntityIndex(pages) {
  // entity name → Set of page numbers
  const index = { شخصیات: {}, اماکن: {}, کتابیں: {}, زبانیں: {} };

  for (const { pageNum, text } of pages) {
    const found = extractFromPage(text, pageNum);
    if (!found) continue;

    for (const cat of ['شخصیات', 'اماکن', 'کتابیں', 'زبانیں']) {
      for (const name of found[cat]) {
        if (!name || name.trim().length < 2) continue;
        const key = name.trim();
        if (!index[cat][key]) index[cat][key] = new Set();
        index[cat][key].add(pageNum);
      }
    }
  }

  // Convert to sorted arrays
  const toArr = (map) =>
    Object.entries(map)
      .map(([name, pgSet]) => ({ name, pages: [...pgSet].sort((a, b) => a - b) }))
      .sort((a, b) => a.pages[0] - b.pages[0]); // sort by first appearance

  return {
    شخصیات: toArr(index.شخصیات),
    اماکن:  toArr(index.اماکن),
    کتابیں: toArr(index.کتابیں),
    زبانیں: toArr(index.زبانیں),
  };
}

// ─── Urdu numerals helper ─────────────────────────────────────────────────────
function toUrduNum(n) {
  return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
}

// Convert any Urdu/Arabic numerals in a string to Latin digits
function numeralsToLatin(s) {
  return s
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

// Detect a printed/standalone page number near the top or bottom of a page's text.
// Urdu books print the page number on its own line (e.g. "۲۱"); we use that as the
// REAL page number instead of the sequential document index.
function detectPrintedPageNumber(text) {
  if (!text) return null;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;

  // Look at the first 2 and last 2 non-empty lines (where page numbers live)
  const edges = [lines[0], lines[1], lines[lines.length - 1], lines[lines.length - 2]]
    .filter(Boolean);

  for (const line of edges) {
    const latin = numeralsToLatin(line);
    // The line must contain ONLY digits + light decoration (dashes, dots, brackets,
    // urdu punctuation, spaces). If it contains any letter, it's not a page marker.
    if (/[^\d\s\-–—.\[\](){}۔،:؛]/.test(latin)) continue;
    const digits = latin.replace(/[^\d]/g, '');
    if (digits.length >= 1 && digits.length <= 4) {
      const n = parseInt(digits, 10);
      if (n >= 1 && n <= 4000) return n;
    }
  }
  return null;
}

// Build a map: sequential page index → real (printed) page number.
// Only uses printed numbers if enough pages have them AND they form an
// increasing sequence; otherwise falls back to the sequential index.
function buildPageNumberMap(pages) {
  const candidates = pages.map(p => ({ seq: p.pageNum, printed: detectPrintedPageNumber(p.text) }));
  const detected = candidates.filter(c => c.printed !== null);

  let increasing = 0;
  for (let i = 1; i < detected.length; i++) {
    if (detected[i].printed > detected[i - 1].printed) increasing++;
  }
  const usable =
    detected.length >= Math.max(3, Math.floor(pages.length * 0.35)) &&
    (detected.length < 2 || increasing >= (detected.length - 1) * 0.6);

  const map = {};
  if (!usable) {
    for (const c of candidates) map[c.seq] = c.seq;
    return { map, usable: false };
  }

  // Use detected numbers; interpolate the gaps from the last known printed number
  let lastPrinted = null, lastSeq = null;
  for (const c of candidates) {
    if (c.printed !== null) {
      map[c.seq] = c.printed;
      lastPrinted = c.printed;
      lastSeq = c.seq;
    } else if (lastPrinted !== null) {
      map[c.seq] = lastPrinted + (c.seq - lastSeq);
    } else {
      map[c.seq] = c.seq; // before the first detected number
    }
  }
  return { map, usable: true };
}

// ─── Build فہارس Word Document ────────────────────────────────────────────────
async function buildFiharisDoc(entities) {
  const {
    Document, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, WidthType, VerticalAlign, BorderStyle, Packer,
    convertInchesToTwip
  } = require('docx');

  const FONT  = 'Jameel Noori Nastaleeq';
  const SZ_TITLE   = 56;
  const SZ_SECTION = 40;
  const SZ_BODY    = 24;

  const border = { color: '555555', size: 4, space: 0, style: BorderStyle.SINGLE };
  const borders = { top: border, bottom: border, left: border, right: border, insideH: border, insideV: border };

  const rtlText = (text, size, bold = false) =>
    new TextRun({ text, font: FONT, size, bold, rightToLeft: true });

  const cell = (text, widthPct, bold = false, fill = 'FFFFFF') =>
    new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      shading: { fill },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        bidirectional: true,
        children: [rtlText(String(text), SZ_BODY, bold)]
      })]
    });

  const makeTable = (colDefs, dataRows) =>
    new Table({
      borders,
      bidi: true,
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        // Header row
        new TableRow({
          tableHeader: true,
          children: colDefs.map(([lbl, pct]) => cell(lbl, pct, true, 'D8D8D8'))
        }),
        // Data rows
        ...dataRows.map((cells, ri) =>
          new TableRow({
            children: cells.map(([txt, pct]) => cell(txt, pct, false, ri % 2 === 0 ? 'FFFFFF' : 'F7F7F7'))
          })
        )
      ]
    });

  const gap = (after = 160) => new Paragraph({ spacing: { after } });

  const sectionTitle = (text) => new Paragraph({
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { before: 240, after: 100 },
    children: [rtlText(`• ${text}`, SZ_SECTION, true)]
  });

  const children = [
    // Main Title — فہارس
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      spacing: { after: 360 },
      children: [rtlText('فہارس', SZ_TITLE, true)]
    })
  ];

  const addSection = (title, colDefs, rows) => {
    if (rows.length === 0) return;
    children.push(sectionTitle(title));
    children.push(gap(80));
    children.push(makeTable(colDefs, rows));
    children.push(gap(240));
  };

  // فہرست شخصیات
  addSection(
    'فہرست شخصیات',
    [['نمبر شمار', 15], ['نام شخصیت', 55], ['صفحہ نمبر', 30]],
    entities.شخصیات.map((e, i) => [
      [toUrduNum(i + 1) + '۔', 15],
      [e.name, 55],
      [e.pages.map(toUrduNum).join('، '), 30]
    ])
  );

  // فہرست اماکن
  addSection(
    'فہرست اماکن',
    [['نمبر شمار', 15], ['نام جگہ', 55], ['صفحہ نمبر', 30]],
    entities.اماکن.map((e, i) => [
      [toUrduNum(i + 1) + '۔', 15],
      [e.name, 55],
      [e.pages.map(toUrduNum).join('، '), 30]
    ])
  );

  // فہرست کتابیں
  addSection(
    'فہرست کتابیں',
    [['نمبر شمار', 15], ['نام کتاب', 55], ['صفحہ نمبر', 30]],
    entities.کتابیں.map((e, i) => [
      [toUrduNum(i + 1) + '۔', 15],
      [e.name, 55],
      [e.pages.map(toUrduNum).join('، '), 30]
    ])
  );

  // فہرست زبانیں
  addSection(
    'فہرست زبانیں',
    [['نمبر شمار', 15], ['زبان کا نام', 55], ['صفحہ نمبر', 30]],
    entities.زبانیں.map((e, i) => [
      [toUrduNum(i + 1) + '۔', 15],
      [e.name, 55],
      [e.pages.map(toUrduNum).join('، '), 30]
    ])
  );

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1), right: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1), left: convertInchesToTwip(1)
          }
        }
      },
      children
    }]
  });

  return Packer.toBuffer(doc);
}

// ─── Generate فہارس Endpoint ──────────────────────────────────────────────────
app.post('/api/pdf/generate-index', requireAuth, async (req, res) => {
  try {
    const { pdfId, customTerms, autoDetect } = req.body;
    if (!pdfId) return res.status(400).json({ error: 'pdfId chahiye' });

    const cached = pdfCache.get(pdfId);
    if (!cached) return res.status(404).json({ error: 'PDF cache expire — dobara upload karo' });

    // "My List" mode: user supplies the exact terms to find (100% targeted)
    const CATS = ['شخصیات', 'اماکن', 'کتابیں', 'زبانیں'];
    const cleanTerms = {};
    let customCount = 0;
    for (const c of CATS) {
      const arr = Array.isArray(customTerms?.[c]) ? customTerms[c] : [];
      cleanTerms[c] = [...new Set(arr.map(t => String(t).trim()).filter(t => t.length >= 2))];
      customCount += cleanTerms[c].length;
    }
    const hasCustom = customCount > 0;
    // Auto-detect on by default, unless caller explicitly disables it
    const doAuto = autoDetect !== false && (!hasCustom || autoDetect === true);

    const jobId = uuidv4();
    const update = (pct, msg) => progressMap.set(jobId, { percent: pct, message: msg, status: 'processing' });

    (async () => {
      try {
        const total = cached.pages.length;
        update(10, `📚 ${total} pages analyze ho rahi hain...`);

        // Detect real (printed) page numbers so the فہارس matches the book exactly
        const { map: pageMap, usable: usablePageNums } = buildPageNumberMap(cached.pages);
        console.log(`📄 Page numbers: ${usablePageNums ? 'using PRINTED numbers from book' : 'using sequential index'}`);
        console.log(`🔎 Mode: ${hasCustom ? `custom (${customCount} terms)` : ''}${doAuto ? ' auto' : ''}`);

        // Process in chunks so we can emit progress
        const CHUNK = 20;
        const index = { شخصیات: {}, اماکن: {}, کتابیں: {}, زبانیں: {} };

        const addHit = (cat, key, page) => {
          if (!key || key.length < 2) return;
          if (!index[cat][key]) index[cat][key] = new Set();
          index[cat][key].add(page);
        };

        for (let i = 0; i < cached.pages.length; i += CHUNK) {
          const slice = cached.pages.slice(i, i + CHUNK);
          for (const { pageNum, text } of slice) {
            const realPage = pageMap[pageNum] || pageNum;

            // Auto detection (rule-based)
            if (doAuto) {
              const found = extractFromPage(text, realPage);
              if (found) for (const cat of CATS)
                for (const name of found[cat]) addHit(cat, name.trim(), realPage);
            }

            // Custom "My List" matching — 100% exact, normalized
            if (hasCustom && text) {
              const normText = normalizeUrdu(text);
              const normWordSet = new Set(
                text.split(/\s+/)
                  .map(w => normalizeUrdu(w.replace(/[۔،؟!:؛\-\.,"'()[\]{}]/g, '')))
                  .filter(Boolean)
              );
              for (const cat of CATS) {
                for (const term of cleanTerms[cat]) {
                  const nt = normalizeUrdu(term);
                  if (!nt || nt.length < 2) continue;
                  const hit = nt.includes(' ') ? normText.includes(nt) : normWordSet.has(nt);
                  if (hit) addHit(cat, term, realPage);
                }
              }
            }
          }
          const done = Math.min(i + CHUNK, total);
          update(10 + Math.round((done / total) * 70), `🔍 Analyzing: ${done}/${total} pages`);
        }

        update(82, '📝 فہارس document ban rahi hai...');

        const toArr = (map) =>
          Object.entries(map)
            .map(([name, pgSet]) => ({ name, pages: [...pgSet].sort((a, b) => a - b) }))
            .sort((a, b) => a.pages[0] - b.pages[0]);

        const entities = {
          شخصیات: toArr(index.شخصیات),
          اماکن:  toArr(index.اماکن),
          کتابیں: toArr(index.کتابیں),
          زبانیں: toArr(index.زبانیں),
        };

        const buf = await buildFiharisDoc(entities);

        const tempDir = path.join(__dirname, 'temp', jobId);
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        fs.writeFileSync(path.join(tempDir, 'fiharis.docx'), buf);

        const stats = {
          شخصیات: entities.شخصیات.length,
          اماکن:  entities.اماکن.length,
          کتابیں: entities.کتابیں.length,
          زبانیں: entities.زبانیں.length,
        };

        trackEvent('indexes', req.session.user, `${total} pages — ${stats.شخصیات}+${stats.اماکن}+${stats.کتابیں}+${stats.زبانیں} entities`);
        progressMap.set(jobId, {
          percent: 100,
          message: '✅ فہارس تیار!',
          status: 'done',
          downloadUrl: `/download/${jobId}/fiharis.docx`,
          stats
        });

        setTimeout(() => {
          try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
        }, 1800000);

      } catch (e) {
        console.error('generate-index error:', e.message);
        progressMap.set(jobId, { percent: 0, message: `❌ ${e.message}`, status: 'error' });
      }
    })();

    res.json({ jobId });
  } catch (e) {
    res.status(500).json({ error: 'Index start fail: ' + e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AI ASSISTANT (free) — chat that can search the user's document, help when a
// word isn't found (tries spelling variants), and guide the whole website.
// Uses Groq's free API if GROQ_API_KEY is set; otherwise a built-in rule-based
// assistant so it works with zero setup.
// ═══════════════════════════════════════════════════════════════════════════

// Generate likely spelling/title variants when a search returns nothing
function buildSearchVariants(term) {
  const out = new Set();
  const words = String(term).trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    if (HONORIFICS.includes(words[0])) out.add(words.slice(1).join(' '));
    out.add(words[words.length - 1]);            // last word (often the takhallus/surname)
    out.add(words[0]);                            // first word
    if (words.length > 2) out.add(`${words[0]} ${words[words.length - 1]}`);
  }
  out.add(`علامہ ${term}`);
  out.add(`حضرت ${term}`);
  out.add(`مولانا ${term}`);
  out.delete(term);
  return [...out].filter(Boolean).slice(0, 8);
}

// Search the currently-loaded document; auto-tries variants if nothing found
function assistantSearch(pdfId, term) {
  const cached = pdfId && pdfCache.get(pdfId);
  if (!cached) {
    return { found: false, noDocument: true,
      message: 'Abhi koi file load nahi hai. Pehle Search ya فہارس tab mein file upload karein, phir main usme dhoond sakta hoon.' };
  }
  if (!cached.pageMap) cached.pageMap = buildPageNumberMap(cached.pages).map;

  const run = (t) => {
    const needle = normalizeUrdu(t);
    if (!needle) return { pages: [], total: 0 };
    const pages = []; let total = 0;
    for (const { pageNum, text } of cached.pages) {
      if (!text) continue;
      const hay = normalizeUrdu(text);
      let c = 0, idx = 0;
      while ((idx = hay.indexOf(needle, idx)) !== -1) { c++; idx += needle.length; }
      if (c > 0) { pages.push(cached.pageMap[pageNum] || pageNum); total += c; }
    }
    return { pages: [...new Set(pages)].sort((a, b) => a - b), total };
  };

  let res = run(term), usedVariant = null;
  if (res.total === 0) {
    for (const v of buildSearchVariants(term)) {
      const r = run(v);
      if (r.total > 0) { res = r; usedVariant = v; break; }
    }
  }
  return {
    found: res.total > 0,
    term, usedVariant,
    pages: res.pages.map(toUrduNum),
    pagesRaw: res.pages,
    totalMatches: res.total,
    fileName: cached.fileName || '',
  };
}

const ASSISTANT_SYSTEM = `Tum "Urdu PDF Pro" website ke madadgar AI assistant ho.
Roman Urdu (aur zaroorat ho to Urdu) mein dosti-bhare, mukhtasar jawab do.

Website ke features jin mein tum user ki rehnumai karte ho:
- 📄 Convert: PDF/Image/Word ko saaf Urdu Word file banata hai (scanned ke liye OCR). Convert tab mein file upload karke "Convert Karo" dabayein.
- 🔍 Search: kisi lafz ko poori file mein dhoondta hai aur har صفحہ نمبر deta hai. PDF/Word report bhi download hoti hai.
- 📋 فہارس (Index): شخصیات، اماکن، کتابیں، زبانیں ki fehrist banata hai. "میری فہرست" mode mein user apne naam de to 100% exact pages milte hain.
- 📖 لغت (Dictionary, sirf admin): naam sikhata hai taake فہارس behtar bane.

Tumhare paas "search_in_document" tool hai. Jab bhi user kuch dhoondhna/find karna chahe (jaise "iqbal find karo", "ye lafz nahi mila"), to ye tool use karo.
Agar lafz na mile to tool khud milti julti spelling (variants) try karta hai — user ko batao ke kis spelling se mila.
Agar koi file load na ho to user ko file upload karne ko kaho.
Convert/فہارس jaise lambay kaam ke liye user ko sahi tab aur steps batao.`;

async function groqChat(messages, tools) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages, tools, temperature: 0.3, max_tokens: 800,
    }),
  });
  if (!r.ok) throw new Error(`Groq ${r.status}: ${await r.text()}`);
  return r.json();
}

// Rule-based fallback assistant (works without any API key)
function ruleAssistant(userText, pdfId) {
  const text = String(userText || '').trim();
  const low = text.toLowerCase();
  const findRe = /(?:find|search|dhoond[o0]?|talaash|talash|ڈھونڈ[ووو]?|تلاش|نکال)/i;

  if (findRe.test(low)) {
    // extract the term: quoted, or after the keyword/colon
    let term = (text.match(/["'“”«»]([^"'“”«»]+)["'“”«»]/) || [])[1];
    if (!term) term = (text.match(/(?:find|search|dhoond[o0]?|talaash|talash|تلاش|ڈھونڈو|نکالو)\s*[:\-]?\s*(.+)/i) || [])[1];
    term = (term || '').replace(/\s+(kar[o0]?|karo|krdo|kr\s*do|please|plz)\s*$/i, '').trim();
    if (!term) return 'Kya dhoondhna hai? Misaal: "اقبال find karo".';
    const r = assistantSearch(pdfId, term);
    if (r.noDocument) return r.message;
    if (!r.found) return `"${term}" kisi صفحے par nahi mila — milti julti spelling bhi try ki. Shayad spelling alag ho? Aap لغت/فہارس bhi try kar sakte hain.`;
    const via = r.usedVariant ? ` (spelling "${r.usedVariant}" se mila)` : '';
    return `✅ "${term}"${via} ${toUrduNum(r.pagesRaw.length)} صفحات par mila (${toUrduNum(r.totalMatches)} بار):\nصفحات: ${r.pages.join('، ')}`;
  }
  if (/convert|word banao|word me|ورڈ/i.test(low))
    return '📄 Convert ke liye: upar "Convert" tab kholein, PDF/Image/Word upload karein, phir "Convert Karo" dabayein — saaf Urdu Word file download ho jayegi.';
  if (/فہارس|fihris|fiharis|index|fehrist|فہرست/i.test(low))
    return '📋 فہارس ke liye: "فہارس" tab mein file upload karein. 100% درست pages ke liye "میری فہرست" mode chunein aur naam khud likhein.';
  if (/لغت|dictionary|vocab/i.test(low))
    return '📖 لغت (Dictionary) admin ke liye hai — wahan naam add karne se فہارس behtar banti hai.';
  if (/salam|aoa|assalam|hello|hi|ہائے|سلام/i.test(low))
    return 'وعلیکم السلام! 😊 Main Urdu PDF Pro ka assistant hoon. Convert, Search ya فہارس — kisi bhi cheez mein madad chahiye? "اقبال find karo" jaisa likhein.';
  return 'Main aapki madad kar sakta hoon: file convert, lafz search (صفحہ نمبر ke saath), ya فہارس banane mein. Misaal: "علامہ اقبال find karo" ya "convert kaise karun?".';
}

app.post('/api/assistant/chat', requireAuth, async (req, res) => {
  try {
    const { messages, pdfId } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages chahiye' });
    }
    const history = messages.slice(-10).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || ''),
    }));
    const lastUser = [...history].reverse().find(m => m.role === 'user');

    // No key → rule-based assistant (still fully usable & free)
    if (!process.env.GROQ_API_KEY) {
      return res.json({ reply: ruleAssistant(lastUser?.content || '', pdfId), mode: 'rule' });
    }

    // Groq with tool-calling loop
    const tools = [{
      type: 'function',
      function: {
        name: 'search_in_document',
        description: 'Search the user\'s currently loaded document for a word or name (Urdu) and return the pages where it appears. Use whenever the user wants to find/locate something.',
        parameters: {
          type: 'object',
          properties: { term: { type: 'string', description: 'The word or name to find, in Urdu' } },
          required: ['term'],
        },
      },
    }];

    let convo = [{ role: 'system', content: ASSISTANT_SYSTEM }, ...history];
    for (let step = 0; step < 4; step++) {
      const data = await groqChat(convo, tools);
      const msg = data.choices?.[0]?.message;
      if (!msg) break;
      convo.push(msg);
      if (msg.tool_calls && msg.tool_calls.length) {
        for (const tc of msg.tool_calls) {
          let result;
          if (tc.function?.name === 'search_in_document') {
            let args = {}; try { args = JSON.parse(tc.function.arguments || '{}'); } catch (e) {}
            result = assistantSearch(pdfId, args.term || '');
          } else {
            result = { error: 'unknown tool' };
          }
          convo.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
        }
        continue;
      }
      return res.json({ reply: msg.content || '...', mode: 'ai' });
    }
    const last = convo[convo.length - 1];
    return res.json({ reply: (last && last.content) || 'Maaf kijiye, dobara koshish karein.', mode: 'ai' });
  } catch (e) {
    console.error('Assistant error:', e.message);
    // Graceful fallback to rule-based on any AI failure
    try {
      const last = [...(req.body.messages || [])].reverse().find(m => m.role === 'user');
      return res.json({ reply: ruleAssistant(last?.content || '', req.body.pdfId), mode: 'rule-fallback' });
    } catch (e2) {
      return res.status(500).json({ error: 'Assistant fail' });
    }
  }
});

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN API
// ═══════════════════════════════════════════════════════════════════════════
// Multiple admins supported (comma-separated in ADMIN_EMAIL env, plus defaults)
const ADMIN_EMAILS = new Set(
  [
    ...(process.env.ADMIN_EMAIL || '').split(',').map(s => s.trim().toLowerCase()),
    'alphacoders930@gmail.com',
    'inayatmalik@gmail.com',
  ].filter(Boolean)
);

// Resolve the caller's VERIFIED email.
// 1) session (set server-side at OAuth — trustworthy)
// 2) else verify the Google access token (X-Tokens) by calling Google —
//    the token can't be forged, so this can't be spoofed (unlike a plain header)
async function resolveVerifiedEmail(req) {
  if (req.session.user?.email) return req.session.user.email;
  const th = req.headers['x-tokens'] || req.get('X-Tokens');
  if (th) {
    try {
      const tokens = JSON.parse(th);
      oauth2Client.setCredentials(tokens);
      const { data } = await google.oauth2({ version: 'v2', auth: oauth2Client }).userinfo.get();
      return data.email || null;
    } catch (e) { /* invalid/expired token */ }
  }
  return null;
}

const isAdmin = async (req, res, next) => {
  try {
    const email = await resolveVerifiedEmail(req);
    if (!email || !ADMIN_EMAILS.has(email.toLowerCase())) {
      return res.status(403).json({ error: 'Access denied' });
    }
    req.adminEmail = email;
    next();
  } catch (e) {
    return res.status(403).json({ error: 'Access denied' });
  }
};

app.get('/api/admin/stats', isAdmin, (req, res) => {
  const totalUsers    = Object.keys(analytics.users).length;
  const totalConverts = Object.values(analytics.users).reduce((s, u) => s + (u.converts || 0), 0);
  const totalSearches = Object.values(analytics.users).reduce((s, u) => s + (u.searches || 0), 0);
  const totalIndexes  = Object.values(analytics.users).reduce((s, u) => s + (u.indexes  || 0), 0);

  // Last 7 days
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    days.push({ date: key, ...(analytics.dailyStats[key] || { converts: 0, searches: 0, indexes: 0, newUsers: 0 }) });
  }

  const uptimeSeconds = Math.floor((Date.now() - SERVER_START) / 1000);
  const mem = process.memoryUsage();

  res.json({
    totalUsers, totalConverts, totalSearches, totalIndexes,
    dailyStats: days,
    system: {
      uptimeSeconds,
      cacheSize: pdfCache.size,
      memHeapMB: Math.round(mem.heapUsed / 1024 / 1024),
      memRssMB:  Math.round(mem.rss       / 1024 / 1024),
      nodeVersion: process.version,
    }
  });
});

app.get('/api/admin/users', isAdmin, (req, res) => {
  const list = Object.entries(analytics.users).map(([id, u]) => ({ id, ...u }));
  list.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
  res.json({ users: list });
});

app.get('/api/admin/activity', isAdmin, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  res.json({ activity: analytics.recentActivity.slice(0, limit) });
});

// ═══════════════════════════════════════════════════════════════════════════
// DICTIONARY API (user-taught vocabulary for فہارس)
// ═══════════════════════════════════════════════════════════════════════════

// Get current dictionary (counts + terms)
app.get('/api/dictionary', isAdmin, (req, res) => {
  const counts = {};
  for (const c of DICT_CATS) counts[c] = customDict[c].length;
  res.json({ dictionary: customDict, counts });
});

// Add terms (pasted text — newline/comma separated) to a category
app.post('/api/dictionary/add', isAdmin, (req, res) => {
  const { category, text } = req.body;
  if (!DICT_CATS.includes(category)) return res.status(400).json({ error: 'Invalid category' });
  const terms = String(text || '').split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
  const added = addDictTerms(category, terms);
  res.json({ added, total: customDict[category].length });
});

// Dedicated uploader for dictionary files (allows .txt in addition to Word)
const dictUpload = multer({
  dest: 'uploads/',
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'text/plain' || WORD_MIMES.has(file.mimetype)
      || /\.(txt|docx|doc)$/i.test(file.originalname || '');
    ok ? cb(null, true) : cb(new Error('Sirf .txt ya Word file allowed hai'));
  }
});

// Upload a document (txt / Word) — every line becomes a term in the category
app.post('/api/dictionary/upload', isAdmin, dictUpload.single('file'), async (req, res) => {
  try {
    const category = req.body.category;
    if (!DICT_CATS.includes(category)) return res.status(400).json({ error: 'Invalid category' });
    if (!req.file) return res.status(400).json({ error: 'File chahiye' });

    let raw = '';
    if (WORD_MIMES.has(req.file.mimetype)) {
      const pages = await extractWordText(req.file.path);
      raw = pages.map(p => p.text).join('\n');
    } else {
      raw = fs.readFileSync(req.file.path, 'utf8');
    }
    try { fs.unlinkSync(req.file.path); } catch (e) {}

    const terms = raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    const added = addDictTerms(category, terms);
    res.json({ added, total: customDict[category].length });
  } catch (e) {
    console.error('Dictionary upload error:', e.message);
    res.status(500).json({ error: 'Upload fail: ' + e.message });
  }
});

// Remove a single term
app.post('/api/dictionary/remove', isAdmin, (req, res) => {
  const { category, term } = req.body;
  if (!DICT_CATS.includes(category)) return res.status(400).json({ error: 'Invalid category' });
  customDict[category] = customDict[category].filter(t => t !== term);
  saveDictionary();
  res.json({ total: customDict[category].length });
});

// Clear an entire category
app.post('/api/dictionary/clear', isAdmin, (req, res) => {
  const { category } = req.body;
  if (!DICT_CATS.includes(category)) return res.status(400).json({ error: 'Invalid category' });
  customDict[category] = [];
  saveDictionary();
  res.json({ total: 0 });
});

// ─── Server Start ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`Frontend: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});
