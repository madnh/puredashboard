// Tests for progress.js (<puredashboard-progress>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, geometry and a11y wiring.
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

const { PuredashboardProgress } = await import("../src/progress.js");
void PuredashboardProgress;

// ---- role + aria min/max/now (determinate) ----
{
  const el = mount("puredashboard-progress");
  el.value = 30;
  el.max = 60;
  await tick();
  const bar = el.querySelector('[role="progressbar"]');
  ok(bar, "renders a role=progressbar element");
  ok(bar.getAttribute("aria-valuemin") === "0", "aria-valuemin is 0");
  ok(bar.getAttribute("aria-valuemax") === "60", "aria-valuemax reflects max");
  ok(bar.getAttribute("aria-valuenow") === "30", "aria-valuenow reflects value");
}

// ---- percent computed correctly (30/60 = 50%) ----
{
  const el = mount("puredashboard-progress");
  el.value = 30;
  el.max = 60;
  await tick();
  ok(el._pct() === 50, "value 30 / max 60 computes to 50%");
  const fill = el.querySelector(".puredashboard-progress__fill");
  ok(fill.getAttribute("style") === "width:50%", "line fill width reflects the percent");
  ok(el.style.getPropertyValue("--pd-progress-pct") === "50%", "dynamic --pd-progress-pct custom property reflects the percent");
  const text = el.querySelector(".puredashboard-progress__text");
  ok(text && text.textContent === "50%", "showInfo renders the percent text");
}

// ---- clamping value to [0, max] ----
{
  const el = mount("puredashboard-progress");
  el.max = 100;
  el.value = 150;
  await tick();
  ok(el._pct() === 100, "value above max clamps to 100%");
  el.value = -20;
  await tick();
  ok(el._pct() === 0, "negative value clamps to 0%");
}

// ---- circle variant: stroke-dashoffset reflects the fraction ----
{
  const el = mount("puredashboard-progress");
  el.variant = "circle";
  el.value = 25;
  el.max = 100;   // fraction 0.25
  await tick();
  const ring = el.querySelector(".puredashboard-progress__ring-fill");
  ok(ring, "circle variant renders an SVG ring fill");
  const R = 42, C = 2 * Math.PI * R;
  const expected = C * (1 - 0.25);
  const style = ring.getAttribute("style");
  ok(style.includes(`stroke-dasharray:${C}`), "circle dasharray is the full circumference");
  ok(style.includes(`stroke-dashoffset:${expected}`), "circle dashoffset reflects the 25% fraction");
}

// ---- indeterminate: drops aria-valuenow + adds the modifier ----
{
  const el = mount("puredashboard-progress");
  el.value = 40;
  el.indeterminate = true;
  await tick();
  const bar = el.querySelector('[role="progressbar"]');
  ok(!bar.hasAttribute("aria-valuenow"), "indeterminate omits aria-valuenow");
  ok(bar.getAttribute("aria-valuemin") === "0" && bar.getAttribute("aria-valuemax") === "100", "indeterminate keeps min/max");
  ok(bar.classList.contains("puredashboard-progress--indeterminate"), "indeterminate adds the modifier class");
  ok(bar.getAttribute("aria-label") === "Loading", "indeterminate aria-label uses the null-percent label");
}

// ---- status success/error modifiers + glyph ----
{
  const el = mount("puredashboard-progress");
  el.value = 100;
  el.status = "success";
  await tick();
  const fill = el.querySelector(".puredashboard-progress__fill");
  ok(fill.classList.contains("puredashboard-progress__fill--success"), "success adds the fill modifier");
  const glyph = el.querySelector(".puredashboard-progress__glyph--success");
  ok(glyph && glyph.querySelector("svg"), "success shows a check glyph");
  ok(!el.querySelector(".puredashboard-progress__text"), "success replaces the percent text with the glyph");

  el.status = "error";
  await tick();
  const efill = el.querySelector(".puredashboard-progress__fill");
  ok(efill.classList.contains("puredashboard-progress__fill--error"), "error adds the fill modifier");
  ok(el.querySelector(".puredashboard-progress__glyph--error svg"), "error shows a cross glyph");
}

// ---- showInfo toggles the read-out ----
{
  const el = mount("puredashboard-progress");
  el.value = 50;
  await tick();
  ok(el.querySelector(".puredashboard-progress__info"), "info shown by default");
  el.showInfo = false;
  await tick();
  ok(!el.querySelector(".puredashboard-progress__info"), "showInfo=false removes the read-out");
}

// ---- declarative HTML attributes reflect into properties ----
{
  document.body.innerHTML = `<puredashboard-progress value="30" max="60" variant="circle" status="success" indeterminate></puredashboard-progress>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.value === 30, "value attribute coerced to number");
  ok(el.max === 60, "max attribute coerced to number");
  ok(el.variant === "circle", "variant attribute reflected");
  ok(el.status === "success", "status attribute reflected");
  ok(el.indeterminate === true, "indeterminate boolean attribute reflected");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-progress");
  el.labels = { label: (p) => `Done ${p}%` };
  el.value = 20;
  el.max = 100;
  await tick();
  ok(el._label("label", 20) === "Done 20%", "labels override the default string");
  const el2 = mount("puredashboard-progress");
  await tick();
  ok(el2._label("label", 20) === "20%", "default label kept when not overridden");
}

console.log(`progress.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
