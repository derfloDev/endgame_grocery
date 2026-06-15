# ROADMAP

Goal: Zwei UX-Verbesserungen auf der Einkauflisten-Detailseite.

## Priority 1 — Suchfunktion (Filter)

Objective: Nutzer können schnell prüfen, ob ein Artikel bereits auf der Liste steht.

- Auf der `ListDetailPage` erscheint direkt unter der Abschnittsüberschrift „OFFENE ARTIKEL" eine immer sichtbare Suchleiste.
- Bei Texteingabe werden die **offenen Einträge** nach Name (`entry.text`) und Details (`entry.details`) gefiltert (case-insensitive, enthält-Suche).
- Der Abschnitt „Zuletzt verwendet" (`RecentlyUsedSection`) wird nicht gefiltert.
- Wenn die Suche keine Ergebnisse liefert, zeigt ein spezifischer `EmptyState` einen passenden Hinweis (abweichend vom „Alles erledigt"-Text).
- Das Suchfeld lässt sich leeren (Clear-Button oder natives Input-Reset).
- i18n-Strings werden für `de` und `en` gepflegt.
- Bestehende Tests für `ListDetailPage` bleiben grün; neue Tests decken Filter-Logik und den leeren Suchzustand ab.

## Priority 2 — Swipe-Fix (ungewolltes Öffnen beim Scrollen)

Objective: Vertikales Scrollen auf der Einkaufliste öffnet keine Einträge mehr.

- Im `useLongPress`-Hook wird ein `onTouchMove`-Handler ergänzt, der die vertikale Touch-Verschiebung trackt.
- Überschreitet die vertikale Verschiebung einen Schwellenwert (≥ 8 px), gilt die Geste als Scroll:
  - Der Long-Press-Timer wird abgebrochen.
  - Ein internes Flag verhindert, dass das nachfolgende synthetische `click`-Event `onToggle` auslöst.
- Horizontales Scrollen (z. B. seitliches Wischen) hat keinen Einfluss auf das Toggle-Verhalten.
- Bestehende Tests für `useLongPress` bleiben grün; neue Tests belegen das Scroll-Abbruchverhalten.
