# Contributing

Thanks for your interest in PureDashboard. This project has an intentionally simple
contribution model — please read it before you start.

## TL;DR

- **Found a bug or have an idea? [Open an issue.](../../issues/new/choose)**
- **Pull requests are not accepted** — PR creation on this repo is restricted to
  collaborators (GitHub → Settings → General → *Pull request permissions: Collaborators
  only*), so opening one isn't possible for outside contributors. This is by design (see
  below); it is not a judgement of your work.
- **Want a change now?** The library is MIT-licensed and dependency-free: **fork it,
  edit the file, and use it however you like.** You own your copy.
- **Security issue?** Do *not* open a public issue — see [SECURITY.md](SECURITY.md).

## Why issues only, no PRs

PureDashboard's whole value proposition is being a **small, auditable, single-owner,
zero-dependency** codebase you can read top to bottom and trust (see the README's *Why
this exists*). That only holds if every line goes through one consistent hand and the
[design rules](docs/DEVELOPMENT.md#design-rules) are applied uniformly.

So the model is deliberately asymmetric:

- **You tell me what you need** by opening an issue — a bug, a missing feature, a rough
  edge. If it fits the scope and philosophy, I'll implement it.
- **If it doesn't fit, or you need it on your own timeline, you fork.** That's not a
  fallback — it's the intended path. The code is yours to change; nothing upstream will
  move under you.

This keeps the surface tiny and the supply chain non-existent, which is the point.

## Opening a good issue

Pick the matching template and fill it in. The most useful issues include:

- **Bugs:** what you did, what you expected, what happened. A minimal repro (a tiny HTML
  page importing the module) is gold. Note the browser and whether you're using the
  `reactive.js` `html` or the `html.js` one.
- **Features / changes:** the *problem* you're trying to solve, not just a proposed API.
  Keep in mind the constraints: no dependencies, no build step, CSP-safe, native-first.
  A change that adds a dependency or a build step is out of scope by definition.

## If you're hacking on your own fork

Everything you need is in the docs:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the engine and components fit together.
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — the design rules, the add-a-component recipe, and how to run the tests (`make -C test`, jsdom in Docker — no host install).

Please keep the invariants: zero runtime dependencies, no build/bundler, no
`eval`/`new Function`, BEM class names, and all user-facing strings in a `labels` map.
