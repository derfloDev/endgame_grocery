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

## T-006 — Search Page

### Objective
Implement a client-side Search screen accessible from the bottom nav Search tab.

### Files to create / change

| File | Action |
|------|--------|
| `frontend/src/pages/SearchPage.jsx` | NEW (replace stub from T-001) |

### SearchPage.jsx — full implementation
```jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchLists } from '../api/lists';
import { useAuth } from '../context/AuthContext';
import { Icon, EmptyState, LoadingState, ErrorState } from '../components/ui';
import ListCardHome from '../components/ListCardHome';

export default function SearchPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [lists, setLists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError('');
    fetchLists(token)
      .then(r => { if (isMounted) setLists(r.lists ?? []); })
      .catch(e => { if (isMounted) setError(e.message); })
      .finally(() => { if (isMounted) setIsLoading(false); });
    return () => { isMounted = false; };
  }, [token]);

  const filtered = query.trim()
    ? lists.filter(l =>
        l.name.toLowerCase().includes(query.trim().toLowerCase())
      )
    : [];

  return (
    <div style={{ paddingBottom: 120 }}>

      {/* Header */}
      <div className="overview-topbar">
        <div className="eg-orbitron"
          style={{ fontSize:18, fontWeight:700, color:'var(--text-primary)', letterSpacing:'0.04em' }}>
          SEARCH
        </div>
      </div>

      {/* Search input with icon */}
      <div style={{ padding:'0 16px 16px', position:'relative' }}>
        <span style={{ position:'absolute', left:28, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', display:'flex' }}>
          <Icon name="search" size={18} color="var(--text-secondary)" />
        </span>
        <input
          className="eg-input"
          style={{ paddingLeft:44 }}
          placeholder="Search your lists…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {/* Results */}
      <div style={{ padding:'0 16px' }}>
        {error && <ErrorState onRetry={() => { setError(''); setIsLoading(true); }} />}
        {isLoading && <LoadingState rows={3} />}
        {!isLoading && !error && !query.trim() && (
          <EmptyState title="Find your lists" body="Start typing to search by list name." />
        )}
        {!isLoading && !error && query.trim() && filtered.length === 0 && (
          <EmptyState title="No results" body={`No lists match "${query}".`} />
        )}
        {!isLoading && !error && filtered.map(list => (
          <ListCardHome
            key={list.id}
            list={list}
            onOpen={() => navigate(`/lists/${list.id}`)}
            onRename={() => {}}
            onDelete={() => {}}
          />
        ))}
      </div>
    </div>
  );
}
```

### Validation
- `npm run lint`
- `npm run build`
- `npm test`

### Commit message
`feat(ui): add client-side search page`

---

## Cross-cutting notes

### OfflineBanner
Update `frontend/src/components/OfflineBanner.jsx` to use `eg-offline-banner` and `eg-error-banner` CSS classes instead of the old light-theme variants. Logic unchanged.

### app.test.jsx
The smoke test renders `<App />`. After T-001 the `BottomNav` uses `useLocation`. Ensure test already wraps `<App />` in a `MemoryRouter` or that the existing test setup handles this. If the test fails due to router context, add a `MemoryRouter` wrapper in the test.

### Existing light-theme CSS classes
Old classes (`.button-primary`, `.button-secondary`, `.field`, `.pill`, etc.) in `index.css` may be left as non-conflicting stubs until all pages are fully migrated. They will be visually overridden once all pages switch to `eg-*` classes.
