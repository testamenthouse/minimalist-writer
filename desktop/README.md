# Writer — desktop

Electron shell around `../index.html` (+ `../support.js`). The root page stays the only source of the UI;
`npm run sync` copies it into `./app` (Google Fonts link swapped for the bundled Inter) before every run or build.

- `npm start` — run locally.
- `npm run smoke` — headless load check (prints `SMOKE {...}` and exits).
- `npm run dist` — build into `dist/` without publishing. macOS is Apple Silicon only: a `Writer-<version>-mac-arm64.dmg` installer, which `scripts/zip-dmg.js` then wraps as `Writer-<version>-mac-arm64.dmg.zip` (the download to hand out). No Intel or universal build, no app zip.
- `npm run release` — build and publish to the GitHub release for the current version (run from your own machine; the workflow in `.github/workflows` is manual-only).

Updates: `electron-updater` checks GitHub Releases on launch and hourly, downloads in the background and installs on quit — **but on macOS it can only update from an app zip target, which this build no longer produces (DMG only, by choice); until a zip target is added back the menu's Check for Updates reports an error**;
the app menu shows **Restart to Update** once a download is ready. macOS requires a Developer ID-signed, notarized build
for updates to install — the environment variables are listed in the root README under "Publish a release".

Dictation: `npm run sync` compiles `dictate/dictate.swift` (Speech.framework, on-device) into `bin/dictate` with `xcrun swiftc`; it ships as an extra resource and the page reaches it through `src/preload.js` (`window.dictate`). The first use prompts for the microphone and speech recognition. `DICTATE_BIN=<fake helper> npm run smoke` prints the relayed events.

Local gotchas: run Electron with `ELECTRON_RUN_AS_NODE` unset (VS Code shells set it, which turns Electron into plain Node). If `npm install` reports blocked install scripts, run `npm approve-scripts --allow-scripts-pending` so the Electron binary downloads.
