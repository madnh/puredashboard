// Tests for collapse.js (<puredashboard-collapse>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, events and keyboard.
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
const w = dom.window;
for (const k of ["document", "HTMLElement", "customElements", "NodeFilter", "CustomEvent", "Node", "Event", "MouseEvent", "KeyboardEvent"])
  global[k] = w[k];
global.window = w;
global.queueMicrotask = queueMicrotask;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const tick = () => new Promise((r) => queueMicrotask(() => queueMicrotask(r)));
const mount = (tag) => { const el = document.createElement(tag); document.body.appendChild(el); return el; };
const key = (el, k) => el.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true }));

const { PuredashboardCollapse } = await import("../src/collapse.js");
void PuredashboardCollapse;

const ITEMS = [
  { key: "a", header: "Alpha", content: "First body" },
  { key: "b", header: "Beta", content: "Second body" },
  { key: "c", header: "Gamma", content: "Third body", disabled: true },
];

// ---- one header + region per item, with aria wiring ----
{
  const el = mount("puredashboard-collapse");
  el.items = ITEMS;
  await tick();
  const headers = el.querySelectorAll(".puredashboard-collapse__header");
  const panels = el.querySelectorAll(".puredashboard-collapse__panel");
  ok(headers.length === 3, "renders one header button per item");
  ok(panels.length === 3, "renders one region panel per item");
  const h0 = headers[0], p0 = panels[0];
  ok(h0.tagName === "BUTTON", "header is a native <button>");
  ok(h0.getAttribute("aria-expanded") === "false", "collapsed header has aria-expanded=false");
  ok(p0.getAttribute("role") === "region", "panel has role=region");
  ok(h0.getAttribute("aria-controls") === p0.id, "aria-controls points at the panel id");
  ok(p0.getAttribute("aria-labelledby") === h0.id, "aria-labelledby points at the header id");
  ok(p0.hasAttribute("hidden"), "collapsed panel is hidden");
  ok(el.querySelector(".puredashboard-collapse__label").textContent === "Alpha", "header label rendered exactly");
  ok(el.querySelector(".puredashboard-collapse__content").textContent === "First body", "content rendered exactly");
}

// ---- clicking a header toggles it (open then closed) ----
{
  const el = mount("puredashboard-collapse");
  el.items = ITEMS;
  await tick();
  const h = () => el.querySelectorAll(".puredashboard-collapse__header")[0];
  const p = () => el.querySelectorAll(".puredashboard-collapse__panel")[0];
  h().click();
  await tick();
  ok(h().getAttribute("aria-expanded") === "true", "click opens: aria-expanded=true");
  ok(!p().hasAttribute("hidden"), "click opens: panel shown");
  ok(el.value === "a", "value is the open key after opening");
  h().click();
  await tick();
  ok(h().getAttribute("aria-expanded") === "false", "second click collapses again");
  ok(p().hasAttribute("hidden"), "second click hides the panel");
  ok(el.value === undefined, "value clears when the open item is closed");
}

// ---- accordion mode (multiple=false) closes others ----
{
  const el = mount("puredashboard-collapse");
  el.items = ITEMS;
  el.multiple = false;
  await tick();
  const headers = () => el.querySelectorAll(".puredashboard-collapse__header");
  headers()[0].click();
  await tick();
  headers()[1].click();
  await tick();
  ok(el.value === "b", "accordion: value is the last opened key");
  ok(headers()[0].getAttribute("aria-expanded") === "false", "accordion: opening b closes a");
  ok(headers()[1].getAttribute("aria-expanded") === "true", "accordion: b is open");
}

// ---- multiple=true keeps several open ----
{
  const el = mount("puredashboard-collapse");
  el.items = ITEMS;
  el.multiple = true;
  await tick();
  const headers = () => el.querySelectorAll(".puredashboard-collapse__header");
  headers()[0].click();
  await tick();
  headers()[1].click();
  await tick();
  ok(Array.isArray(el.value) && el.value.includes("a") && el.value.includes("b"), "multiple: value is an array of both open keys");
  ok(headers()[0].getAttribute("aria-expanded") === "true", "multiple: a stays open");
  ok(headers()[1].getAttribute("aria-expanded") === "true", "multiple: b also open");
  headers()[0].click();
  await tick();
  ok(!el.value.includes("a") && el.value.includes("b"), "multiple: closing a leaves b open");
}

// ---- change event detail (both shapes) ----
{
  const el = mount("puredashboard-collapse");
  el.items = ITEMS;
  await tick();
  let last;
  el.addEventListener("change", (e) => { last = e.detail; });
  el.querySelectorAll(".puredashboard-collapse__header")[0].click();
  await tick();
  ok(last && last.value === "a", "accordion change detail carries the open key");

  const el2 = mount("puredashboard-collapse");
  el2.items = ITEMS;
  el2.multiple = true;
  await tick();
  let last2;
  el2.addEventListener("change", (e) => { last2 = e.detail; });
  el2.querySelectorAll(".puredashboard-collapse__header")[1].click();
  await tick();
  ok(last2 && Array.isArray(last2.value) && last2.value.includes("b"), "multiple change detail carries an array");
}

// ---- disabled item won't toggle ----
{
  const el = mount("puredashboard-collapse");
  el.items = ITEMS;
  await tick();
  const disabled = el.querySelectorAll(".puredashboard-collapse__header")[2];
  ok(disabled.disabled === true, "disabled item's header is a disabled button");
  let fired = false;
  el.addEventListener("change", () => { fired = true; });
  disabled.click();
  await tick();
  ok(el.value == null, "clicking a disabled item does not change value");
  ok(fired === false, "clicking a disabled item emits no change event");
}

// ---- Arrow / Home / End move header focus (skipping disabled) ----
{
  const el = mount("puredashboard-collapse");
  el.items = ITEMS;
  await tick();
  const headers = el.querySelectorAll(".puredashboard-collapse__header");
  headers[0].focus();
  key(headers[0], "ArrowDown");
  ok(document.activeElement === headers[1], "ArrowDown moves focus to the next enabled header");
  key(headers[1], "ArrowDown");
  ok(document.activeElement === headers[0], "ArrowDown wraps past the disabled item to the first");
  key(headers[0], "ArrowUp");
  ok(document.activeElement === headers[1], "ArrowUp wraps to the last enabled header");
  key(headers[1], "Home");
  ok(document.activeElement === headers[0], "Home jumps to the first header");
  key(headers[0], "End");
  ok(document.activeElement === headers[1], "End jumps to the last ENABLED header");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-collapse");
  el.labels = { group: "Phần" };
  await tick();
  ok(el._label("group") === "Phần", "labels override the default group string");
  const el2 = mount("puredashboard-collapse");
  await tick();
  ok(el2._label("group") === "Sections", "default label kept when not overridden");
}

// ---- headingLevel: outline control of each header wrapper ----
{
  const heads = (el) => [...el.querySelectorAll(".puredashboard-collapse__heading")];
  const el = mount("puredashboard-collapse");
  el.items = ITEMS;
  await tick();
  ok(heads(el).every((h) => h.tagName === "H3" && !h.hasAttribute("role")), "default: each header in a native <h3>");
  el.headingLevel = 2; await tick();
  ok(heads(el).every((h) => h.tagName === "DIV" && h.getAttribute("role") === "heading" && h.getAttribute("aria-level") === "2"), "headingLevel=2: role=heading aria-level=2");
  el.headingLevel = "5"; await tick();
  ok(heads(el).every((h) => h.getAttribute("aria-level") === "5"), "headingLevel accepts a string level");
  el.headingLevel = 3; await tick();
  ok(heads(el).every((h) => h.tagName === "H3" && !h.hasAttribute("role")), "headingLevel=3 is the native <h3>");
  el.headingLevel = "none"; await tick();
  ok(heads(el).every((h) => h.tagName === "DIV" && !h.hasAttribute("role") && !h.hasAttribute("aria-level")), "headingLevel=none: plain div, no heading in the outline");
  for (const bad of [0, 7, "x", 2.5]) {
    el.headingLevel = bad; await tick();
    ok(heads(el).every((h) => h.tagName === "H3"), `invalid headingLevel ${JSON.stringify(bad)} falls back to <h3>`);
  }
  ok(el.querySelector(".puredashboard-collapse__header").getAttribute("aria-expanded") !== null, "header button still rendered inside the wrapper");
}

// ---- regions=false: no role=region landmark per panel ----
{
  const el = mount("puredashboard-collapse");
  el.items = ITEMS;
  await tick();
  const panels = () => [...el.querySelectorAll(".puredashboard-collapse__panel")];
  ok(panels().every((p) => p.getAttribute("role") === "region" && p.getAttribute("aria-labelledby")), "default: each panel is a labelled region");
  el.regions = false; await tick();
  ok(panels().every((p) => !p.hasAttribute("role") && !p.hasAttribute("aria-labelledby")), "regions=false: no role=region, no aria-labelledby");
  ok(panels().every((p) => p.id), "regions=false: panels keep their id (aria-controls target)");
  el.regions = true; await tick();
  ok(panels().every((p) => p.getAttribute("role") === "region"), "regions back to true restores the regions");
}

// ---- [hidden] hides the host (display:block would otherwise override the UA rule) ----
// CSS contract only, as in alert.test.mjs: jsdom reports display:none for any [hidden] element.
{
  const { readFileSync } = await import("node:fs");
  const css = readFileSync(new URL("../src/collapse.css", import.meta.url), "utf8");
  ok(/puredashboard-collapse\[hidden\]\s*\{\s*display:\s*none/.test(css), "puredashboard-collapse[hidden] { display: none } restores hiding");
}

console.log(`collapse.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
