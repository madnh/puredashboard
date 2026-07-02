// Tests for splitter.js (<puredashboard-splitter>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, events and logic.
// jsdom has NO layout (getBoundingClientRect → 0), so we drive resizing via the
// KEYBOARD (not pointer geometry); the pointer/rect math is guarded and verified
// in a real browser.
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
const w = dom.window;
for (const k of ["document", "HTMLElement", "customElements", "NodeFilter", "CustomEvent", "Node", "Event", "MouseEvent", "KeyboardEvent"])
  global[k] = w[k];
// jsdom lacks PointerEvent; alias it to MouseEvent so any pointer-path code that
// might run stays constructible (the tests themselves drive via the keyboard).
global.PointerEvent = w.PointerEvent || w.MouseEvent;
global.window = w;
global.queueMicrotask = queueMicrotask;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const tick = () => new Promise((r) => queueMicrotask(() => queueMicrotask(r)));

// Build a splitter with `n` <div> panels and mount it.
const mount = (n, attrs = {}) => {
  const el = document.createElement("puredashboard-splitter");
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v === true ? "" : v);
  const panels = [];
  for (let i = 0; i < n; i++) { const p = document.createElement("div"); p.textContent = `panel ${i}`; el.appendChild(p); panels.push(p); }
  document.body.appendChild(el);
  return { el, panels };
};
const gutters = (el) => Array.from(el.querySelectorAll(".js-puredashboard-splitter__gutter"));
const key = (g, k) => g.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true }));

const { PuredashboardSplitter } = await import("../src/splitter.js");
void PuredashboardSplitter;

// ---- panels preserved; a gutter between each adjacent pair ----
{
  const { el, panels } = mount(3);
  await tick();
  ok(panels.every((p) => p.isConnected && p.parentElement === el), "author panels preserved as children");
  ok(panels.every((p) => p.classList.contains("puredashboard-splitter__panel")), "panels get the BEM panel class");
  ok(gutters(el).length === 2, "3 panels → 2 gutters (n-1)");
  // gutters sit BETWEEN adjacent panels
  ok(panels[0].nextElementSibling === gutters(el)[0], "gutter 0 follows panel 0");
  ok(panels[1].nextElementSibling === gutters(el)[1], "gutter 1 follows panel 1");
}

// ---- two panels → one gutter ----
{
  const { el } = mount(2);
  await tick();
  ok(gutters(el).length === 1, "2 panels → 1 gutter");
}

// ---- gutter a11y: role/orientation/tabindex/aria-valuenow + label ----
{
  const { el } = mount(2);
  await tick();
  const g = gutters(el)[0];
  ok(g.getAttribute("role") === "separator", "gutter is role=separator");
  ok(g.getAttribute("aria-orientation") === "vertical", "horizontal split → aria-orientation=vertical");
  ok(g.getAttribute("tabindex") === "0", "gutter is focusable (tabindex=0)");
  ok(g.getAttribute("aria-label") === "Resize panels", "gutter has the labelled aria-label");
  ok(g.getAttribute("aria-valuenow") === "50", "aria-valuenow starts at the equal-split 50");
  ok(g.hasAttribute("aria-valuemin") && g.hasAttribute("aria-valuemax"), "aria-valuemin/max present");
}

// ---- initial sizes honour per-panel data-size ----
{
  const { el, panels } = mount(2);
  panels[0].setAttribute("data-size", "70");
  panels[1].setAttribute("data-size", "30");
  // re-mount so _init reads the data-size (mount already ran on append); rebuild:
  el.remove();
  const el2 = document.createElement("puredashboard-splitter");
  const a = document.createElement("div"); a.setAttribute("data-size", "70");
  const b = document.createElement("div"); b.setAttribute("data-size", "30");
  el2.append(a, b);
  document.body.appendChild(el2);
  await tick();
  ok(Math.round(el2.sizes[0]) === 70 && Math.round(el2.sizes[1]) === 30, "data-size drives the initial split");
  ok(Math.round(Number(a.style.flexGrow)) === 70, "flex-grow reflects the size percentage");
}

// ---- keyboard: ArrowRight/Left nudge the adjacent panels + update aria ----
{
  const { el, panels } = mount(2);
  await tick();
  const g = gutters(el)[0];
  const before0 = el.sizes[0], before1 = el.sizes[1];
  key(g, "ArrowRight");
  await tick();
  ok(el.sizes[0] > before0 && el.sizes[1] < before1, "ArrowRight grows the left panel, shrinks the right");
  ok(Math.abs(el.sizes[0] + el.sizes[1] - (before0 + before1)) < 1e-6, "pair sum is conserved");
  ok(Number(panels[0].style.flexGrow) === el.sizes[0], "left panel flex-grow updated");
  ok(g.getAttribute("aria-valuenow") === String(Math.round(el.sizes[0])), "aria-valuenow tracks the left panel");
  const mid = el.sizes[0];
  key(g, "ArrowLeft");
  await tick();
  ok(el.sizes[0] < mid, "ArrowLeft shrinks the left panel back");
}

// ---- keyboard: Home/End go to the clamped extremes (min applied) ----
{
  const { el } = mount(2, { "min-size": "20%" });
  await tick();
  const g = gutters(el)[0];
  key(g, "End");
  await tick();
  ok(Math.round(el.sizes[1]) === 20, "End drives the right panel down to the 20% min");
  ok(Math.round(el.sizes[0]) === 80, "End gives the rest to the left panel");
  key(g, "Home");
  await tick();
  ok(Math.round(el.sizes[0]) === 20, "Home drives the left panel down to the 20% min");
}

// ---- resize CustomEvent is emitted with the percentages ----
{
  const { el } = mount(2);
  await tick();
  let detail = null, count = 0;
  el.addEventListener("resize", (e) => { count++; detail = e.detail; });
  key(gutters(el)[0], "ArrowRight");
  await tick();
  ok(count === 1, "one resize event per keyboard nudge");
  ok(detail && Array.isArray(detail.sizes) && detail.sizes.length === 2, "resize detail carries the sizes array");
  ok(Math.abs(detail.sizes.reduce((a, b) => a + b, 0) - 100) < 1e-6, "sizes sum to ~100");
}

// ---- vertical mode sets flow + orientation + keyboard axis ----
{
  const { el } = mount(2, { vertical: true });
  await tick();
  ok(el.vertical === true, "vertical property reflects the attribute");
  const g = gutters(el)[0];
  ok(g.getAttribute("aria-orientation") === "horizontal", "vertical split → aria-orientation=horizontal");
  const before = el.sizes[0];
  key(g, "ArrowDown");
  await tick();
  ok(el.sizes[0] > before, "ArrowDown grows the top panel in vertical mode");
}

// ---- localisable labels ----
{
  const { el } = mount(2);
  el.labels = { resize: "Đổi kích thước" };
  ok(el._label("resize") === "Đổi kích thước", "labels override the default string");
  const { el: el2 } = mount(2);
  ok(el2._label("resize") === "Resize panels", "default label kept when not overridden");
}

// ---- pointer drag is safely guarded where there's no layout (jsdom) ----
{
  const { el } = mount(2);
  await tick();
  const g = gutters(el)[0];
  const before = el.sizes.slice();
  // Should not throw despite getBoundingClientRect() returning zeros.
  let threw = false;
  try {
    g.dispatchEvent(new global.PointerEvent("pointerdown", { bubbles: true, clientX: 0, clientY: 0 }));
    g.dispatchEvent(new global.PointerEvent("pointermove", { bubbles: true, clientX: 40, clientY: 40 }));
    g.dispatchEvent(new global.PointerEvent("pointerup", { bubbles: true }));
  } catch { threw = true; }
  ok(!threw, "pointer drag path does not throw without layout");
  ok(JSON.stringify(el.sizes) === JSON.stringify(before), "no-layout drag leaves sizes unchanged");
}

console.log(`splitter.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
