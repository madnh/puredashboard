// Tests for slider.js (<puredashboard-slider>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, events and logic.
// (Form-associated validity via ElementInternals is partly unsupported in jsdom;
// those paths are guarded and verified in a real browser via a harness page.)
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

const { PuredashboardSlider } = await import("../src/slider.js");
void PuredashboardSlider;

// ---- rendering + min/max/step/value reflection ----
{
  const el = mount("puredashboard-slider");
  el.min = 0; el.max = 200; el.step = 5; el.value = "40";
  await tick();
  const field = el.querySelector(".js-puredashboard-slider__field");
  ok(field, "renders an inner <input type=range>");
  ok(field.getAttribute("type") === "range", "inner field is a range input");
  ok(field.getAttribute("min") === "0", "min reflected to the field");
  ok(field.getAttribute("max") === "200", "max reflected to the field");
  ok(field.getAttribute("step") === "5", "step reflected to the field");
  ok(field.value === "40", "value reflected to the field");
}

// ---- defaults: midpoint value, min=0, max=100, step=1 ----
{
  const el = mount("puredashboard-slider");
  await tick();
  ok(Number(el.min) === 0, "min defaults to 0");
  ok(Number(el.max) === 100, "max defaults to 100");
  ok(Number(el.step) === 1, "step defaults to 1");
  ok(el.value === "50", "value defaults to the midpoint of [min,max]");
}

// ---- value sync on input: native event bubbles once, el.value follows ----
{
  const el = mount("puredashboard-slider");
  el.min = 0; el.max = 100;
  await tick();
  const field = el.querySelector(".js-puredashboard-slider__field");
  let count = 0, seenTarget = null;
  el.addEventListener("input", (e) => { count++; seenTarget = e.target; });
  field.value = "73";
  field.dispatchEvent(new w.Event("input", { bubbles: true }));
  await tick();
  ok(el.value === "73", "el.value follows the range input");
  ok(count === 1, "exactly one native input event bubbles (no re-dispatch dup)");
  ok(seenTarget === field, "input event target is the inner field");
}

// ---- native change bubbles through the host once ----
{
  const el = mount("puredashboard-slider");
  await tick();
  const field = el.querySelector(".js-puredashboard-slider__field");
  let count = 0;
  el.addEventListener("change", () => { count++; });
  field.value = "88";
  field.dispatchEvent(new w.Event("change", { bubbles: true }));
  await tick();
  ok(count === 1, "change bubbles through the host exactly once");
  ok(el.value === "88", "el.value reflects the committed value");
}

// ---- fill percent custom property computed at min / mid / max ----
{
  const el = mount("puredashboard-slider");
  el.min = 0; el.max = 100; el.value = "0";
  await tick();
  ok(el.style.getPropertyValue("--pd-slider-pct") === "0%", "percent is 0% at min");
  el.value = "50";
  await tick();
  ok(el.style.getPropertyValue("--pd-slider-pct") === "50%", "percent is 50% at mid");
  el.value = "100";
  await tick();
  ok(el.style.getPropertyValue("--pd-slider-pct") === "100%", "percent is 100% at max");
  // non-zero min: value 20 of [10,30] → 50%
  const el2 = mount("puredashboard-slider");
  el2.min = 10; el2.max = 30; el2.value = "20";
  await tick();
  ok(el2.style.getPropertyValue("--pd-slider-pct") === "50%", "percent handles a non-zero min");
}

// ---- showValue output present, updates, and hidden by default ----
{
  const el = mount("puredashboard-slider");
  el.min = 0; el.max = 100; el.value = "25";
  await tick();
  ok(!el.querySelector(".puredashboard-slider__value"), "no value bubble by default");
  el.showValue = true;
  await tick();
  const out = el.querySelector(".puredashboard-slider__value");
  ok(out && out.textContent === "25", "value bubble present and shows the value");
  ok(out.getAttribute("aria-hidden") === "true", "value bubble is aria-hidden (redundant with native semantics)");
  el.value = "60";
  await tick();
  ok(el.querySelector(".puredashboard-slider__value").textContent === "60", "value bubble updates with the value");
}

// ---- disabled reflects to the inner range ----
{
  const el = mount("puredashboard-slider");
  el.disabled = true;
  await tick();
  const field = el.querySelector(".js-puredashboard-slider__field");
  ok(field.disabled === true, "disabled reflected to the inner range");
}

// ---- declarative HTML attributes reflect into properties ----
{
  document.body.innerHTML = `<puredashboard-slider min="0" max="10" step="2" value="4" disabled></puredashboard-slider>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(Number(el.min) === 0 && Number(el.max) === 10 && Number(el.step) === 2, "min/max/step attributes reflected to properties");
  ok(el.value === "4", "value attribute reflected");
  ok(el.disabled === true, "disabled boolean attribute reflected");
  const field = el.querySelector(".js-puredashboard-slider__field");
  ok(field.getAttribute("max") === "10" && field.disabled === true, "reflected attrs reach the inner field");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-slider");
  el.labels = { value: (v) => `Giá trị: ${v}` };
  await tick();
  ok(el._label("value", 7) === "Giá trị: 7", "labels override the default (function key interpolates)");
  const el2 = mount("puredashboard-slider");
  await tick();
  ok(el2._label("value", 7) === "Value: 7", "default label kept when not overridden");
}

console.log(`slider.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
