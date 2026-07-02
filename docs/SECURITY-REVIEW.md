# Security Review — `src/` (2026-07)

A point-in-time security audit of the library source. **All findings below have been
remediated** (see [Status](#status)); this document is kept as a record of what was
checked and what changed.

- **Method:** a 7-dimension audit (xss-sinks, markdown, code-exec, reactive-engine,
  router, upload-forms, supply-chain), each finding then adversarially verified (an
  independent pass tried to refute it). 9 raw findings → **6 kept, 3 refuted**.
- **Headline:** no critical/high issues. The core invariants held — no `eval`/`new
  Function` anywhere, `md.js` Markdown is `textContent`-only with a real scheme
  whitelist, no outbound network calls, no hardcoded secrets. The 6 findings were
  hardening items at the **trusted/untrusted boundary** plus two robustness bugs.

> **CSP nuance.** Under the library's target deployment — a strict `script-src 'self'`
> with no `unsafe-inline` — navigating an `<a href="javascript:…">` is *blocked by CSP*.
> So the `javascript:`-URL findings (#1/#2) only executed in apps shipping **no CSP or a
> weak one**. They were still fixed (defense in depth + internal consistency with
> `md.js`), but they were never an unconditional bypass.

## Findings & remediation

| # | Sev | Area | Issue | Fixed by |
|---|-----|------|-------|----------|
| 1 | Low | `nav.js` / `menu.js` / `table.js` | `href` from a data field wasn't scheme-whitelisted → a `javascript:` URL ran on click (absent strict CSP) | Engine guard (#2) + `menu.js` `safeUrl()` |
| 2 | Low | `reactive.js` `AttrPart` | The engine `setAttribute` never validated URL scheme — the layer that *could*. Root cause of #1. | `safeUrlAttr()` drops `javascript:`/`vbscript:` (and `data:` on navigational attrs; `data:` still allowed on media like `<img src>`) |
| 3 | Low | `reactive.js` child/array | Bindings `innerHTML`'d any non-primitive via `String(v)` **without checking a SAFE marker** → object with a hostile `toString()` = XSS (type confusion) | Only values carrying `Symbol.for("puredashboard.safe")` (shared with `html.js` `raw()`/`html`) render as markup; anything else → text |
| 4 | Low (confirmed) | `router.js` | `decodeURIComponent()` on a route param had no try/catch → `#/x/%` threw `URIError`, wedging `render()` | `try/catch` falls back to the raw capture |
| 5 | Low | `form.js` | A field named `__proto__`/`constructor` corrupted the collected `values` object (instance-level, not global) | Collect into `Object.create(null)` |
| 6 | Info | `upload.js` | `accept`/`maxSize` are client-side UX hints only — bypassable | Documented (`@prop` + `_agents.md`): the server must validate |

### Refuted (verified safe as used)
- `menu.js` / `nav.js` `icon` / `render` fields via `raw()` — **trusted-by-design** author
  markup (icons/SVG), documented; not an untrusted sink.
- `form.js` FormData key edge — subsumed by #5; no separate global-pollution issue.

## Status

All six findings were remediated in **PR #2** (commit `cb32e97`, `fix(security): address
all findings from the security review`), and locked in by `test/security.test.mjs`
(scheme sanitize incl. mixed-case/tab-obfuscated/media-vs-nav, the type-confusion guard,
`raw()` interop, the router `URIError` guard, form `__proto__`, and menu `href`). The
`reactive.js` type-confusion test that previously asserted the *vulnerable* behavior was
corrected to require the SAFE marker. Full suite green.

The trust boundary is now documented in [`src/_agents.md`](../src/_agents.md): component
props (`items`/`href`/`getHref`/`icon`/`render`) are trusted author config; route out
untrusted content through `textContent`/`<puredashboard-markdown>` or sanitize it first.
