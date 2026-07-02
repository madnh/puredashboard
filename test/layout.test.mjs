// Tests for layout.js (<puredashboard-layout> family).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual elements, events and logic.
// (matchMedia is absent in jsdom — the breakpoint path is feature-detected and
// verified in a real browser; here we only assert it never throws.)
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
const w = dom.window;
for (const k of ["document", "HTMLElement", "customElements", "CustomEvent", "Node", "Event", "MouseEvent"])
  global[k] = w[k];
global.window = w;               // NB: jsdom window has NO matchMedia — the guard must hold
global.queueMicrotask = queueMicrotask;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const mount = (tag) => { const el = document.createElement(tag); document.body.appendChild(el); return el; };

const mod = await import("../src/layout.js");
void mod;

// ---- all five elements are defined ----
{
  for (const tag of ["puredashboard-layout", "puredashboard-header", "puredashboard-content", "puredashboard-footer", "puredashboard-sider"])
    ok(customElements.get(tag), `${tag} is defined`);
}

// ---- each element preserves its author children ----
{
  const lay = document.createElement("puredashboard-layout");
  const kid = document.createElement("puredashboard-header");
  lay.appendChild(kid);
  document.body.appendChild(lay);
  ok(lay.firstElementChild === kid, "layout preserves its author children");

  for (const tag of ["puredashboard-header", "puredashboard-content", "puredashboard-footer"]) {
    const el = document.createElement(tag);
    const span = document.createElement("span");
    span.textContent = "x";
    el.appendChild(span);
    document.body.appendChild(el);
    ok(el.firstElementChild === span && el.contains(span), `${tag} preserves its author children`);
  }
}

// ---- layout is a flex container / becomes a row with a sider (CSS contract) ----
{
  const css = readFileSync(new URL("../src/layout.css", import.meta.url), "utf8");
  ok(/puredashboard-layout\s*\{[^}]*display:\s*flex/.test(css), "layout is a flex container");
  ok(/puredashboard-layout\s*\{[^}]*flex-direction:\s*column/.test(css), "layout stacks (column) by default");
  ok(/:has\(>\s*puredashboard-sider\)/.test(css), "layout becomes a row when it has a direct sider (:has)");
  ok(/puredashboard-header\s*\{[^}]*display:\s*flex/.test(css), "header renders as a flex bar");
  ok(/puredashboard-content\s*\{[^}]*overflow:\s*auto/.test(css), "content scrolls its overflow");
}

// ---- layout hasSider property reflects to the has-sider attribute ----
{
  const lay = mount("puredashboard-layout");
  ok(lay.hasSider === false, "hasSider defaults to false");
  lay.hasSider = true;
  ok(lay.hasAttribute("has-sider"), "hasSider=true reflects to the has-sider attribute");
  lay.hasSider = false;
  ok(!lay.hasAttribute("has-sider"), "hasSider=false removes the attribute");
}

// ---- sider preserves children by moving them into an inner scroll region ----
{
  const sider = document.createElement("puredashboard-sider");
  const link = document.createElement("a");
  link.href = "#/";
  link.textContent = "Home";
  sider.appendChild(link);
  document.body.appendChild(sider);
  const inner = sider.querySelector(".puredashboard-sider__inner");
  ok(inner, "sider builds an inner scroll region");
  ok(sider.contains(link), "sider preserves its author child");
  ok(inner.contains(link), "author child is moved into the inner scroll region");
}

// ---- sider reflects width via the --pd-sider-w custom property ----
{
  const sider = mount("puredashboard-sider");
  ok(sider.width === 220, "width defaults to 220");
  ok(sider.collapsedWidth === 64, "collapsedWidth defaults to 64");
  ok(sider.style.getPropertyValue("--pd-sider-w") === "220px", "expanded width applied via --pd-sider-w");
  sider.width = 300;
  ok(sider.getAttribute("width") === "300" && sider.width === 300, "width property/attribute stay in sync");
  ok(sider.style.getPropertyValue("--pd-sider-w") === "300px", "changing width updates --pd-sider-w");
}

// ---- collapsible renders a trigger; non-collapsible does not ----
{
  const plain = mount("puredashboard-sider");
  ok(!plain.querySelector(".js-puredashboard-sider__trigger"), "no trigger when not collapsible");

  const sider = mount("puredashboard-sider");
  sider.collapsible = true;
  const trigger = sider.querySelector(".js-puredashboard-sider__trigger");
  ok(trigger, "collapsible renders a trigger");
  ok(trigger.tagName === "BUTTON" && trigger.type === "button", "trigger is a native <button>");
  ok(trigger.querySelector("svg"), "trigger carries an inline SVG icon");
  ok(trigger.getAttribute("aria-label") === "Collapse sidebar", "trigger aria-label is 'collapse' when expanded");

  sider.collapsible = false;
  ok(!sider.querySelector(".js-puredashboard-sider__trigger"), "trigger removed when collapsible turns off");
}

// ---- toggling flips collapsed (property + attribute + width) and emits "collapse" ----
{
  const sider = mount("puredashboard-sider");
  sider.collapsible = true;
  let ev = null;
  sider.addEventListener("collapse", (e) => { ev = e; });

  sider.toggle();
  ok(sider.collapsed === true, "toggle flips collapsed to true");
  ok(sider.hasAttribute("collapsed"), "collapsed reflects to the attribute");
  ok(sider.style.getPropertyValue("--pd-sider-w") === "64px", "collapsed width applied");
  ok(ev && ev.detail.collapsed === true, "collapse event fired with detail.collapsed=true");
  ok(ev.bubbles === true, "collapse event bubbles");
  const trigger = sider.querySelector(".js-puredashboard-sider__trigger");
  ok(trigger.getAttribute("aria-label") === "Expand sidebar", "trigger aria-label becomes 'expand' when collapsed");

  ev = null;
  sider.toggle();
  ok(sider.collapsed === false, "toggle flips collapsed back to false");
  ok(sider.style.getPropertyValue("--pd-sider-w") === "220px", "expanded width restored");
  ok(ev && ev.detail.collapsed === false, "collapse event fired again with detail.collapsed=false");
}

// ---- clicking the trigger toggles and emits ----
{
  const sider = mount("puredashboard-sider");
  sider.collapsible = true;
  let count = 0, last = null;
  sider.addEventListener("collapse", (e) => { count++; last = e.detail.collapsed; });
  const trigger = sider.querySelector(".js-puredashboard-sider__trigger");
  trigger.click();
  ok(count === 1 && last === true && sider.collapsed === true, "clicking the trigger collapses + emits once");
  trigger.click();
  ok(count === 2 && last === false && sider.collapsed === false, "clicking again expands + emits once");
}

// ---- declarative attributes reflect into properties ----
{
  document.body.innerHTML = `<puredashboard-sider width="180" collapsed-width="48" collapsible collapsed></puredashboard-sider>`;
  const sider = document.body.firstElementChild;
  ok(sider.width === 180, "width attribute reflected to property");
  ok(sider.collapsedWidth === 48, "collapsed-width attribute reflected to property");
  ok(sider.collapsible === true, "collapsible attribute reflected to property");
  ok(sider.collapsed === true, "collapsed attribute reflected to property");
  ok(sider.style.getPropertyValue("--pd-sider-w") === "48px", "starts at collapsed width when collapsed at parse");
  ok(sider.querySelector(".js-puredashboard-sider__trigger"), "declarative collapsible renders the trigger");
}

// ---- breakpoint is guarded when matchMedia is unavailable (jsdom) ----
{
  ok(typeof window.matchMedia !== "function", "sanity: jsdom has no matchMedia");
  const sider = mount("puredashboard-sider");
  let threw = false;
  try { sider.breakpoint = "md"; } catch { threw = true; }
  ok(!threw, "setting breakpoint does not throw when matchMedia is unavailable");
  ok(sider.breakpoint === "md", "breakpoint reflected despite no matchMedia");
}

// ---- localisable labels ----
{
  const sider = mount("puredashboard-sider");
  sider.labels = { collapse: "Thu gọn", expand: "Mở rộng" };
  ok(sider._label("collapse") === "Thu gọn", "labels override the default string");
  const other = mount("puredashboard-sider");
  ok(other._label("collapse") === "Collapse sidebar", "default label kept when not overridden");
}

console.log(`layout.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
