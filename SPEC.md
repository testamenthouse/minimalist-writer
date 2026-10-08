# Writer — specification

## Overview
A browser-based, offline-first book writing app. A **library** is a folder on disk; each **subfolder** is a book (except the reserved `Templates/`); each `NN-title.md` file inside is a chapter. The app is a **folder utility**: it reads and writes those files directly (File System Access API) and holds nothing else — the folder is the only source of truth; `localStorage` stores settings only and IndexedDB stores the folder **handle** only. On load the app reopens the remembered folder (reading it fresh from disk); until a folder is open the app shows a single gate screen and nothing else works. A gate screen, two screens (Books, Book), a fullscreen Write mode, a per-chapter Notes pane, and three overlays (Print, Settings, Delete). Dictation types into the chapter at the caret (the Mac app through the Mac's own on-device speech recognizer, the browser version through Chrome's). No server, no accounts, no analytics — everything stays on the user's machine.

## About this document
`index.html` at the repo root (with `support.js`, its small template runtime) **is** the app: a single class component with `renderVals()`, served as-is by GitHub Pages or opened straight from disk by double-click. This file describes every screen, rule and file-format detail it implements. Colours, type, spacing, radii and interactions are final; the "Behaviour rules" section lists settled rulings — do not reintroduce what they exclude. Update this file with every change.

---

## Data model

```ts
type Chapter = { id: string; title: string; text: string; notes?: string }   // text = raw markdown body, one line per paragraph; notes = sidecar
type BookMeta = { wordGoal?: number; color?: string; [k: string]: unknown }  // book.json; unknown keys are preserved
type Book    = { name: string; chapters: Chapter[]; meta: BookMeta }   // name = folder name
type Settings = {
  font: 'sans' | 'serif' | 'mono' | 'courier'; size: number;   // size = editor px (default 18)
  typewriter: boolean; dim: boolean; pageNums: boolean;              // receipt width is NOT a setting (print-time only)
  theme: 'system' | 'light' | 'dark'                                  // default 'system' (follows prefers-color-scheme)
}
type Persisted = { settings: Settings }                       // the ONLY thing in localStorage
// IndexedDB `writer` / store `kv` / key `lib` = the FileSystemDirectoryHandle (the only thing stored there)
// Runtime-only: folderOpen: boolean, booting: boolean (true until the remembered handle is checked), resumable: boolean, libHandle, books: Book[]
```

### File format
- Chapter file: `NN-title.md` (`NN` = 2-digit position, `title` slugified `[\\/:*?"<>|]` → `-`).
- Contents: `# Title` on line 1, blank line, then body **verbatim** — every editor line is a file line; blank lines round-trip exactly. Every `.md` the app writes (chapters, notes, templates, zip entries) ends in exactly one trailing newline: one is added only when the content does not already end in `\n`, never doubled.
- Writing a book: write every chapter under its current index, then delete any `^\d{2}-.*\.md$` in the folder not in the keep-set (handles reorder/rename/delete).
- Notes sidecar: `NN-title.notes.md` next to the chapter file (same slug). Written only when non-empty, deleted when emptied; paired on load by slug (case-insensitive); included in the book zip; not printed, not word-counted.
- **Book frontmatter**: `book.json` inside the book folder, pretty-printed `{ "wordGoal": 80000, "color": "#bfe0f5" }`. Written only when at least one key is set, deleted when all are cleared (like notes); included in the book zip; never touched by the chapter sweep. `wordGoal` = positive integer; `color` = `#rrggbb`; invalid values are dropped on read, unknown keys kept. Edited in the Book modal (Words / Color rows).
- **Chapter templates**: `Templates/` in the library root (case-insensitive, reserved — never a book, and `Templates` is refused as a book name). Every `*.md` inside is a template in the chapter format: `# Name` on line 1 is the template's name (else the filename, dashes → spaces), the body after it is what a new chapter starts with. The folder is the only source: nothing is seeded, the app reads it on open and the watcher re-reads it when its stamps change, so templates made or edited in Finder show up live. `Save as template` writes `Templates/<name-slug>.md` (`# Name`, blank line, the chapter body verbatim; notes are not part of a template); a duplicate name is refused with `Name in use`. Editing a template on the Templates screen rewrites its file (debounced like chapters); renaming it writes `Templates/<new-slug>.md` and removes the old file. Deleting a template removes the file. Not in the book zip.
- **Library config**: `writer.json` in the library root, `{ "settings": Settings }`. Read on open (overrides localStorage), written whenever settings change (and once on open if missing). The root may hold `writer.json`; only loose `.md`/`.txt` are refused.
- Opening a folder **replaces** the library with exactly what is on disk. No cached orphans.

### Persistence
- **Folder adapter (`FS`, above `class Component`).** Every file operation goes through one object with one interface: `pick` · `resume` · `resumeClick` · `forget` · `ensureWrite` · `list` (one recursive walk: `{ path, kind, mtime, size }`, dotfiles skipped, no reads) · `read` · `write` · `remove` · `rename` · `mkdir` · `watch` · `reveal` · `libraryPath`. Paths are relative and forward-slashed. The Mac app's preload exposes `window.writer` (the main process owns the library path, remembers it in `~/Library/Application Support/Writer/config.json`, writes atomically, watches with `fs.watch`, and `reveal` is `shell.showItemInFolder`); the browser adapter wraps the File System Access API with the handle in IndexedDB and has no `watch` or `reveal`. The component never touches a handle; `this.lib` is `{ name }` or null. `window.__wr.fs` is the adapter (QA hands it an OPFS root through `__setLibrary`). Same model as Sermon Builder.
- `localStorage['writer.lib.v3']` = `{ settings }` only — a fallback copy; `writer.json` in the folder is authoritative once a folder is open. **Books are never cached.** Settings keys: `font`, `size`, `typewriter`, `dim`, `pageNums`, `theme` (`system` | `light` | `dark`, default `system`). A one-line script in `<head>` reads the fallback copy and sets `<html data-theme>` before the runtime loads so a dark user never sees a white flash.
- `localStorage['writer.rail']` = `'min' | 'max'` (rail collapsed); `localStorage['writer.notes']` = `'open' | 'closed'` (notes pane).
- **Autosave to disk — everything.** Every change (body text, title, notes, chapter add/delete/reorder) marks the book dirty and writes it ~0.8 s later (debounced). Book create/rename/delete write immediately. Flush on `visibilitychange→hidden` and `pagehide`; `beforeunload` flushes and prompts if anything is still dirty. ⌘S / Ctrl+S forces. Status line shows `Saved h:mm` or `Save failed`.
- **The folder is watched.** While the tab is visible the app polls every 3 s (and 300 ms after the tab becomes visible): it lists every book folder and takes a signature of each book from its files' names + `lastModified` + size (no reads), plus the `writer.json` stamp. A book whose signature changed is re-read from disk and replaced in memory **unless** it has unsaved edits here or it is the open book and the user typed in the last 2 s (then it is retried next tick). Folders that appear are added; folders that vanish are removed (the open book vanishing returns to Books and exits Write). A changed `writer.json` re-applies settings. The current position is kept by chapter index, and when the open chapter itself is replaced the caret goes to the end of the new text (focus is taken only if it was in the editor or nowhere; the notes pane and find field are never interrupted). The app's own writes bump the stored signature so they never trigger a reload, and a scan is discarded if a write was in flight. Disk always wins for a book with nothing pending here.
- **Write permission self-heals.** Chrome drops a one-time grant after the tab sits in the background, so reads keep working but the next write throws. Every write path (autosave, create, rename, delete) first calls `ensureWrite()`: `queryPermission` → if not granted, `requestPermission` (works when a user gesture triggered the write — Chrome prompts right there). If it still fails, `needPerm` is set, status shows `Save failed`, dirty books stay dirty, and the next pointerdown/keydown re-requests and flushes.
- **Remembered folder.** After `showDirectoryPicker()` the handle is `put` into IndexedDB. On mount (`boot`) the handle is read back and `queryPermission({mode:'readwrite'})` is called: `granted` → the library loads from disk with no gate; `prompt` → the gate shows `Resume` (calls `requestPermission()` on click; Chrome 122+ offers "Allow on every visit" here, and an installed PWA persists it automatically); anything else or no handle → the plain gate. A handle whose folder is gone is forgotten and the gate shows `Folder not found`. **Log out forgets the handle.** While `booting` nothing renders (no gate flash). Books are still never cached — every load reads the folder. Fallback where the API is missing: `<input type=file webkitdirectory>` upload + `.md`/zip downloads.

---

## Visual system

- **Palette** (CSS custom properties on `:root`; every inline style uses the token, never a hex): `--fg` ink, `--muted` secondary, `--faint` tertiary/placeholder, `--line` hairline, `--fill` hover fill, `--bg` background, `--fg-hover` primary-button hover, `--scrim` overlay backdrop. Light: `#000` `#525252` `#a3a3a3` `#e5e7eb` `#f5f5f5` `#fff` `#262626` `rgba(255,255,255,.7)`. Dark (`:root[data-theme="dark"]`): `#ececec` `#a3a3a3` `#737373` `#333` `#2a2a2a` `#1f1f1f` `#cfcfcf` `rgba(0,0,0,.6)` — charcoal, never near-black. Primary buttons are `--fg` on `--bg` text, so they invert with the theme. Find highlights have explicit dark overrides (`::highlight` cannot read tokens). `color-scheme` follows the theme so scrollbars and native controls match. No other colors. No shadows. Book spine colors (the pastel palette) and the print stylesheet are theme-independent — paper is always white.
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

### 0a. Browser check
The web build runs only in Google Chrome. `blocked()` (`Dictation.isChrome()` false) renders a single screen **instead of everything else**, before the gate: heading `Writer`, a black link-button `Get Google Chrome` (google.com/chrome), status line `Google Chrome required`. `boot()` is skipped, so the remembered folder is never touched.

### 0. Gate (no folder open)
Rendered **instead of everything else** while `folderOpen === false` (and `booting === false`): no shelf, no settings, no overlays, no keyboard shortcuts (the global keydown handler returns early).
- Full-viewport flex column, centred, gap 14px, padding 32px.
- Heading `Start Writing` — 20px/600, letter-spacing -0.01em, `#000`, margin-bottom 6px.
- Primary button — `#000` bg / `#fff` text, 14px/500, padding `10px 18px`, radius 6, hover `#262626`. Label `Open folder`, or `Resume` when a remembered folder needs a permission click (`resumable`); in that case a secondary text button `Open folder` (14px `#525252` → `#000` + `#f5f5f5`) sits beneath it.
- Status line beneath, 13px `#a3a3a3` (`Could not open`, `Folder not found`).
- No folder name is shown on the gate. `loadLibrary()` is the only thing that sets `folderOpen = true`.

### 1. Books (library)
- Page padding `48px`, max-width `1100px` centred.
- **Top bar**: folder name on the left (20px/600, letter-spacing -0.01em, Inter, wraps, padding `0 10px`), icon row on the right — `+` icon (New book), layers icon (Templates) and gear icon (Settings). No text buttons.
- **New book**: the **Book modal** opens empty (`renameIdx = -2`) with the input focused. **Nothing is created in memory or on disk** until a non-empty, unique name is saved (Enter/Save). Esc/Cancel/click-outside/empty discards. Duplicate → status `Name in use`. On save the folder is written immediately (one untitled chapter, plus `book.json` if Words/Color were set).
- **Grid**: `repeat(auto-fill, minmax(150px, 1fr))`, gap 32px.
- **Empty library** (no book folders): a single centred black button `New book` (same style as the gate button, `padding:48px 0` around it) that opens the Book modal. No text beneath it.
- **Loose files in the library root**: a folder with any `.md`/`.txt` file directly in its root is **refused** — not opened, not remembered — and an **alert card** opens (same card as Delete: `This folder should only contain subfolders.` 15px/600, then a single black `OK`; click-outside or Esc also closes; renders over the gate too). Applies to the picker, the remembered-folder resume (the handle is kept so `Resume` retries once the file is moved), Sync and the upload fallback. Dotfiles and other file types are ignored. A book is a folder; nothing else is.
- **Sermon Builder libraries are refused**: a listing with `sermon.json` in the root, an `Illustrations/` folder, or a `collection.json`/`series.json` inside a subfolder belongs to the Sermon Builder app (`isForeign`, checked before any file is read). Nothing is read or written, the folder is forgotten (not kept for Resume), and the alert card opens with `This is a Sermon Builder library.`, an `Open Sermon Builder` text link (new tab, https://testamenthouse.github.io/sermon-builder/; the Mac app hands it to the default browser) and `OK`. Applies to the picker, the remembered-folder resume, Sync and the upload fallback. The alert card carries an optional link (`alertLink` + `alertLinkLabel`) left of `OK`.
- **Book cover** (click = open, double-click = rename inline):
  - Aspect 2:3, white, `1px solid #525252` → `#000` on hover.
  - Spine: 14px strip down the left edge, `meta.color` or `#f5f5f5`, right border 1px `#e5e7eb`.
  - Two "page edge" rectangles behind, offset 3px and 6px right/bottom, same border colour, so it reads as a block of pages.
  - Title centred in the cover in the **content font**, 15px/600, wraps, padding 20px.
  - Meta beneath the cover: `N chapters · W words`, or `N chapters · W / G words` when a word goal is set; 12px `#a3a3a3`.
  - Cover hover: border → `#000` and the cover lifts `translate(-3px,-3px)` off its page stack, `.25s cubic-bezier(.2,.7,.2,1)`.
  - **Book modal** (double-click a cover, the `+` icon / `New book` button, or the rail gear on the Book screen): scrim + card (padding 20, min-width 360, max-width 420, gap 16). Full-width `<input>` 20px/600 with a 1px `#000` bottom border, placeholder `Book name`, focused (selected when renaming). Then two `label | control` rows (14px, label `#525252`): **Words** — text input (`inputmode=numeric`, digits parsed on save) 110px right-aligned, hairline bottom border, blank = no goal; **Color** — nine 18px swatches radius 4 (none/white + `#d9d9d9 #f5c2c2 #f8d9a8 #f6e7a1 #c8e6c9 #bfe0f5 #d6ccf2 #f5c8e2`), hairline border, selected border `#000`. Then a right-aligned `Cancel` (text) + `Save` (black) row. For existing books only, a hairline, then `Show in Finder` (`Show in Explorer` on Windows; Mac app only — the browser has no path, so the row is absent) and a full-width centred `Delete book` text button → `Delete “Book”?` modal (Cancel / Delete, z-index above the Book modal). Save commits name + Words + Color together (name unchanged → just rewrites the book with the new `book.json`). Delete removes the folder recursively from disk and the book from the library; deleting the open book returns to Books. Enter commits (name or Words field), Esc / Cancel / click-outside cancels, empty name → cancel; rename writes the new folder then removes the old one. The cover stays in the grid under the scrim.
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
- **Chapter tools strip**: `position:fixed; top:0; left:<rail width>; right:0; height:72px`, flex-end, padding `16px 20px 0 0`, gap 4px. Hover-revealed (opacity 0 unless the mouse is over the strip or Find is open). Order left→right: **find · fullscreen (Write) · dictate · print chapter · download chapter · save as template (layers) · notes · trash**. The mic is `#000` on `#f5f5f5` while listening. The notes icon is `#000` when the pane is open or the chapter has notes. When the notes pane is open the strip's `right` and the word count shift left by 300px.
  - **Find field** (appears left of the icons when open): 28px tall pill `1px solid #e5e7eb` radius 6, padding `0 4px 0 10px`; input 160px 13px placeholder `Find`; counter `n/m` 12px `#a3a3a3` tabular (`0` when no match, empty when query empty); `‹ ›` 14px chevrons.
- **Chapter title**: `<h1>` contenteditable, content font, 36px/700, letter-spacing -0.02em, line-height 1.15, margin-bottom 40px, placeholder `Chapter title`. Enter blurs and focuses the body. Commit on blur (trimmed).
- **Body editor**: contenteditable div, content font, `size`px (default 18), line-height 1.75, min-height 50vh, `white-space:pre-wrap`, caret `#000`. One `<p style="margin:0">` per line; empty line = `<p><br></p>`. On open, a chapter whose last line has text gets one empty line appended so there is always a fresh line to click into; a chapter that already ends on an empty line is left as is. Trailing empty lines are dropped when the body is read back, so the file still ends in exactly one newline.
- **Word counts** fixed bottom-right: `chapterWords · bookWords`, or `chapterWords · bookWords / goal` when the book has a word goal (then shown even for a one-chapter book); 13px `#a3a3a3`. Markdown markers and notes are excluded from counts.

**Notes pane (300px, right)** — `notesOpen`, persisted. Sticky, `border-left:1px solid #e5e7eb`, padding 24px top (aligns with the rail). Header row: collapse chevron `›` (`#a3a3a3`, always visible) then caption `NOTES` (11px/500 uppercase, letter-spacing .08em, `#a3a3a3`). Body: plain `<textarea>` in the content font, 14px, line-height 1.7, no border, fills the pane. Saves to the sidecar file like any other change. Hidden in Write mode.

### 3. Write (fullscreen)
- Enters `requestFullscreen()`; `fixed inset:0` white layer, z-index 10, scrollable. Content max-width 672px, padding `45vh 24px 50vh` (top pad `96px` when Typewriter is off — then it opens at the top instead of centring).
- Same body editor; caret placed at end on entry and scrolled to centre via rAF (Typewriter on).
- **Typewriter** (setting): after each input/selection change, scroll so the caret's line centre is at `innerHeight/2` (skip if |Δ| ≤ 2px).
- **Dim** (setting): every `<p>` except the one containing the caret gets `opacity:.3`.
- `×` icon fixed top-right (`16px/20px`), `#a3a3a3` → `#000`; Esc also exits. Word count fixed bottom-right, 13px `#a3a3a3`. **Typewriter · Dim** toggles fixed bottom-left (2026-10-07): two 13px text buttons (`left:20px; bottom:16px`, padding `4px 8px`, radius 6), `#000` when on / `#a3a3a3` when off, hover `#000` + `#f5f5f5`. They flip the persisted settings in place (`toggleAid`): focus returns to the editor and the aids re-apply on the next frame — Dim off clears every paragraph to full opacity even if the caret isn't in the editor; Typewriter on re-centres the caret. These are the only place the two aids are set — they are not in Settings. A third text button, **Dictate**, sits beside them (`#000` while listening, `#a3a3a3` otherwise) and toggles dictation. Nothing else on screen.

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

## Dictation
- Starts from the mic in the chapter tools, the `Dictate` toggle on the Write screen, or ⌘⇧D (Book screen open). While dictating a solid **Stop** button (mic glyph + `Stop`, `--fg` on `--bg`, 32px, radius 6, `z-index:12`) sits bottom right on both the Book and Write screens, where the word count was (the count slides 88px left of it; 320px from the right when the Notes pane is open) — the hover-revealed mic is never the way to stop. The same controls, leaving the book and Log out also stop it.
- **Target**: the contenteditable that has focus when dictation starts (body or chapter title), else the body editor with the caret at its end. The caret is followed while dictating — into the title or a replaced editor (entering Write mode, a chapter switch) — so words always land where the cursor is; the Notes textarea and the Find field are never targets.
- **Insertion**: final segments go in with `execCommand('insertText')` at the caret so `onInput` runs unchanged (serialize, decorate, dirty + autosave, native undo). A space is added before the segment unless the paragraph is empty, ends in whitespace or the segment starts with punctuation; the first letter is capitalized at a paragraph start or after `.` `!` `?`. `new paragraph` / `new line` anywhere in a segment → `insertParagraph`; the Mac's recognizer turns the spoken command into newline characters itself, which split the same way. The partial (still forming) segment is never inserted.
- **Spoken punctuation** (`Dictation.spoken`, run on every final segment and on the partial preview): Chrome's engine does not turn command words into marks, so the app does. `period` / `full stop` `.` · `comma` `,` · `question mark` `?` · `exclamation point` / `exclamation mark` `!` · `colon` · `semicolon` · `ellipsis` / `dot dot dot` `…` · `open quote` / `close quote` (also `begin` / `end`, `quotes`) `"` · `open paren` / `close paren` (`parenthesis`, `bracket`) · `hyphen` `-` and `apostrophe` join the words on both sides · `dash` / `em dash` `—` · `en dash` `–`. A mark attaches to the word before it (an opening mark to the word after), the next word is capitalized after `.` `!` `?` (not after an ellipsis), and a mark the recognizer already put around the command (`store. Period.`) or that the paragraph already ends with is not doubled. Like macOS Dictation, the words always count as commands — `a period of time` has to be typed.
- **Live bar**: fixed bottom center (`z-index:12`, above the Write layer): 32px pill, hairline border, radius 6, 13px; a pulsing 8px `--fg` dot (`wr-pulse`, 1.4s) then the partial text in `--fg` with its tail kept in view, or `Listening` (`Starting` until the engine answers) in `--faint`.
- **Engine** (`Dictation` in the logic script): Chrome's Web Speech API (`SpeechRecognition`, continuous + interim results, restarted when Chrome ends a session after silence; `not-allowed` → `Microphone blocked`, `network` → `No connection`, `audio-capture` → `No microphone`).
- **GitHub link on the demo**: when the page is served from a `*.github.io` host, a GitHub mark (18px, `#a3a3a3` → `#000` + `#f5f5f5` on hover, padding 6px 8px, radius 6) floats fixed at top 16px / right 20px (z-index 6) linking to the repository in a new tab. Shown on the blocked, gate, shelf and templates-list screens, where the corner is free; hidden on the chapter editor, template editor and Write mode, whose tool strips own that corner. Never shown from a local checkout. On the same screens and host a footer line sits fixed at bottom 16px, centered, 13px `#a3a3a3`: `Writing sermons? Check out Sermon Builder.` with the name a `#525252` link (new tab, `#000` on hover). A Sermon Builder library picked on that host skips the card and navigates straight to Sermon Builder (`foreign()`), after the folder is forgotten.
- **Chrome only on the web**: any other browser (brand check via `navigator.userAgentData`, UA fallback) opens the alert card with `Dictation requires Google Chrome.` and `OK` (the same card as the loose-files alert; `alertText` state carries the message).
- The bar's dot swells with the microphone level (Chrome's `soundstart`/`soundend`) and stops pulsing while sound is heard, so a silent input is visible; engine notes (`No speech heard`, `Microphone blocked`, `No connection`) show in the bar for 3 s and in the status line. Three seconds of pure zeros from the input → `Microphone is silent` (a MacBook with its lid closed disables its built-in microphone; use an external microphone or open the lid); speech-level audio with no result → on-device gives way to Apple's servers, then `Speech recognition returned nothing` stops the session.

## Find
- Magnifier or ⌘F/Ctrl+F (not in Write mode) opens; ⌘F again focuses + selects the field; Esc closes and refocuses the editor.
- Case-insensitive substring over the editor's text nodes. Uses the **CSS Custom Highlight API** — no DOM mutation: `::highlight(wr-find){background:#e5e7eb}`, `::highlight(wr-cur){background:#000;color:#fff}`.
- Enter / `›` next, Shift+Enter / `‹` previous (wraps); current match is scrolled to vertical centre (`smooth`). Re-run on every edit. Tools strip stays visible while open.

---

## Overlays
All overlays: `fixed inset:0`, `rgba(255,255,255,.7)` scrim, click-outside or Esc closes, card `1px solid #e5e7eb` radius 8 padding 24, 14px.

### Print
Opened by either print icon; label at top (13px `#525252`): `Print Chapter` or `Print Book`. Two cards side by side (150px wide, radius 8, `1px solid #e5e7eb` → `#000` on hover, 13px label): **Receipt** (torn-edge receipt glyph) and **Letter** (page glyph). Beneath, one row of two 150px cells aligned under the cards (2026-10-07): under **Receipt** a segmented **58mm · 80mm** receipt-width choice (13px, selected `#000` bg / `#fff` text, others `#525252`, radius 6) held in component state `printRoll` (default 80) — chosen at print time, **never persisted** (not in `writer.json` or localStorage; resets to 80mm on reload); under **Letter** the **Page numbers** checkbox (14px square, radius 3, filled `#000` with white check when on; persisted in `settings.pageNums`). No download here — downloads have their own icons.

Printing builds a clean hidden `<iframe>` document (no app CSS) and calls `print()` on it; the parent `document.title` is swapped to the document title during print (`Book — Chapter` or `Book`) so "Save as PDF" is named correctly.
- Content: book title (700, 6mm below) on the first chapter only; chapter title (600, 3mm below); then markdown rendered flat: h1–h3 (600), `<p class="q">` quote (`padding-left:1em; border-left:1px solid #000`), `<p class="li">` list (`• ` or `1. ` prefix, hanging indent 1.4em), `<hr>`, inline strong/em/s/code. `p{margin:0;min-height:1.4em;white-space:pre-wrap}`.
- Each chapter `break-after:page`; last chapter not.
- **Receipt**: `@page{margin:2mm 3mm}` **only** — **no `@page size`** (Chrome ignores it for roll printers and shrinks/centres the text; a settled ruling). Font = `size × 0.5`pt, line-height 1.4, `.ch{break-inside:avoid}`, and a `1.5in` tail spacer after each chapter ending in a 6pt `·` so Chrome keeps the blank feed. Cut-per-page is configured in the printer driver, not the app.
- **Letter**: `@page{margin:25mm}`, font `size × 0.67`pt, line-height 1.6, no tail.
- **Page numbers** (Letter only): CSS margin boxes — `@top-center{content:"<book>"}` and `@bottom-center{content:counter(page)}`, 9pt, content font. **No fixed page boxes, no manual pagination** (settled ruling: Chrome shrinks the page).

### Settings
Rows `label | control`: **Folder** (name + `Change`), **Sync** (`Folder` / `N unsaved` / `Reopen folder to sync` + `Sync` — flushes pending edits, then re-reads the whole folder as truth, keeping the current chapter by index; status `Up to date`), **Font** (sans · serif · mono · courier), **Size** (16 · 18 · 20 · 22), **Theme** (System · Light · Dark — System follows `prefers-color-scheme` live). Typewriter and Dim moved to the Write screen's bottom-left toggles and receipt width to the Print overlay (2026-10-07). Segmented options: selected `--fg` bg / `--bg` text, others `--muted`, radius 6. **Bottom row**: hairline above (`padding-top:10px`), then **`Log out`** as a full-width centred text button (14px `#525252` → `#000` + `#f5f5f5`, radius 6).

**Log out**: flush pending saves, exit fullscreen, drop the folder handle from memory **and from IndexedDB**, drop all books, reset every overlay/flag, set `folderOpen = false` → back to the gate. Closing the tab does not log out — the folder reopens next visit.

### New chapter (template picker)
Only when the library's `Templates/` folder holds at least one template; otherwise `+` creates the chapter at once. The same card as Book (padding 24, min 360 / max 420, gap 20): heading `New chapter` (15px/600); a row with the label `Select template` (muted) on the left and a 200px dropdown on the right — a bordered button (1px `#e5e5e5`, radius 6, padding 6/10, current choice + chevron, border → `#000` while open or hovered) that opens a popover below it (`Blank` then one row per template, current row filled); then `Cancel` / `Create`. Default choice is `Blank`; Create makes the chapter at once with the chosen body. Click anywhere on the card closes the popover; Esc / scrim closes the card. No management here — that is the Templates screen. A row click creates an untitled chapter with the template body and focuses the title. Esc / click-outside closes.

### Save as template
Opened by the layers icon in the chapter tools. Same card as Book: one input (placeholder `Template name`, prefilled with the chapter title, 20px/600, underline), `Cancel` / `Save template`. Enter saves, Esc cancels. Writes `Templates/<slug>.md` from the current chapter body, status `Template saved`; duplicate name → `Name in use` and the card stays. Without a folder handle (upload fallback) the icon flashes `Open the folder in Chrome or Edge to save templates`.

### Templates screen
Opened by the layers icon in the Books top bar. Same shell as Books (max 720, padding `40px 32px 128px`): a top row with `←` (Books), the title `Templates` (20px/600), `+` (New template) and the gear. Below it one row per template, sorted by name — name (14px, `#525252` → `#000` + `#f5f5f5` on hover) and the word count (11px, faint) on the left, a trash icon on the right that opens the Delete card. Clicking a row opens the template editor. Empty folder: a single centred black `New template` button (like the empty library). `+` / `New template` open the Save-as-template card with an empty name; a unique name creates `Templates/<slug>.md` with an empty body and opens it in the editor with the body focused.

### Template editor
The chapter editor without the rail, notes, find, print, download or dictation: an always-visible `←` top-left (faint, back to the list), a hover-revealed strip top-right with one trash icon (Delete card for this template), the eyebrow `TEMPLATE`, the title `<h1>` (placeholder `Template name`) and the body. Title and body are the template's name and body: body edits autosave to the file (800 ms debounce, `dirtyTpl`, same status flashes as chapters); a title blur renames (new slug written, old file removed, `Name in use` and revert on a clash, empty reverts). The word count sits bottom-right. The folder watcher re-reads `Templates/` when its stamps change unless an edit is pending here; an outside change to the open template re-renders the editor, and a deleted one drops back to the list. ⌘S flushes; the picker (`+` in a book) lists exactly what this screen shows.

### Delete (chapter, book or template)
Same card: `Delete “Title”?` / `Delete “Book”?` / `Delete “Template”?` then `Cancel` / `Delete` text buttons (`confirmTpl` file, else the `confirmBook` flag, picks the target). Never `confirm()`/`alert()`; never a two-step "Confirm" button.

---

## Downloads
- **Chapter** (tools strip): `Book — Chapter.md`, raw markdown.
- **Book** (rail): `Book.zip` containing `Book/NN-title.md` (and `NN-title.notes.md` where notes exist) for each chapter, plus `Book/book.json` when frontmatter is set.

## Keyboard
(All disabled on the gate.) ⌘S save · ⌘F find · ⌘⇧D dictate · Esc (close overlay / exit Write / close find) · Enter in title → body · Enter/Shift+Enter in find → next/prev.

## Behaviour rules (do not regress)
- Minimal: bare-verb buttons, no helper text, no descriptive UI copy, no emoji.
- Rail and chapter-area icons are hover-revealed; the rail collapse chevron and the Write `×` are always visible.
- Book name is not editable inline on the Book screen — only via the rail gear's Book overlay, or double-click on Books.
- Settings lives top-right / in the rail header, never at the bottom. Infrequent actions take no real estate.
- The app is a folder utility: nothing works until a folder is open; remember the folder **handle** only (never book contents); never cache books; opening a folder shows exactly what is on disk. Log out is the only way to forget the folder.
- Never create a book without a folder. A new book exists only once it has been named and written.
- New chapters are created immediately (no "pending until named" flow for chapters). With templates in the folder the `+` first asks `Blank` or which template; the chapter is still created at once on the pick, untitled, with the template body.
- Everything autosaves to disk — no explicit save step.
- Font setting never touches UI chrome.
- Markdown download is **not** inside the Print overlay.
- Receipt print: no `@page size`, don't touch margins.
- Only export/bundle when asked.
- Dictation on the web is Chrome only — alert, never a silent no-op, elsewhere.

## Design tokens
- Colors: tokens `--fg` `--muted` `--faint` `--line` `--fill` `--bg` `--fg-hover` `--scrim` — light `#000` `#525252` `#a3a3a3` `#e5e7eb` `#f5f5f5` `#fff` `#262626` `rgba(255,255,255,.7)`; dark `#ececec` `#a3a3a3` `#737373` `#333` `#2a2a2a` `#1f1f1f` `#cfcfcf` `rgba(0,0,0,.6)`
- Type (UI, Inter): 11 caption/uppercase · 12 meta · 13 buttons/status · 14 rows/overlays · 15 book name · 20 page title. Content: 36/700 chapter title; body = Size setting; print = size×0.5 (receipt) / ×0.67 (letter) in pt; print header/footer 9pt.
- Spacing: 2 (list gap) · 4 (icon gap) · 8 · 10 (row x-padding) · 12 · 16 · 20 · 24 · 32 (grid gap) · 40 · 48 · 96 (main top).
- Radii: 3 / 4 / 6 / 8. Shadows: none.
- Motion: opacity `.4s`, hover-out delay 600 ms; cover lift `.25s cubic-bezier(.2,.7,.2,1)`; scroll `smooth` for find.
- Layout: rail 280 / 56; notes pane 300; content 672; editor line-height 1.75; Write padding `45vh 24px 50vh`.

## Assets
No images. Icons are inline 24-viewBox stroke SVGs (Lucide-equivalent): arrow-left, plus, printer, download, settings/gear, search, maximize, mic, sticky-note (notes), trash, x, chevron-left/right/up/down, check. Fonts: Inter from Google Fonts (`wght 400–700`) in the prototype; bundle locally in production.

## No desktop app
The Electron shell built 2026-10-07 was removed 2026-10-08: Chrome persists the folder grant and dictates, so the apps had nothing left to offer against a signed-download burden. Google Chrome (web link, or a double-clicked `index.html`) is the only runtime; never reintroduce a native bridge (`window.writer`, `window.dictate`), Show in Finder, or OS folder watching.

## Files
- `index.html` — the app (template + logic in one file; references `support.js`). Lives at the repo root so GitHub Pages serves it.
- `support.js` — the small template runtime the page needs.

## Phones and touch

Below 760px the Book screen is one column. The chapter rail is a drawer: a fixed top-left pair (Books, Chapters)
opens it over the page, its scrim or a chapter row closes it, and its top row (new chapter, print, download, book)
closes it when used. Notes cover the whole screen with the same close chevron; the tool strip is always visible, a
solid band, and the find bar wraps under it on its own row; dialogs fit the width; the shelf and template screens
tighten their padding. Hover-revealed icons are always visible on touch screens. Everything above 760px is
unchanged. CSS lives in the `<style>` block as `.wr-*` class rules with `!important` over the inline styles
(`wr-page`, `wr-main`, `wr-rail`, `wr-notes`, `wr-tools`, `wr-find`, `wr-dlg`, `wr-print`, `wr-dict`, `wr-h1`,
`wr-mbar`, `wr-scrim`, `wr-wide`, `wr-vh`/`wr-minvh` for dvh). Folder access still needs desktop Chrome.
