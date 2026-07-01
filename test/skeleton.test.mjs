// Tests for skeleton.js (<puredashboard-skeleton>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element and render logic.
// (Shimmer animation + prefers-reduced-motion are CSS-only and verified visually;
// here we assert the DOM/structure, dimensions, a11y attributes and modifiers.)
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
const w = dom.window;
for (const k of ["document", "HTMLElement", "customElements", "NodeFilter", "CustomEvent", "Node", "Event", "MouseEvent"])
  global[k] = w[k];
global.window = w;
global.queueMicrotask = queueMicrotask;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const tick = () => new Promise((r) => queueMicrotask(() => queueMicrotask(r)));
const mount = (tag) => { const el = document.createElement(tag); document.body.appendChild(el); return el; };

const { PuredashboardSkeleton } = await import("../src/skeleton.js");
void PuredashboardSkeleton;

// ---- host a11y: role=status + aria-busy + aria-label (loading) ----
{
  const el = mount("puredashboard-skeleton");
  await tick();
  ok(el.getAttribute("role") === "status", "host has role=status");
  ok(el.getAttribute("aria-busy") === "true", "host has aria-busy=true");
  ok(el.getAttribute("aria-label") === "Loading…", "host aria-label is the loading string");
}

// ---- text variant (default) renders `lines` bars, last one is the short one ----
{
  const el = mount("puredashboard-skeleton");
  el.lines = 4;
  await tick();
  const wrap = el.querySelector(".puredashboard-skeleton__lines");
  ok(wrap, "text variant renders a lines wrapper");
  ok(wrap.getAttribute("aria-hidden") === "true", "shapes are aria-hidden");
  const bars = el.querySelectorAll(".puredashboard-skeleton__el--text");
  ok(bars.length === 4, "renders `lines` (4) bars");
  ok(bars[3].classList.contains("puredashboard-skeleton__el--last"), "last bar has the --last modifier");
  ok(!bars[0].classList.contains("puredashboard-skeleton__el--last"), "non-last bars are not --last");
}

// ---- default line count is 3 ----
{
  const el = mount("puredashboard-skeleton");
  await tick();
  ok(el.querySelectorAll(".puredashboard-skeleton__el--text").length === 3, "defaults to 3 bars");
}

// ---- rect variant applies width/height via inline style ----
{
  const el = mount("puredashboard-skeleton");
  el.variant = "rect";
  el.width = "200px";
  el.height = "80px";
  await tick();
  const box = el.querySelector(".puredashboard-skeleton__el--rect");
  ok(box, "rect variant renders a rect shape");
  ok(box.getAttribute("aria-hidden") === "true", "rect shape is aria-hidden");
  ok(box.style.width === "200px", "rect applies width via inline style");
  ok(box.style.height === "80px", "rect applies height via inline style");
}

// ---- circle variant sizes width == height from `width` ----
{
  const el = mount("puredashboard-skeleton");
  el.variant = "circle";
  el.width = "48px";
  await tick();
  const c = el.querySelector(".puredashboard-skeleton__el--circle");
  ok(c, "circle variant renders a circle shape");
  ok(c.style.width === "48px" && c.style.height === "48px", "circle width == height from `width`");
}

// ---- radius override applies to the shape ----
{
  const el = mount("puredashboard-skeleton");
  el.variant = "rect";
  el.radius = "4px";
  await tick();
  const box = el.querySelector(".puredashboard-skeleton__el--rect");
  ok(box.style.borderRadius === "4px", "radius override applied via inline style");
}

// ---- animated toggles the shimmer modifier ----
{
  const el = mount("puredashboard-skeleton");
  await tick();
  ok(el.querySelector(".puredashboard-skeleton__el--animated"), "animated by default → shimmer modifier present");
  el.animated = false;
  await tick();
  ok(!el.querySelector(".puredashboard-skeleton__el--animated"), "animated=false removes the shimmer modifier");
}

// ---- declarative HTML attributes reflect into properties ----
{
  document.body.innerHTML = `<puredashboard-skeleton variant="circle" width="32px" animated="false"></puredashboard-skeleton>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.variant === "circle", "variant attribute reflected");
  ok(el.width === "32px", "width attribute reflected");
  const c = el.querySelector(".puredashboard-skeleton__el--circle");
  ok(c && c.style.width === "32px", "reflected width reaches the circle shape");
  ok(!el.querySelector(".puredashboard-skeleton__el--animated"), "animated=\"false\" attribute disables shimmer");
}

// ---- localisable labels (loading string used for aria-label) ----
{
  const el = mount("puredashboard-skeleton");
  el.labels = { loading: "Đang tải…" };
  await tick();
  ok(el._label("loading") === "Đang tải…", "labels override the default string");
  ok(el.getAttribute("aria-label") === "Đang tải…", "overridden label is applied to aria-label");
  const el2 = mount("puredashboard-skeleton");
  await tick();
  ok(el2._label("loading") === "Loading…", "default label kept when not overridden");
}

console.log(`skeleton.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
