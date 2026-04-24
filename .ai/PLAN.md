# PLAN — UI Redesign: Endgame Grocery Design System

## Goal
Apply the Endgame Grocery dark-neon design system (from `Endgame Grocery Design System-handoff.zip`) to every frontend screen. Replace the current light/warm theme with the Marvel-inspired dark-space visual identity. Implement all new UI patterns where existing backend features support them.

## Source Material
- `Endgame Grocery Design System-handoff.zip`
  - `project/README.md` — full design system spec
  - `project/colors_and_type.css` — design tokens
  - `project/ui_kits/app/Components.jsx` — shared components prototype
  - `project/ui_kits/app/HomeScreen.jsx` — overview screen prototype
  - `project/ui_kits/app/ListScreen.jsx` — list detail prototype

## Task Sequence (implement in order — each task depends on the prior)

```
T-001 → T-002 → T-003 → T-004 → T-005 → T-006
```

---

## T-001 — Design Tokens & App Shell

### Objective
Replace the global CSS with dark theme tokens and rebuild the app shell to a mobile-first layout with bottom navigation.

### Files to change / create

| File | Action |
|------|--------|
| `frontend/index.html` | Add Google Fonts `<link>`, update `<title>` |
| `frontend/src/styles/tokens.css` | **NEW** — full CSS custom property set |
| `frontend/src/index.css` | **REWRITE** — dark theme base styles, utility classes |
| `frontend/src/assets/endgame_grocery_logo.png` | **NEW** — copy from zip |
| `frontend/src/App.jsx` | Rebuild `ProtectedLayout`, add `/search` route |

### index.html
```html
<!-- Add before </head> -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;800;900&family=Exo+2:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<!-- Update title -->
<title>Endgame Grocery</title>
```

### tokens.css — full variable set
```css
:root {
  /* Background */
  --bg-base:    #080B1C;
  --bg-surface: #0D1128;
  --bg-raised:  #141832;

  /* Neon primaries */
  --neon-purple: #8B2BE2;
  --neon-violet: #A855F7;
  --neon-cyan:   #00E5FF;
  --neon-blue:   #3B82F6;

  /* Accents */
  --accent-pink: #FF2D78;
  --accent-star: #E2E8FF;

  /* Semantic */
  --color-success: #00E5B0;
  --color-warning: #FFB800;
  --color-error:   #FF4560;
  --color-info:    #00E5FF;

  /* Text */
  --text-primary:   #F0F0FF;
  --text-secondary: #8E9AC8;
  --text-disabled:  #3D4470;

  /* Gradients */
  --gradient-brand:   linear-gradient(135deg, #8B2BE2 0%, #6366F1 45%, #00E5FF 100%);
  --gradient-card:    linear-gradient(135deg, rgba(139,43,226,0.15) 0%, rgba(0,229,255,0.08) 100%);
  --gradient-surface: linear-gradient(180deg, #141832 0%, #0D1128 100%);
  --gradient-text:    linear-gradient(90deg, #A855F7, #00E5FF);

  /* Type scale */
  --text-xs:   11px;
  --text-sm:   13px;
  --text-base: 15px;
  --text-md:   17px;
  --text-lg:   20px;
  --text-xl:   24px;
  --text-2xl:  32px;
  --text-3xl:  42px;
  --text-4xl:  56px;

  /* Border radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --radius-xl: 28px;

  /* Shadows / elevation */
  --shadow-1:    0 2px 8px rgba(0,0,0,0.4);
  --shadow-2:    0 4px 24px rgba(0,0,0,0.5), 0 0 16px rgba(139,43,226,0.2);
  --shadow-3:    0 8px 40px rgba(0,0,0,0.7), 0 0 32px rgba(0,229,255,0.25);
  --glow-purple: 0 0 20px rgba(139,43,226,0.6), 0 0 40px rgba(139,43,226,0.3);
  --glow-cyan:   0 0 20px rgba(0,229,255,0.5), 0 0 40px rgba(0,229,255,0.25);

  /* Easing */
  --ease-out: cubic-bezier(0.25, 0.46, 0.45, 0.94);

  /* Durations */
  --duration-micro:    150ms;
  --duration-standard: 250ms;
  --duration-page:     400ms;
}
```

### index.css — structural changes
- `:root`: `@import './styles/tokens.css'`; `color-scheme: dark; background: var(--bg-base); color: var(--text-primary); font-family: 'Exo 2', sans-serif`
- `body`: `margin: 0; min-height: 100vh`
- Remove `.hero-card` entirely
- `.app-shell`: mobile canvas — `max-width: 430px; margin: 0 auto; min-height: 100vh; position: relative; overflow-x: hidden`
- Add `@keyframes shimmer`, `@keyframes slideUp`, `@keyframes fadeIn`
- Keep `.visually-hidden` as-is
- Old classes (`.hero-card`, `.eyebrow`, etc.) removed; old classes still used by unported components (`.stack`, `.button-row`) kept as stubs until all pages are migrated

#### New dark-theme utility classes added to index.css

**Buttons**
```css
.eg-btn-primary   /* gradient-brand bg, #080B1C text, pill, glow-purple shadow */
.eg-btn-secondary /* transparent, neon-cyan border + text, pill */
.eg-btn-ghost     /* rgba(139,43,226,0.1) bg, violet text, purple border, pill */
.eg-btn-danger    /* rgba(255,69,96,0.1) bg, error text, red border, pill */
.eg-icon-btn      /* 36×36 square, bg-raised, subtle border, radius-md */
```

**Form**
```css
.eg-input     /* bg-raised, purple border 1.5px, radius-md, text-primary, neon focus glow */
.eg-field     /* display:grid; gap:0.4rem */
.eg-field label { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary) }
```

**Cards / surfaces**
```css
.eg-card       /* bg-surface, purple border, radius-lg, position:relative, overflow:hidden */
```

**Chips**
```css
.eg-chip-purple  /* rgba(139,43,226,0.12) bg, neon-violet text, purple border, radius pill */
.eg-chip-cyan    /* rgba(0,229,255,0.1) bg, neon-cyan text */
.eg-chip-success /* rgba(0,229,176,0.1) bg, success text */
.eg-chip-queued  /* rgba(61,68,112,0.4) bg, text-disabled text */
```

**Banners**
```css
.eg-error-banner   /* rgba(255,69,96,0.1) bg, error text, radius-md, padding */
.eg-offline-banner /* bg-raised, text-secondary, radius-md */
```

**Typography helpers**
```css
.eg-orbitron      { font-family: 'Orbitron', sans-serif }
.eg-mono          { font-family: 'JetBrains Mono', monospace }
.eg-gradient-text { background: var(--gradient-text); -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent; background-clip: text }
```

### App.jsx changes
```jsx
// Remove <section className="hero-card"> wrapper from ProtectedLayout
// New ProtectedLayout:
function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <div className="app-shell">
        <OfflineBanner />
        <Outlet />
        <BottomNav />
      </div>
    </ProtectedRoute>
  );
}

// Add to router (inside protected group):
<Route path="/search" element={<SearchPage />} />

// Imports to add:
import BottomNav from './components/ui/BottomNav';
import SearchPage from './pages/SearchPage';
```

Note: `SearchPage` can be a stub (`export default function SearchPage() { return null; }`) until T-006 is implemented. The import + route must exist after T-001 so BottomNav links work.

### Asset extraction (run before implementing T-001)
```bash
mkdir -p frontend/src/assets
unzip -p "Endgame Grocery Design System-handoff.zip" \
  "endgame-grocery-design-system/project/assets/endgame_grocery_logo.png" \
  > frontend/src/assets/endgame_grocery_logo.png
```

### Validation
- `npm run lint`
- `npm run build`
- `npm test` (existing tests still pass)

### Commit message
`feat(ui): add Endgame design tokens and dark app shell`

---

## T-002 — Shared UI Component Library

### Objective
Create the reusable Endgame Grocery UI components consumed by all redesigned screens.

### Files to create

| File | Component |
|------|-----------|
| `frontend/src/components/ui/Icon.jsx` | Inline SVG icon subset |
| `frontend/src/components/ui/TopBar.jsx` | Sticky top bar |
| `frontend/src/components/ui/FAB.jsx` | Floating action button |
| `frontend/src/components/ui/BottomNav.jsx` | Bottom tab navigation |
| `frontend/src/components/ui/EmptyState.jsx` | Empty content placeholder |
| `frontend/src/components/ui/LoadingState.jsx` | Shimmer skeleton rows |
| `frontend/src/components/ui/ErrorState.jsx` | Error / retry view |
| `frontend/src/components/ui/BottomSheet.jsx` | Bottom sheet overlay |
| `frontend/src/components/ui/index.js` | Barrel export |

### Component specs

#### Icon.jsx
```jsx
// Props: name (string), size=20, color='currentColor', strokeWidth=1.5
// Returns <svg> with inline Lucide-style path
// Required icon names (copy paths from handoff Components.jsx):
//   plus, check, checkCircle, trash, edit, x,
//   chevronRight, chevronDown, chevronLeft, share, users,
//   shoppingCart, list, search, alertCircle, sparkles,
//   moreVertical, arrowLeft, filter
// Add logOut:
//   <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
//   <polyline points="16 17 21 12 16 7"/>
//   <line x1="21" y1="12" x2="9" y2="12"/>
```

#### TopBar.jsx
```jsx
// Props: title (string), subtitle? (string), onBack? (() => void), actions? ([{icon, onClick}])
// position: sticky; top: 0; z-index: 50
// padding: 52px 16px 12px
// background: linear-gradient(180deg, rgba(8,11,28,1) 70%, rgba(8,11,28,0) 100%)
// display: flex; align-items: center; gap: 12px
// back button: eg-icon-btn with arrowLeft Icon
// title: Orbitron 18px weight 700 text-primary
// subtitle: 12px text-secondary margin-top 2px
// actions: rendered as eg-icon-btn at right
```

#### FAB.jsx
```jsx
// Props: onClick (() => void), icon='plus'
// position: fixed; bottom: 92px; right: calc(50% - 195px); z-index: 90
// 56×56px circle; background: var(--gradient-brand)
// box-shadow: var(--glow-purple), 0 4px 16px rgba(0,0,0,0.5)
// transition: transform var(--duration-micro), box-shadow var(--duration-micro)
// onMouseEnter: scale(1.08) + stronger glow
// onMouseLeave: reset
// Icon inside: size 24, color '#080B1C', strokeWidth 2.5
```

#### BottomNav.jsx
```jsx
// No props
// Uses useLocation() for active detection, useNavigate() for navigation
// Tabs: [
//   { id:'lists',  icon:'list',   label:'Lists',  path:'/' },
//   { id:'search', icon:'search', label:'Search', path:'/search' }
// ]
// Active detection:
//   lists tab: pathname === '/' || pathname.startsWith('/lists')
//   search tab: pathname.startsWith('/search')
// position: fixed; bottom: 0; left: 50%; transform: translateX(-50%)
// width: 100%; max-width: 430px; z-index: 100
// background: rgba(8,11,28,0.95); backdrop-filter: blur(20px)
// border-top: 1px solid rgba(139,43,226,0.25)
// padding: 8px 0 28px
// display: flex; justify-content: space-around
// Active tab: neon-cyan icon + label, text-shadow glow
// Inactive: text-disabled color, strokeWidth 1.5
```

#### EmptyState.jsx
```jsx
// Props: title (string), body (string), action? (string), onAction? (() => void)
// Centered column: padding 48px 32px, gap 12px
// shoppingCart Icon 56px text-disabled color
// title: Orbitron 16px weight 600 text-secondary
// body: 14px text-disabled, max-width 240px, line-height 1.5
// Optional eg-btn-primary action button (margin-top 8px)
```

#### LoadingState.jsx
```jsx
// Props: rows=4
// Renders `rows` shimmer skeleton divs
// Each: height 64px, radius-md, shimmer gradient animation
// background: linear-gradient(90deg, rgba(20,24,50,0.8) 25%, rgba(30,36,72,0.8) 50%, rgba(20,24,50,0.8) 75%)
// backgroundSize: 200% 100%
// animation: shimmer 1.4s infinite, delay i*0.1s
// border: 1px solid rgba(139,43,226,0.1)
// gap 8px, padding 16px
```

#### ErrorState.jsx
```jsx
// Props: onRetry (() => void)
// Centered column: padding 48px 32px, gap 12px
// alertCircle Icon 48px color-error
// "Mission Failed": Orbitron 16px weight 600, color-error, text-shadow 0 0 16px rgba(255,69,96,0.4)
// "Something went wrong. Try again.": 14px text-secondary
// eg-btn-secondary Retry button (margin-top 8px)
```

#### BottomSheet.jsx
```jsx
// Props: open (bool), onClose (() => void), title (string), children
// Renders nothing when open=false
// Backdrop: position fixed, inset 0, rgba(8,11,28,0.7), backdropFilter blur(4px),
//   onClick→onClose, z-index 200
// Sheet: position fixed, bottom 0, left 50%, transform translateX(-50%),
//   width 100%, maxWidth 430px, z-index 201
//   background: rgba(13,17,40,0.98)
//   border-top: 1px solid rgba(139,43,226,0.4)
//   border-radius: 28px 28px 0 0
//   padding: 20px 20px 48px
//   box-shadow: 0 -8px 40px rgba(139,43,226,0.2)
//   animation: slideUp 0.3s var(--ease-out)
// Drag handle: 36×4px, border-radius 9999, rgba(139,43,226,0.4), margin: -8px auto 16px
// Title: Orbitron 16px weight 600 text-primary, margin-bottom 16px
// children rendered below title
```

#### ui/index.js
```js
export { default as Icon } from './Icon';
export { default as TopBar } from './TopBar';
export { default as FAB } from './FAB';
export { default as BottomNav } from './BottomNav';
export { default as EmptyState } from './EmptyState';
export { default as LoadingState } from './LoadingState';
export { default as ErrorState } from './ErrorState';
export { default as BottomSheet } from './BottomSheet';
```

### Validation
- `npm run lint`
- `npm run build`

### Commit message
`feat(ui): add shared Endgame UI component library`

---

## T-003 — Auth Pages Redesign

### Objective
Apply the dark design system to Login and Register screens. All form logic unchanged.

### Files to change

| File | Action |
|------|--------|
| `frontend/src/pages/LoginPage.jsx` | Update JSX — all logic unchanged |
| `frontend/src/pages/RegisterPage.jsx` | Update JSX — all logic unchanged |
| `frontend/src/index.css` | Add/update auth dark CSS classes |

### Brand header block (both pages)
```jsx
import logo from '../assets/endgame_grocery_logo.png';

// Replace <p className="eyebrow"> with:
<div className="auth-brand">
  <img src={logo} alt="Endgame Grocery" className="auth-logo" />
  <div className="auth-brand-text">
    <div className="eg-orbitron eg-gradient-text auth-brand-title">ENDGAME</div>
    <div className="auth-brand-sub">GROCERY</div>
  </div>
</div>
```

### LoginPage copy & class changes
- `<h1>` → `"Welcome Back"`
- subtitle `<p>` → `"Sign in to access your mission."`
- `className="button-primary"` → `"eg-btn-primary"`
- `className="error-banner"` → `"eg-error-banner"`
- `className="muted-link"` → `"eg-link"`
- All `<input>` → add `className="eg-input"`
- `<div className="field">` → `<div className="eg-field">`
- Remove `<p className="eyebrow">` (replaced by auth-brand block)
- Remove `<div className="page-copy">` wrapper

### RegisterPage copy & class changes
- Same class replacements as LoginPage
- `<h1>` → `"Join the Squad"`
- subtitle `<p>` → `"Create your account to get started."`
- Remove `<p className="eyebrow">`

### CSS additions / replacements (index.css)
```css
.auth-layout {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 2rem 1.25rem;
  background: var(--bg-base);
}

.auth-card {
  width: min(100%, 30rem);
  background: var(--bg-surface);
  border: 1px solid rgba(139, 43, 226, 0.3);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-3);
  padding: 2rem;
}

.auth-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 1.5rem;
}

.auth-logo {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  box-shadow: 0 0 16px rgba(139, 43, 226, 0.5);
  flex-shrink: 0;
}

.auth-brand-title {
  font-size: var(--text-xl);
  font-weight: 800;
  letter-spacing: 0.06em;
  line-height: 1;
}

.auth-brand-sub {
  font-size: var(--text-xs);
  font-weight: 500;
  letter-spacing: 0.2em;
  color: var(--text-secondary);
  margin-top: 2px;
}

.auth-card h1 {
  font-family: 'Orbitron', sans-serif;
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.5rem;
}

.auth-card > p {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0 0 1.5rem;
}

.auth-form {
  display: grid;
  gap: 1rem;
}

.eg-link {
  color: var(--neon-cyan);
  font-weight: 600;
  text-decoration: none;
  font-size: var(--text-sm);
}
```

### Validation
- `npm run lint`
- `npm run build`

### Commit message
`feat(ui): apply dark design to auth pages`

---

## T-004 — Overview Page Redesign

### Objective
Redesign the lists overview as the dark HomeScreen with neon list cards, bottom-sheet new-list flow, and Orbitron brand header.

### Files to change / create

| File | Action |
|------|--------|
| `frontend/src/pages/OverviewPage.jsx` | Full JSX rewrite — all state/logic preserved |
| `frontend/src/components/ListCardHome.jsx` | NEW |
| `frontend/src/components/NewListSheet.jsx` | NEW |

### ListCardHome.jsx
```jsx
// Props:
//   list: { id, name, is_owner, owner_name, is_pending_sync }
//   onOpen: () => void         — tap the card body
//   onRename: (name) => void   — called from inline rename form
//   onDelete: () => void       — called from inline delete btn
//
// Internal state: menuOpen (bool), renamingMode (bool), renameValue (string)
//
// Structure:
//   <div className="eg-card list-card-home" onClick={onOpen}>
//     {/* gradient overlay */}
//     <div className="eg-card-overlay" />
//
//     <div className="list-card-row">
//       <div className="list-card-info">
//         <div className="eg-orbitron list-card-name">{list.name}</div>
//         <div className="list-card-chips">
//           <span className={list.is_owner ? 'eg-chip-purple' : 'eg-chip-cyan'}>
//             {list.is_owner ? 'Owner' : `Shared · ${list.owner_name}`}
//           </span>
//           {list.is_pending_sync && <span className="eg-chip-queued">Queued</span>}
//         </div>
//       </div>
//       <button className="eg-icon-btn" onClick={e => { e.stopPropagation(); setMenuOpen(v=>!v); }}>
//         <Icon name="moreVertical" size={18} color="var(--text-secondary)" />
//       </button>
//     </div>
//
//     {/* Inline action menu (shown when menuOpen) */}
//     {menuOpen && !renamingMode && (
//       <div className="list-card-menu" onClick={e => e.stopPropagation()}>
//         <button className="eg-btn-ghost list-card-menu-btn"
//           onClick={() => { setRenamingMode(true); setRenameValue(list.name); }}>
//           Rename
//         </button>
//         <button className="eg-btn-danger list-card-menu-btn" onClick={() => { setMenuOpen(false); onDelete(); }}>
//           Delete
//         </button>
//       </div>
//     )}
//     {menuOpen && renamingMode && (
//       <div className="list-card-menu" onClick={e => e.stopPropagation()}>
//         <input className="eg-input" value={renameValue}
//           onChange={e => setRenameValue(e.target.value)}
//           onKeyDown={e => {
//             if (e.key === 'Enter') submitRename();
//             if (e.key === 'Escape') { setRenamingMode(false); setMenuOpen(false); }
//           }} autoFocus />
//         <div className="button-row" style={{marginTop:8}}>
//           <button className="eg-btn-ghost" onClick={() => { setRenamingMode(false); setMenuOpen(false); }}>Cancel</button>
//           <button className="eg-btn-secondary" onClick={submitRename}>Save</button>
//         </div>
//       </div>
//     )}
//   </div>
//
// submitRename: if renameValue.trim() calls onRename(renameValue.trim()), resets state
//
// CSS additions:
//   .list-card-home { cursor: pointer; margin-bottom: 10px; transition: border-color var(--duration-standard), box-shadow var(--duration-standard) }
//   .list-card-home:hover { border-color: rgba(0,229,255,0.45); box-shadow: 0 0 24px rgba(0,229,255,0.12), 0 4px 24px rgba(0,0,0,0.5) }
//   .eg-card-overlay { position:absolute; inset:0; border-radius:inherit; pointer-events:none; background:var(--gradient-card) }
//   .list-card-row { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; position:relative }
//   .list-card-info { flex:1; min-width:0 }
//   .list-card-name { font-size: var(--text-base); font-weight:600; color:var(--text-primary); margin-bottom:6px }
//   .list-card-chips { display:flex; gap:6px; flex-wrap:wrap }
//   .list-card-menu { padding:12px 0 0; display:grid; gap:8px; position:relative }
//   .list-card-menu-btn { width:100%; justify-content:flex-start }
```

### NewListSheet.jsx
```jsx
// Props: open (bool), onAdd ((name:string) => void), onClose (() => void)
// Internal state: name (string)
//
// <BottomSheet open={open} onClose={handleClose} title="New List">
//   <input className="eg-input" placeholder="List name…" autoFocus
//     value={name} onChange={e=>setName(e.target.value)}
//     onKeyDown={e => e.key==='Enter' && handleSubmit()} />
//   <div className="button-row" style={{marginTop:16}}>
//     <button className="eg-btn-ghost" style={{flex:1}} onClick={handleClose}>Cancel</button>
//     <button className="eg-btn-primary" style={{flex:2}} onClick={handleSubmit}
//       disabled={!name.trim()}>Create List</button>
//   </div>
// </BottomSheet>
//
// handleClose: setName(''); onClose()
// handleSubmit: if name.trim() → onAdd(name.trim()); setName(''); onClose()
```

### OverviewPage.jsx — JSX rewrite
Preserve all existing state (`lists`, `isLoading`, `error`, `syncVersion`) and all async handlers.

**Refactors needed to existing logic:**
1. Extract `handleCreateList` into a function accepting `name: string` directly (not an event): `async function createListByName(name)` — called from `NewListSheet`.
2. Extract `submitRename` to accept `(listId, newName)` as parameters (remove dependency on `editingId`/`editingName` state — those state variables can be removed).
3. Keep `handleDelete` as-is.

**New state:**
```jsx
const [view, setView] = useState('active');   // 'active' | 'all' — visual only (no item data)
const [showNew, setShowNew] = useState(false);
```

**Derived values:**
```jsx
const sharedCount = lists.filter(l => !l.is_owner).length;
// Both views show all lists (no item-count data to filter by active state)
const displayLists = lists;
```

**Returned JSX:**
```jsx
return (
  <div style={{ paddingBottom: 120 }}>

    {/* Sticky header */}
    <div className="overview-topbar">
      <div className="overview-brand">
        <div>
          <div className="eg-orbitron eg-gradient-text overview-brand-title">ENDGAME</div>
          <div className="overview-brand-sub">GROCERY</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <img src={logo} alt="Endgame Grocery" className="overview-logo" />
          <button className="eg-icon-btn" onClick={logout} title="Log out">
            <Icon name="logOut" size={18} color="var(--text-secondary)" />
          </button>
        </div>
      </div>
      <div className="overview-chips">
        <span className="eg-chip-purple">
          <Icon name="list" size={12} color="var(--neon-violet)" />
          {' '}{lists.length} {lists.length === 1 ? 'list' : 'lists'}
        </span>
        {sharedCount > 0 && (
          <span className="eg-chip-cyan">{sharedCount} shared</span>
        )}
      </div>
    </div>

    {/* View toggle */}
    <div className="overview-toggle">
      {['active','all'].map(v => (
        <button key={v}
          className={view === v ? 'eg-toggle-active' : 'eg-toggle'}
          onClick={() => setView(v)}>
          {v === 'active' ? 'Active' : 'All Lists'}
        </button>
      ))}
    </div>

    {/* Content */}
    <div style={{ padding: '0 16px' }}>
      {error && <ErrorState onRetry={loadLists} />}
      {isLoading && <LoadingState rows={3} />}
      {!isLoading && !error && displayLists.length === 0 && (
        <EmptyState
          title="No lists yet"
          body="Create your first mission to get started."
          action="New List"
          onAction={() => setShowNew(true)}
        />
      )}
      {!isLoading && !error && displayLists.map(list => (
        <ListCardHome
          key={list.id}
          list={list}
          onOpen={() => navigate(`/lists/${list.id}`)}
          onRename={(name) => void createRename(list.id, name)}
          onDelete={() => void handleDelete(list.id)}
        />
      ))}
    </div>

    <FAB onClick={() => setShowNew(true)} />
    <NewListSheet
      open={showNew}
      onAdd={(name) => void createListByName(name)}
      onClose={() => setShowNew(false)}
    />
  </div>
);
```

**Imports to add:** `useNavigate` from react-router-dom, `logo` from assets, `Icon, FAB, EmptyState, LoadingState, ErrorState` from ui, `ListCardHome`, `NewListSheet`.

### New CSS classes (index.css)
```css
.overview-topbar {
  padding: 52px 16px 16px;
  background: linear-gradient(180deg, rgba(8,11,28,1) 70%, rgba(8,11,28,0) 100%);
  position: sticky; top: 0; z-index: 50;
}
.overview-brand {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 12px;
}
.overview-brand-title { font-size: var(--text-2xl); font-weight: 800; letter-spacing: 0.06em; line-height: 1 }
.overview-brand-sub   { font-size: var(--text-xs); font-weight: 500; letter-spacing: 0.2em; color: var(--text-secondary); margin-top: -2px }
.overview-logo        { width: 40px; height: 40px; border-radius: 10px; box-shadow: 0 0 16px rgba(139,43,226,0.4) }
.overview-chips       { display: flex; gap: 8px; align-items: center; flex-wrap: wrap }
.overview-toggle      { display: flex; gap: 6px; padding: 0 16px 14px }
.eg-toggle            { /* inactive pill filter btn */ font-family:'Exo 2',sans-serif; font-size:var(--text-sm); font-weight:500; padding:6px 14px; border-radius:9999px; cursor:pointer; background:var(--bg-raised); color:var(--text-secondary); border:1px solid rgba(255,255,255,0.06); transition:all var(--duration-standard) }
.eg-toggle-active     { background:rgba(0,229,255,0.12); color:var(--neon-cyan); border-color:rgba(0,229,255,0.4) }
```

### Validation
- `npm run lint`
- `npm run build`
- `npm test`

### Commit message
`feat(ui): redesign overview page as Endgame home screen`

---

## T-005 — List Detail Page Redesign

### Objective
Redesign the list detail view with TopBar navigation, FAB-triggered add-item sheet, neon entry rows, swipe-to-delete, and collapsible done section.

### Files to change / create

| File | Action |
|------|--------|
| `frontend/src/pages/ListDetailPage.jsx` | Full JSX rewrite — all state/logic preserved |
| `frontend/src/components/AddItemSheet.jsx` | NEW |
| `frontend/src/components/EntryRow.jsx` | NEW |

### AddItemSheet.jsx
```jsx
// Props: open (bool), onAdd ((text:string) => void), onClose (() => void)
// Internal state: text (string)
//
// <BottomSheet open={open} onClose={onClose} title="Add Item">
//   <input className="eg-input" placeholder="Add milk, lemons, bread…"
//     autoFocus value={text} onChange={e=>setText(e.target.value)}
//     onKeyDown={e => e.key==='Enter' && handleSubmit()} />
//   <div className="button-row" style={{marginTop:16}}>
//     <button className="eg-btn-ghost" style={{flex:1}} onClick={onClose}>Cancel</button>
//     <button className="eg-btn-primary" style={{flex:2}} onClick={handleSubmit}
//       disabled={!text.trim()}>Add Item</button>
//   </div>
// </BottomSheet>
//
// handleSubmit: if text.trim() → onAdd(text.trim()); setText('')
//   (does NOT auto-close — allows adding multiple items in sequence)
//   User closes explicitly via Cancel or backdrop tap
```

### EntryRow.jsx
```jsx
// Props:
//   entry: { id, text, status, is_pending_sync }
//   onToggle: () => void
//   onEdit: (newText: string) => void
//   onDelete: () => void
//
// State: editMode (bool), editText (string), swipeX (number), swiping (bool)
// Refs: rowRef (div), startX (number), currentDx (number)
//
// === Normal (non-edit) mode ===
// Outer wrapper: position:relative; overflow:hidden; margin-bottom:8px
//
// Delete zone (always rendered, behind the row):
//   position:absolute; right:0; top:0; bottom:0; width:80px
//   display:flex; align-items:center; justify-content:center
//   background: rgba(255,69,96,0.2); border-radius: 0 var(--radius-md) var(--radius-md) 0
//   <Icon name="trash" size={20} color="var(--color-error)" />
//
// Row div (ref=rowRef):
//   style={{ transform:`translateX(${swipeX}px)`, transition: swiping?'none':'transform 0.25s var(--ease-out)' }}
//   onTouchStart={handleTouchStart}
//   onTouchMove={handleTouchMove}
//   onTouchEnd={handleTouchEnd}
//   className="entry-row"
//
//   Row contents:
//   [check-circle btn] [text area, flex:1] [edit btn]
//
//   Check-circle btn (eg-icon-btn borderless):
//     Icon name="checkCircle" size=22
//     color: status==='done' ? 'var(--color-success)' : 'var(--text-disabled)'
//     onClick → onToggle()
//
//   Text area:
//     <p> entry.text, Exo 2 15px
//     done: text-decoration:line-through; color:var(--text-disabled)
//     is_pending_sync: + <span className="eg-chip-queued" style={{fontSize:10}}>Queued</span>
//
//   Edit btn: eg-icon-btn, Icon name="edit" size=18 text-secondary
//     onClick → { setEditMode(true); setEditText(entry.text); }
//
// Touch handler logic:
//   handleTouchStart(e): startX.current = e.touches[0].clientX; setSwiping(true)
//   handleTouchMove(e):
//     currentDx.current = e.touches[0].clientX - startX.current
//     if (currentDx.current < 0) setSwipeX(Math.max(currentDx.current, -100))
//   handleTouchEnd():
//     setSwiping(false)
//     if (currentDx.current < -80) { setSwipeX(0); onDelete(); }
//     else setSwipeX(0)
//     currentDx.current = 0
//
// === Edit mode ===
// Renders inline input + Save/Cancel
//   <input className="eg-input" value={editText} onChange autoFocus
//     onKeyDown: Enter → submitEdit(); Escape → cancelEdit() />
//   <div className="button-row" style={{marginTop:8}}>
//     <button className="eg-btn-ghost" onClick={cancelEdit}>Cancel</button>
//     <button className="eg-btn-secondary" onClick={submitEdit}>Save</button>
//   </div>
//   submitEdit: if editText.trim() → onEdit(editText.trim()); setEditMode(false)
//   cancelEdit: setEditMode(false); setEditText('')
//
// CSS:
//   .entry-row {
//     display: flex; align-items: center; gap: 12px;
//     background: var(--bg-surface);
//     border: 1px solid rgba(139,43,226,0.2);   /* open */
//     border-radius: var(--radius-md);
//     padding: 12px 16px;
//   }
//   .entry-row-done { border-color: rgba(0,229,176,0.15) }
```

### ListDetailPage.jsx — JSX rewrite
Preserve all existing state, effects, and handler functions.

**Refactors to existing logic:**
1. Extract add-entry into `async function addEntryByText(text)` (same logic as `handleCreateEntry` but takes text string, not form event).
2. Extract edit-entry into `async function submitEditEntry(entryId, text)` (same logic as `submitEdit` but params instead of state).
3. Keep `toggleStatus`, `handleDeleteEntry`, `handleShareSubmit`, `handleRevokeMember` as-is.

**New state:**
```jsx
const [showAddItem, setShowAddItem] = useState(false);
const [doneOpen, setDoneOpen] = useState(true);  // collapsible done section
```

**Returned JSX:**
```jsx
return (
  <div style={{ paddingBottom: 120 }}>

    <TopBar
      title={list?.name ?? 'List'}
      onBack={() => navigate('/')}
      actions={list?.is_owner ? [{
        icon: <Icon name="share" size={20} color="var(--text-secondary)" />,
        onClick: () => setIsSharingOpen(v => !v)
      }] : []}
    />

    {entryError && (
      <div className="eg-error-banner" style={{margin:'0 16px 8px'}}>
        {entryError}
      </div>
    )}
    {isLoading && <LoadingState rows={4} />}

    {!isLoading && (
      <div style={{ padding: '0 16px' }}>

        {/* Open items */}
        <div className="entry-section-header">
          <span className="eg-orbitron" style={{fontSize:13, color:'var(--text-secondary)', letterSpacing:'0.08em'}}>
            OPEN ITEMS
          </span>
          <span className="eg-chip-purple" style={{fontSize:11}}>{openEntries.length}</span>
        </div>
        {openEntries.length === 0 && (
          <EmptyState title="All clear" body="No open items. Add one with the + button." />
        )}
        {openEntries.map(entry => (
          <EntryRow key={entry.id} entry={entry}
            onToggle={() => void toggleStatus(entry)}
            onEdit={(text) => void submitEditEntry(entry.id, text)}
            onDelete={() => void handleDeleteEntry(entry.id)} />
        ))}

        {/* Done items — collapsible */}
        {doneEntries.length > 0 && (
          <>
            <button className="entry-section-collapse"
              onClick={() => setDoneOpen(v => !v)}>
              <span className="eg-orbitron" style={{fontSize:13, color:'var(--color-success)', letterSpacing:'0.08em'}}>
                DONE
              </span>
              <span className="eg-chip-success" style={{fontSize:11, marginLeft:'auto'}}>{doneEntries.length}</span>
              <Icon name={doneOpen ? 'chevronDown' : 'chevronRight'} size={16} color="var(--color-success)" />
            </button>
            {doneOpen && doneEntries.map(entry => (
              <EntryRow key={entry.id} entry={entry}
                onToggle={() => void toggleStatus(entry)}
                onEdit={(text) => void submitEditEntry(entry.id, text)}
                onDelete={() => void handleDeleteEntry(entry.id)} />
            ))}
          </>
        )}

        {/* Sharing panel (owner only, inline expandable) */}
        {list?.is_owner && isSharingOpen && (
          <SharingPanel
            members={members}
            shareEmail={shareEmail}
            shareError={shareError}
            isSharingLoading={isSharingLoading}
            onEmailChange={setShareEmail}
            onShareSubmit={handleShareSubmit}
            onRevoke={handleRevokeMember}
          />
        )}

      </div>
    )}

    <FAB onClick={() => setShowAddItem(true)} />
    <AddItemSheet
      open={showAddItem}
      onAdd={(text) => void addEntryByText(text)}
      onClose={() => setShowAddItem(false)}
    />
  </div>
);
```

**SharingPanel** — define as a named function in the same file (not exported):
```jsx
function SharingPanel({ members, shareEmail, shareError, isSharingLoading, onEmailChange, onShareSubmit, onRevoke }) {
  return (
    <div className="sharing-panel">
      <div className="entry-section-header">
        <span className="eg-orbitron" style={{fontSize:13,color:'var(--neon-violet)',letterSpacing:'0.08em'}}>SQUAD</span>
        <span className="eg-chip-purple" style={{fontSize:11}}>{members.length}</span>
      </div>

      <form onSubmit={onShareSubmit} style={{display:'grid',gap:8,marginBottom:16}}>
        <input className="eg-input" placeholder="Share with email…"
          value={shareEmail} onChange={e=>onEmailChange(e.target.value)} />
        <button className="eg-btn-secondary" type="submit">Add Member</button>
      </form>

      {shareError && <div className="eg-error-banner" style={{marginBottom:8}}>{shareError}</div>}
      {isSharingLoading && <LoadingState rows={2} />}

      {!isSharingLoading && members.map(m => (
        <div key={m.user_id} className="member-row">
          <div>
            <div style={{fontWeight:600,color:'var(--text-primary)',fontSize:'var(--text-base)'}}>{m.display_name}</div>
            <div style={{fontSize:'var(--text-sm)',color:'var(--text-secondary)'}}>{m.email}</div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <span className={m.is_owner ? 'eg-chip-purple' : 'eg-chip-cyan'} style={{fontSize:11}}>
              {m.is_owner ? 'Owner' : 'Member'}
            </span>
            {m.is_pending_sync && <span className="eg-chip-queued" style={{fontSize:11}}>Queued</span>}
            {!m.is_owner && (
              <button className="eg-btn-danger" style={{fontSize:13,padding:'6px 12px'}}
                onClick={() => void onRevoke(m.user_id)}>Revoke</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### New CSS classes (index.css)
```css
.entry-section-header {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 16px 0 8px;
}
.entry-section-collapse {
  display: flex; align-items: center; gap: 8px;
  width: 100%; background: none; border: none; border-top: 1px solid rgba(0,229,176,0.15);
  padding: 12px 0; cursor: pointer;
}
.sharing-panel {
  margin-top: 24px;
  background: var(--bg-surface);
  border: 1px solid rgba(139,43,226,0.25);
  border-radius: var(--radius-lg);
  padding: 16px;
}
.member-row {
  display: flex; justify-content: space-between; align-items: center; gap: 12px;
  padding: 10px 0;
  border-top: 1px solid rgba(255,255,255,0.05);
}
.member-row:first-of-type { border-top: none }
```

### Validation
- `npm run lint`
- `npm run build`
- `npm test`

### Commit message
`feat(ui): redesign list detail page with neon theme and swipe-to-delete`

---

## ~~T-006 — Search Page~~ — DROPPED

**Reason:** Search feature removed from scope per user decision (2026-04-24). The Search tab is removed from BottomNav. The `/search` route and `SearchPage` stub are cleaned up as part of T-007.

---

## T-007 — List Detail: Options Flyout + BottomNav Cleanup

### Objective
1. Remove the Search tab from BottomNav and clean up the `/search` route.
2. Replace the single share icon in the TopBar with a `moreVertical` options button that opens a bottom-sheet flyout. The flyout provides two actions (owner only): **Rename list** and **Share list**, each opening its own focused sub-sheet.

### Files to change / create

| File | Action |
|------|--------|
| `frontend/src/components/ui/BottomNav.jsx` | Remove Search tab; keep only Lists tab |
| `frontend/src/App.jsx` | Remove `/search` route and `SearchPage` import |
| `frontend/src/pages/ListDetailPage.jsx` | Replace share TopBar action with options button; wire three sheets; remove inline SharingPanel |
| `frontend/src/components/ListOptionsSheet.jsx` | **NEW** — options menu sheet |
| `frontend/src/components/RenameListSheet.jsx` | **NEW** — rename input sheet |
| `frontend/src/components/ShareListSheet.jsx` | **NEW** — share form + member list sheet |

### BottomNav.jsx change
Remove the `search` entry from the `tabs` array. Only `lists` tab remains:
```jsx
const tabs = [
  { id: 'lists', label: 'Lists', path: '/', icon: 'list' },
];
```
Active detection and render logic unchanged — no more conditional for search path.

### App.jsx change
- Remove `import SearchPage from './pages/SearchPage'`
- Remove `<Route path="/search" element={<SearchPage />} />` from the protected routes group

### ListOptionsSheet.jsx
```jsx
// Props: open (bool), onClose (() => void), isOwner (bool),
//        onRenameSelect (() => void), onShareSelect (() => void)
//
// Renders a BottomSheet with title "List Options"
// Two option rows (owner only — if !isOwner render nothing / closed sheet):
//
//   Option row structure:
//   <button className="list-option-row" onClick={...}>
//     <div className="list-option-icon"> <Icon name="..." size={22} color="..."/> </div>
//     <div className="list-option-text">
//       <span className="list-option-label">Rename list</span>
//       <span className="list-option-desc">Change the name of this list</span>
//     </div>
//     <Icon name="chevronRight" size={16} color="var(--text-disabled)" />
//   </button>
//
// Row 1: Icon "edit", label "Rename list", desc "Change the name of this list"
//   onClick → onClose(); onRenameSelect()
//
// Row 2: Icon "share", label "Share list", desc "Manage squad access"
//   onClick → onClose(); onShareSelect()
//
// CSS:
//   .list-option-row {
//     display: flex; align-items: center; gap: 14px;
//     width: 100%; background: none; border: none; border-radius: var(--radius-md);
//     padding: 14px 12px; cursor: pointer; text-align: left;
//     transition: background var(--duration-micro);
//   }
//   .list-option-row:hover { background: rgba(139,43,226,0.1) }
//   .list-option-row + .list-option-row { border-top: 1px solid rgba(255,255,255,0.05) }
//   .list-option-icon {
//     width: 40px; height: 40px; border-radius: var(--radius-md);
//     display: grid; place-items: center; flex-shrink: 0;
//   }
//   .list-option-icon-edit  { background: rgba(139,43,226,0.15) }
//   .list-option-icon-share { background: rgba(0,229,255,0.12) }
//   .list-option-text { flex: 1; min-width: 0 }
//   .list-option-label { display: block; font-weight: 600; font-size: var(--text-base); color: var(--text-primary) }
//   .list-option-desc  { display: block; font-size: var(--text-sm); color: var(--text-secondary); margin-top: 2px }
```

### RenameListSheet.jsx
```jsx
// Props: open (bool), onClose (() => void),
//        currentName (string), onRename ((newName: string) => Promise<void>)
//
// Internal state: value (string) — initialised to currentName when open becomes true (useEffect)
//
// <BottomSheet open={open} onClose={onClose} title="Rename List">
//   <input className="eg-input" value={value}
//     onChange={e => setValue(e.target.value)}
//     onKeyDown={e => e.key === 'Enter' && handleSubmit()}
//     autoFocus />
//   <div className="button-row" style={{marginTop:16}}>
//     <button className="eg-btn-ghost" style={{flex:1}} onClick={onClose}>Cancel</button>
//     <button className="eg-btn-primary" style={{flex:2}}
//       onClick={handleSubmit} disabled={!value.trim() || value.trim() === currentName}>
//       Save
//     </button>
//   </div>
// </BottomSheet>
//
// handleSubmit: if value.trim() && value.trim() !== currentName →
//   await onRename(value.trim()); onClose()
//
// useEffect([open]): when open changes to true → setValue(currentName)
```

### ShareListSheet.jsx
```jsx
// Props: open (bool), onClose (() => void),
//        members ([{user_id, display_name, email, is_owner, is_pending_sync}]),
//        shareEmail (string), shareError (string), isSharingLoading (bool),
//        onEmailChange ((email: string) => void),
//        onShareSubmit ((event) => void),
//        onRevoke ((memberId: string) => void)
//
// <BottomSheet open={open} onClose={onClose} title="Share List">
//
//   {/* Share-by-email form */}
//   <form onSubmit={onShareSubmit} style={{display:'grid',gap:8,marginBottom:16}}>
//     <label className="eg-field">
//       <span style={{color:'var(--text-secondary)',fontSize:'var(--text-sm)',fontWeight:600}}>
//         Add member by email
//       </span>
//       <input className="eg-input" type="email" placeholder="alex@example.com"
//         value={shareEmail} onChange={e => onEmailChange(e.target.value)} />
//     </label>
//     <button className="eg-btn-secondary" type="submit">Add Member</button>
//   </form>
//
//   {shareError && <div className="eg-error-banner" style={{marginBottom:8}}>{shareError}</div>}
//
//   {/* Member list */}
//   <div className="share-sheet-members-label eg-orbitron">
//     SQUAD ({members.length})
//   </div>
//   {isSharingLoading && <LoadingState rows={2} />}
//   {!isSharingLoading && members.map(m => (
//     <div key={m.user_id} className="member-row">
//       <div>
//         <div style={{fontWeight:600,color:'var(--text-primary)',fontSize:'var(--text-base)'}}>
//           {m.display_name}
//         </div>
//         <div style={{fontSize:'var(--text-sm)',color:'var(--text-secondary)'}}>{m.email}</div>
//       </div>
//       <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
//         <span className={m.is_owner ? 'eg-chip-purple' : 'eg-chip-cyan'} style={{fontSize:11}}>
//           {m.is_owner ? 'Owner' : 'Member'}
//         </span>
//         {m.is_pending_sync && <span className="eg-chip-queued" style={{fontSize:11}}>Queued</span>}
//         {!m.is_owner && (
//           <button className="eg-btn-danger" style={{fontSize:13,padding:'6px 12px'}}
//             onClick={() => void onRevoke(m.user_id)}>
//             Revoke
//           </button>
//         )}
//       </div>
//     </div>
//   ))}
// </BottomSheet>
//
// CSS:
//   .share-sheet-members-label {
//     font-size: var(--text-xs); letter-spacing: 0.1em; color: var(--text-secondary);
//     padding: 8px 0 6px; border-top: 1px solid rgba(255,255,255,0.06);
//     margin-top: 8px;
//   }
```

### ListDetailPage.jsx changes

**State changes:**
- Remove: `isSharingOpen` (bool)
- Add:
  ```jsx
  const [showOptions, setShowOptions] = useState(false);
  const [showRename, setShowRename]   = useState(false);
  const [showShare, setShowShare]     = useState(false);
  ```

**Rename handler** (new, uses existing `renameList` API):
```jsx
async function handleRename(newName) {
  try {
    setEntryError('');
    const result = await renameList(id, token, { name: newName });
    setList(currentList => ({
      ...currentList,
      name: result?.queued ? newName : result.list?.name ?? newName
    }));
  } catch (err) {
    setEntryError(err.message);
  }
}
```
Import `renameList` from `'../api/lists'`.

**TopBar actions** (replace existing share action):
```jsx
actions={list?.is_owner ? [{
  ariaLabel: 'List options',
  icon: <Icon name="moreVertical" size={20} color="var(--text-secondary)" />,
  onClick: () => setShowOptions(true)
}] : []}
```

**Remove from JSX:**
- The entire inline `{list?.is_owner && isSharingOpen ? (<SharingPanel ... />) : null}` block
- The `SharingPanel` function definition at the bottom of the file

**Add to JSX (after `<AddItemSheet>`)**:
```jsx
<ListOptionsSheet
  open={showOptions}
  onClose={() => setShowOptions(false)}
  isOwner={list?.is_owner ?? false}
  onRenameSelect={() => setShowRename(true)}
  onShareSelect={() => setShowShare(true)}
/>
<RenameListSheet
  open={showRename}
  onClose={() => setShowRename(false)}
  currentName={list?.name ?? ''}
  onRename={handleRename}
/>
<ShareListSheet
  open={showShare}
  onClose={() => setShowShare(false)}
  members={members}
  shareEmail={shareEmail}
  shareError={shareError}
  isSharingLoading={isSharingLoading}
  onEmailChange={setShareEmail}
  onShareSubmit={handleShareSubmit}
  onRevoke={handleRevokeMember}
/>
```

**Imports to add:**
```jsx
import { renameList } from '../api/lists';
import ListOptionsSheet from '../components/ListOptionsSheet';
import RenameListSheet from '../components/RenameListSheet';
import ShareListSheet from '../components/ShareListSheet';
```

### New CSS classes (index.css)
```css
/* Already covered by existing .member-row class from T-005.
   New additions: */

.list-option-row {
  display: flex; align-items: center; gap: 14px;
  width: 100%; background: none; border: none; border-radius: var(--radius-md);
  padding: 14px 12px; cursor: pointer; text-align: left;
  transition: background var(--duration-micro);
}
.list-option-row:hover { background: rgba(139,43,226,0.1) }
.list-option-row + .list-option-row {
  border-top: 1px solid rgba(255,255,255,0.05);
}
.list-option-icon {
  width: 40px; height: 40px; border-radius: var(--radius-md);
  display: grid; place-items: center; flex-shrink: 0;
}
.list-option-icon-edit  { background: rgba(139,43,226,0.15) }
.list-option-icon-share { background: rgba(0,229,255,0.12) }
.list-option-text { flex: 1; min-width: 0 }
.list-option-label {
  display: block; font-weight: 600; font-size: var(--text-base); color: var(--text-primary);
}
.list-option-desc {
  display: block; font-size: var(--text-sm); color: var(--text-secondary); margin-top: 2px;
}
.share-sheet-members-label {
  font-size: var(--text-xs); letter-spacing: 0.1em; color: var(--text-secondary);
  padding: 8px 0 6px; border-top: 1px solid rgba(255,255,255,0.06); margin-top: 8px;
}
```

### Validation
- `npm run lint`
- `npm run build`
- `npm test`

### Commit message
`feat(ui): replace list detail share button with options flyout and add rename`

---

## T-008 — E2E Tests: Shopping List CRUD

### Objective
Add four Playwright end-to-end tests covering the core shopping-list flows: create list, add item, delete item (swipe), and mark item as done. Also fix two existing `auth.spec.js` assertions that reference old overview copy removed in T-004.

### Files to change / create

| File | Action |
|------|--------|
| `e2e/lists.spec.js` | **NEW** — 4 shopping list E2E tests |
| `e2e/auth.spec.js` | Fix 2 broken `getByText("No lists yet…")` assertions |

### Context: available selectors (no component changes needed)

| Element | Locator |
|---------|---------|
| FAB (overview + detail) | `getByRole("button", { name: "Add" })` — `aria-label="Add"` already set |
| NewListSheet input | `getByLabel("New list")` — `<label htmlFor="new-list-sheet-name">New list</label>` |
| NewListSheet submit | `getByRole("button", { name: "Create list" })` |
| AddItemSheet input | `getByLabel("Add item")` — `<label htmlFor="add-item-sheet-text">Add item</label>` |
| AddItemSheet submit | `getByRole("button", { name: "Add Item" })` |
| Toggle-done button | `getByRole("button", { name: "Mark {text} done" })` — dynamic aria-label |
| Toggle-open button | `getByRole("button", { name: "Mark {text} open" })` |
| Entry row (normal) | `.entry-row` — also has `data-testid="entry-row-{id}"` |
| Entry row (done) | `.entry-row.entry-row-done` |
| Done text | `.entry-row-text-done` containing the item text |
| Auth token key | `"endgame_grocery.auth_token"` in `localStorage` |

### auth.spec.js fix

Two tests check for the old combined overview copy string that no longer exists after T-004:

```js
// OLD — fails: EmptyState renders title and body in separate elements
await expect(page.getByText("No lists yet. Create one to get started.")).toBeVisible();

// NEW — matches the EmptyState title element
await expect(page.getByText("No lists yet")).toBeVisible();
```

Both occurrences (in the "registers a new user" test and the "logs in an existing user" test) must be updated.

### lists.spec.js — full implementation

```js
import { expect, test } from "@playwright/test";

const STORAGE_KEY = "endgame_grocery.auth_token";
const TEST_PASSWORD = "password123";

function uniqueEmail(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@e2e.test`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Register a user via API, log in via API, inject the JWT into localStorage
 * and navigate to the overview. Returns the token for subsequent API calls.
 */
async function setupLoggedInUser(page, request) {
  const email = uniqueEmail("lists");

  const regRes = await request.post("/api/auth/register", {
    data: { display_name: "List Tester", email, password: TEST_PASSWORD }
  });
  expect(regRes.ok()).toBeTruthy();

  const loginRes = await request.post("/api/auth/login", {
    data: { email, password: TEST_PASSWORD }
  });
  expect(loginRes.ok()).toBeTruthy();
  const { token } = await loginRes.json();

  // Navigate to the app origin first, inject the token, then reload
  // so the AuthProvider reads it and renders the protected overview.
  await page.goto("/");
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: STORAGE_KEY, value: token }
  );
  await page.goto("/");
  await page.waitForURL("/");

  return { token };
}

/** Create a shopping list via API. Returns the created list object. */
async function createListByApi(request, token, name) {
  const res = await request.post("/api/lists", {
    data: { name },
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).list;
}

/** Create an entry on a list via API. Returns the created entry object. */
async function createEntryByApi(request, token, listId, text) {
  const res = await request.post(`/api/lists/${listId}/entries`, {
    data: { text },
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).entry;
}

/**
 * Simulate a left swipe on the entry row containing `entryText` by dispatching
 * synthetic TouchEvents. The swipe distance (95 px) exceeds the 80 px delete
 * threshold in EntryRow's handleTouchEnd.
 */
async function swipeEntryLeft(page, entryText) {
  const row = page.locator(".entry-row").filter({ hasText: entryText });
  const box = await row.boundingBox();

  await row.evaluate(
    (el, { sx, ex, y }) => {
      const makeTouch = (x) =>
        new Touch({
          identifier: 1,
          target: el,
          clientX: x,
          clientY: y,
          radiusX: 1,
          radiusY: 1,
          rotationAngle: 0,
          force: 1
        });

      el.dispatchEvent(
        new TouchEvent("touchstart", {
          bubbles: true,
          cancelable: true,
          touches: [makeTouch(sx)],
          changedTouches: [makeTouch(sx)]
        })
      );
      el.dispatchEvent(
        new TouchEvent("touchmove", {
          bubbles: true,
          cancelable: true,
          touches: [makeTouch(ex)],
          changedTouches: [makeTouch(ex)]
        })
      );
      el.dispatchEvent(
        new TouchEvent("touchend", {
          bubbles: true,
          cancelable: true,
          touches: [],
          changedTouches: [makeTouch(ex)]
        })
      );
    },
    {
      sx: box.x + box.width - 20,  // start near right edge
      ex: box.x + box.width - 115, // end 95 px to the left (> 80 px threshold)
      y: box.y + box.height / 2
    }
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("shopping lists", () => {

  test("creates a new shopping list", async ({ page, request }) => {
    await setupLoggedInUser(page, request);

    const listName = `Mission ${Date.now()}`;

    // Open NewListSheet via FAB
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText("New List")).toBeVisible();

    // Fill name and submit
    await page.getByLabel("New list").fill(listName);
    await page.getByRole("button", { name: "Create list" }).click();

    // List card with the new name appears on the overview
    await expect(page.getByText(listName)).toBeVisible();
  });

  test("adds an item to a shopping list", async ({ page, request }) => {
    const { token } = await setupLoggedInUser(page, request);
    const list = await createListByApi(request, token, "Avengers Pantry");

    await page.goto(`/lists/${list.id}`);

    const itemText = `Mjolnir ${Date.now()}`;

    // Open AddItemSheet via FAB
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText("Add Item")).toBeVisible();

    await page.getByLabel("Add item").fill(itemText);
    await page.getByRole("button", { name: "Add Item" }).click();

    // Entry row with the item text appears
    await expect(page.getByText(itemText)).toBeVisible();
  });

  test("deletes an item from a shopping list via swipe", async ({ page, request }) => {
    const { token } = await setupLoggedInUser(page, request);
    const list = await createListByApi(request, token, "Quantum Realm Groceries");
    const itemText = `Pym Particles ${Date.now()}`;
    await createEntryByApi(request, token, list.id, itemText);

    await page.goto(`/lists/${list.id}`);

    // Entry is visible before deletion
    await expect(page.getByText(itemText)).toBeVisible();

    // Swipe left past the 80 px threshold to trigger deletion
    await swipeEntryLeft(page, itemText);

    // Entry is no longer rendered
    await expect(page.getByText(itemText)).not.toBeVisible();
  });

  test("marks an item as done in a shopping list", async ({ page, request }) => {
    const { token } = await setupLoggedInUser(page, request);
    const list = await createListByApi(request, token, "Endgame Checklist");
    const itemText = `Infinity Stone ${Date.now()}`;
    await createEntryByApi(request, token, list.id, itemText);

    await page.goto(`/lists/${list.id}`);

    // Toggle button starts with "Mark … done" label (item is open)
    const toggleBtn = page.getByRole("button", { name: `Mark ${itemText} done` });
    await expect(toggleBtn).toBeVisible();

    await toggleBtn.click();

    // Label flips to "open" → item is in done state
    await expect(
      page.getByRole("button", { name: `Mark ${itemText} open` })
    ).toBeVisible();

    // Text has the done (strikethrough) class applied
    await expect(
      page.locator(".entry-row-text-done", { hasText: itemText })
    ).toBeVisible();
  });

});
```

### Validation
- `npm run e2e` — all 9 tests pass (5 existing auth + 4 new lists)

### Commit message
`test(e2e): add shopping list CRUD end-to-end tests`

---

## Cross-cutting notes

### OfflineBanner
Update `frontend/src/components/OfflineBanner.jsx` to use `eg-offline-banner` and `eg-error-banner` CSS classes instead of the old light-theme variants. Logic unchanged.

### app.test.jsx
The smoke test renders `<App />`. After T-001 the `BottomNav` uses `useLocation`. Ensure test already wraps `<App />` in a `MemoryRouter` or that the existing test setup handles this. If the test fails due to router context, add a `MemoryRouter` wrapper in the test.

### Existing light-theme CSS classes
Old classes (`.button-primary`, `.button-secondary`, `.field`, `.pill`, etc.) in `index.css` may be left as non-conflicting stubs until all pages are fully migrated. They will be visually overridden once all pages switch to `eg-*` classes.

---

## T-009 — Spacing-scale tokens & consistency fixes

### Objective
Introduce a formal 4-px-based spacing scale in `tokens.css` and fix eleven specific spacing inconsistencies found in the full-app audit. No layout changes — only padding, margin, gap, and border-radius corrections.

Approach chosen: **Option B** — add spacing custom properties to `tokens.css` and update the specific properties in `index.css`. Tailwind was evaluated but rejected for this cycle due to migration cost across 20+ JSX files and complex neon gradient arbitrary-value requirements.

### Files to change

| File | Action |
|------|--------|
| `frontend/src/styles/tokens.css` | Add `--space-*` scale |
| `frontend/src/index.css` | Fix 11 spacing properties |

### tokens.css — spacing scale to append inside `:root`

```css
  /* Spacing scale (4px base grid) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
```

### index.css — 11 targeted fixes

| Selector | Property | Old value | New value | Rationale |
|----------|----------|-----------|-----------|-----------|
| `.loading-state` | `padding` | `16px` | `0` | LoadingState is already centered via flex parent; padding creates asymmetric gap |
| `.bottom-sheet` | `padding` | `20px 20px 48px` | `var(--space-5) var(--space-4) var(--space-12)` | Align horizontal padding to 16px grid; 48px bottom keeps FAB clearance |
| `.list-card-name` | `margin-bottom` | `10px` | `var(--space-2)` | 8px matches 4px grid |
| `.member-row` | `padding` | `10px 0` | `var(--space-3) 0` | 12px matches 4px grid |
| `.list-option-row` | `padding` | `14px 12px` | `var(--space-3)` | Uniform 12px all sides for touch target |
| `.overview-toggle` | `padding` | `0 16px 14px` | `0 var(--space-4) var(--space-3)` | Bottom drops to 12px grid value |
| `.share-sheet-members-label` | `padding` | `8px 0 6px` | `var(--space-2) 0` | Symmetric 8px top/bottom |
| `.entry-row-edit-actions` | `margin-top` | `4px` | `0` | Parent `.entry-row-edit` already has `gap: 12px`; the extra 4px pushes total to 16px inconsistently |
| `.auth-logo` | `border-radius` | `10px` | `var(--radius-md)` | Use token instead of magic number |
| `.overview-logo` | `border-radius` | `10px` | `var(--radius-md)` | Use token instead of magic number |
| `.field, .eg-field` | `gap` | `0.4rem` | `6px` | Explicit pixel value on 4px-adjacent grid |

### Validation
- `npm run lint` — passes
- `npm run build` — passes
- `npm test` — passes (spacing fixes are CSS-only, no test assertions change)

### Commit message
`fix(ui): add spacing-scale tokens and fix spacing inconsistencies`

---

## T-010 — List detail section spacing fixes

### Objective
Fix two visual spacing gaps on the list detail page reported after T-009:
1. No gap between the Open Items card and the Done card.
2. No internal spacing between the "DONE" collapse header and the first entry row inside that card.

No layout restructuring — two targeted CSS additions in `index.css`.

### Files to change

| File | Action |
|------|--------|
| `frontend/src/index.css` | Add 2 CSS rules |

### index.css — 2 targeted additions

**Fix 1 — gap between section cards**

The two `<section className="entry-section">` elements are direct siblings inside the JSX fragment. No margin separates them. Use the adjacent-sibling combinator so the rule only fires when a second section follows the first (not on a standalone section):

```css
.entry-section + .entry-section {
  margin-top: var(--space-4); /* 16px between Open Items card and Done card */
}
```

**Fix 2 — space between Done header button and first entry**

`.entry-section-collapse` must remain `padding: 0` on all sides so that when the Done card is **collapsed** the section's own `padding: 1.25rem` produces symmetric spacing (20 px) on all four sides.

Adding `padding-bottom` to the button directly causes asymmetry in the collapsed state (20 px top vs 32 px bottom) — do **not** use that approach.

Instead, target the first entry row that immediately follows the collapse button with the adjacent-sibling combinator. This `margin-top` is only active when entries are actually rendered below the button (expanded state); it has no effect in the collapsed state:

```css
/* entry-section-collapse padding stays at 0 */

.entry-section-collapse + .entry-row-wrapper {
  margin-top: var(--space-3); /* 12px gap — only when entries are shown below the DONE header */
}
```

⚠️ **Known rework target**: The initial implementation used `padding: 0 0 var(--space-3)` on `.entry-section-collapse`, which breaks the collapsed-state symmetry. The implementer must revert that padding to `padding: 0` and add the `.entry-section-collapse + .entry-row-wrapper` rule instead.

### Validation
- `npm run lint` — passes
- `npm run build` — passes
- `npm test` — passes (CSS-only, no test assertions change)

### Commit message
`fix(ui): add gap between list detail section cards and done header spacing`
