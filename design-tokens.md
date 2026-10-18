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

- Product name: **Sightline**. Tokens live in `css/style.css` as `:root` variables. No dark theme, no banner.
- `--ctl: 37px` is the one size for every square control in the top bar: notifications, quick find, tools, avatar.
  The user is only an avatar box; the name, role, language, help and sign out are in its menu.
- Flow: `login.html` → `index.html` → `report.html`. A sample session lasts 8 hours and is stored in
  localStorage, so opening a report in a new tab (Ctrl+click) stays signed in.
- Login: headline and paragraph vertically centred on the left, an animated abstract chart (breathing bars, a
  trend line that draws itself, a dot that follows it) at the bottom. Both entry buttons share one mould
  (44px, 15px/500, centred); Microsoft is greyed out and disabled.
- Home: brand mark + name + tagline, quick find, bell, avatar. Left rail with search, library, saved pages and
  departments (each with its reports). Cards show department, page count, title and the full summary.
- Report page: top bar in three zones. Left: back box (same spot as the brand mark), title, department.
  Centre: previous, a typeable page box, next. Right: zoom, save page, notes, a "more" menu (share link,
  download, fullscreen, about this report, report a data issue), then quick find, bell, avatar.
  The thumbnail pager is hidden for now (`hidden` on `.pager` in `report.html`), so the page fills the window.
- Quick find: Ctrl K (⌘ K on Mac) searches reports, saved pages and commands.
- Images: `reports/<report>/s/` (640px) and `m/` (1600px) are pre-scaled with a Lanczos filter and light
  sharpening; the 2400px originals are used when zoomed, on high-density screens and for downloads.
- Icons: Phosphor Icons (regular, MIT, https://phosphoricons.com), inline in `ICONS` in `js/app.js`.

## Text case

- Sentence case for every UI string. Capitals only for proper nouns (Sightline), language codes (VI, EN)
  and acronyms. No all-caps labels, no Title Case headings.
