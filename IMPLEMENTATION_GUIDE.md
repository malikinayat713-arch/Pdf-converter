# PDF Search Feature - Implementation Guide

**Step-by-Step Development Walkthrough**

---

## PHASE 1: BACKEND SETUP (Days 1-5)

### Step 1.1: Install Dependencies

```bash
cd backend
npm install pdf-parse
npm install uuid  # already installed, but confirm
npm install cors  # already installed
```

**Updated package.json dependencies:**
```json
{
  "express": "^4.18.2",
  "pdf-parse": "^1.1.1",
  "pdfjs-dist": "^3.11.174",
  "docx": "^8.5.0",
  "axios": "^1.4.0",
  "multer": "^1.4.5",
  "express-session": "^1.17.3",
  "googleapis": "^118.0.0",
  "canvas": "^2.11.0",
  "uuid": "^9.0.0",
  "dotenv": "^16.0.3"
}
```

### Step 1.2: Update Backend server.js - Add PDF Cache

Insert after the progressMap declaration (around line 74):

```javascript
// ─── PDF Cache (expires after 1 hour) ──────────────────────────────────────
const pdfCache = new Map();
const PDF_CACHE_TTL = 60 * 60 * 1000; // 1 hour

function cleanupExpiredPDFs() {
  const now = Date.now();
  for (const [pdfId, data] of pdfCache.entries()) {
    if (now > data.expiresAt) {
      pdfCache.delete(pdfId);
      console.log(`[Cache] Expired PDF: ${pdfId}`);
    }
  }
}

// Cleanup every 10 minutes
setInterval(cleanupExpiredPDFs, 10 * 60 * 1000);
```

### Step 1.3: Add PDF Extract Endpoint

Add before the `/api/convert` endpoint (around line 206):

```javascript
// ─── Extract PDF Text ─────────────────────────────────────────────────────
app.post('/api/pdf/extract', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.session.tokens && !req.session.user && !req.headers['x-tokens']) {
      return res.status(401).json({ error: 'Login required' });
    }

    if (req.headers['x-tokens']) {
      try {
        const tokens = JSON.parse(req.headers['x-tokens']);
        req.session.tokens = tokens;
      } catch (e) {
        console.error('Failed to parse tokens:', e.message);
      }
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileName = req.file.originalname;
    const pdfId = uuidv4();

    // Read and parse PDF
    const pdfData = new Uint8Array(fs.readFileSync(filePath));
    const pdfDoc = await pdfjsLib.getDocument({
      data: pdfData,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true
    }).promise;

    const totalPages = Math.min(pdfDoc.numPages, 1000);
    const pages = [];

    // Extract text from each page
    for (let i = 1; i <= totalPages; i++) {
      try {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ')
          .trim();

        pages.push({
          pageNum: i,
          text: pageText,
          lines: pageText.split('\n').map(l => l.trim()).filter(l => l)
        });
      } catch (e) {
        console.error(`Error extracting page ${i}:`, e.message);
        pages.push({ pageNum: i, text: '', lines: [] });
      }
    }

    // Cache the extracted PDF
    pdfCache.set(pdfId, {
      userId: req.session.user?.id || 'anonymous',
      fileName: fileName,
      pageCount: totalPages,
      pages: pages,
      createdAt: Date.now(),
      expiresAt: Date.now() + PDF_CACHE_TTL,
      accessedAt: Date.now()
    });

    // Cleanup uploaded file
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      // Ignore cleanup errors
    }

    res.json({
      pdfId: pdfId,
      fileName: fileName,
      pageCount: totalPages,
      message: `PDF extracted. ${totalPages} pages ready to search.`
    });
  } catch (err) {
    console.error('Extract error:', err);
    try {
      fs.unlinkSync(req.file.path);
    } catch (e) {
      // Ignore
    }
    res.status(500).json({
      error: err.message || 'Failed to extract PDF'
    });
  }
});
```

### Step 1.4: Add PDF Search Endpoint

Add after the extract endpoint:

```javascript
// ─── Search Extracted PDF ────────────────────────────────────────────────────
app.post('/api/pdf/search', (req, res) => {
  try {
    if (!req.session.tokens && !req.session.user && !req.headers['x-tokens']) {
      return res.status(401).json({ error: 'Login required' });
    }

    if (req.headers['x-tokens']) {
      try {
        const tokens = JSON.parse(req.headers['x-tokens']);
        req.session.tokens = tokens;
      } catch (e) {
        console.error('Failed to parse tokens:', e.message);
      }
    }

    const { pdfId, query, caseSensitive, wholeWords } = req.body;

    if (!pdfId || !query) {
      return res.status(400).json({ error: 'pdfId and query are required' });
    }

    if (query.length > 500) {
      return res.status(400).json({ error: 'Query too long (max 500 chars)' });
    }

    const pdfData = pdfCache.get(pdfId);
    if (!pdfData) {
      return res.status(404).json({
        error: 'PDF not found or has expired. Please upload again.'
      });
    }

    // Update access time
    pdfData.accessedAt = Date.now();

    const startTime = Date.now();

    // Build regex for search
    let searchRegex;
    try {
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const flags = caseSensitive ? 'g' : 'gi';

      if (wholeWords) {
        // Urdu-aware word boundary (considering Urdu characters)
        const urduWordBoundary = /[\p{L}\p{N}]/u;
        searchRegex = new RegExp(`(?<!\\w)${escapedQuery}(?!\\w)`, flags);
      } else {
        searchRegex = new RegExp(escapedQuery, flags);
      }
    } catch (e) {
      return res.status(400).json({ error: 'Invalid search query' });
    }

    const results = [];
    let totalMatches = 0;
    const pagesFound = new Set();

    // Search through pages
    pdfData.pages.forEach(page => {
      const pageText = page.text;
      const matches = [];

      let match;
      // Reset regex for reuse
      searchRegex.lastIndex = 0;

      while ((match = searchRegex.exec(pageText)) !== null) {
        const start = Math.max(0, match.index - 80);
        const end = Math.min(pageText.length, match.index + match[0].length + 80);
        const context = pageText.substring(start, end);

        matches.push({
          matchText: match[0],
          context: context,
          lineNum: page.lines.findIndex(l => l.includes(match[0])) + 1,
          position: {
            start: match.index,
            end: match.index + match[0].length
          }
        });
      }

      if (matches.length > 0) {
        pagesFound.add(page.pageNum);
        results.push({
          pageNum: page.pageNum,
          matchCount: matches.length,
          matches: matches
        });
        totalMatches += matches.length;
      }
    });

    const searchTime = Date.now() - startTime;

    res.json({
      query: query,
      totalMatches: totalMatches,
      pagesFound: Array.from(pagesFound).sort((a, b) => a - b),
      results: results,
      searchTime: searchTime,
      pdfInfo: {
        pageCount: pdfData.pageCount,
        fileName: pdfData.fileName
      }
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({
      error: err.message || 'Search failed'
    });
  }
});
```

### Step 1.5: Add PDF Info Endpoint

Add after the search endpoint:

```javascript
// ─── Get PDF Cache Info ──────────────────────────────────────────────────────
app.get('/api/pdf/:pdfId/info', (req, res) => {
  try {
    if (!req.session.tokens && !req.session.user && !req.headers['x-tokens']) {
      return res.status(401).json({ error: 'Login required' });
    }

    const pdfData = pdfCache.get(req.params.pdfId);
    if (!pdfData) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    const expiresIn = Math.max(0, pdfData.expiresAt - Date.now());

    res.json({
      pdfId: req.params.pdfId,
      fileName: pdfData.fileName,
      pageCount: pdfData.pageCount,
      createdAt: new Date(pdfData.createdAt).toISOString(),
      expiresAt: new Date(pdfData.expiresAt).toISOString(),
      expiresIn: expiresIn,
      accessedAt: new Date(pdfData.accessedAt).toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get PDF info' });
  }
});
```

---

## PHASE 2: FRONTEND COMPONENTS (Days 6-12)

### Step 2.1: Extend App.js - Add Mode State

Modify the state section at the top of App() function:

```javascript
export default function App() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('convert'); // NEW: 'convert' or 'search'
  const [loading, setLoading] = useState(true);
  // ... rest of existing state
```

### Step 2.2: Add Mode Selector Component

Add before the return statement in App.js (around line 110):

```javascript
  // NEW: Mode Selector Component
  function ModeSelector() {
    return (
      <div className="mode-tabs">
        <button
          className={`mode-tab ${mode === 'convert' ? 'active' : ''}`}
          onClick={() => {
            setMode('convert');
            reset();
          }}
        >
          <span>📄</span> Convert to Word
        </button>
        <button
          className={`mode-tab ${mode === 'search' ? 'active' : ''}`}
          onClick={() => {
            setMode('search');
            reset();
          }}
        >
          <span>🔍</span> Search PDF
        </button>
      </div>
    );
  }
```

### Step 2.3: Create SearchMode Component

Add this new component to App.js (before the main return):

```javascript
  // NEW: Search Mode Component
  function SearchMode() {
    const [searchFile, setSearchFile] = useState(null);
    const [pdfId, setPdfId] = useState(null);
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState(null);
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [wholeWords, setWholeWords] = useState(false);
    const fileRef = useRef();

    const handleSearchDrop = useCallback(e => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f && f.type === 'application/pdf') {
        setSearchFile(f);
        setSearchError(null);
      } else {
        setSearchError('Only PDF files are supported');
      }
    }, []);

    const handleSearchFile = e => {
      const f = e.target.files[0];
      if (f) {
        setSearchFile(f);
        setSearchError(null);
        setPdfId(null);
        setSearchResults(null);
      }
    };

    const uploadPDF = async () => {
      if (!searchFile) return;
      setSearchError(null);
      setSearchLoading(true);
      const fd = new FormData();
      fd.append('pdf', searchFile);

      try {
        const headers = { withCredentials: true };
        const tokens = localStorage.getItem('tokens');
        if (tokens) headers['X-Tokens'] = tokens;
        const { data } = await axios.post(`${API}/api/pdf/extract`, fd, {
          withCredentials: true,
          headers
        });
        setPdfId(data.pdfId);
        setSearchResults(null);
        setQuery('');
      } catch (e) {
        setSearchError(e.response?.data?.error || 'Failed to upload PDF');
      } finally {
        setSearchLoading(false);
      }
    };

    const performSearch = async e => {
      e.preventDefault();
      if (!query.trim() || !pdfId) return;

      setSearchLoading(true);
      setSearchError(null);

      try {
        const headers = { withCredentials: true };
        const tokens = localStorage.getItem('tokens');
        if (tokens) headers['X-Tokens'] = tokens;
        const { data } = await axios.post(
          `${API}/api/pdf/search`,
          { pdfId, query, caseSensitive, wholeWords },
          { withCredentials: true, headers }
        );
        setSearchResults(data);
      } catch (e) {
        setSearchError(e.response?.data?.error || 'Search failed');
      } finally {
        setSearchLoading(false);
      }
    };

    const resetSearch = () => {
      setSearchFile(null);
      setPdfId(null);
      setQuery('');
      setSearchResults(null);
      setSearchError(null);
      setSearchLoading(false);
    };

    // UPLOAD PHASE: File not yet uploaded
    if (!pdfId) {
      return (
        <div className="search-wrap">
          <div className="conv-hero">
            <h1 className="conv-title">PDF تلاش کریں</h1>
            <p className="conv-sub">اپنی PDF upload کریں اور اردو متن تلاش کریں</p>
          </div>

          <div className="conv-body">
            <div
              className={`drop ${dragOver ? 'drag' : ''} ${searchFile ? 'has-file' : ''}`}
              onDrop={handleSearchDrop}
              onDragOver={e => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => !searchFile && fileRef.current.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                onChange={handleSearchFile}
                style={{ display: 'none' }}
              />
              {searchFile ? (
                <div className="file-row">
                  <div className="file-ic">📑</div>
                  <div className="file-meta">
                    <div className="file-nm">{searchFile.name}</div>
                    <div className="file-sz">{fmtSize(searchFile.size)}</div>
                  </div>
                  <button
                    className="file-rm"
                    onClick={e => {
                      e.stopPropagation();
                      setSearchFile(null);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="drop-inner">
                  <div className="drop-anim">
                    <div className="drop-circle c1" />
                    <div className="drop-circle c2" />
                    <div className="drop-circle c3" />
                    <span className="drop-main-ic">📂</span>
                  </div>
                  <div className="drop-txt">یہاں PDF drop کریں</div>
                  <div className="drop-st">یا کلک کریں تاکہ منتخب کریں</div>
                  <div className="drop-chips">
                    <span className="chip">PDF Only</span>
                    <span className="chip">Max 500MB</span>
                    <span className="chip">1000 Pages</span>
                  </div>
                </div>
              )}
            </div>

            {searchError && (
              <div className="err-box">
                <span>⚠️</span> {searchError}
              </div>
            )}

            {searchFile && (
              <button
                className="btn-conv"
                onClick={uploadPDF}
                disabled={searchLoading}
              >
                <span className="btn-conv-ic">📤</span>
                {searchLoading ? 'اپ لوڈ ہو رہا ہے...' : 'PDF اپ لوڈ کریں'}
              </button>
            )}

            <div className="how-card">
              <div className="how-title">⚡ یہ کیسے کام کرتا ہے؟</div>
              <div className="how-steps">
                {[
                  ['📄', 'PDF اپ لوڈ کریں'],
                  ['🔍', 'متن میں تلاش کریں'],
                  ['📖', 'صفحہ نمبر دیکھیں'],
                  ['✨', 'نتائج کاپی کریں'],
                ].map(([ic, txt], i) => (
                  <div className="how-step" key={i}>
                    <div className="how-num">{i + 1}</div>
                    <div className="how-ic">{ic}</div>
                    <div className="how-txt">{txt}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // SEARCH PHASE: File uploaded, ready to search
    return (
      <div className="search-wrap">
        <div className="conv-hero">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center', marginBottom: '16px' }}>
            <button
              onClick={resetSearch}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer'
              }}
              title="نئی PDF اپ لوڈ کریں"
            >
              ↩️
            </button>
            <h1 className="conv-title" style={{ margin: 0 }}>
              {searchFile.name}
            </h1>
          </div>
          <p className="conv-sub">اردو متن تلاش کریں</p>
        </div>

        <div className="conv-body">
          {/* Search Bar */}
          <form onSubmit={performSearch} className="search-bar-form">
            <div className="search-input-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="search-input"
                placeholder="اردو متن تلاش کریں... (Search Urdu text)"
                value={query}
                onChange={e => setQuery(e.target.value)}
                dir="auto"
                disabled={searchLoading}
              />
            </div>
            <button
              type="submit"
              className="search-btn"
              disabled={searchLoading || !query.trim()}
            >
              {searchLoading ? '⏳' : '🔍'} {searchLoading ? 'تلاش ہو رہی ہے' : 'Search'}
            </button>
          </form>

          {/* Search Filters */}
          <div className="search-filters">
            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={e => setCaseSensitive(e.target.checked)}
              />
              Case Sensitive
            </label>
            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={wholeWords}
                onChange={e => setWholeWords(e.target.checked)}
              />
              Whole Words Only
            </label>
          </div>

          {/* Loading State */}
          {searchLoading && (
            <div className="search-loading">
              <div className="loading-spinner" />
              <div className="loading-text">تلاش ہو رہی ہے...</div>
              <div className="loading-query">'{query}'</div>
            </div>
          )}

          {/* Error State */}
          {searchError && !searchLoading && (
            <div className="search-error">
              <div className="search-error-icon">⚠️</div>
              <div className="search-error-content">
                <div className="search-error-title">تلاش ناکام</div>
                <div className="search-error-msg">{searchError}</div>
                <div className="search-error-actions">
                  <button
                    className="error-retry-btn"
                    onClick={() => setSearchError(null)}
                  >
                    دوبارہ کوشش کریں
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          {searchResults && searchResults.totalMatches === 0 && !searchLoading && (
            <div className="no-results">
              <div className="no-results-icon">❌</div>
              <div className="no-results-title">کوئی نتیجہ نہیں</div>
              <div className="no-results-text">
                '{query}' کے لیے کوئی نتیجہ نہیں ملا
              </div>
              <div className="no-results-tips">
                <ul>
                  <li>اپنی ہجی کی جانچ کریں</li>
                  <li>سادہ الفاظ استعمال کریں</li>
                  <li>خصوصی حروف نہ استعمال کریں</li>
                </ul>
              </div>
            </div>
          )}

          {searchResults && searchResults.totalMatches > 0 && !searchLoading && (
            <>
              <div className="search-results-summary">
                <span>✓</span> {searchResults.totalMatches} نتائج{' '}
                <span>{searchResults.results.length}</span> صفحات میں
                ({searchResults.searchTime}ms)
              </div>

              <div className="results-list">
                {searchResults.results.map(result => (
                  <div key={`page-${result.pageNum}`} className="result-card">
                    <div className="result-header">
                      <span className="page-badge">📄 Page {result.pageNum}</span>
                      <span className="match-count">
                        {result.matchCount} match{result.matchCount !== 1 ? 'es' : ''}
                      </span>
                    </div>

                    {result.matches.map((match, idx) => (
                      <div key={idx}>
                        <div className="result-text">
                          <span dir="auto">
                            {match.context.substring(0, match.context.indexOf(match.matchText))}
                            <span className="match">{match.matchText}</span>
                            {match.context.substring(
                              match.context.indexOf(match.matchText) + match.matchText.length
                            )}
                          </span>
                        </div>
                      </div>
                    ))}

                    <div className="result-actions">
                      <button
                        className="result-action-btn"
                        onClick={() => {
                          const text = result.matches
                            .map(m => m.context)
                            .join('\n---\n');
                          navigator.clipboard.writeText(text);
                          alert('نتیجہ کاپی ہو گیا!');
                        }}
                      >
                        📋 Copy
                      </button>
                      <button
                        className="result-action-btn"
                        onClick={() => alert(`صفحہ ${result.pageNum} پر جائیں (جلد آنے والی)`)}
                      >
                        👁️ View Page
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
```

### Step 2.4: Update Main Return JSX

Modify the return statement to include mode selector and conditional rendering:

```javascript
  return (
    <div className="app">
      <div className="bg-gradient" />
      <div className="bg-dots" />

      {/* Header */}
      <header className="header">
        {/* ... existing header code ... */}
      </header>

      <main className="main">
        {!user ? (
          /* Login Screen */
          <div className="login-wrap">
            {/* ... existing login code ... */}
          </div>
        ) : (
          /* Main App - NEW: Mode Selector */
          <>
            <ModeSelector />

            {/* Conditional rendering based on mode */}
            {mode === 'convert' ? (
              /* Convert Mode - Existing code */
              <div className="conv-wrap">
                {/* ... existing conversion UI code ... */}
              </div>
            ) : (
              /* Search Mode - NEW Component */
              <SearchMode />
            )}
          </>
        )}
      </main>

      <footer className="footer">
        {/* ... existing footer ... */}
      </footer>
    </div>
  );
```

### Step 2.5: Update App.css - Add Search Styles

Add all the CSS from Section 3.3 of PDF_SEARCH_DESIGN.md to App.css

---

## PHASE 3: INTEGRATION & TESTING (Days 13-15)

### Step 3.1: Test Backend Endpoints

**Test PDF Extract:**
```bash
curl -X POST http://localhost:5000/api/pdf/extract \
  -F "pdf=@test.pdf" \
  -H "X-Tokens: {}" \
  -H "Cookie: session_id=..."
```

**Test PDF Search:**
```bash
curl -X POST http://localhost:5000/api/pdf/search \
  -H "Content-Type: application/json" \
  -H "X-Tokens: {}" \
  -d '{"pdfId":"...", "query":"تلاش", "caseSensitive":false}'
```

### Step 3.2: Test Frontend Flows

**Test Case 1: Upload & Search Happy Path**
- [ ] Upload PDF successfully
- [ ] PDF extract endpoint called
- [ ] pdfId returned and stored
- [ ] Search input appears
- [ ] Search executes successfully
- [ ] Results display with correct page numbers
- [ ] Match highlights work

**Test Case 2: Error Handling**
- [ ] Invalid PDF shows error
- [ ] Network error displays retry button
- [ ] Expired pdfId shows clear message
- [ ] Long queries get rejected

**Test Case 3: Mobile Responsiveness**
- [ ] Dropzone responsive
- [ ] Search bar wraps on mobile
- [ ] Results cards stack properly
- [ ] Buttons touch-friendly (48px minimum)

### Step 3.3: Performance Testing

**Benchmark queries:**
```javascript
// Test with 100-page PDF
const startTime = performance.now();
await performSearch();
const duration = performance.now() - startTime;
console.log(`Search took ${duration}ms`);
// Target: < 500ms
```

### Step 3.4: Accessibility Audit

- [ ] Test with keyboard navigation (Tab, Enter, Escape)
- [ ] Test with screen reader (NVDA/JAWS)
- [ ] Verify color contrast (WCAG AA)
- [ ] Check focus indicators
- [ ] Test RTL text rendering

---

## DEPLOYMENT CHECKLIST

### Backend (Railway)

**Before deployment:**
```bash
# Test build
npm run build  # if applicable
npm start      # verify server starts

# Check environment variables
echo $GOOGLE_CLIENT_ID
echo $GOOGLE_CLIENT_SECRET
```

**On Railway:**
1. Connect GitHub repo
2. Select `/backend` directory
3. Add environment variables (same as local .env)
4. Deploy
5. Monitor logs for errors

### Frontend (Netlify/Vercel)

**Before deployment:**
```bash
cd frontend
npm run build
# Test build locally: npm install -g serve && serve -s build
```

**On Netlify:**
1. Connect GitHub repo
2. Build command: `npm run build`
3. Publish directory: `build`
4. Environment variables: `REACT_APP_API_URL=https://your-backend.railway.app`
5. Deploy

### Verification

After deployment:
- [ ] Login works
- [ ] Convert mode still works
- [ ] Can upload PDF in search mode
- [ ] Search returns results
- [ ] No console errors
- [ ] Mobile responsive
- [ ] API calls use HTTPS

---

## QUICK START SUMMARY

**Total implementation time: 2-3 weeks**

1. **Day 1-2**: Backend - Install deps, add cache, create extract endpoint
2. **Day 3-4**: Backend - Add search endpoint, test with curl
3. **Day 5-8**: Frontend - Create SearchMode component, build UI
4. **Day 9-10**: Frontend - Connect to APIs, handle states
5. **Day 11-12**: Testing - Unit tests, E2E flows, mobile test
6. **Day 13-14**: Polish - Performance tune, accessibility fix
7. **Day 15**: Deploy to production

---

## COMMON ISSUES & SOLUTIONS

| Issue | Solution |
|-------|----------|
| PDF extraction hangs | Increase timeout, process pages in batches |
| Search regex errors | Escape special characters, use try-catch |
| Cache memory grows | Implement TTL cleanup (already done) |
| CORS errors in frontend | Ensure CORS headers in Express middleware |
| Auth fails in search | Store tokens in localStorage, pass in header |
| RTL text breaks | Use `dir="auto"` on inputs, text containers |
| Mobile layout breaks | Test on 320px, 768px, 1024px widths |

---

## NEXT STEPS

1. ✅ Approve design (this document)
2. → Clone repo and create feature branch: `git checkout -b feature/pdf-search`
3. → Implement backend endpoints (days 1-4)
4. → Implement frontend components (days 5-10)
5. → Test and polish (days 11-14)
6. → Create pull request with detailed notes
7. → Code review and merge
8. → Deploy to production

---

**Ready to build? Let's go! 🚀**
