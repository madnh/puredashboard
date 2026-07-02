// Security regression tests for the fixes from the security review:
//   - reactive.js: URL-attribute scheme sanitize (javascript:/vbscript:/data:)
//   - reactive.js: child/array bindings only innerHTML SAFE-marked values
//   - router.js:   malformed %-escape in a route param must not throw
//   - form.js:     a "__proto__" field must not corrupt the collected object
//   - menu.js:     item href with a dangerous scheme is neutralized
// Run in isolation via Docker (no host install): `make -C test`.
import { JSDOM } from "jsdom";

// One realm for the whole file (custom elements are realm-bound).
const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/", runScripts: "outside-only" });
const w = dom.window;
for (const k of ["document", "HTMLElement", "customElements", "NodeFilter", "CustomEvent",
  "Node", "Event", "MouseEvent", "FormData"])
  global[k] = w[k];
global.window = w;
global.queueMicrotask = queueMicrotask;
w.HTMLElement.prototype.showPopover = function () {};
w.HTMLElement.prototype.hidePopover = function () {};

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const tick = () => new Promise((r) => queueMicrotask(() => queueMicrotask(r)));

const { html, renderResult } = await import("../src/reactive.js");
const { raw } = await import("../src/html.js");

// ── reactive.js: URL-attribute scheme sanitize ─────────────────────────────
{
  const host = document.createElement("div");
  const cases = [
    ["javascript:alert(1)", "", "javascript: href dropped"],
    ["vbscript:msgbox(1)", "", "vbscript: href dropped"],
    ["data:text/html,x", "", "data: href dropped"],
    ["  JaVaScRiPt:alert(1)", "", "mixed-case/whitespace javascript: href dropped"],
    ["https://example.com/x", "https://example.com/x", "https href preserved"],
    ["/dash?a=1", "/dash?a=1", "relative href preserved"],
    ["#/nodes/web", "#/nodes/web", "hash href preserved"],
    ["mailto:a@b.co", "mailto:a@b.co", "mailto href preserved"],
  ];
  for (const [href, want, msg] of cases) {
    renderResult(html`<a href=${href}>x</a>`, host);
    ok(host.querySelector("a").getAttribute("href") === want, msg);
  }
  renderResult(html`<a href=${"java\tscript:alert(1)"}>x</a>`, host);
  ok(host.querySelector("a").getAttribute("href") === "", "tab-obfuscated javascript: href dropped");
  const img = "data:image/png;base64,iVBORw0KGgo=";
  renderResult(html`<img src=${img} />`, host);
  ok(host.querySelector("img").getAttribute("src") === img, "data: allowed on img src");
  renderResult(html`<img src=${"javascript:alert(1)"} />`, host);
  ok(host.querySelector("img").getAttribute("src") === "", "javascript: src dropped");
}

// ── reactive.js: child binding type-confusion guard ────────────────────────
{
  const host = document.createElement("div");
  const hostile = { toString() { return "<img src=x onerror=alert(1)>"; } };
  renderResult(html`<div>${hostile}</div>`, host);
  ok(host.querySelector("img") === null, "unmarked object child NOT innerHTML'd");
  ok(host.querySelector("div").textContent.includes("<img"), "unmarked object rendered as text");
  renderResult(html`<div>${[hostile]}</div>`, host);
  ok(host.querySelector("img") === null, "unmarked object array item NOT innerHTML'd");
  const safe = { [Symbol.for("puredashboard.safe")]: true, toString() { return "<b>ok</b>"; } };
  renderResult(html`<div>${safe}</div>`, host);
  ok(host.querySelector("div b")?.textContent === "ok", "SAFE-marked child still renders as markup");
  // html.js raw() must be recognized as SAFE by the reactive engine
  renderResult(html`<div>${raw("<i>icon</i>")}</div>`, host);
  ok(host.querySelector("div i")?.textContent === "icon", "html.js raw() treated as SAFE by reactive.js");
}

// ── router.js: malformed %-escape must not throw ───────────────────────────
{
  const { Router } = await import("../src/router.js");
  const routes = { "/nodes/:name": { load: async () => ({ default: () => {} }) } };
  const withHash = (hash, fn) => {
    const rd = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/" + hash });
    const savedLoc = global.location, savedHist = global.history, savedWin = global.window;
    global.location = rd.window.location; global.history = rd.window.history; global.window = rd.window;
    try { return fn(); } finally { global.location = savedLoc; global.history = savedHist; global.window = savedWin; }
  };
  let hit = null, threw = false;
  withHash("#/nodes/%", () => { try { hit = new Router({ mode: "hash", routes }).match(); } catch { threw = true; } });
  ok(!threw, "malformed %-escape route does not throw (URIError guarded)");
  ok(hit && hit.params.name === "%", "param falls back to the raw (undecoded) capture");
  const hit2 = withHash("#/nodes/a%20b", () => new Router({ mode: "hash", routes }).match());
  ok(hit2 && hit2.params.name === "a b", "well-formed %-escape still decodes");
}

// ── form.js: a "__proto__" field must not corrupt the collected object ──────
{
  const { PuredashboardForm } = await import("../src/form.js");
  void PuredashboardForm;
  document.body.innerHTML = `<puredashboard-form><input name="__proto__" value="x"><input name="ok" value="y"></puredashboard-form>`;
  const el = document.body.querySelector("puredashboard-form");
  await tick();
  let detail = null;
  el.addEventListener("submit", (e) => { detail = e.detail; });
  el.submit();
  await tick();
  ok(detail && detail.values, "form submit produced values");
  ok(({}).polluted === undefined, "no global Object.prototype pollution");
  ok(detail && detail.values.ok === "y", "normal field still collected");
  ok(detail && Object.getPrototypeOf(detail.values) === null, "collected object has null prototype (no proto corruption)");
  document.body.innerHTML = "";
}

// ── menu.js: item href with a dangerous scheme is neutralized ──────────────
{
  const { menu } = await import("../src/menu.js");
  const anchor = document.createElement("button");
  document.body.appendChild(anchor);
  menu(anchor, [{ label: "Evil", href: "javascript:alert(1)" }, { label: "Good", href: "/ok" }]);
  await tick();
  const links = [...document.querySelectorAll("a.puredashboard-menu__item")];
  const evil = links.find((a) => a.textContent.includes("Evil"));
  const good = links.find((a) => a.textContent.includes("Good"));
  ok(evil && evil.getAttribute("href") === "#", "menu neutralizes javascript: href to #");
  ok(good && good.getAttribute("href") === "/ok", "menu preserves a safe href");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
