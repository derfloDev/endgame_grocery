# Plan

Status: **ready_for_implement**

Goal: Zwei UX-Verbesserungen auf der Einkauflisten-Detailseite — Suchfunktion (T-001) und Swipe-Fix (T-002).

---

## T-001 — Suchfunktion (Filter) auf der ListDetailPage

### Scope
Eine immer sichtbare Suchleiste direkt unter der Abschnittsüberschrift „OPEN ITEMS" filtert die offenen Einträge nach Name und Details. Der „Zuletzt verwendet"-Bereich bleibt ungefiltert.

### Acceptance Criteria
- Suchleiste ist ohne Interaktion sichtbar (kein Toggle-Button nötig).
- Eingabe filtert `openEntries` case-insensitiv per Enthält-Suche auf `entry.text` und `entry.details`.
- Bei leerem Suchergebnis erscheint ein eigener `EmptyState` mit Suche-spezifischem Text.
- Suchfeld kann per nativen Clear-Button (type="search") geleert werden.
- i18n-Schlüssel sind in `en` und `de` hinterlegt.
- Bestehende Tests bleiben grün.
- `pageSource.split(/\r?\n/).length < 400` bleibt erfüllt.

### Files to Change

| File | Change |
|------|--------|
| `frontend/src/pages/ListDetailPage/ListDetailPage.tsx` | `searchQuery` State; `visibleEntries` gefiltert; Such-Input-Element + bedingter EmptyState |
| `frontend/src/pages/ListDetailPage/ListDetailPage.module.css` | Stile für `.detail-search` (Input-Wrapper + Input) |
| `frontend/src/locales/en/translation.json` | Neue Schlüssel: `detail.searchPlaceholder`, `detail.noSearchResultsTitle`, `detail.noSearchResults` |
| `frontend/src/locales/de/translation.json` | Gleiche Schlüssel auf Deutsch |
| `frontend/src/pages/ListDetailPage.test.tsx` | Neue Tests: Filter-Logik, Such-EmptyState, Löschen des Suchbegriffs |

### Implementation Notes

**State & Filter-Logik** (in `ListDetailPage.tsx`):
```ts
const [searchQuery, setSearchQuery] = useState<string>("");

const filteredEntries = searchQuery.trim()
  ? openEntries.filter((e) =>
      e.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.details ?? "").toLowerCase().includes(searchQuery.toLowerCase())
    )
  : openEntries;

const visibleEntries = filteredEntries; // ersetzt bisherige Zeile
```

**Such-Input** (innerhalb `<section className="entry-section">`):
- `<input type="search">` mit `placeholder={t("detail.searchPlaceholder")}` und `aria-label`
- `value={searchQuery}` + `onChange={(e) => setSearchQuery(e.target.value)}`
- Platzierung: nach dem `<div className="entry-section-header">`, vor dem Grid

**Bedingter EmptyState**:
```tsx
{filteredEntries.length === 0 ? (
  searchQuery.trim()
    ? <EmptyState body={t("detail.noSearchResults")} title={t("detail.noSearchResultsTitle")} />
    : <EmptyState body={t("detail.noOpenItems")} title={t("detail.allClearTitle")} />
) : (
  <div className={styles["entry-tile-grid"]} ...>…</div>
)}
```

**i18n-Schlüssel**:
```json
// en
"detail.searchPlaceholder": "Search items…",
"detail.noSearchResultsTitle": "No matches",
"detail.noSearchResults": "No items match your search."

// de
"detail.searchPlaceholder": "Artikel suchen…",
"detail.noSearchResultsTitle": "Keine Treffer",
"detail.noSearchResults": "Kein Artikel entspricht deiner Suche."
```

**CSS** (`.detail-search` in `ListDetailPage.module.css`):
```css
.detail-search {
  width: 100%;
  padding: 8px 12px;
  margin-bottom: 10px;
  border: 1px solid rgba(139, 43, 226, 0.25);
  border-radius: var(--radius-md);
  background: var(--bg-raised);
  color: var(--text-primary);
  font: inherit;
  font-size: 0.875rem;
}
.detail-search:focus {
  outline: none;
  border-color: rgba(0, 229, 255, 0.4);
}
```

**Neue Tests** in `frontend/src/pages/ListDetailPage.test.tsx`:
1. Suchfeld ist sichtbar wenn Einträge geladen sind.
2. Filtert Einträge nach Name (case-insensitiv).
3. Filtert Einträge nach Details.
4. Zeigt Such-EmptyState wenn keine Treffer.
5. Zeigt alle Einträge wieder nach Leeren des Suchfelds.

---

## T-002 — Swipe-Fix: Vertikales Scrollen öffnet keine EntryTiles mehr

### Scope
Im `useLongPress`-Hook wird ein `onTouchMove`-Handler ergänzt, der die vertikale Verschiebung trackt. Bei ≥ 8 px Verschiebung wird der Timer abgebrochen und ein Flag gesetzt, das das nachfolgende synthetische `click`-Event blockiert.

### Acceptance Criteria
- Vertikales Wischen (δY ≥ 8 px) löst weder `onToggle` noch `onLongPress` aus.
- Kurzes Antippen (`touchStart` + `touchEnd` ohne Bewegung) löst `onToggle` wie bisher aus.
- Langes Drücken (≥ 500 ms ohne Bewegung) löst `onLongPress` wie bisher aus.
- Horizontale Bewegung (δX groß, δY < 8 px) blockiert Toggle nicht.
- Bestehende Tests in `useLongPress.test.tsx` bleiben grün.

### Files to Change

| File | Change |
|------|--------|
| `frontend/src/hooks/useLongPress.ts` | `touchStartYRef` + `scrollBlockedRef` Refs; `onTouchStart` nimmt `React.TouchEvent`; neuer `onTouchMove(event: React.TouchEvent)`; `handleClick` prüft `scrollBlockedRef`; `cancel()` setzt beide Refs zurück |
| `frontend/src/hooks/useLongPress.test.tsx` | Neue Tests: Scroll-Abbruch, Scroll-blockiert-Click |

### Implementation Notes

**Neue Refs**:
```ts
const touchStartYRef = useRef<number | null>(null);
const scrollBlockedRef = useRef(false);
```

**Geänderte `start`-Signatur** (nur für Touch-Pfad):
```ts
function startTouch(event: React.TouchEvent): void {
  touchStartYRef.current = event.touches[0]?.clientY ?? null;
  scrollBlockedRef.current = false;
  start(); // bestehende Timer-Logik bleibt unverändert
}
```

**Neuer `onTouchMove`-Handler**:
```ts
function handleTouchMove(event: React.TouchEvent): void {
  if (touchStartYRef.current === null) return;
  const deltaY = Math.abs((event.touches[0]?.clientY ?? touchStartYRef.current) - touchStartYRef.current);
  if (deltaY >= 8) {
    scrollBlockedRef.current = true;
    cancel();
  }
}
```

**Erweiterter `handleClick`**:
```ts
function handleClick(event: MouseEvent): void {
  if (longPressedRef.current || scrollBlockedRef.current) {
    event.preventDefault();
    event.stopPropagation();
    longPressedRef.current = false;
    scrollBlockedRef.current = false;
  }
}
```

**Erweitertes `cancel()`**:
```ts
function cancel(): void {
  setPressing(false);
  touchStartYRef.current = null;
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current);
  }
  timerRef.current = null;
}
```

**Aktualisiertes Interface**:
```ts
interface LongPressHandlers {
  onMouseDown: () => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onTouchStart: (event: React.TouchEvent) => void;  // war () => void
  onTouchEnd: () => void;
  onTouchCancel: () => void;
  onTouchMove: (event: React.TouchEvent) => void;   // NEU
  onClick: (event: MouseEvent) => void;
}
```

**Rückgabe**:
```ts
longPressHandlers: {
  onMouseDown: start,
  onMouseLeave: cancel,
  onMouseUp: cancel,
  onTouchCancel: cancel,
  onTouchEnd: cancel,
  onTouchStart: startTouch,   // geändert
  onTouchMove: handleTouchMove, // neu
  onClick: handleClick
}
```

**Neue Tests** in `useLongPress.test.tsx`:
1. Vertikales Wischen (δY ≥ 8 px) nach touchStart ruft `onLongPress` nicht auf.
2. Vertikales Wischen gefolgt von einem Click-Event ruft `onToggle`/`onClick` nicht auf.
3. Kurze Bewegung (δY < 8 px) blockiert Toggle nicht.

---

## Validation
- `npm run lint`
- `npm run build`
- `npm test`
