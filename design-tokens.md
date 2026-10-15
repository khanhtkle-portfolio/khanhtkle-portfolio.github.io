# Design tokens

Source: one 1920×869 screenshot of a theme-editor UI. No live page was available, so
nothing here is a computed style. Colors are sampled pixel values; sizes are pixel
measurements of the screenshot (1 screenshot px ≈ 1 CSS px). Font family and type
sizes are inferred from glyph shapes and cap height. No text, logo or images were copied.

## Color

| Token | Value | Where it appears |
|---|---|---|
| `--bg` (canvas) | `#f2f1ee` | Page background behind panels (warm light gray) |
| `--surface` | `#fdfdfc` | Top bar, panels, buttons (warm near-white) |
| `--surface-2` | `#fbfaf9` | Side rail, recessed areas |
| `--line` | `#deddd9` | Every border and divider, 1px |
| `--ink` | `#1a1a18` | Titles, primary text (near-black, slightly warm) |
| `--muted` | `#6b6a66` | Descriptions, labels, secondary text |
| `--accent` | `#3b82f6` | Single saturated color, used only for focus and active states |
| `--inverse` | `#000000` / `#ffffff` | Small solid badge (black fill, white text) |

Rule: the UI is monochrome warm gray. Color appears only in content, never in chrome.

## Typography

- Family: neutral grotesque sans (Inter-like). Used here: **Inter**, fallback `system-ui`.
- Top bar title: ~18px, weight 500, line-height 1.2, ink. Cap height measured at 12px.
- Button label: ~15px, weight 500.
- Section label / description: ~14px, weight 400, muted.
- Panel heading: ~17px, weight 600.
- Tight tracking on larger sizes (-0.01em to -0.02em); no uppercase, no letter-spaced labels.

## Top bar (the part to match exactly)

- Height 49px content + 1px bottom border `--line` (50px total), full width, background `--surface`.
- Single row, items vertically centered, no shadow.
- Back chevron `<`: 6px wide × 12px tall glyph, 1.5px stroke, at x = 30px from the left
  (inside a 36px hit area centered at x = 33).
- Title starts at x = 72px, so the gap between chevron and title is ~36px.
- Right action: height 37px (y 6 → 42), 1px border `--line`, radius 6px, background `--surface`,
  horizontal padding ~12px, right margin ~15px. Label 15px / 500.
  The language toggle sits in this slot.

## Spacing

- Base unit 4px; common steps 8 / 12 / 16 / 24.
- Rail/panel inner padding: 16px; stack gap between labelled groups: ~24px.
- Label-to-control gap: 8px. Control height 30px (dropdown chips), 37px (top-bar button).

## Radius

- Chips and controls: 6–8px. Panels and cards: 8–12px. Badge: 4px. Avatars/round buttons: 50%.

## Shadow

- None. Depth comes only from the 1px `#deddd9` borders and the canvas/surface color step
  (`#f2f1ee` → `#fdfdfc`). Hover states change border color, not elevation.

## Section rhythm

- Chrome (top bar, rail) is white-ish with hairline borders; the content area is the warm
  canvas, and content sits in white bordered panels on it.
- Vertical rhythm is compact: 24px between groups, 12px inside groups.

## Applied in this site

- Product name: **Sightline**. `css/style.css` defines these tokens as `:root` variables. No dark theme, no banner above the top bar.
- Flow: `login.html` (one headline, one paragraph, three sample reports, guest entry; Microsoft sign-in shown
  greyed out and disabled) → `index.html` → `report.html`. Inner pages redirect to login until a guest session exists.
- The VI | EN switch exists only on the login page. After sign-in it lives in the user menu, with shortcuts,
  glossary, about and sign out.
- Top bar on inner pages: brand mark + name + tagline (home) or back chevron + report title (report page),
  notification bell with unread count, user chip.
- Home left rail: search, library (all, pinned, recent) and departments, each with an icon, count and its
  reports listed underneath as direct links; "Request a report" pinned to the bottom.
- Cards show only the department, page count, title and full summary.
- Report page: does not scroll. Corner tools: share link (paperclip), download, fullscreen. Pager on its own
  surface: 112×70px thumbnails scrolling horizontally, page counter on the right at the same height.
- Added tokens: `--star`, `--danger` / `--danger-bg`, `--pop-shadow` (warm tinted, menus and dialogs only).
- Icons: Phosphor Icons (regular weight, MIT licence, https://phosphoricons.com), copied as inline SVG into `ICONS` in `js/app.js`. The back chevron and the Sightline mark are custom.

## Text case

- Sentence case for every UI string: headings, buttons, menu items, labels ("Request a report", "Last viewed").
- Capitals only where they are part of the word: the product name Sightline, language codes VI and EN,
  acronyms and department names that are proper nouns.
- No all-caps labels and no Title Case headings.

## Report page additions

- Top bar mirrors the home page: a 28px box at the same x position as the Sightline mark (here it is the back
  chevron), then the report title in the same weight, a divider and the department name. The title opens a
  list to switch reports. An info button opens "About this report" (summary and the questions it answers).
- Zoom 100–300% with the corner controls, the + - 0 keys or a double click; drag to pan. The page itself never scrolls.
- Pin uses the push-pin icon everywhere (outline = not pinned, filled = pinned).
