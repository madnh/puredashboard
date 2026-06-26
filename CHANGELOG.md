# Changelog

All notable changes to PureDashboard are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Versions map to git tags / GitHub Releases (e.g. `v0.1.0`). While the version is `0.x`,
the API may still change between minor versions.

## [Unreleased]

## [0.1.0] - 2026-06-26

First public release — extracted into a standalone, zero-dependency, no-build library.

### Added
- **Template engine** (`reactive.js`): a lit-html-style parts engine that diffs the DOM
  in place (so `<input>` focus/caret/scroll survive re-renders), the `repeat()` keyed-list
  directive, `renderResult`, and the `Reactive` custom-element base. No `eval`/`new Function`.
- **String templating** (`html.js`): escaped `html`, plus `raw`, `icon`, `escapeHTML`.
- **Components**
  - `<puredashboard-table>` — sortable columns, filter, pagination + rows-per-page,
    row selection with a bulk-action bar, per-row actions.
  - `<puredashboard-upload>` — drag-and-drop, thumbnails, per-file progress, native
    multipart form submit; plus `uploadFile()`.
  - `<puredashboard-markdown>` — XSS-safe Markdown rendered `textContent`-only with an
    href whitelist; plus `parseMarkdown` / `renderMarkdown`.
- **Imperative overlays** — `dialog` / `drawer` / `alert` / `confirm` / `prompt`,
  `menu()`, and `toast` (+ `.success/.error/.warn/.info`), all on the native top layer.
- **Router** (`router.js`) — hash or History API modes, params, catch-all 404,
  lazy-loaded pages, layouts, and guards.
- **Optional theme** (`src/theme/`) — `tokens.css` (light/dark palette), `base.css`
  (form controls), `shell.css` (dashboard frame), and `dashboard.css` (all-in-one).
  Dark by default, light via `prefers-color-scheme`, forceable with `data-theme`.
- **Docs & tooling** — README, `docs/ARCHITECTURE.md`, `docs/USAGE.md`,
  `docs/DEVELOPMENT.md`; jsdom test suite run in Docker (`make -C test`); a browser
  showcase/demo harness under `test/`.

### Changed
- Toasts now use the elevated `--panel` surface (consistent with `menu` / `dialog`), so
  they read as crisp cards instead of relying on a low-contrast background.

[Unreleased]: https://github.com/madnh/puredashboard/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/madnh/puredashboard/releases/tag/v0.1.0
