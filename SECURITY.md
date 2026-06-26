# Security Policy

PureDashboard is built for security-sensitive, embedded admin/ops UIs, so reports are
taken seriously.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Use GitHub's private reporting instead: go to the **[Security tab][advisories]** →
**“Report a vulnerability”**. This opens a private advisory visible only to you and the
maintainer — nothing is disclosed until a fix is ready.

Helpful things to include:

- The affected file/component and version (release tag or commit).
- A minimal proof of concept — ideally a small HTML page that imports the module.
- The impact you can demonstrate (e.g. script execution, data exfiltration, DoS).

This is a single-maintainer project, so response is best-effort: expect an initial reply
within a few days, and a fix or a clear decision once the issue is confirmed. Please
allow reasonable time to patch before any public disclosure.

[advisories]: ../../security/advisories

## Supported versions

Fixes land on the **latest release / `main`**. There are no long-term support branches —
pin a release tag, and update when a fix you need ships.

## Scope & threat model

What this project deliberately does to shrink the attack surface:

- **No third-party JavaScript, no build step.** There is no `node_modules`, no
  transitive dependency tree, and PureDashboard is **not published to any registry** —
  so there is no supply-chain path to compromise. Any package named `puredashboard` on a
  registry is **not** this project (see the README).
- **CSP-safe by construction.** The template engine clones `<template>` nodes and walks
  markers — no `eval`, no `new Function` — so it runs under a strict
  `script-src 'self'`. The only relaxation the components need is `style-src 'unsafe-inline'`
  (for dynamic inline `style="…"` values like progress widths), **never** for scripts.
- **`md.js` is for untrusted input.** Markdown is rendered with `document.createElement`
  + `textContent` only (no HTML parsing), and link `href`s are whitelisted to
  `http`/`https`/`mailto`/relative. Reports of HTML/script injection through it are
  in-scope and high priority.

Out of scope: vulnerabilities in *your* application code, your server, or your CSP
configuration; issues that require an already-XSS'd page; and anything depending on a
modified copy of the library.
