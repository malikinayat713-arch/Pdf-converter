# PDF Search Feature - Technical Reference & Code Examples

**Developer Quick Reference**

---

## Installation & Setup

### Step 1: Backend Dependencies

```bash
cd backend
npm install pdf-parse
npm list | grep pdf  # verify installation
```

**In package.json, you should have:**
```json
{
  "dependencies": {
    "pdf-parse": "^1.1.1",
    "pdfjs-dist": "^3.11.174",
    "express": "^4.18.2",
    "multer": "^1.4.5",
    "uuid": "^9.0.0"
  }
}
```

### Step 2: Verify Existing Structure

```bash
# Check these files exist
ls -la backend/server.js
ls -la frontend/src/App.js
ls -la frontend/src/App.css
```

---

## Backend Code Reference

### Cache Structure

```javascript
// In-memory cache for extracted PDFs
const pdfCache = new Map();

pdfCache.get(pdfId) returns:
{
  userId: "google-user-id",           // for multi-user support
  fileName: "document.pdf",
  pageCount: 45,
  pages: [
    {
      pageNum: 1,
      text: "Full page text here...",
      lines: ["line 1", "line 2", ...]
    },
    ...
  ],
  createdAt: 1718457000000,          // timestamp
  expiresAt: 1718460600000,          // 1 hour later
  accessedAt: 1718457000000          // for LRU eviction
}
```

### PDF Extraction Logic

```javascript
// Key algorithm - extract text preserving page structure
async function extractPDFText(filePath) {
  const pdfData = new Uint8Array(fs.readFileSync(filePath));
  
  const pdfDoc = await pdfjsLib.getDocument({
    data: pdfData,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true
  }).promise;

  const totalPages = Math.min(pdfDoc.numPages, 1000);
  const pages = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    
    // Join all text items from the page
    const pageText = textContent.items
      .map(item => item.str)
      .join(' ')
      .trim();

    pages.push({
      pageNum: i,
      text: pageText,
      lines: pageText.split('\n').map(l => l.trim()).filter(l => l)
    });
  }

  return pages;
}
```

### Search Algorithm

```javascript
// Core search logic - case-insensitive regex search
function performSearch(pdfData, query, caseSensitive, wholeWords) {
  // 1. Prepare regex pattern
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const flags = caseSensitive ? 'g' : 'gi';
  
  let searchRegex;
  if (wholeWords) {
    // Word boundary search (Urdu-aware)
    searchRegex = new RegExp(`(?<!\\w)${escapedQuery}(?!\\w)`, flags);
  } else {
    searchRegex = new RegExp(escapedQuery, flags);
  }

  // 2. Search through all pages
  const results = [];
  let totalMatches = 0;
  const pagesFound = new Set();

  pdfData.pages.forEach(page => {
    const pageText = page.text;
    const matches = [];
    
    let match;
    searchRegex.lastIndex = 0;  // Reset regex for reuse

    while ((match = searchRegex.exec(pageText)) !== null) {
      // Extract context (80 chars before and after)
      const contextStart = Math.max(0, match.index - 80);
      const contextEnd = Math.min(
        pageText.length,
        match.index + match[0].length + 80
      );
      const context = pageText.substring(contextStart, contextEnd);

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

  return {
    query,
    totalMatches,
    pagesFound: Array.from(pagesFound).sort((a, b) => a - b),
    results: results
  };
}
```

### Cache Management

```javascript
// Clean up expired PDFs every 10 minutes
function cleanupExpiredPDFs() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [pdfId, data] of pdfCache.entries()) {
    if (now > data.expiresAt) {
      pdfCache.delete(pdfId);
      cleaned++;
    }
  }
  
  console.log(`[Cache] Cleaned ${cleaned} expired PDFs`);
}

// Run cleanup periodically
setInterval(cleanupExpiredPDFs, 10 * 60 * 1000);

// Or implement LRU (Least Recently Used) eviction:
function evictLRU() {
  const maxSize = 100;  // max PDFs in cache
  
  if (pdfCache.size >= maxSize) {
    let oldest = null;
    let oldestTime = Infinity;
    
    for (const [pdfId, data] of pdfCache.entries()) {
      if (data.accessedAt < oldestTime) {
        oldest = pdfId;
        oldestTime = data.accessedAt;
      }
    }
    
    if (oldest) {
      pdfCache.delete(oldest);
      console.log(`[Cache] Evicted LRU PDF: ${oldest}`);
    }
  }
}
```

---

## Frontend Code Reference

### SearchMode Component State Management

```javascript
// Key state variables for search feature
const [searchFile, setSearchFile] = useState(null);    // File object
const [pdfId, setPdfId] = useState(null);              // Cached PDF ID
const [query, setQuery] = useState('');                // Search term
const [searchResults, setSearchResults] = useState(null); // API response
const [searchLoading, setSearchLoading] = useState(false); // Loading state
const [searchError, setSearchError] = useState(null);   // Error message
const [caseSensitive, setCaseSensitive] = useState(false); // Filter
const [wholeWords, setWholeWords] = useState(false);   // Filter

// State flow:
// 1. User uploads PDF
// 2. Call /api/pdf/extract → get pdfId
// 3. setPdfId(data.pdfId) - enable search UI
// 4. User types query and clicks search
// 5. Call /api/pdf/search → get results
// 6. setSearchResults(data) - display results
```

### Upload & Extract Function

```javascript
const uploadPDF = async () => {
  if (!searchFile) return;
  
  setSearchLoading(true);
  setSearchError(null);
  const fd = new FormData();
  fd.append('pdf', searchFile);

  try {
    const headers = { withCredentials: true };
    const tokens = localStorage.getItem('tokens');
    
    // IMPORTANT: Pass tokens in header for cross-origin auth
    if (tokens) headers['X-Tokens'] = tokens;
    
    const { data } = await axios.post(
      `${API}/api/pdf/extract`,
      fd,
      { withCredentials: true, headers }
    );
    
    // Success: Store pdfId and enable search UI
    setPdfId(data.pdfId);
    setSearchResults(null);
    setQuery('');
    
  } catch (e) {
    // Error: Show user-friendly message
    setSearchError(
      e.response?.data?.error || 'Failed to upload PDF'
    );
    setPdfId(null);
    
  } finally {
    setSearchLoading(false);
  }
};
```

### Search Execution Function

```javascript
const performSearch = async (e) => {
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
      {
        pdfId: pdfId,
        query: query.trim(),
        caseSensitive: caseSensitive,
        wholeWords: wholeWords
      },
      { withCredentials: true, headers }
    );
    
    // Success: Display results
    setSearchResults(data);
    
    // Scroll results into view
    setTimeout(() => {
      document.querySelector('.results-list')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 100);
    
  } catch (e) {
    setSearchError(
      e.response?.data?.error || 'Search failed. Try again.'
    );
    setSearchResults(null);
    
  } finally {
    setSearchLoading(false);
  }
};
```

### Copy Result Functionality

```javascript
const copyResultToClipboard = async (result) => {
  try {
    // Format result text for copying
    const text = result.matches
      .map(m => m.context)
      .join('\n---\n');
    
    // Copy to clipboard
    await navigator.clipboard.writeText(text);
    
    // Show feedback
    alert('نتیجہ کاپی ہو گیا! / Result copied!');
    
    // Alternative: Show toast notification
    // toast.success('Copied to clipboard', { duration: 2000 });
    
  } catch (err) {
    alert('Copy failed. Try again.');
  }
};
```

### Result Card Rendering

```javascript
// Render individual result card
{searchResults.results.map(result => (
  <div key={`page-${result.pageNum}`} className="result-card">
    {/* Header: Page number and match count */}
    <div className="result-header">
      <span className="page-badge">
        📄 Page {result.pageNum}
      </span>
      <span className="match-count">
        {result.matchCount} match{result.matchCount !== 1 ? 'es' : ''}
      </span>
    </div>

    {/* Match snippets */}
    {result.matches.map((match, idx) => (
      <div key={idx} className="result-text">
        <span dir="auto">
          {/* Text before match */}
          {match.context.substring(
            0,
            match.context.indexOf(match.matchText)
          )}
          
          {/* Highlighted match */}
          <span className="match">{match.matchText}</span>
          
          {/* Text after match */}
          {match.context.substring(
            match.context.indexOf(match.matchText) + match.matchText.length
          )}
        </span>
      </div>
    ))}

    {/* Action buttons */}
    <div className="result-actions">
      <button
        className="result-action-btn"
        onClick={() => copyResultToClipboard(result)}
      >
        📋 Copy
      </button>
      <button
        className="result-action-btn"
        onClick={() => alert(`View page ${result.pageNum} (coming soon)`)}
      >
        👁️ View Page
      </button>
    </div>
  </div>
))}
```

---

## CSS Classes Reference

### Search Feature Specific Classes

```css
.mode-tabs {}              /* Container for mode buttons */
.mode-tab {}               /* Individual mode button */
.mode-tab.active {}        /* Active mode button */

.search-wrap {}            /* Main search container */
.search-bar-form {}        /* Form wrapper (flex row) */
.search-input-wrap {}      /* Input with icon wrapper */
.search-icon {}            /* Search icon (positioned absolute) */
.search-input {}           /* Text input field (48px height) */
.search-btn {}             /* Search button (blue, 48px) */

.search-filters {}         /* Filter options container */
.filter-checkbox {}        /* Individual checkbox */

.search-results-summary {} /* "X results found" banner */
.results-list {}           /* Container for result cards */
.result-card {}            /* Individual result card */
.result-header {}          /* Page number + match count */
.page-badge {}             /* Blue page number badge */
.match-count {}            /* "3 matches" text */
.result-text {}            /* Text snippet with highlight */
.result-text .match {}     /* Highlighted search term */
.result-actions {}         /* Copy/View buttons */
.result-action-btn {}      /* Individual action button */

.search-loading {}         /* Loading state container */
.loading-spinner {}        /* Spinning animation */
.loading-text {}           /* "Searching..." text */
.loading-query {}          /* Query being searched */

.no-results {}             /* No results state */
.no-results-icon {}        /* Empty state icon */
.no-results-title {}       /* "No results" title */
.no-results-text {}        /* Explanation text */
.no-results-tips {}        /* Tips list */

.search-error {}           /* Error state container */
.search-error-icon {}      /* Error icon */
.search-error-content {}   /* Error message content */
.search-error-title {}     /* Error title */
.search-error-msg {}       /* Error message text */
.search-error-actions {}   /* Retry button container */
.error-retry-btn {}        /* Retry button */
```

---

## Common Patterns & Best Practices

### Authentication Handling

```javascript
// Always check for tokens in two places:
// 1. Session (server-side maintained)
// 2. localStorage (client-side backup)

const getAuthHeaders = () => {
  const headers = { withCredentials: true };
  const tokens = localStorage.getItem('tokens');
  
  if (tokens) {
    headers['X-Tokens'] = tokens;
  }
  
  return headers;
};

// Use in all API calls:
const { data } = await axios.post(
  `${API}/api/pdf/extract`,
  formData,
  { withCredentials: true, headers: getAuthHeaders() }
);
```

### Error Handling Pattern

```javascript
try {
  setLoading(true);
  setError(null);
  
  // API call
  const { data } = await axios.post(...);
  
  // Success handling
  setResults(data);
  
} catch (err) {
  // Extract error message with fallbacks
  const message = 
    err.response?.data?.error ||  // Server error message
    err.message ||                 // Network error
    'An error occurred';           // Fallback
    
  setError(message);
  
} finally {
  setLoading(false);
}
```

### State Reset Pattern

```javascript
const resetSearch = () => {
  setSearchFile(null);
  setPdfId(null);
  setQuery('');
  setSearchResults(null);
  setSearchError(null);
  setSearchLoading(false);
};

// Used when:
// - User uploads new file
// - User changes search mode
// - User clicks back button
```

---

## Performance Optimization Tips

### Backend

1. **Batch Processing**: Extract pages in parallel (6 concurrent)
   ```javascript
   const CONCURRENT = 6;
   for (let i = 0; i < pages; i += CONCURRENT) {
     await Promise.all(pageBatch);
   }
   ```

2. **Memory Management**: Limit cache size with TTL
   ```javascript
   const PDF_CACHE_TTL = 60 * 60 * 1000;  // 1 hour
   setInterval(cleanupExpiredPDFs, 10 * 60 * 1000);
   ```

3. **Query Optimization**: Escape special chars before regex
   ```javascript
   const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
   ```

### Frontend

1. **Code Splitting**: Load SearchMode only when needed
   ```javascript
   const SearchMode = React.lazy(() => 
     Promise.resolve(SearchModeComponent)
   );
   ```

2. **Memoization**: Prevent unnecessary re-renders
   ```javascript
   const handleDrop = useCallback((e) => {
     // handler
   }, []);
   ```

3. **Debouncing**: Optional for real-time search
   ```javascript
   const [query, setQuery] = useState('');
   const debouncedQuery = useDebounce(query, 300);
   ```

---

## Testing Code Examples

### Test Extract Endpoint

```bash
# Using curl
curl -X POST http://localhost:5000/api/pdf/extract \
  -F "pdf=@test.pdf" \
  -H "X-Tokens: {\"access_token\": \"test\"}" \
  -b "session_id=test"

# Expected response
{
  "pdfId": "550e8400-e29b-41d4-a716-446655440000",
  "fileName": "test.pdf",
  "pageCount": 10,
  "message": "PDF extracted. 10 pages ready to search."
}
```

### Test Search Endpoint

```bash
curl -X POST http://localhost:5000/api/pdf/search \
  -H "Content-Type: application/json" \
  -H "X-Tokens: {\"access_token\": \"test\"}" \
  -d '{
    "pdfId": "550e8400-e29b-41d4-a716-446655440000",
    "query": "متن",
    "caseSensitive": false,
    "wholeWords": false
  }'

# Expected response
{
  "query": "متن",
  "totalMatches": 12,
  "pagesFound": [5, 12, 23],
  "results": [
    {
      "pageNum": 5,
      "matchCount": 3,
      "matches": [...]
    }
  ],
  "searchTime": 145
}
```

### Jest Test Example

```javascript
describe('Search Algorithm', () => {
  it('should find case-insensitive matches', () => {
    const pdfData = {
      pages: [
        { pageNum: 1, text: 'Hello world hello' }
      ]
    };
    
    const result = performSearch(
      pdfData,
      'HELLO',
      false,  // case insensitive
      false
    );
    
    expect(result.totalMatches).toBe(2);
    expect(result.results[0].matchCount).toBe(2);
  });

  it('should respect whole word matching', () => {
    const pdfData = {
      pages: [
        { pageNum: 1, text: 'apple application app' }
      ]
    };
    
    const result = performSearch(
      pdfData,
      'app',
      false,
      true  // whole words only
    );
    
    expect(result.totalMatches).toBe(1);  // Only 'app', not 'apple' or 'application'
  });
});
```

---

## Troubleshooting Guide

### Issue: PDF extraction hangs

**Solution:**
```javascript
// Add timeout
const extractWithTimeout = (filePath, timeout = 30000) => {
  return Promise.race([
    extractPDFText(filePath),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Extraction timeout')), timeout)
    )
  ]);
};
```

### Issue: Cache grows unbounded

**Solution:** Already implemented with TTL
```javascript
// Verify cleanup runs
console.log(`[Cache] Size: ${pdfCache.size}`);
```

### Issue: Auth fails silently

**Solution:** Check token format
```javascript
// In browser console
console.log(JSON.parse(localStorage.getItem('tokens')));
// Should have: { access_token, refresh_token, expires_in, ... }
```

### Issue: RTL text backwards

**Solution:** Use `dir="auto"` 
```jsx
<input dir="auto" />
<div dir="auto">{urduText}</div>
```

---

## Database Schema (Optional Future)

```sql
-- Table to store search history (Phase 2+)
CREATE TABLE search_history (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255),
  pdf_id UUID,
  query TEXT,
  results_count INT,
  search_time INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_user_id ON search_history(user_id);
CREATE INDEX idx_created_at ON search_history(created_at);
```

---

## Environment Variables

**Backend .env:**
```
# Existing
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:5000/auth/google/callback
SESSION_SECRET=...
FRONTEND_URL=http://localhost:3000
PORT=5000

# New (optional)
PDF_CACHE_TTL=3600000  # 1 hour in milliseconds
PDF_EXTRACTION_TIMEOUT=30000  # 30 seconds
PDF_MAX_PAGES=1000
PDF_MAX_SIZE=524288000  # 500MB in bytes
```

**Frontend .env:**
```
REACT_APP_API_URL=http://localhost:5000
REACT_APP_SEARCH_ENABLED=true
```

---

## Useful Links & Resources

- [pdfjs-dist Documentation](https://mozilla.github.io/pdf.js/)
- [pdf-parse npm](https://www.npmjs.com/package/pdf-parse)
- [React Testing Library](https://testing-library.com/react)
- [Axios Documentation](https://axios-http.com/)
- [WCAG 2.1 Accessibility](https://www.w3.org/WAI/WCAG21/quickref/)
- [Urdu Unicode](https://en.wikipedia.org/wiki/Urdu_(Unicode_block))

---

**End of Technical Reference**

Keep this document handy while developing!
