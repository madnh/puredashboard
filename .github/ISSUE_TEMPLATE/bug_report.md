---
name: Bug report
about: Something doesn't work the way the docs say
title: "[bug] "
labels: bug
---

**What happened**
A clear description of the bug.

**Steps to reproduce**
Ideally a minimal HTML page that imports the module(s). For example:

```html
<script type="module">
  import "../src/table.js";
  // …smallest snippet that shows the problem
</script>
```

**Expected vs actual**
What you expected, and what happened instead.

**Environment**
- Component / file (e.g. `table.js`, `reactive.js`):
- Which `html` tag (the `reactive.js` parts engine, or `html.js` string builder):
- Browser + version:
- Release tag or commit:

**Notes**
Console errors, screenshots, CSP settings, anything else relevant.
