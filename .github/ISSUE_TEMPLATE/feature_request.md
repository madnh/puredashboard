---
name: Feature request / change
about: Suggest a feature or change (the maintainer implements; PRs aren't accepted)
title: "[idea] "
labels: enhancement
---

**The problem**
What are you trying to do that's hard or impossible today? Describe the *problem*, not
just a proposed API — it usually leads to a better solution.

**A possible approach (optional)**
If you have one in mind, sketch it.

**Fits the constraints?**
PureDashboard stays within hard limits. Please confirm your idea is compatible:

- [ ] No new runtime dependency (no npm packages)
- [ ] No build step / bundler / transpile
- [ ] CSP-safe (no `eval` / `new Function`)
- [ ] Prefers native elements & the platform

> Reminder: pull requests are not accepted (see CONTRIBUTING.md). Open this issue and,
> if it fits the scope, the maintainer will implement it — otherwise you're free to fork
> and build it yourself (MIT).
