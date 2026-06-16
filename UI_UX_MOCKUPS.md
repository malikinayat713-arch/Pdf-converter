# PDF Search Feature - UI/UX Mockups & Design Specifications

**Visual Design Reference Guide**

---

## TABLE OF CONTENTS

1. [Desktop Layout - Full Mockup](#desktop-layout---full-mockup)
2. [Mobile Layout - Full Mockup](#mobile-layout---full-mockup)
3. [Component Specifications](#component-specifications)
4. [Color & Typography Guide](#color--typography-guide)
5. [Animation Keyframes](#animation-keyframes)
6. [Responsive Breakpoints](#responsive-breakpoints)
7. [State Variations](#state-variations)
8. [Accessibility Features](#accessibility-features)

---

## DESKTOP LAYOUT - FULL MOCKUP

### Screen 1: Mode Selection (After Login)

```
┌──────────────────────────────────────────────────────────────────────┐
│ 📄 اردو PDF کنورٹر      [User Avatar] Username      [↩ Logout]     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                                                                      │
│                    ┌──────────────────────────────┐                 │
│                    │  [📄 Convert to Word]        │                 │
│                    │  [🔍 Search PDF]             │                 │
│                    └──────────────────────────────┘                 │
│                                                                      │
│                    SELECT YOUR MODE ABOVE ▲                         │
│                                                                      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

CSS Classes:
- .mode-tabs (container)
- .mode-tab (buttons)
- .mode-tab.active (selected)

Colors:
- Active: --blue (#4361ee) with white text
- Inactive: transparent with --muted text
- Hover: --border background
```

### Screen 2: Search Mode - Upload Phase

```
┌──────────────────────────────────────────────────────────────────────┐
│ 📄 اردو PDF کنورٹر      [User Avatar] Username      [↩ Logout]     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│              [📄 Convert to Word]  [🔍 Search PDF]                  │
│                     ↑ active tab                                     │
│                                                                      │
│                        PDF تلاش کریں                                  │
│              اپنی PDF upload کریں اور اردو متن تلاش کریں              │
│                                                                      │
│              ┌─────────────────────────────────────┐                │
│              │                                     │                │
│              │    ✦ ✦ ✦                           │                │
│              │     ✦ ✦ ✦   📂                     │                │
│              │    ✦ ✦ ✦                           │                │
│              │                                     │                │
│              │  یہاں PDF drop کریں               │                │
│              │  یا کلک کریں تاکہ منتخب کریں        │                │
│              │                                     │                │
│              │  [PDF]  [JPG]  [MAX 500MB]        │                │
│              │                                     │                │
│              └─────────────────────────────────────┘                │
│                                                                      │
│              ┌─────────────────────────────────────┐                │
│              │  ⚡ یہ کیسے کام کرتا ہے؟           │                │
│              │  ┌──────┐  ┌──────┐                │                │
│              │  │  1   │  │  2   │                │                │
│              │  │ 📄   │  │ 🔍   │                │                │
│              │  │      │  │      │                │                │
│              │  └──────┘  └──────┘                │                │
│              │  ┌──────┐  ┌──────┐                │                │
│              │  │  3   │  │  4   │                │                │
│              │  │ 📖   │  │ ✨   │                │                │
│              │  │      │  │      │                │                │
│              │  └──────┘  └──────┘                │                │
│              └─────────────────────────────────────┘                │
│                                                                      │
│ اردو PDF کنورٹر • Google Drive OCR • Made with ❤️                   │
└──────────────────────────────────────────────────────────────────────┘

CSS Classes:
- .search-wrap
- .conv-hero
- .drop (dropzone)
- .drop.drag (when dragging over)
- .drop-anim, .drop-circle
- .how-card, .how-steps
```

### Screen 3: Search Mode - Upload Complete + Search Bars

```
┌──────────────────────────────────────────────────────────────────────┐
│ 📄 اردو PDF کنورٹر      [User Avatar] Username      [↩ Logout]     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│              [📄 Convert to Word]  [🔍 Search PDF]                  │
│                                                                      │
│                    ↩️  document.pdf                                   │
│                      اردو متن تلاش کریں                              │
│                                                                      │
│              ┌──────────────────────┬──────────────┐                │
│              │ 🔍 [Input Field]     │ [Search Btn] │                │
│              │    اردو متن...       │              │                │
│              └──────────────────────┴──────────────┘                │
│                                                                      │
│         ☐ Case Sensitive    ☐ Whole Words Only                      │
│                                                                      │
│                    [Search results area or empty]                   │
│                                                                      │
│ اردو PDF کنورٹر • Google Drive OCR • Made with ❤️                   │
└──────────────────────────────────────────────────────────────────────┘

CSS Classes:
- .search-bar-form (flex, gap 12px)
- .search-input-wrap (flex with icon)
- .search-input (48px height)
- .search-btn (blue, flex)
- .search-filters (blue-light background)
- .filter-checkbox (flex, gap 8px)
```

### Screen 4: Search Results - With Matches

```
┌──────────────────────────────────────────────────────────────────────┐
│ 📄 اردو PDF کنورٹر      [User Avatar] Username      [↩ Logout]     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│              [📄 Convert to Word]  [🔍 Search PDF]                  │
│                                                                      │
│                    ↩️  document.pdf                                   │
│                      اردو متن تلاش کریں                              │
│                                                                      │
│              ┌──────────────────────┬──────────────┐                │
│              │ 🔍 [متن]             │ [Search Btn] │                │
│              └──────────────────────┴──────────────┘                │
│                                                                      │
│  ✓ 12 نتائج 3 صفحات میں (145ms)                                    │
│                                                                      │
│  ┌────────────────────────────────────────────────┐                │
│  │ 📄 Page 5              3 matches on this page  │                │
│  │ ────────────────────────────────────────────── │                │
│  │                                                │                │
│  │ "...پہلے متن کے بعد معلومات کے ساتھ..."        │                │
│  │                                                │                │
│  │ [📋 Copy] [👁️ View Page]                      │                │
│  └────────────────────────────────────────────────┘                │
│                                                                      │
│  ┌────────────────────────────────────────────────┐                │
│  │ 📄 Page 12             2 matches on this page  │                │
│  │ ────────────────────────────────────────────── │                │
│  │                                                │                │
│  │ "...متن کے ساتھ نیا پیراگراف شامل ہے..."       │                │
│  │                                                │                │
│  │ [📋 Copy] [👁️ View Page]                      │                │
│  └────────────────────────────────────────────────┘                │
│                                                                      │
│  ┌────────────────────────────────────────────────┐                │
│  │ 📄 Page 23             7 matches on this page  │                │
│  │ ────────────────────────────────────────────── │                │
│  │                                                │                │
│  │ "...متن سے متعلق تفصیلات..."                  │                │
│  │                                                │                │
│  │ [📋 Copy] [👁️ View Page]                      │                │
│  └────────────────────────────────────────────────┘                │
│                                                                      │
│ اردو PDF کنورٹر • Google Drive OCR • Made with ❤️                   │
└──────────────────────────────────────────────────────────────────────┘

CSS Classes:
- .search-results-summary (green-light background)
- .results-list (flex column, gap 14px)
- .result-card (white, bordered, shadowed)
- .result-header (flex, gap 12px)
- .page-badge (blue background, white text)
- .match-count (muted text, secondary)
- .result-text (blue-light bg, left border, dir=auto)
- .result-text .match (gold bg, bold text)
- .result-actions (flex, gap 8px)
- .result-action-btn (subtle border, hover effects)
```

### Screen 5: Search Results - No Results

```
┌──────────────────────────────────────────────────────────────────────┐
│ 📄 اردو PDF کنورٹر      [User Avatar] Username      [↩ Logout]     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│              [📄 Convert to Word]  [🔍 Search PDF]                  │
│                                                                      │
│                    ↩️  document.pdf                                   │
│                      اردو متن تلاش کریں                              │
│                                                                      │
│              ┌──────────────────────┬──────────────┐                │
│              │ 🔍 [متن]             │ [Search Btn] │                │
│              └──────────────────────┴──────────────┘                │
│                                                                      │
│              ┌──────────────────────────────────┐                  │
│              │                                  │                  │
│              │              ❌                   │                  │
│              │                                  │                  │
│              │         کوئی نتیجہ نہیں          │                  │
│              │     'متن' کے لیے کوئی نتیجہ  │                  │
│              │             نہیں ملا              │                  │
│              │                                  │                  │
│              │         کوشش کریں:               │                  │
│              │         • اپنی ہجی کی جانچ      │                  │
│              │         • سادہ الفاظ استعمال    │                  │
│              │         • خصوصی حروف نہ استعمال │                  │
│              │                                  │                  │
│              └──────────────────────────────────┘                  │
│                                                                      │
│ اردو PDF کنورٹر • Google Drive OCR • Made with ❤️                   │
└──────────────────────────────────────────────────────────────────────┘

CSS Classes:
- .no-results
- .no-results-icon (48px)
- .no-results-title
- .no-results-text
- .no-results-tips (ul, li with bullet styling)
```

### Screen 6: Search Loading State

```
┌──────────────────────────────────────────────────────────────────────┐
│ 📄 اردو PDF کنورٹر      [User Avatar] Username      [↩ Logout]     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│              [📄 Convert to Word]  [🔍 Search PDF]                  │
│                                                                      │
│                    ↩️  document.pdf                                   │
│                      اردو متن تلاش کریں                              │
│                                                                      │
│              ┌──────────────────────┬──────────────┐                │
│              │ 🔍 [متن]             │ [Search Btn] │                │
│              └──────────────────────┴──────────────┘                │
│                                                                      │
│              ┌──────────────────────────────────┐                  │
│              │                                  │                  │
│              │          ⟲ (spinning)            │                  │
│              │                                  │                  │
│              │       تلاش ہو رہی ہے...         │                  │
│              │            'متن'                 │                  │
│              │                                  │                  │
│              │         براہ کرم انتظار کریں...   │                  │
│              │                                  │                  │
│              └──────────────────────────────────┘                  │
│                                                                      │
│ اردو PDF کنورٹر • Google Drive OCR • Made with ❤️                   │
└──────────────────────────────────────────────────────────────────────┘

CSS Classes:
- .search-loading
- .loading-spinner (animated rotation)
- .loading-text
- .loading-query (italics, muted)

Animations:
- .loading-spinner: @keyframes spin (360deg rotation, 0.8s, infinite)
```

### Screen 7: Search Error State

```
┌──────────────────────────────────────────────────────────────────────┐
│ 📄 اردو PDF کنورٹر      [User Avatar] Username      [↩ Logout]     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│              [📄 Convert to Word]  [🔍 Search PDF]                  │
│                                                                      │
│                    ↩️  document.pdf                                   │
│                      اردو متن تلاش کریں                              │
│                                                                      │
│              ┌──────────────────────┬──────────────┐                │
│              │ 🔍 [متن]             │ [Search Btn] │                │
│              └──────────────────────┴──────────────┘                │
│                                                                      │
│              ┌─────────────────────────────────┐                   │
│              │ ⚠️  تلاش ناکام                    │                   │
│              │                                 │                   │
│              │ PDF پروسیس نہیں ہو سکی۔        │                   │
│              │ براہ کرم دوبارہ اپ لوڈ کریں۔    │                   │
│              │                                 │                   │
│              │ [دوبارہ کوشش کریں] [نیا...]   │                   │
│              └─────────────────────────────────┘                   │
│                                                                      │
│ اردو PDF کنورٹر • Google Drive OCR • Made with ❤️                   │
└──────────────────────────────────────────────────────────────────────┘

CSS Classes:
- .search-error (red-light background)
- .search-error-icon
- .search-error-content
- .search-error-title (bold, red)
- .search-error-msg (red text)
- .search-error-actions (flex buttons)
- .error-retry-btn (red background)
```

---

## MOBILE LAYOUT - FULL MOCKUP

### Mobile: Search Mode Upload (375px width)

```
┌─────────────────────────────────────┐
│ 📄 اردو PDF    [Avatar] [↩]        │
├─────────────────────────────────────┤
│                                     │
│  [📄 Convert] [🔍 Search]          │
│   (buttons stack or horizontal)     │
│                                     │
│     PDF تلاش کریں                    │
│   اپنی PDF upload کریں...            │
│                                     │
│  ┌────────────────────────────────┐ │
│  │                                │ │
│  │      ✦ ✦ ✦                    │ │
│  │       ✦ ✦ ✦   📂              │ │
│  │      ✦ ✦ ✦                    │ │
│  │                                │ │
│  │   یہاں drop کریں               │ │
│  │   یا کلک کریں                  │ │
│  │                                │ │
│  │   [PDF] [MAX 500MB]           │ │
│  │                                │ │
│  └────────────────────────────────┘ │
│                                     │
│        [📤 Upload PDF]              │
│                                     │
│  ┌────────────────────────────────┐ │
│  │ ⚡ کیسے کام کرتا ہے؟         │ │
│  │                                │ │
│  │ [1]  [2]                      │ │
│  │ 📄   🔍                        │ │
│  │                                │ │
│  │ [3]  [4]                      │ │
│  │ 📖   ✨                        │ │
│  │                                │ │
│  └────────────────────────────────┘ │
│                                     │
│  اردو PDF • Made with ❤️           │
└─────────────────────────────────────┘

Changes from desktop:
- Full-width padding: 16px
- Mode tabs: 2 columns, maybe vertical stack
- How card: single column grid
- Dropzone: full width
- Buttons: 100% width
```

### Mobile: Search with Results (375px width)

```
┌─────────────────────────────────────┐
│ 📄 اردو PDF    [Avatar] [↩]        │
├─────────────────────────────────────┤
│                                     │
│  [📄 Convert] [🔍 Search]          │
│                                     │
│    ↩️ document.pdf                   │
│      متن تلاش کریں                  │
│                                     │
│  ┌─────────────────────────────────┐│
│  │ 🔍 [متن]  [Search]            ││
│  └─────────────────────────────────┘│
│                                     │
│  ☐ Case Sens  ☐ Whole Words        │
│                                     │
│  ✓ 12 نتائج 3 صفحات (145ms)       │
│                                     │
│  ┌─────────────────────────────────┐│
│  │ 📄 Page 5                       ││
│  │ 3 matches                       ││
│  │ ───────────────────────────────  ││
│  │ "...متن کے بعد...               ││
│  │                                 ││
│  │ [📋] [👁️]                      ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │ 📄 Page 12                      ││
│  │ 2 matches                       ││
│  │ ───────────────────────────────  ││
│  │ "...متن سے...                  ││
│  │                                 ││
│  │ [📋] [👁️]                      ││
│  └─────────────────────────────────┘│
│                                     │
│  اردو PDF • Made with ❤️           │
└─────────────────────────────────────┘

Changes from desktop:
- Single column layout
- Result cards full-width
- Buttons smaller, more compact
- Search bar: flex-direction column on very small screens
```

---

## COMPONENT SPECIFICATIONS

### Component 1: Mode Tab Button

**States:**
```
INACTIVE (default):
┌─────────────────────┐
│ 📄 Convert to Word  │
│ Border: --border    │
│ Text: --muted       │
│ BG: transparent     │
└─────────────────────┘

ACTIVE:
┌─────────────────────┐
│ 📄 Convert to Word  │ ← blue background
│ Border: --blue      │
│ Text: white         │
│ BG: --blue          │
│ Shadow: 0 4px 16px  │
└─────────────────────┘

HOVER (inactive):
┌─────────────────────┐
│ 📄 Convert to Word  │
│ Border: --blue      │
│ Text: --blue        │
│ BG: transparent     │
└─────────────────────┘
```

**Code:**
```css
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
```

### Component 2: Search Input with Icon

**Layout:**
```
┌────────────────────────────┐
│ 🔍 [Input]                 │
└────────────────────────────┘

Icon position: absolute left 14px
Input padding: 12px 16px 12px 44px (makes room for icon)
```

**States:**
```
DEFAULT:
Height: 48px
Border: 1px solid --border
Border-radius: 12px
Font-size: 15px
Outline: none

FOCUSED:
Border-color: var(--blue)
Box-shadow: 0 0 0 3px rgba(67,97,238,0.1)
Background: white

DISABLED:
Opacity: 0.6
Cursor: not-allowed
```

**Code:**
```css
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
```

### Component 3: Result Card with Hover Effect

**Base State:**
```
┌────────────────────────────────┐
│ 📄 Page 5  ┊  3 matches        │
│ ────────────────────────────── │
│ "...متن کے درمیان...             │
│                                │
│ [📋 Copy] [👁️ View]           │
└────────────────────────────────┘
Border: 1px solid --border
Padding: 20px
Border-radius: 16px
Box-shadow: var(--shadow)
```

**Hover State:**
```
┌────────────────────────────────┐ ← border turns blue
│ 📄 Page 5  ┊  3 matches        │   transforms up 2px
│ ────────────────────────────── │   shadow darkens
│ "...متن کے درمیان...             │
│                                │
│ [📋 Copy] [👁️ View]           │
└────────────────────────────────┘
Border-color: var(--blue)
Box-shadow: var(--shadow-lg)
Transform: translateY(-2px)
```

**Code:**
```css
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
```

### Component 4: Match Highlight

**Visual:**
```
Text color: automatically from page text
Match background: var(--gold) #f59e0b
Match color: #000 (dark, for contrast)
Match font-weight: 700 (bold)
Match padding: 0 2px
Match border-radius: 2px
```

**HTML:**
```html
<span dir="auto">
  ...پہلے
  <span class="match">متن</span>
  کے بعد...
</span>
```

**Code:**
```css
.result-text .match {
  background: var(--gold);
  color: #000;
  font-weight: 700;
  padding: 0 2px;
  border-radius: 2px;
}
```

---

## COLOR & TYPOGRAPHY GUIDE

### Color Palette

```
PRIMARY:
--blue: #4361ee          (buttons, badges, active states)
--blue-dark: #3451d1     (hover states, darker variant)
--blue-light: #eef1ff    (backgrounds, light fills)

SEMANTIC:
--green: #10b981         (success, results found)
--green-light: #ecfdf5   (success background)
--gold: #f59e0b          (highlights, attention)
--red: #ef4444           (errors, warnings)
--red-light: #fef2f2     (error background)

TEXT:
--text: #1e293b          (primary text - headings, body)
--muted: #64748b         (secondary text - hints, labels)
--light: #94a3b8         (tertiary text - disabled states)
--border: #e2e8f8        (borders, dividers)
--white: #ffffff         (cards, backgrounds)
--bg: #f0f4ff            (page background)
```

### Typography

**Fonts:**
- Display: 'Noto Nastaliq Urdu' (Urdu headings, 400/700 weight)
- Body: 'Inter' (English text, 400/500/600/700 weight)

**Sizes:**

| Element | Size | Weight | Line-height |
|---------|------|--------|-------------|
| Hero Title | 32px | 800 | 1.2 |
| Page Badge | 13px | 700 | 1.4 |
| Body Text | 15px | 400 | 1.6 |
| Match Count | 13px | 500 | 1.4 |
| Context | 14px | 400 | 1.6 |
| Button | 15px | 700 | 1.4 |
| Label | 14px | 500 | 1.4 |

**Direction:** Use `dir="auto"` for bilingual content to automatically detect RTL/LTR

---

## ANIMATION KEYFRAMES

### Spin Animation (for loading spinner)

```css
@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-spinner {
  animation: spin 0.8s linear infinite;
}
```

### Pulse Animation (for active progress step)

```css
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(67,97,238,0.4); }
  50% { box-shadow: 0 0 0 6px rgba(67,97,238,0); }
}

.pstep.active .pstep-dot {
  animation: pulse 1.5s ease infinite;
}
```

### Slide Up Animation (for card entrance)

```css
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.result-card, .search-loading, .no-results {
  animation: slideUp 0.4s ease;
}
```

### Scale/Pop Animation (for successful action)

```css
@keyframes pop {
  0% { transform: scale(0); }
  70% { transform: scale(1.15); }
  100% { transform: scale(1); }
}

.search-results-summary {
  animation: pop 0.5s ease;
}
```

---

## RESPONSIVE BREAKPOINTS

### Desktop: 1200px+

```
- Two-column layouts possible
- Sidebar for filters (future)
- Full padding and margins
- All hover states enabled
```

### Tablet: 768px - 1199px

```
- Single column, full width
- Filters collapse to dropdown
- Larger touch targets (48px)
- Padding: 24px
```

### Mobile: < 768px

```
- Full-width content (16px padding)
- Stacked components
- No hover effects (touch-friendly)
- All buttons 100% width or 48px height
- Font sizes slightly reduced
- Dropzone height: 240px (was 300px)
```

**Media Query Template:**
```css
@media (max-width: 768px) {
  .search-wrap { padding: 0; }
  .search-bar-form { flex-direction: column; }
  .search-btn { width: 100%; }
  .result-card { padding: 16px; }
  .mode-tabs { flex-direction: column; gap: 8px; }
  .mode-tab { width: 100%; }
}

@media (max-width: 480px) {
  .search-input { font-size: 16px; } /* iOS zoom prevention */
  .drop { padding: 24px 16px; }
  .no-results { padding: 24px 16px; }
}
```

---

## STATE VARIATIONS

### Search Input States

```
1. EMPTY (default)
   Placeholder: "اردو متن تلاش کریں..."
   Value: ""
   Border: --border
   
2. FOCUSED
   Border: --blue
   Shadow: 0 0 0 3px rgba(67,97,238,0.1)
   
3. FILLED
   Value: "متن"
   Shows clear button (future)
   
4. LOADING
   Disabled: true
   Opacity: 0.7
   Cursor: not-allowed
   
5. ERROR
   Border: var(--red)
   Background: var(--red-light)
```

### Result Card States

```
1. NORMAL
   White background
   --border color
   var(--shadow)
   
2. HOVER
   Slightly darker shadow
   Blue border
   Translate up 2px
   
3. ACTIVE/SELECTED (future)
   Blue background on header
   White text
   
4. COPIED (after copy action)
   Brief highlight animation
   "Copied!" toast notification
```

### Button States

```
PRIMARY (.search-btn):
- Default: --blue bg, white text, shadow
- Hover: --blue-dark, translateY(-2px)
- Active: darker blue
- Disabled: opacity 0.6, no hover
- Loading: spinner animation

SECONDARY (.result-action-btn):
- Default: transparent bg, --text, border
- Hover: --blue text, --blue-light bg, --blue border
- Active: slightly darker
- Disabled: opacity 0.5

DANGER (.error-retry-btn):
- Default: --red bg, white text
- Hover: #dc2626 (darker red)
```

---

## ACCESSIBILITY FEATURES

### Keyboard Navigation

```
Tab:        Navigate through focusable elements
Shift+Tab:  Reverse navigation
Enter:      Activate buttons, submit forms
Escape:     Close modals, clear search (future)
Ctrl+F:     Open search mode (future, via event listener)
```

### Screen Reader Support

```
ARIA Labels:
<input aria-label="Search Urdu text">
<button aria-label="Search Urdu PDF">

ARIA Live Regions:
<div aria-live="polite" aria-atomic="true">
  Search results summary
</div>

Focus Indicators:
All buttons, inputs, links have visible :focus-visible styles
Outline-width: 2px
Outline-color: var(--blue)
Outline-offset: 2px
```

### Color Contrast

```
Text on White (--text on --white):
#1e293b on #ffffff = 12.6:1 ✓ AAA

Text on Blue (white on --blue):
#ffffff on #4361ee = 5.2:1 ✓ AA

Secondary Text (--muted on --white):
#64748b on #ffffff = 6.5:1 ✓ AA

Match Highlight (black on --gold):
#000000 on #f59e0b = 11.2:1 ✓ AAA
```

### Language Support

```
Urdu (RTL):
- Set dir="rtl" or dir="auto" on containers
- Use flex-direction for proper layout
- Align text right when appropriate

English (LTR):
- Default direction
- Normal text alignment

Bilingual Content:
- Use dir="auto" for automatic detection
- Wrap separate languages in spans with dir attribute

Example:
<p dir="auto">
  <span dir="ur">اردو متن</span> English text
</p>
```

### Focus Management

```
When search completes:
1. Scroll results into view
2. Focus on first result or back to input
3. Announce "X results found" to screen reader

When error occurs:
1. Move focus to error message
2. Make error message focusable (tabindex="0")
3. Announce error to screen reader
```

---

## IMPLEMENTATION CHECKLIST

- [ ] All colors use CSS variables
- [ ] All animations use CSS keyframes or CSS transitions
- [ ] All text is semantic HTML (h1, p, label, etc.)
- [ ] All buttons are actual <button> elements
- [ ] All form inputs have associated <label> elements
- [ ] Focus states visible on all interactive elements
- [ ] Hover states only on desktop (@media (hover: hover))
- [ ] Touch targets minimum 48px x 48px
- [ ] Font sizes responsive (consider clamp())
- [ ] Tested at 320px, 480px, 768px, 1024px, 1200px
- [ ] Color contrast meets WCAG AA minimum
- [ ] RTL text renders correctly
- [ ] No images for icons (use emoji or SVG/font-icons)
- [ ] Animations respect prefers-reduced-motion
- [ ] Loading states clear and meaningful
- [ ] Error messages actionable and specific
- [ ] Success states provide positive feedback

---

## DESIGN SYSTEM TOKENS

### Spacing Scale

```
4px   (xs)
8px   (sm)
12px  (md)
16px  (lg)
20px  (xl)
24px  (2xl)
32px  (3xl)
40px  (4xl)
48px  (5xl)
```

### Border Radius

```
8px   (sm, for small elements like badges)
12px  (md, for inputs and buttons)
14px  (lg, for cards and modals)
16px  (xl, for larger cards)
20px  (2xl, for main cards)
50%   (full, for pills and circles)
```

### Shadow Scale

```
--shadow: 0 4px 24px rgba(67,97,238,0.10)      (default cards)
--shadow-lg: 0 8px 40px rgba(67,97,238,0.15)   (hovered cards)
Hover: translateY(-2px) + shadow-lg
```

---

**This comprehensive UI/UX guide ensures consistency, professionalism, and excellent user experience across all devices and states.**

