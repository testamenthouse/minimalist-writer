# Handoff: Writer — minimalist book writing app

## Overview
A browser-based, offline-first book writing app. A **library** is a folder on disk; each **subfolder** is a book; each `NN-title.md` file inside is a chapter. The app is a **folder utility**: it reads and writes those files directly (File System Access API) and holds nothing else — the folder is the only source of truth; `localStorage` stores settings only and IndexedDB stores the folder **handle** only. On load the app reopens the remembered folder (reading it fresh from disk); until a folder is open the app shows a single gate screen and nothing else works. A gate screen, two screens (Books, Book), a fullscreen Write mode, a per-chapter Notes pane, and three overlays (Print, Settings, Delete). No server, no accounts, no analytics — everything stays on the user's machine.

## About the design files
`Writer.dc.html` is a **working HTML prototype** that demonstrates the intended look and behaviour end-to-end, including real file I/O. `Writer.html` is the same thing bundled into one standalone file. They are **design references**, not production code to copy: recreate the UI and behaviour in your target stack (React/Vue/Svelte, Electron, Tauri, etc.) using its conventions. If no stack exists yet, a small React + TypeScript app (Vite) is the natural fit — the prototype is already React-shaped (a single class component with `renderVals()`).

## Fidelity
**High-fidelity.** Colours, type, spacing, radii and interactions are final. Recreate pixel-perfectly. The prototype has been iterated with the user over many rounds; the "Behaviour rules" section lists things they explicitly rejected — do not reintroduce them.

---

## Data model

```ts
type Chapter = { id: string; title: string; text: string; notes?: string }   // text = raw markdown body, one line per paragraph; notes = sidecar
type BookMeta = { wordGoal?: number; color?: string; [k: string]: unknown }  // book.json; unknown keys are preserved
type Book    = { name: string; chapters: Chapter[]; meta: BookMeta }   // name = folder name
type Settings = {
  font: 'sans' | 'serif' | 'mono' | 'courier'; size: number;   // size = editor px (default 18)
  typewriter: boolean; dim: boolean; roll: 58 | 80; pageNums: boolean
}
type Persisted = { settings: Settings }                       // the ONLY thing in localStorage
// IndexedDB `writer` / store `kv` / key `lib` = the FileSystemDirectoryHandle (the only thing stored there)
// Runtime-only: folderOpen: boolean, booting: boolean (true until the remembered handle is checked), resumable: boolean, libHandle, books: Book[]
```

### File format
- Chapter file: `NN-title.md` (`NN` = 2-digit position, `title` slugified `[\\/:*?"<>|]` → `-`).
- Contents: `# Title` on line 1, blank line, then body **verbatim** — every editor line is a file line; blank lines round-trip exactly.
- Writing a book: write every chapter under its current index, then delete any `^\d{2}-.*\.md$` in the folder not in the keep-set (handles reorder/rename/delete).
- Notes sidecar: `NN-title.notes.md` next to the chapter file (same slug). Written only when non-empty, deleted when emptied; paired on load by slug (case-insensitive); included in the book zip; not printed, not word-counted.
- **Book frontmatter**: `book.json` inside the book folder, pretty-printed `{ "wordGoal": 80000, "color": "#bfe0f5" }`. Written only when at least one key is set, deleted when all are cleared (like notes); included in the book zip; never touched by the chapter sweep. `wordGoal` = positive integer; `color` = `#rrggbb`; invalid values are dropped on read, unknown keys kept. Edited in the Book modal (Words / Color rows).
- **Library config**: `writer.json` in the library root, `{ "settings": Settings }`. Read on open (overrides localStorage), written whenever settings change (and once on open if missing). The root may hold `writer.json`; only loose `.md`/`.txt` are refused.
- Opening a folder **replaces** the library with exactly what is on disk. No cached orphans — the user explicitly rejected them.

### Persistence
- `localStorage['writer.lib.v3']` = `{ settings }` only — a fallback copy; `writer.json` in the folder is authoritative once a folder is open. **Books are never cached.**
- `localStorage['writer.rail']` = `'min' | 'max'` (rail collapsed); `localStorage['writer.notes']` = `'open' | 'closed'` (notes pane).
- **Autosave to disk — everything.** Every change (body text, title, notes, chapter add/delete/reorder) marks the book dirty and writes it ~0.8 s later (debounced). Book create/rename/delete write immediately. Flush on `visibilitychange→hidden` and `pagehide`; `beforeunload` flushes and prompts if anything is still dirty. ⌘S / Ctrl+S forces. Status line shows `Saved h:mm` or `Save failed`.
- **The folder is watched.** While the tab is visible the app polls every 3 s (and 300 ms after the tab becomes visible): it lists every book folder and takes a signature of each book from its files' names + `lastModified` + size (no reads), plus the `writer.json` stamp. A book whose signature changed is re-read from disk and replaced in memory **unless** it has unsaved edits here or it is the open book and the user typed in the last 2 s (then it is retried next tick). Folders that appear are added; folders that vanish are removed (the open book vanishing returns to Books and exits Write). A changed `writer.json` re-applies settings. The current position is kept by chapter index, and when the open chapter itself is replaced the caret goes to the end of the new text (focus is taken only if it was in the editor or nowhere; the notes pane and find field are never interrupted). The app's own writes bump the stored signature so they never trigger a reload, and a scan is discarded if a write was in flight. Disk always wins for a book with nothing pending here.
- **Write permission self-heals.** Chrome drops a one-time grant after the tab sits in the background, so reads keep working but the next write throws. Every write path (autosave, create, rename, delete) first calls `ensureWrite()`: `queryPermission` → if not granted, `requestPermission` (works when a user gesture triggered the write — Chrome prompts right there). If it still fails, `needPerm` is set, status shows `Save failed`, dirty books stay dirty, and the next pointerdown/keydown re-requests and flushes.
- **Remembered folder.** After `showDirectoryPicker()` the handle is `put` into IndexedDB. On mount (`boot`) the handle is read back and `queryPermission({mode:'readwrite'})` is called: `granted` → the library loads from disk with no gate; `prompt` → the gate shows `Resume` (calls `requestPermission()` on click; Chrome 122+ offers "Allow on every visit" here, and an installed PWA persists it automatically); anything else or no handle → the plain gate. A handle whose folder is gone is forgotten and the gate shows `Folder not found`. **Log out forgets the handle.** While `booting` nothing renders (no gate flash). Books are still never cached — every load reads the folder. Fallback where the API is missing: `<input type=file webkitdirectory>` upload + `.md`/zip downloads.

---

## Visual system

- **Palette**: `#000` ink, `#525252` secondary, `#a3a3a3` tertiary/placeholder, `#e5e7eb` hairline, `#f5f5f5` hover fill, `#fff` background. No other colours. No shadows.
- **UI font**: Inter (`Inter, -apple-system, BlinkMacSystemFont, sans-serif`), antialiased. UI chrome is **always** Inter regardless of the Font setting.
- **Content font** (Font setting) applies only to: cover titles, chapter title, editor body, print.
  - sans → Inter stack · serif → `Georgia, 'Times New Roman', serif` · mono → `ui-monospace, Menlo, monospace` · courier → `'Courier New', Courier, monospace`
- **Radii**: 6px buttons/rows, 8px cards/overlays, 3–4px tiny chips.
- **Icon buttons**: 16×16 stroke icons (stroke 1.75, round caps/joins — Lucide-style), `padding:6px 8px`, colour `#525252` → hover `#000` + `#f5f5f5` fill, no border, radius 6.
- **Hover-reveal groups**: opacity 0 → 1 on mouse-enter of the group, back to 0 **600 ms after** mouse-leave, `transition: opacity .4s`.
- **Links**: `a{color:#000} a:hover{color:#525252}`.
- Placeholders on contenteditable: `[data-ph]:empty:before{content:attr(data-ph);color:#a3a3a3}`.

---

## Screens

### 0. Gate (no folder open)
Rendered **instead of everything else** while `folderOpen === false` (and `booting === false`): no shelf, no settings, no overlays, no keyboard shortcuts (the global keydown handler returns early).
- Full-viewport flex column, centred, gap 14px, padding 32px.
- Heading `Start Private Writing Session` — 20px/600, letter-spacing -0.01em, `#000`, margin-bottom 6px.
- Primary button — `#000` bg / `#fff` text, 14px/500, padding `10px 18px`, radius 6, hover `#262626`. Label `Open folder`, or `Resume` when a remembered folder needs a permission click (`resumable`); in that case a secondary text button `Open folder` (14px `#525252` → `#000` + `#f5f5f5`) sits beneath it.
- Status line beneath, 13px `#a3a3a3` (`Could not open`, `Folder not found`).
- No folder name is shown on the gate. `loadLibrary()` is the only thing that sets `folderOpen = true`.

### 1. Books (library)
- Page padding `48px`, max-width `1100px` centred.
- **Top bar**: folder name on the left (20px/600, letter-spacing -0.01em, Inter, wraps, padding `0 10px`), icon row on the right — `+` icon (New book) and gear icon (Settings). No text buttons.
- **New book**: the **Book modal** opens empty (`renameIdx = -2`) with the input focused. **Nothing is created in memory or on disk** until a non-empty, unique name is saved (Enter/Save). Esc/Cancel/click-outside/empty discards. Duplicate → status `Name in use`. On save the folder is written immediately (one untitled chapter, plus `book.json` if Words/Color were set).
- **Grid**: `repeat(auto-fill, minmax(150px, 1fr))`, gap 32px.
- **Empty library** (no book folders): a single centred black button `New book` (same style as the gate button, `padding:48px 0` around it) that opens the Book modal. No text beneath it.
- **Loose files in the library root**: a folder with any `.md`/`.txt` file directly in its root is **refused** — not opened, not remembered — and an **alert card** opens (same card as Delete: `This folder should only contain subfolders.` 15px/600, then a single black `OK`; click-outside or Esc also closes; renders over the gate too). Applies to the picker, the remembered-folder resume (the handle is kept so `Resume` retries once the file is moved), Sync and the upload fallback. Dotfiles and other file types are ignored. A book is a folder; nothing else is.
- **Book cover** (click = open, double-click = rename inline):
  - Aspect 2:3, white, `1px solid #525252` → `#000` on hover.
  - Spine: 14px strip down the left edge, `meta.color` or `#f5f5f5`, right border 1px `#e5e7eb`.
  - Two "page edge" rectangles behind, offset 3px and 6px right/bottom, same border colour, so it reads as a block of pages.
  - Title centred in the cover in the **content font**, 15px/600, wraps, padding 20px.
  - Meta beneath the cover: `N chapters · W words`, or `N chapters · W / G words` when a word goal is set; 12px `#a3a3a3`.
  - Cover hover: border → `#000` and the cover lifts `translate(-3px,-3px)` off its page stack, `.25s cubic-bezier(.2,.7,.2,1)`.
  - **Book modal** (double-click a cover, the `+` icon / `New book` button, or the rail gear on the Book screen): scrim + card (padding 20, min-width 360, max-width 420, gap 16). Full-width `<input>` 20px/600 with a 1px `#000` bottom border, placeholder `Book name`, focused (selected when renaming). Then two `label | control` rows (14px, label `#525252`): **Words** — text input (`inputmode=numeric`, digits parsed on save) 110px right-aligned, hairline bottom border, blank = no goal; **Color** — nine 18px swatches radius 4 (none/white + `#d9d9d9 #f5c2c2 #f8d9a8 #f6e7a1 #c8e6c9 #bfe0f5 #d6ccf2 #f5c8e2`), hairline border, selected border `#000`. Then a right-aligned `Cancel` (text) + `Save` (black) row. For existing books only, a hairline and a full-width centred `Delete book` text button → `Delete “Book”?` modal (Cancel / Delete, z-index above the Book modal). Save commits name + Words + Color together (name unchanged → just rewrites the book with the new `book.json`). Delete removes the folder recursively from disk and the book from the library; deleting the open book returns to Books. Enter commits (name or Words field), Esc / Cancel / click-outside cancels, empty name → cancel; rename writes the new folder then removes the old one. The cover stays in the grid under the scrim.
- **Status line** bottom-left, 13px `#a3a3a3` (`Saved h:mm`, `Save failed`, `Downloaded`…), clears after 4 s.

### 2. Book (editing)
Grid `280px | minmax(0,1fr)`, min-height 100vh.

**Left rail (280px)**, sticky, `border-right:1px solid #e5e7eb`, padding `24px 14px 20px`, column gap 16px.
- Header block (hover-reveal group):
  - Icon row: `←` (back to Books) on the left; spacer; then `+` (new chapter), printer (print book), download (book as zip), gear (**Book** overlay — see below). Icons are hover-revealed (see above). **No text buttons in the rail.**
  - Book name beneath on its own line: 15px/600, line-height 1.4, `overflow-wrap:anywhere`, padding `0 10px`. **Never truncated.** Not editable inline — renamed through the Book overlay.
  - **Book overlay** (rail gear): the same Book modal as on the Books screen, opened on the current book (`renameIdx = bookIdx`).
- Chapter list (flex column, gap 2px, scrolls): rows `padding:7px 10px`, radius 6, 14px, line-height 1.4; `[NN] Title ………… words`. Number and words 11px `#a3a3a3`, title ellipsised. Current row: `#000`/500/`#f5f5f5`; others `#525252`/400; hover `#f5f5f5`. Rows are draggable to reorder (HTML5 DnD; drop re-sorts and renumbers files).
- Bottom row: `Settings` button left (gear 16px + label, 13px `#525252` → `#000` + `#f5f5f5`, padding `6px 10px`, radius 6, always visible); status line in the middle (12px `#a3a3a3`, right-aligned, ellipsised); collapse chevron `‹` right (always visible, `#a3a3a3`).

**Collapsed rail (56px)** — persisted:
- Padding `24px 8px 20px`, items centred.
- Chapter numbers only: 32×28 boxes, 11px tabular-nums, same colour/bg rules, `title` tooltip = chapter title, still draggable. `+` box beneath (14px icon, `#a3a3a3`).
- Gear box (32×28, 14px icon, `#a3a3a3`, opens Settings) then the expand chevron `›` at the bottom. No title, status, or other icons.
- Main column shows the book title as a caption above the chapter title: 11px/500, uppercase, letter-spacing .08em, `#a3a3a3`, margin-bottom 12px.

**Main column**: padding `96px 48px 160px`, inner max-width 672px centred.
- **Chapter tools strip**: `position:fixed; top:0; left:<rail width>; right:0; height:72px`, flex-end, padding `16px 20px 0 0`, gap 4px. Hover-revealed (opacity 0 unless the mouse is over the strip or Find is open). Order left→right: **find · fullscreen (Write) · print chapter · download chapter · notes · trash**. The notes icon is `#000` when the pane is open or the chapter has notes. When the notes pane is open the strip's `right` and the word count shift left by 300px.
  - **Find field** (appears left of the icons when open): 28px tall pill `1px solid #e5e7eb` radius 6, padding `0 4px 0 10px`; input 160px 13px placeholder `Find`; counter `n/m` 12px `#a3a3a3` tabular (`0` when no match, empty when query empty); `‹ ›` 14px chevrons.
- **Chapter title**: `<h1>` contenteditable, content font, 36px/700, letter-spacing -0.02em, line-height 1.15, margin-bottom 40px, placeholder `Chapter title`. Enter blurs and focuses the body. Commit on blur (trimmed).
- **Body editor**: contenteditable div, content font, `size`px (default 18), line-height 1.75, min-height 50vh, `white-space:pre-wrap`, caret `#000`. One `<p style="margin:0">` per line; empty line = `<p><br></p>`.
- **Word counts** fixed bottom-right: `chapterWords · bookWords`, or `chapterWords · bookWords / goal` when the book has a word goal (then shown even for a one-chapter book); 13px `#a3a3a3`. Markdown markers and notes are excluded from counts.

**Notes pane (300px, right)** — `notesOpen`, persisted. Sticky, `border-left:1px solid #e5e7eb`, padding 24px top (aligns with the rail). Header row: collapse chevron `›` (`#a3a3a3`, always visible) then caption `NOTES` (11px/500 uppercase, letter-spacing .08em, `#a3a3a3`). Body: plain `<textarea>` in the content font, 14px, line-height 1.7, no border, fills the pane. Saves to the sidecar file like any other change. Hidden in Write mode.

### 3. Write (fullscreen)
- Enters `requestFullscreen()`; `fixed inset:0` white layer, z-index 10, scrollable. Content max-width 672px, padding `45vh 24px 50vh` (top pad `96px` when Typewriter is off — then it opens at the top instead of centring).
- Same body editor; caret placed at end on entry and scrolled to centre via rAF (Typewriter on).
- **Typewriter** (setting): after each input/selection change, scroll so the caret's line centre is at `innerHeight/2` (skip if |Δ| ≤ 2px).
- **Dim** (setting): every `<p>` except the one containing the caret gets `opacity:.3`.
- `×` icon fixed top-right (`16px/20px`), `#a3a3a3` → `#000`; Esc also exits. Word count fixed bottom-right, 13px `#a3a3a3`. Nothing else on screen.

---

## Markdown in the body (iA-Writer style)
Files stay raw markdown. The editor decorates each `<p>` **in place** — markers remain in the text and are dimmed, so `innerText` serialises back to the exact source.

Line types (regex on the paragraph text):
- `#`, `##`, `###` + space → h1 `1.6em/700, lh 1.25, margin .6em 0 .2em, ls -0.01em`; h2 `1.3em/600, lh 1.3, margin .5em 0 .15em`; h3 `1.1em/600, margin .4em 0 .1em`
- `>` → `padding-left:1em; border-left:2px solid #e5e7eb; color:#525252`
- `-`/`*`/`+` + space, `1.`/`1)` + space → `padding-left:1em`
- `---` / `***` alone → `letter-spacing:.3em`

Inline (non-greedy, no nesting): `**bold**`/`__bold__` → `<strong>`; `*i*`/`_i_` → `<em>` (not inside words); `~~s~~` → `<s>`; `` `code` `` → `<code>` (`ui-monospace`, .9em, `#f5f5f5` bg, radius 4, padding 0 .2em). Markers wrapped in `<span style="color:#a3a3a3">`.

Rules: re-decorate on every `input` (skip while IME composing). Only rewrite a paragraph's innerHTML when it actually changes; restore the caret by text offset afterwards (native undo is lost at that keystroke only — accepted). Paste: multi-line plain text → one `<p>` per line.

## Find
- Magnifier or ⌘F/Ctrl+F (not in Write mode) opens; ⌘F again focuses + selects the field; Esc closes and refocuses the editor.
- Case-insensitive substring over the editor's text nodes. Uses the **CSS Custom Highlight API** — no DOM mutation: `::highlight(wr-find){background:#e5e7eb}`, `::highlight(wr-cur){background:#000;color:#fff}`.
- Enter / `›` next, Shift+Enter / `‹` previous (wraps); current match is scrolled to vertical centre (`smooth`). Re-run on every edit. Tools strip stays visible while open.

---

## Overlays
All overlays: `fixed inset:0`, `rgba(255,255,255,.7)` scrim, click-outside or Esc closes, card `1px solid #e5e7eb` radius 8 padding 24, 14px.

### Print
Opened by either print icon; label at top (13px `#525252`): `Print Chapter` or `Print Book`. Two cards side by side (150px wide, radius 8, `1px solid #e5e7eb` → `#000` on hover, 13px label): **Receipt** (torn-edge receipt glyph) and **Letter** (page glyph). Beneath: **Page numbers** checkbox (14px square, radius 3, filled `#000` with white check when on; persisted in `settings.pageNums`). No download here — downloads have their own icons.

Printing builds a clean hidden `<iframe>` document (no app CSS) and calls `print()` on it; the parent `document.title` is swapped to the document title during print (`Book — Chapter` or `Book`) so "Save as PDF" is named correctly.
- Content: book title (700, 6mm below) on the first chapter only; chapter title (600, 3mm below); then markdown rendered flat: h1–h3 (600), `<p class="q">` quote (`padding-left:1em; border-left:1px solid #000`), `<p class="li">` list (`• ` or `1. ` prefix, hanging indent 1.4em), `<hr>`, inline strong/em/s/code. `p{margin:0;min-height:1.4em;white-space:pre-wrap}`.
- Each chapter `break-after:page`; last chapter not.
- **Receipt**: `@page{margin:2mm 3mm}` **only** — **no `@page size`** (Chrome ignores it for roll printers and shrinks/centres the text; the user has been burned by this repeatedly). Font = `size × 0.5`pt, line-height 1.4, `.ch{break-inside:avoid}`, and a `1.5in` tail spacer after each chapter ending in a 6pt `·` so Chrome keeps the blank feed. Cut-per-page is configured in the printer driver, not the app.
- **Letter**: `@page{margin:25mm}`, font `size × 0.67`pt, line-height 1.6, no tail.
- **Page numbers** (Letter only): CSS margin boxes — `@top-center{content:"<book>"}` and `@bottom-center{content:counter(page)}`, 9pt, content font. **No fixed page boxes, no manual pagination** (tried; Chrome shrank the page and the user called it horrible).

### Settings
Rows `label | control`: **Folder** (name + `Change`), **Sync** (`Folder` / `N unsaved` / `Reopen folder to sync` + `Sync` — flushes pending edits, then re-reads the whole folder as truth, keeping the current chapter by index; status `Up to date`), **Font** (sans · serif · mono · courier), **Size** (16 · 18 · 20 · 22), **Typewriter** (On/Off), **Dim** (On/Off), **Receipt width** (58 · 80). Segmented options: selected `#000` bg / `#fff` text, others `#525252`, radius 6. **Bottom row**: hairline above (`padding-top:10px`), then **`Log out`** as a full-width centred text button (14px `#525252` → `#000` + `#f5f5f5`, radius 6).

**Log out**: flush pending saves, exit fullscreen, drop the folder handle from memory **and from IndexedDB**, drop all books, reset every overlay/flag, set `folderOpen = false` → back to the gate. Closing the tab does not log out — the folder reopens next visit.

### Delete (chapter or book)
Same card: `Delete “Title”?` / `Delete “Book”?` then `Cancel` / `Delete` text buttons (`confirmBook` flag picks the target). Never `confirm()`/`alert()`; never a two-step "Confirm" button.

---

## Downloads
- **Chapter** (tools strip): `Book — Chapter.md`, raw markdown.
- **Book** (rail): `Book.zip` containing `Book/NN-title.md` (and `NN-title.notes.md` where notes exist) for each chapter, plus `Book/book.json` when frontmatter is set.

## Keyboard
(All disabled on the gate.) ⌘S save · ⌘F find · Esc (close overlay / exit Write / close find) · Enter in title → body · Enter/Shift+Enter in find → next/prev.

## Behaviour rules the user insisted on (do not regress)
- Minimal: bare-verb buttons, no helper text, no descriptive UI copy, no emoji.
- Rail and chapter-area icons are hover-revealed; the rail collapse chevron and the Write `×` are always visible.
- Book name is not editable inline on the Book screen — only via the rail gear's Book overlay, or double-click on Books.
- Settings lives top-right / in the rail header, never at the bottom. Infrequent actions take no real estate.
- The app is a folder utility: nothing works until a folder is open; remember the folder **handle** only (never book contents); never cache books; opening a folder shows exactly what is on disk. Log out is the only way to forget the folder.
- Never create a book without a folder. A new book exists only once it has been named and written.
- New chapters are created immediately (the user declined a "pending until named" flow for chapters).
- Everything autosaves to disk — no explicit save step.
- Font setting never touches UI chrome.
- Markdown download is **not** inside the Print overlay.
- Receipt print: no `@page size`, don't touch margins.
- Only export/bundle when asked.

## Design tokens
- Colours: `#000` `#525252` `#a3a3a3` `#e5e7eb` `#f5f5f5` `#fff`; scrim `rgba(255,255,255,.7)`
- Type (UI, Inter): 11 caption/uppercase · 12 meta · 13 buttons/status · 14 rows/overlays · 15 book name · 20 page title. Content: 36/700 chapter title; body = Size setting; print = size×0.5 (receipt) / ×0.67 (letter) in pt; print header/footer 9pt.
- Spacing: 2 (list gap) · 4 (icon gap) · 8 · 10 (row x-padding) · 12 · 16 · 20 · 24 · 32 (grid gap) · 40 · 48 · 96 (main top).
- Radii: 3 / 4 / 6 / 8. Shadows: none.
- Motion: opacity `.4s`, hover-out delay 600 ms; cover lift `.25s cubic-bezier(.2,.7,.2,1)`; scroll `smooth` for find.
- Layout: rail 280 / 56; notes pane 300; content 672; editor line-height 1.75; Write padding `45vh 24px 50vh`.

## Assets
No images. Icons are inline 24-viewBox stroke SVGs (Lucide-equivalent): arrow-left, plus, printer, download, settings/gear, search, maximize, sticky-note (notes), trash, x, chevron-left/right/up/down, check. Fonts: Inter from Google Fonts (`wght 400–700`) in the prototype; bundle locally in production.

## Desktop app (`../desktop`)
Electron shell, built 2026-10-07. `desktop/scripts/sync.js` copies `Writer.dc.html` → `desktop/app/index.html` (+ `support.js`) before every run/build, swapping the Google Fonts link for bundled Inter and pointing `window.__resources` at vendored React/ReactDOM so the app is fully offline. The main process serves `app://writer/` from `desktop/app`, grants the page the File System Access API without prompts (so the remembered folder opens straight into the library — no gate after the first pick), and runs `electron-updater` against GitHub Releases: checks on launch and hourly, downloads quietly, installs on quit, app menu offers **Restart to Update**. Prototype runtime note: `support.js` loads React from unpkg unless `window.__resources` overrides it — the GitHub Pages build still uses the CDN. Run with `ELECTRON_RUN_AS_NODE` unset (VS Code shells set it, which makes Electron behave as plain Node).

## Files in this bundle
- `Writer.dc.html` — the prototype source (template + logic in one file; references `support.js`).
- `support.js` — the prototype's small runtime (template binding). Not needed in production.
- `Writer.html` — single-file bundled build of the prototype; open in Chrome/Edge to try the real behaviour (folder access, print, zip).
- `DESIGN-NOTES.md` — the running design-decision log from the design sessions.
