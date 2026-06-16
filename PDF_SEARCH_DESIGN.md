# PDF Search Feature - Design & Implementation Guide

**Professional PDF Search for Urdu PDF Converter**

---

## Executive Summary

Add a dual-mode feature to the Urdu PDF Converter: **Convert PDF to Word** (existing) OR **Search PDF for Text** (new). Users can select their desired workflow, upload a PDF, and either convert it or perform fast, accurate text search with page-number pinpointing.

---

## 1. UI/UX DESIGN

### 1.1 Design Philosophy

**Aesthetic Direction: Modern Professional + Multilingual Accessibility**

- **Tone**: Refined, minimalist, with strategic use of the existing blue/purple gradient palette
- **Hierarchy**: Clear separation between Convert vs Search modes
- **Language**: Full RTL support for Urdu, LTR for English
- **Accessibility**: WCAG 2.1 AA compliant, keyboard navigable, screen reader friendly

### 1.2 Layout Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER (sticky)                                            │
│  Logo + User Pill + Logout                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  MODE SELECTION TABS (prominent, animated)                 │
│  [📄 Convert to Word]  [🔍 Search PDF]                     │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  MAIN CONTENT AREA (responsive grid)                       │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │  FILE UPLOAD ZONE    │  │  SEARCH FILTERS      │        │
│  │  (Drag & Drop)       │  │  (Optional Sidebar)  │        │
│  └──────────────────────┘  └──────────────────────┘        │
│                                                             │
│  RESULTS AREA / PROGRESS AREA / EMPTY STATE                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Component Specifications

#### MODE SELECTION TAB BAR
```
Design:
- Two prominent toggle buttons with icons
- Active state: full color + subtle shadow
- Inactive state: light gray + no shadow
- Smooth transition (0.3s)
- Border-bottom indicator on active tab

Convert Mode:    📄 Convert PDF to Word
Search Mode:     🔍 Search PDF for Text

Colors:
- Active: var(--blue) with white text
- Inactive: var(--muted) text on transparent bg
- Background: var(--white) with subtle border
```

#### UPLOAD DROPZONE (Shared across both modes)
```
Design:
- Drag & drop area (45px dashed border, var(--border) color)
- Shows file icon, name, and size when file selected
- Hover state: border turns blue, background lightens
- Drag state: border blue, background light blue, slight scale transform

States:
1. Empty: "Yahan PDF drop karo — ya click karke select karo"
2. Has File: Show file name, size, remove button
3. Error: Red border, error message below

Typography:
- Main text: 16px, font-weight 600
- Subtext: 14px, var(--muted)
- File name: 15px, bold
- File size: 13px, var(--muted)
```

#### SEARCH MODE: SEARCH INPUT & CONTROLS
```
Design:
┌─ Search Input Bar ──────────────────────┐
│  🔍  [Input field]  [Search Button]    │
│  Placeholder: "اردو متن تلاش کریں..."  │
│  (Search Urdu text...)                  │
└─────────────────────────────────────────┘

Filters Row (collapsible on mobile):
[☐ Case Sensitive] [☐ Whole Words] [Recent Searches ▼]

Input Styling:
- Height: 48px
- Font: Inter 15px
- Padding: 12px 16px
- Border: 1px solid var(--border)
- Border-radius: 12px
- Focus state: border-color var(--blue), box-shadow subtle

Search Button:
- Background: var(--blue)
- Color: white
- Height: 48px
- Padding: 0 24px
- Border-radius: 12px
- Hover: darker blue, translateY(-2px)
- Loading state: spinner animation
```

#### SEARCH RESULTS DISPLAY

**Result Card Design:**
```
┌─ Result Card ─────────────────────────────────┐
│  📄 Page 5  ┊  3 matches on this page         │
│  ────────────────────────────────────────────  │
│  "...متن کے درمیان تلاش کردہ TEXT کے ساتھ..." │
│                                               │
│  [Copy Text] [Jump to Page] [Highlight]      │
└───────────────────────────────────────────────┘

Result Count Summary:
"Found X results in Y pages"
- Color: var(--text)
- Font: Inter 15px bold
- Icon: 🔍

Sorting/Filtering:
- Default: by page number ascending
- Option: by relevance (match count)

Empty Result State:
"❌ No matches found for 'query'
Try:
• Checking spelling
• Using simpler terms
• Searching without special characters"
```

#### SEARCH RESULTS LIST
```
Grid Layout:
- Desktop: Single-column card list (700px max-width)
- Mobile: Full-width cards with padding
- Gap between cards: 12px
- Card padding: 20px
- Card border: 1px solid var(--border)
- Card border-radius: 16px
- Card background: white
- Card shadow: var(--shadow)

Each Result Shows:
1. Page Number Badge
   - Background: var(--blue)
   - Color: white
   - Border-radius: 8px
   - Padding: 6px 12px
   - Font: bold, 14px

2. Match Count
   - Text: "3 matches"
   - Color: var(--muted)
   - Font: 13px

3. Context Snippet
   - Show 60 characters before and after match
   - Highlight match in bold, colored text
   - Truncate with "..." if needed

4. Action Buttons
   - Copy Snippet: text-only button
   - Jump to Page: primary action
   - Highlight in PDF: secondary action (future)

Hover Effects:
- Card: subtle shadow increase, translate(-2px)
- Buttons: color change, background lighten
```

### 1.4 States & Flows

**Loading State:**
```
┌─ Searching... ───────────────────────┐
│  🔍 Processing 'query'                │
│  ━━━━━━━━━━━━━━━━━━━━  45%           │
│  Please wait...                       │
└───────────────────────────────────────┘

Progress Bar:
- Background: var(--border)
- Fill: linear-gradient(var(--blue) → purple)
- Height: 6px
- Border-radius: 3px
- Animation: smooth width transition

Spinner:
- 36px circle
- Border: 3px dashed var(--blue)
- Animation: spin 0.8s linear infinite
```

**Error State:**
```
┌─ Error occurred ──────────────────────┐
│  ⚠️ PDF could not be processed        │
│  "Error message from server"          │
│                                       │
│  [Try Again] [New Search]             │
└───────────────────────────────────────┘

Styling:
- Background: var(--red-light)
- Border: 1px solid rgba(red, 0.3)
- Icon: 48px
- Text color: var(--red)
```

### 1.5 Responsive Design Breakpoints

| Breakpoint | Changes |
|-----------|---------|
| **1200px+** | Sidebar for search filters on right |
| **768px - 1200px** | Filters collapse to dropdown |
| **< 768px** | Full-width layout, stacked components |

**Mobile Optimizations:**
- Touch-friendly button sizes: 48px minimum
- Increased padding on dropzone: 32px
- Single-column grid for results
- Modal/drawer for filters
- Tab bar remains horizontal but text can hide

### 1.6 Color Palette (Using Existing Theme)

```css
:root {
  /* Primary */
  --blue: #4361ee;
  --blue-dark: #3451d1;
  --blue-light: #eef1ff;
  
  /* Accent */
  --green: #10b981;  /* Success/matches found */
  --gold: #f59e0b;   /* Highlight */
  --red: #ef4444;    /* Error */
  
  /* Text & Neutral */
  --text: #1e293b;
  --muted: #64748b;
  --light: #94a3b8;
  --border: #e2e8f8;
  --white: #ffffff;
  
  /* Background */
  --bg: #f0f4ff;
}
```

**Search-Specific Usage:**
- Page badges: var(--blue)
- Match highlights: var(--gold)
- Found notification: var(--green)
- No results: var(--muted)
- Error: var(--red)

---

## 2. BACKEND ARCHITECTURE

### 2.1 PDF Text Extraction & Indexing

**Technology Stack:**
- **pdf-parse** (Node.js) - Fast text extraction with page tracking
- **pdfjs-dist** (already in use) - Alternative for character-level extraction if needed
- **Lunr.js** (optional) - Client-side search indexing for small PDFs

**Extraction Process:**

```
PDF Upload
    ↓
1. Extract Raw Text
   - Use pdf-parse to extract all text
   - Preserve page boundaries
   - Track character position per page
   ↓
2. Build Page Index
   - Create map: { pageNum: [text chunks] }
   - Normalize text (trim, dedupe whitespace)
   - Store page numbers for results
   ↓
3. Search Execution
   - Case-insensitive regex or text matching
   - Find all occurrences per page
   - Build results array with metadata
   ↓
4. Return Results
   - Array: [{ pageNum, text, context, matchCount }, ...]
   - Count: total matches
   - Duration: search time (for UX)
```

### 2.2 New API Endpoints

**Endpoint 1: Extract & Cache PDF Text**

```
POST /api/pdf/extract
Headers: X-Tokens (or session auth)
Body: 
{
  file: <PDF binary>
}

Response:
{
  jobId: "uuid",
  pdfId: "uuid", // cached for search reuse
  pageCount: 45,
  message: "PDF extracted. Ready to search."
}

Error Responses:
- 401: Not authenticated
- 400: Invalid file type
- 413: File too large
- 500: Extraction failed
```

**Endpoint 2: Search Extracted PDF**

```
POST /api/pdf/search
Headers: X-Tokens (or session auth)
Body:
{
  pdfId: "uuid",
  query: "متن",
  caseSensitive: false,
  wholeWords: false
}

Response:
{
  query: "متن",
  totalMatches: 12,
  pagesFound: [5, 12, 23],
  results: [
    {
      pageNum: 5,
      matches: [
        {
          text: "...پہلے متن کے بعد...",
          context: "پہلے متن کے ڈیزائن میں...",
          position: { start: 45, end: 48 }
        }
      ],
      matchCount: 3
    },
    ...
  ],
  searchTime: 145  // milliseconds
}

Error Responses:
- 401: Not authenticated
- 404: PDF not found / expired
- 400: Invalid query
- 500: Search failed
```

**Endpoint 3: Get Cached PDF Info**

```
GET /api/pdf/:pdfId/info
Response:
{
  pdfId: "uuid",
  pageCount: 45,
  fileName: "document.pdf",
  createdAt: "2024-01-15T10:30:00Z",
  expiresAt: "2024-01-16T10:30:00Z"
}
```

### 2.3 Data Models

**PDF Cache (In-Memory + Optional DB):**

```javascript
{
  pdfId: UUID,
  userId: "google-user-id",
  fileName: string,
  pageCount: number,
  
  // Page-based text store
  pages: [
    {
      pageNum: 1,
      text: string,      // full page text
      lines: string[]    // by-line text for context
    },
    ...
  ],
  
  // Metadata
  createdAt: timestamp,
  expiresAt: timestamp,  // auto-cleanup after 1 hour
  accessedAt: timestamp
}
```

**Search Result:**

```javascript
{
  pageNum: number,
  matchCount: number,
  matches: [
    {
      matchText: string,     // the actual matched text
      context: string,       // text surrounding match (100 chars before/after)
      lineNum: number,       // for future pagination
      position: {
        start: number,       // character offset in page
        end: number
      }
    }
  ]
}
```

### 2.4 Text Search Algorithm

**Pseudo-code:**

```javascript
function searchPDF(pdfId, query, options) {
  const { caseSensitive, wholeWords } = options;
  const pdf = getCache(pdfId);
  
  // Prepare query
  let searchRegex;
  if (wholeWords) {
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    searchRegex = new RegExp(`\\b${escapedQuery}\\b`, 
                             caseSensitive ? 'g' : 'gi');
  } else {
    searchRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 
                            caseSensitive ? 'g' : 'gi');
  }
  
  const results = [];
  let totalMatches = 0;
  const pagesFound = new Set();
  
  // Search each page
  pdf.pages.forEach((page, index) => {
    const pageNum = index + 1;
    const matches = [];
    
    // Find all matches in page text
    let match;
    while ((match = searchRegex.exec(page.text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const contextStart = Math.max(0, start - 80);
      const contextEnd = Math.min(page.text.length, end + 80);
      
      matches.push({
        matchText: match[0],
        context: page.text.substring(contextStart, contextEnd),
        position: { start, end }
      });
    }
    
    if (matches.length > 0) {
      pagesFound.add(pageNum);
      results.push({
        pageNum,
        matchCount: matches.length,
        matches
      });
      totalMatches += matches.length;
    }
  });
  
  return {
    query,
    totalMatches,
    pagesFound: Array.from(pagesFound).sort((a, b) => a - b),
    results: results.sort((a, b) => a.pageNum - b.pageNum),
    searchTime: performance.now() - startTime
  };
}
```

### 2.5 Performance Considerations

| Factor | Solution |
|--------|----------|
| **Large PDFs (1000 pages)** | Cache in-memory for 1 hour, compress text |
| **Multiple searches same PDF** | Reuse pdfId, don't re-extract |
| **Concurrent searches** | Rate limit: 10 searches/min per user |
| **Memory cleanup** | TTL-based expiry, LRU cache eviction |
| **Search latency** | Index entire PDF once, search < 100ms |

---

## 3. FRONTEND IMPLEMENTATION

### 3.1 Component Structure (React)

```
App.js (existing, modified)
├── Header (existing)
├── ModeSelector (NEW)
│   ├── Tab: "Convert"
│   └── Tab: "Search"
├── MainContent (conditional based on mode)
│   ├── ConvertMode (existing functionality)
│   └── SearchMode (NEW)
│       ├── FileUpload
│       ├── SearchControls
│       ├── SearchResults
│       └── StateHandlers (loading, error, empty)
└── Footer (existing)
```

### 3.2 React Component Code Outline

**ModeSelector Component:**
```jsx
function ModeSelector({ mode, setMode }) {
  return (
    <div className="mode-tabs">
      <button 
        className={`mode-tab ${mode === 'convert' ? 'active' : ''}`}
        onClick={() => setMode('convert')}
      >
        <span>📄</span> Convert to Word
      </button>
      <button 
        className={`mode-tab ${mode === 'search' ? 'active' : ''}`}
        onClick={() => setMode('search')}
      >
        <span>🔍</span> Search PDF
      </button>
    </div>
  );
}
```

**SearchMode Component:**
```jsx
function SearchMode({ user, API }) {
  const [file, setFile] = useState(null);
  const [pdfId, setPdfId] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWords, setWholeWords] = useState(false);
  
  const handleFileUpload = async (file) => {
    setFile(file);
    setLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('pdf', file);
      
      const { data } = await axios.post(
        `${API}/api/pdf/extract`,
        formData,
        { withCredentials: true }
      );
      
      setPdfId(data.pdfId);
      setResults(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload PDF');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim() || !pdfId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data } = await axios.post(
        `${API}/api/pdf/search`,
        { pdfId, query, caseSensitive, wholeWords },
        { withCredentials: true }
      );
      
      setResults(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Search failed');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="search-wrap">
      {/* Upload or Search based on state */}
      {!pdfId ? (
        <FileUpload onFileSelect={handleFileUpload} />
      ) : (
        <>
          <SearchHeader file={file} onBack={() => setPdfId(null)} />
          <SearchBar 
            query={query}
            setQuery={setQuery}
            onSearch={handleSearch}
            loading={loading}
          />
          <SearchFilters 
            caseSensitive={caseSensitive}
            setCaseSensitive={setCaseSensitive}
            wholeWords={wholeWords}
            setWholeWords={setWholeWords}
          />
          {/* Results, Loading, or Error states */}
          {loading && <SearchLoading />}
          {error && <SearchError error={error} />}
          {results && results.totalMatches === 0 && <NoResults query={query} />}
          {results && results.totalMatches > 0 && <ResultsList results={results} />}
        </>
      )}
    </div>
  );
}
```

### 3.3 CSS Classes for Search Feature

Add to App.css:

```css
/* Search Mode Tabs */
.mode-tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 32px;
  justify-content: center;
  animation: slideUp 0.4s ease;
}

.mode-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: 2px solid var(--border);
  color: var(--muted);
  padding: 12px 24px;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.mode-tab:hover {
  border-color: var(--blue);
  color: var(--blue);
}

.mode-tab.active {
  background: var(--blue);
  border-color: var(--blue);
  color: white;
  box-shadow: 0 4px 16px rgba(67,97,238,0.3);
}

.mode-tab span {
  font-size: 18px;
}

/* Search Wrap */
.search-wrap {
  max-width: 720px;
  margin: 0 auto;
  animation: slideUp 0.4s ease;
}

/* Search Bar */
.search-bar-form {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.search-input-wrap {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 14px;
  font-size: 18px;
  color: var(--muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 48px;
  padding: 12px 16px 12px 44px;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  font-size: 15px;
  font-family: 'Inter', sans-serif;
  transition: all 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--blue);
  box-shadow: 0 0 0 3px rgba(67,97,238,0.1);
  background: var(--white);
}

.search-btn {
  height: 48px;
  padding: 0 28px;
  background: var(--blue);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-btn:hover {
  background: var(--blue-dark);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(67,97,238,0.3);
}

.search-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Search Filters */
.search-filters {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 28px;
  padding: 14px 16px;
  background: var(--blue-light);
  border-radius: 12px;
  flex-wrap: wrap;
}

.filter-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.filter-checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--blue);
}

/* Search Results */
.search-results-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
  padding: 14px;
  background: var(--green-light);
  border: 1px solid rgba(16,185,129,0.3);
  border-radius: 12px;
  color: var(--text);
  font-size: 15px;
  font-weight: 600;
}

.search-results-summary span {
  color: var(--green);
  font-weight: 700;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.result-card {
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 20px;
  box-shadow: var(--shadow);
  transition: all 0.3s ease;
}

.result-card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
  border-color: var(--blue);
}

.result-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.page-badge {
  background: var(--blue);
  color: white;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.match-count {
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
}

.result-text {
  background: var(--blue-light);
  border-left: 3px solid var(--blue);
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 14px;
  font-size: 14px;
  line-height: 1.6;
  direction: auto;
}

.result-text .match {
  background: var(--gold);
  color: #000;
  font-weight: 700;
  padding: 0 2px;
  border-radius: 2px;
}

.result-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.result-action-btn {
  background: none;
  border: 1px solid var(--border);
  color: var(--text);
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.result-action-btn:hover {
  border-color: var(--blue);
  color: var(--blue);
  background: var(--blue-light);
}

/* No Results State */
.no-results {
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 48px;
  text-align: center;
  box-shadow: var(--shadow);
  animation: slideUp 0.4s ease;
}

.no-results-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.no-results-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 8px;
}

.no-results-text {
  font-size: 14px;
  color: var(--muted);
  margin-bottom: 20px;
  line-height: 1.6;
}

.no-results-tips {
  text-align: left;
  display: inline-block;
}

.no-results-tips li {
  font-size: 13px;
  color: var(--text);
  margin-bottom: 6px;
  list-style: none;
  padding-left: 24px;
  position: relative;
}

.no-results-tips li:before {
  content: '•';
  position: absolute;
  left: 0;
  color: var(--blue);
  font-weight: bold;
}

/* Search Loading */
.search-loading {
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 48px;
  text-align: center;
  box-shadow: var(--shadow);
  animation: slideUp 0.4s ease;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid var(--border);
  border-top-color: var(--blue);
  border-radius: 50%;
  margin: 0 auto 16px;
  animation: spin 0.8s linear infinite;
}

.loading-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 8px;
}

.loading-query {
  font-size: 13px;
  color: var(--muted);
  font-style: italic;
}

/* Search Error */
.search-error {
  background: var(--red-light);
  border: 1px solid rgba(239,68,68,0.3);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  gap: 14px;
  align-items: flex-start;
  animation: slideUp 0.4s ease;
}

.search-error-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.search-error-content {
  flex: 1;
}

.search-error-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--red);
  margin-bottom: 4px;
}

.search-error-msg {
  font-size: 13px;
  color: var(--red);
  line-height: 1.6;
  margin-bottom: 12px;
}

.search-error-actions {
  display: flex;
  gap: 8px;
}

.error-retry-btn {
  background: var(--red);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.error-retry-btn:hover {
  background: #dc2626;
  transform: translateY(-1px);
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .search-wrap {
    padding: 0;
  }
  
  .search-bar-form {
    flex-direction: column;
  }
  
  .search-btn {
    width: 100%;
  }
  
  .search-filters {
    padding: 12px;
    gap: 12px;
  }
  
  .result-card {
    padding: 16px;
  }
  
  .no-results {
    padding: 32px 20px;
  }
  
  .mode-tabs {
    margin-bottom: 24px;
  }
  
  .mode-tab {
    flex: 1;
    justify-content: center;
  }
}
```

---

## 4. FEATURE LIST

### 4.1 MVP (Minimum Viable Product) - Phase 1

**Core Features:**
- [x] Mode selector: Convert vs Search
- [x] PDF upload (drag & drop, click upload)
- [x] Text extraction from PDF (page-by-page)
- [x] Case-insensitive text search
- [x] Display results with page numbers
- [x] Show match count per page
- [x] Context snippet for each match (80 chars before/after)
- [x] Clean, professional UI matching existing app
- [x] Loading states with progress indication
- [x] Error handling and user-friendly messages
- [x] Mobile responsive design

**Performance:**
- Search completes in < 500ms for 1000-page PDFs
- Cache PDF for reuse (1-hour TTL)
- Memory efficient (no full PDF storage after search)

### 4.2 Phase 2 - Enhanced Features (3-6 months)

**Matching Options:**
- [ ] Whole-word search toggle
- [ ] Case-sensitive option
- [ ] Regex pattern search (advanced)
- [ ] Synonym search (for Urdu variants)

**Results Enhancement:**
- [ ] Highlight matches in actual PDF viewer
- [ ] Jump to page with embedded viewer
- [ ] Download results as CSV/JSON
- [ ] Save/bookmark frequently searched phrases
- [ ] Search history (last 20 searches)

**UI/UX Improvements:**
- [ ] PDF preview in sidebar
- [ ] Real-time search suggestions
- [ ] Keyboard shortcuts (Ctrl+F to open search)
- [ ] Dark mode support
- [ ] Animation for result scroll

**Performance & Scale:**
- [ ] Compressed PDF storage (LZ4 compression)
- [ ] Multi-language OCR support
- [ ] Parallel batch search for multiple PDFs
- [ ] Search analytics (popular terms)

### 4.3 Phase 3 - Premium Features (Future)

**Advanced Search:**
- [ ] Natural language search
- [ ] Fuzzy/typo-tolerant search
- [ ] Search across multiple PDFs
- [ ] Advanced filters (date, size, category)

**Collaboration:**
- [ ] Share search results
- [ ] Collaborative annotations
- [ ] Search result comments

**Integration:**
- [ ] Slack/Teams notifications
- [ ] Google Drive sync
- [ ] Cloud storage unlimited PDFs
- [ ] API for third-party integrations

---

## 5. IMPLEMENTATION ROADMAP

### Phase 1: MVP (2-3 weeks)

**Week 1: Backend Setup**
- [ ] Add pdf-parse dependency
- [ ] Create /api/pdf/extract endpoint
- [ ] Create /api/pdf/search endpoint
- [ ] Implement text extraction logic
- [ ] Test with sample Urdu PDFs

**Week 2: Frontend Components**
- [ ] Create ModeSelector component
- [ ] Create SearchMode component with upload
- [ ] Implement SearchBar with controls
- [ ] Create SearchResults display
- [ ] Implement loading/error states

**Week 3: Integration & Polish**
- [ ] Connect frontend to backend APIs
- [ ] Test end-to-end search flow
- [ ] Mobile responsive testing
- [ ] Performance optimization
- [ ] Accessibility audit (WCAG 2.1 AA)

### Phase 2: Start Month 3

### Phase 3: When Phase 2 stable

---

## 6. TECHNICAL DEPENDENCIES

### Backend
```json
{
  "pdf-parse": "^1.1.1",
  "pdfjs-dist": "^3.11.174" (already present),
  "axios": "^1.4.0" (already present)
}
```

### Frontend
```json
{
  "axios": "^1.4.0" (already present),
  "react": "^18.0.0" (already present)
}
```

### Optional (Future Phases)
```json
{
  "lunr": "^2.3.9",           // client-side search indexing
  "comfy.js": "^1.2.0",       // PDF viewer with highlights
  "tesseract.js": "^4.1.1"    // OCR (if implementing)
}
```

---

## 7. API CONTRACT SPECIFICATION

See Section 2.2 for detailed endpoint specifications with full request/response examples.

---

## 8. TESTING CHECKLIST

### Unit Tests
- [ ] Text extraction preserves page numbers
- [ ] Search regex works for Urdu characters
- [ ] Case-sensitive toggle works correctly
- [ ] Whole-word matching excludes partial matches
- [ ] Results sort correctly by page number

### Integration Tests
- [ ] Upload → Extract → Search flow works
- [ ] Multiple searches reuse same pdfId
- [ ] Cache expiry removes old PDFs
- [ ] Auth required on all endpoints
- [ ] Error handling returns proper messages

### E2E Tests
- [ ] User can upload and search PDF
- [ ] Results display with correct page numbers
- [ ] Filters apply correctly
- [ ] Mobile UI responsive
- [ ] Search completes in reasonable time

### Performance Tests
- [ ] Extract time for 1000-page PDF < 5s
- [ ] Search time for any query < 500ms
- [ ] Memory usage stable over 10 searches

### Accessibility Tests
- [ ] Search input focused on mode change
- [ ] Results keyboard navigable
- [ ] Error messages announced to screen readers
- [ ] Color contrast WCAG AA
- [ ] RTL text renders correctly

---

## 9. DEPLOYMENT CONSIDERATIONS

**Backend (Railway):**
- Add new endpoints to existing server.js
- Update environment variables if needed
- Set PDF cache TTL (default: 1 hour)
- Monitor memory usage during scaling

**Frontend (Netlify/Vercel):**
- Deploy updated App.js and App.css
- Update build if any dependencies added
- Test OAuth flow in production
- Verify API URL points to production backend

**Security:**
- Validate file uploads (PDF only)
- Limit file size (500MB max, same as convert)
- Rate limit search endpoint (10 req/min)
- Sanitize search queries to prevent injection
- Use HTTPS for all API calls

---

## 10. SUCCESS METRICS

| Metric | Target |
|--------|--------|
| Search latency (p95) | < 300ms |
| PDF extraction accuracy | 98%+ |
| Uptime | 99.9% |
| User satisfaction (CSAT) | > 4.5/5 |
| Search per user (monthly) | > 10 |
| Feature adoption | > 40% of daily users |

---

## Appendix A: Color Reference

Use these CSS variables throughout the search feature:

```css
/* Primary Search Colors */
--blue: #4361ee;              /* Primary action, buttons, badges */
--blue-dark: #3451d1;         /* Hover states */
--blue-light: #eef1ff;        /* Backgrounds, light fills */

/* Success/Found */
--green: #10b981;             /* Results found notification */
--green-light: #ecfdf5;       /* Success backgrounds */

/* Highlight/Accent */
--gold: #f59e0b;              /* Match highlights in results */

/* Error/Warning */
--red: #ef4444;               /* Errors */
--red-light: #fef2f2;         /* Error backgrounds */

/* Text/Neutral */
--text: #1e293b;              /* Primary text */
--muted: #64748b;             /* Secondary text */
--light: #94a3b8;             /* Tertiary text */
--border: #e2e8f8;            /* Borders, dividers */
--white: #ffffff;             /* Cards, backgrounds */
```

---

## Appendix B: Keyboard Shortcuts (Phase 2)

- `Ctrl+F` / `Cmd+F` - Open search modal
- `Enter` - Execute search
- `Escape` - Close search or clear results
- `↑/↓` - Navigate results
- `Ctrl+C` - Copy selected result
- `Ctrl+K` - Open command palette (future)

---

## Appendix C: Error Messages (Bilingual)

| Error | Urdu | English |
|-------|------|---------|
| File too large | فائل بہت بڑی ہے (500MB سے زیادہ) | File is too large (max 500MB) |
| Invalid PDF | غلط PDF فارمیٹ | Invalid PDF format |
| Search failed | تلاش ناکام ہوئی، دوبارہ کوشش کریں | Search failed. Please try again |
| No results | کوئی نتیجہ نہیں ملا | No results found |
| Upload timeout | اپ لوڈ میں وقت سے زیادہ لگا | Upload took too long |
| Network error | نیٹ ورک میں مسئلہ | Network error |

---

## Conclusion

This design provides a professional, scalable PDF search feature that integrates seamlessly with the existing Urdu PDF Converter. The phased approach allows rapid MVP delivery (2-3 weeks) with room for enhancement based on user feedback.

**Next Steps:**
1. Approve design and architecture
2. Create backend API endpoints
3. Implement frontend components
4. Conduct user testing
5. Deploy to production

---

**Document Version:** 1.0  
**Last Updated:** June 2024  
**Status:** Ready for Implementation
