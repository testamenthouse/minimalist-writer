# Writer

A minimalist book-writing app that works offline. A library is a folder on your disk, each book is a subfolder, and each chapter is a Markdown file. Writer reads and writes those files directly and keeps nothing else, so your manuscript is always yours, in plain text, wherever you keep it.

No accounts, no server, no analytics. Everything stays on your machine.

- [What it does](#what-it-does)
- [Get it](#get-it)
- [Your library is a folder](#your-library-is-a-folder)
- [Writing](#writing)
- [Write mode](#write-mode)
- [Templates](#templates)
- [Dictation](#dictation)
- [Printing and downloads](#printing-and-downloads)
- [Settings](#settings)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Building the desktop app](#building-the-desktop-app)
- [Running the web version](#running-the-web-version)
- [Repository layout](#repository-layout)

## What it does

- **A shelf of books.** Each book is a cover on a shelf with a spine color and a word goal. Open one and the chapters sit in a rail on the left.
- **A clean editor.** Markdown stays in the file as you typed it. The editor dims the markers in place and renders headings, quotes, lists, bold and italic, the way iA Writer does.
- **Write mode.** Fullscreen, nothing but the text. Typewriter scrolling keeps the line you are on centered. Dim fades every paragraph but the one you are in.
- **Notes.** A notes pane beside every chapter, saved to a sidecar file, never printed or counted.
- **Dictation.** Speak at the caret. On the Mac the recognition runs on-device through Apple's own recognizer.
- **Print.** Letter pages with optional page numbers, or a receipt printer roll at 58mm or 80mm.
- **Templates.** Keep chapter starting points in a `Templates/` folder and pick one when you add a chapter.
- **Autosave and folder watching.** Every change is on disk within a second. Edit a file in another app and Writer picks it up.
- **Light, dark, or system theme.** Dark is charcoal, not black.

## Get it

**Mac app (Apple Silicon).** Download the latest `.dmg.zip` from [Releases](../../releases), unzip it, open the DMG, and drag Writer to Applications. The app opens straight into your remembered library.

**Windows app.** Download the latest `.exe` installer from [Releases](../../releases). It installs for the current user with one click. Dictation is Mac only.

**Web version.** Open the published page in Google Chrome:

https://testamenthouse.github.io/minimalist-writer/

Chrome is required because the app opens a folder on your disk through the File System Access API. Other browsers show a "Google Chrome required" screen. You can also open `handoff/Writer.html` from a checkout in Chrome. It is the whole app in one file.

Phones and tablets get a one-column layout but cannot open a folder. Writing happens on a desktop.

## Your library is a folder

The first time you open Writer it asks for a folder. That folder is your library. Keep it in iCloud Drive, Dropbox, or a git repo. Open it in any other editor. Writer never caches a book, so what you see is always what is on disk.

```
My Books/
  writer.json                 settings (font, size, theme)
  The Long Field/             a book
    book.json                 { "wordGoal": 80000, "color": "#bfe0f5" }
    01-the-river.md           chapter 1
    01-the-river.notes.md     its notes
    02-first-frost.md         chapter 2
  Templates/                  chapter templates (reserved)
    scene.md
```

- A book is a folder. Nothing else is. A library whose root holds loose `.md` files is refused until you move them into a book.
- A chapter file starts with `# Title` on the first line, a blank line, then the body exactly as you typed it. Reordering chapters in the rail renumbers the files.
- Notes live in a `.notes.md` sidecar beside the chapter, written only when there is something in them.
- `book.json` holds the word goal and spine color. It exists only while at least one is set.
- `Log out` in Settings is the only thing that makes Writer forget the folder. Closing the tab or quitting the app does not.

## Writing

1. **New book** with `+` on the shelf. Give it a name, and optionally a word goal and a spine color. The folder is created when you save the name, not before.
2. **New chapter** with `+` in the rail. It appears at once, untitled, ready for a title. Press Enter in the title to drop into the body.
3. **Type Markdown.** `#` headings, `>` quotes, `-` lists, `**bold**`, `*italic*`, `~~struck~~`, `` `code` ``, `---` rules. The markers stay in the file.
4. **Reorder** chapters by dragging rows in the rail. Collapse the rail to chapter numbers with the chevron at the bottom.
5. **Find** with `⌘F`. Enter and Shift+Enter step through matches.
6. **Notes** with the note icon in the chapter tools. The pane opens on the right and stays open until you close it.
7. **Word counts** sit bottom right: chapter, book, and the goal if the book has one.

Everything autosaves under a second after you stop typing. `⌘S` forces it. The status line shows `Saved h:mm` or `Save failed`.

Double-click a cover on the shelf, or use the gear in the rail, to rename a book, change its goal or color, or delete it. Every delete asks first.

## Write mode

The fullscreen icon in the chapter tools, or the maximize button, takes you into Write mode: the text alone on a white or charcoal page.

- **Typewriter** keeps the caret's line at the center of the screen.
- **Dim** fades every paragraph except the one you are in.
- **Dictate** starts and stops dictation.

The three toggles sit bottom left. `Esc` or the `×` top right leaves.

## Templates

Put any chapter-shaped `.md` file in a `Templates/` folder at the library root, or save the current chapter as one with the layers icon in the chapter tools. From then on `+` in a book asks `Blank` or which template. The Templates screen (layers icon on the shelf) lists, edits, renames and deletes them. Nothing is seeded. The folder is the only source.

## Dictation

Click the mic in the chapter tools, press `⌘⇧D`, or use the Dictate toggle in Write mode. Words land at the caret, in the body or the title, and follow it if you move it. A bar at the bottom shows the words still forming. A solid Stop button sits bottom right.

Speak punctuation the way macOS Dictation expects: `period`, `comma`, `question mark`, `open quote`, `new paragraph`, and so on.

- **Mac app:** recognition runs on-device through Apple's Speech framework. The first use asks for microphone and speech recognition permission. macOS Dictation must be turned on in System Settings → Keyboard → Dictation.
- **Web version:** uses Chrome's speech engine. Other browsers cannot dictate.

## Printing and downloads

The printer icon in the chapter tools prints the chapter. The one in the rail prints the book.

- **Letter**: 25mm margins, the book title at the top of each page and page numbers at the bottom when the box is checked. Each chapter starts a new page. Use the browser's Save as PDF to get a file.
- **Receipt**: for thermal roll printers at 58mm or 80mm. Pick the width at print time.

The download icon in the chapter tools saves the chapter as `Book — Chapter.md`. The one in the rail saves the whole book as `Book.zip` with every chapter, its notes, and `book.json`.

## Settings

The gear in the shelf's top bar, or `Settings` at the bottom of the rail.

| Row | What it does |
|---|---|
| Folder | Shows the library and lets you change it |
| Sync | Flushes pending edits, then re-reads the whole folder |
| Font | Sans, serif, mono or Courier for titles, body and print. Chrome stays in Inter |
| Size | Editor text size: 16, 18, 20 or 22 |
| Theme | System, Light or Dark |
| Log out | Forgets the folder and returns to the start screen |

Settings are saved to `writer.json` in the library, so they follow the folder.

## Keyboard shortcuts

| Keys | Action |
|---|---|
| `⌘S` / `Ctrl+S` | Save now |
| `⌘F` / `Ctrl+F` | Find in chapter (Enter / Shift+Enter to step) |
| `⌘⇧D` | Start or stop dictation |
| `Enter` in the title | Move to the body |
| `Esc` | Close dialog, close find, or leave Write mode |

## Building the desktop app

The desktop app is an [Electron](https://www.electronjs.org/) shell around `handoff/Writer.dc.html`, built with electron-builder. The prototype file is the only source of the UI. The Mac build targets Apple Silicon. The Windows build is a 64-bit one-click installer.

**You need**

- Node.js 22
- On the Mac: Xcode command line tools (`xcode-select --install`) for the Swift dictation helper
- For a signed, notarized Mac release: a Developer ID certificate and an Apple ID app-specific password

**Run it locally**

```sh
git clone https://github.com/testamenthouse/minimalist-writer.git
cd minimalist-writer/desktop
npm install
env -u ELECTRON_RUN_AS_NODE npm start
```

`npm start` first runs `npm run sync`, which copies the prototype into `desktop/app` with the Google Fonts link swapped for bundled Inter and React pointed at the vendored copy, so the packaged app is fully offline. On the Mac it also compiles `dictate/dictate.swift` into `bin/dictate`.

**Build an installer**

```sh
cd desktop
npm run dist
```

On a Mac this writes `Writer-<version>-mac-arm64.dmg` and wraps it as `Writer-<version>-mac-arm64.dmg.zip` in `desktop/dist`. The zip is the download to hand out. On Windows it writes the NSIS installer.

**Publish a release**

Bump `version` in `desktop/package.json`, then push a tag:

```sh
git tag v0.2.0
git push origin v0.2.0
```

The [release workflow](.github/workflows/release.yml) builds on macOS and Windows, signs and notarizes the Mac build, and uploads both to a GitHub release. It needs these repository secrets: `MAC_CERT_P12_BASE64`, `MAC_CERT_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`. Running `npm run release` locally does the same with the same variables in your environment.

**Updates.** The app checks GitHub Releases on launch and hourly and offers **Restart to Update** when a download is ready. On the Mac, automatic updates need an app zip target that the current build does not produce, so Mac users download the new DMG from Releases until that target is restored. Windows updates work through the installer.

**Troubleshooting**

- *Electron starts as plain Node, or nothing opens.* VS Code terminals set `ELECTRON_RUN_AS_NODE=1`. Unset it, as in the commands above.
- *npm reports blocked install scripts.* Run `npm approve-scripts --allow-scripts-pending` in `desktop/` so the Electron binary downloads.
- *Dictation crashes or never prompts in a dev run.* The dev script already handles this (the helper disclaims the terminal as its responsible process). If macOS Dictation itself is off, the app tells you and opens the settings pane.
- *`npm run smoke`* runs a headless load check and exits. `DICTATE_BIN=<script> npm run smoke` drives the dictation bridge with a fake helper.

## Running the web version

There is no build step. The [Pages workflow](.github/workflows/pages.yml) publishes `handoff/Writer.dc.html` and `handoff/support.js` on every push to `main`. To run it locally, serve the `handoff` folder with any static server and open `Writer.dc.html` in Chrome, or just open `handoff/Writer.html`, the single-file bundle.

The web version loads React from a CDN the first time; the desktop app ships it.

## Repository layout

```
handoff/
  Writer.dc.html     The app. Template and logic in one file; the only source of the UI
  support.js         The small runtime that binds the template
  Writer.html        Single-file bundle of the same app for opening directly in Chrome
  README.md          The full behavior spec: every screen, rule and file-format detail
  DESIGN-NOTES.md    The design decision log
desktop/
  src/               Electron main, preload and dictation bridge
  dictate/           The Swift on-device speech helper
  scripts/           sync, build-dictate, zip-dmg
  electron-builder.yml
.github/workflows/   Pages deploy and tagged releases
```
