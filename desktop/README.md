# Writer — desktop

Electron shell around `../handoff/Writer.dc.html`. The prototype stays the only source of the UI;
`npm run sync` copies it into `./app` (Google Fonts link swapped for the bundled Inter) before every run or build.

- `npm start` — run locally.
- `npm run smoke` — headless load check (prints `SMOKE {...}` and exits).
- `npm run dist` — build installers into `dist/` without publishing.
- `npm run release` — build and publish to the GitHub release for the current version (CI does this on `v*` tags).

Updates: `electron-updater` checks GitHub Releases on launch and hourly, downloads in the background and installs on quit;
the app menu shows **Restart to Update** once a download is ready. macOS requires a Developer ID-signed, notarized build
for updates to install — see the release workflow for the secrets.

Local gotchas: run Electron with `ELECTRON_RUN_AS_NODE` unset (VS Code shells set it, which turns Electron into plain Node). If `npm install` reports blocked install scripts, run `npm approve-scripts --allow-scripts-pending` so the Electron binary downloads.
