# Writer

A minimalist book-writing app that works offline. A library is a folder on your disk, each book is a subfolder, and each chapter is a Markdown file. Writer reads and writes those files directly and keeps nothing else, so your manuscript is always yours, in plain text, wherever you keep it.

**Try it now:** https://testamenthouse.github.io/minimalist-writer/ (Google Chrome, then pick any folder)

**Or run it yourself, no technical knowledge needed:** download the folder and double-click `index.html`. That is the whole setup. There is nothing to install, no build step and no server, and your writing never leaves your machine.

1. Click the green **Code** button at the top of this page, then **Download ZIP**.
2. Unzip it anywhere you like.
3. Open the folder and double-click `index.html`. If it opens in another browser, right-click it and choose **Open With → Google Chrome**.
4. Click **Open folder** and pick where your books should live.

Chrome has everything the app needs, dictation included.

**There is no database.** The only storage is the folder you choose. The whole app runs off that folder: every book, chapter, note, template and setting is a file in it, read and written directly. No accounts, no server, no analytics. Everything stays on your machine.

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
- [Running the web version](#running-the-web-version)
- [Repository layout](#repository-layout)

## What it does

- **A shelf of books.** Each book is a cover on a shelf with a spine color and a word goal. Open one and the chapters sit in a rail on the left.
- **A clean editor.** Markdown stays in the file as you typed it. The editor dims the markers in place and renders headings, quotes, lists, bold and italic, the way iA Writer does.
- **Write mode.** Fullscreen, nothing but the text. Typewriter scrolling keeps the line you are on centered. Dim fades every paragraph but the one you are in.
- **Notes.** A notes pane beside every chapter, saved to a sidecar file, never printed or counted.
- **Dictation.** Speak at the caret, through Chrome's speech engine.
- **Print.** Letter pages with optional page numbers, or a receipt printer roll at 58mm or 80mm.
- **Templates.** Keep chapter starting points in a `Templates/` folder and pick one when you add a chapter.
- **Autosave and folder watching.** Every change is on disk within a second. Edit a file in another app and Writer picks it up.
- **Light, dark, or system theme.** Dark is charcoal, not black.

## Get it

**Web version.** Open the app in Google Chrome:

https://testamenthouse.github.io/minimalist-writer/

**Your own copy.** Download the ZIP and double-click `index.html`, as described at the top. Same app, no server.

Chrome is required because the app opens a folder on your disk through the File System Access API. Other browsers show a "Google Chrome required" screen.

Phones and tablets get a one-column layout but cannot open a folder. Writing happens on a desktop.

## Your library is a folder

The first time you open Writer it asks for a folder. That folder is your library and the only place anything is stored. There is no database behind it, no copy in the cloud, and no hidden cache: the entire UI is built from the files in that folder each time it reads them, and every edit goes straight back to disk. Keep it in iCloud Drive, Dropbox, or a git repo. Open it in any other editor. What you see is always what is on disk.

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
- A [Sermon Builder](https://github.com/testamenthouse/sermon-builder) library is refused untouched. Pick one by mistake and Writer links you to Sermon Builder instead of writing anything into it.

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

uses Chrome's speech engine. Other browsers cannot dictate.

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

## Running the web version

There is no build step. The app is `index.html` plus `support.js` at the repo root, so GitHub Pages serves it as it is. To run it locally, open `index.html` in Chrome straight from the folder, or serve the folder with any static server.

The page loads React from a CDN the first time it opens.

## Repository layout

```
index.html           The app. Template and logic in one file; the only source of the UI
support.js           The small runtime that binds the template
SPEC.md              The full behavior spec: every screen, rule and file-format detail
.github/workflows/   Pages workflow, manual-only (nothing runs automatically)
```

## License

[GPL-3.0](LICENSE).
