// Tests for the optional app theme's shell (src/theme/shell.css): the .app-frame wrapper.
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom computes the cascade for these properties but does no layout, so this pins the
// declared contract; the scroll behaviour itself is a real-browser property.
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>");
const w = dom.window;
const document = w.document;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };

const style = document.createElement("style");
style.textContent = readFileSync(new URL("../src/theme/shell.css", import.meta.url), "utf8");
document.head.appendChild(style);

// ---- body is the fixed full-height column (unchanged) ----
{
  const b = w.getComputedStyle(document.body);
  ok(b.display === "flex" && b.flexDirection === "column" && b.overflow === "hidden", "body: fixed flex column that does not scroll");
}

// ---- .app-frame carries the full-height column down through a wrapper (router outlet, mount point) ----
{
  const outlet = document.createElement("div");
  outlet.className = "app-frame";
  document.body.appendChild(outlet);
  const c = w.getComputedStyle(outlet);
  ok(c.display === "flex" && c.flexDirection === "column", ".app-frame is a flex column");
  ok(c.flexGrow === "1" && c.flexShrink === "1", ".app-frame fills <body>");
  ok(c.minHeight === "0" || c.minHeight === "0px", ".app-frame min-height 0 (may shrink below its content)");
  ok(c.overflow === "auto", ".app-frame scrolls itself");
  const plain = document.createElement("div");
  document.body.appendChild(plain);
  ok(w.getComputedStyle(plain).display === "block", "a wrapper without the class is unaffected");
}

console.log(`theme-shell.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
