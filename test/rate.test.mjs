// Tests for rate.js (<puredashboard-rate>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, events and logic.
// (Form-associated validity via ElementInternals is partly unsupported in jsdom;
// those paths are guarded and verified in a real browser via a harness.)
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
const key = (el, k) => el.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));

const { PuredashboardRate } = await import("../src/rate.js");
void PuredashboardRate;

// ---- role=slider + aria contract ----
{
  const el = mount("puredashboard-rate");
  el.count = 5;
  el.value = 3;
  await tick();
  const s = el.querySelector(".js-puredashboard-rate__slider");
  ok(s, "renders a single slider element");
  ok(s.getAttribute("role") === "slider", "role is slider");
  ok(el.querySelectorAll(".js-puredashboard-rate__slider").length === 1, "exactly one slider (single tab stop)");
  ok(s.getAttribute("tabindex") === "0", "slider is the one focusable tab stop");
  ok(s.getAttribute("aria-valuemin") === "0", "aria-valuemin is 0");
  ok(s.getAttribute("aria-valuemax") === "5", "aria-valuemax is count");
  ok(s.getAttribute("aria-valuenow") === "3", "aria-valuenow is value");
  ok(s.getAttribute("aria-valuetext") === "3 of 5 stars", "aria-valuetext localised read-out");
}

// ---- renders `count` stars ----
{
  const el = mount("puredashboard-rate");
  el.count = 7;
  await tick();
  ok(el.querySelectorAll(".js-puredashboard-rate__star").length === 7, "renders count star glyphs");
  const el2 = mount("puredashboard-rate");
  await tick();
  ok(el2.querySelectorAll(".js-puredashboard-rate__star").length === 5, "default count is 5");
}

// ---- clicking star N sets value N ----
{
  const el = mount("puredashboard-rate");
  await tick();
  const stars = el.querySelectorAll(".js-puredashboard-rate__star");
  let seen = null;
  el.addEventListener("change", (e) => { seen = e.detail.value; });
  stars[3].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(el.value === 4, "clicking the 4th star sets value 4");
  ok(seen === 4, "change event detail.value is 4");
}

// ---- allowHalf: left-half click gives .5, keyboard steps by .5 ----
{
  const el = mount("puredashboard-rate");
  el.allowHalf = true;
  await tick();
  const star = el.querySelectorAll(".js-puredashboard-rate__star")[2]; // 3rd
  // Fake geometry: left half of the star.
  star.getBoundingClientRect = () => ({ left: 0, width: 20, top: 0, height: 20, right: 20, bottom: 20 });
  star.dispatchEvent(new w.MouseEvent("click", { bubbles: true, clientX: 5 }));
  await tick();
  ok(el.value === 2.5, "left-half click on 3rd star sets 2.5 when allowHalf");
  // right half → whole star
  star.dispatchEvent(new w.MouseEvent("click", { bubbles: true, clientX: 15 }));
  await tick();
  ok(el.value === 3, "right-half click on 3rd star sets 3");
}

// ---- allowClear: re-clicking the current value clears to 0 ----
{
  const el = mount("puredashboard-rate");
  el.value = 3;
  await tick();
  const stars = el.querySelectorAll(".js-puredashboard-rate__star");
  stars[2].dispatchEvent(new w.MouseEvent("click", { bubbles: true })); // click star 3 again
  await tick();
  ok(el.value === 0, "re-clicking the current value clears to 0 (allowClear default)");
  // with allowClear off, re-click keeps the value
  const el2 = mount("puredashboard-rate");
  el2.allowClear = false;
  el2.value = 3;
  await tick();
  const s2 = el2.querySelectorAll(".js-puredashboard-rate__star");
  s2[2].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(el2.value === 3, "re-click keeps value when allowClear is false");
}

// ---- keyboard: arrows inc/dec, half steps, Home/End ----
{
  const el = mount("puredashboard-rate");
  el.value = 3;
  await tick();
  const s = el.querySelector(".js-puredashboard-rate__slider");
  key(s, "ArrowRight");
  await tick();
  ok(el.value === 4, "ArrowRight increments");
  key(s, "ArrowLeft");
  key(s, "ArrowLeft");
  await tick();
  ok(el.value === 2, "ArrowLeft decrements");
  key(s, "Home");
  await tick();
  ok(el.value === 0, "Home sets 0");
  key(s, "End");
  await tick();
  ok(el.value === 5, "End sets count");
  key(s, "ArrowDown");
  await tick();
  ok(el.value === 4, "ArrowDown decrements");
  key(s, "ArrowUp");
  await tick();
  ok(el.value === 5, "ArrowUp increments (clamped at count)");
}

// ---- keyboard half-steps when allowHalf ----
{
  const el = mount("puredashboard-rate");
  el.allowHalf = true;
  el.value = 2;
  await tick();
  const s = el.querySelector(".js-puredashboard-rate__slider");
  key(s, "ArrowRight");
  await tick();
  ok(el.value === 2.5, "ArrowRight steps by 0.5 when allowHalf");
  key(s, "ArrowLeft");
  key(s, "ArrowLeft");
  await tick();
  ok(el.value === 1.5, "ArrowLeft steps by 0.5 when allowHalf");
}

// ---- disabled / readonly ignore input ----
{
  const el = mount("puredashboard-rate");
  el.value = 2;
  el.disabled = true;
  await tick();
  const s = el.querySelector(".js-puredashboard-rate__slider");
  ok(s.getAttribute("tabindex") === "-1", "disabled removes the tab stop");
  ok(s.getAttribute("aria-disabled") === "true", "aria-disabled reflected");
  key(s, "ArrowRight");
  el.querySelectorAll(".js-puredashboard-rate__star")[4].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(el.value === 2, "disabled ignores keyboard and click input");

  const el2 = mount("puredashboard-rate");
  el2.value = 2;
  el2.readonly = true;
  await tick();
  const s2 = el2.querySelector(".js-puredashboard-rate__slider");
  ok(s2.getAttribute("aria-readonly") === "true", "aria-readonly reflected");
  key(s2, "ArrowRight");
  el2.querySelectorAll(".js-puredashboard-rate__star")[4].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(el2.value === 2, "readonly ignores keyboard and click input");
}

// ---- change fires once per real change, not on no-op ----
{
  const el = mount("puredashboard-rate");
  el.value = 3;
  await tick();
  let count = 0;
  el.addEventListener("change", () => { count++; });
  const s = el.querySelector(".js-puredashboard-rate__slider");
  key(s, "Home"); // 3 -> 0
  key(s, "Home"); // 0 -> 0 (no-op, no event)
  await tick();
  ok(count === 1, "change fires only when the value actually changes");
}

// ---- declarative attributes reflect into properties ----
{
  document.body.innerHTML = `<puredashboard-rate count="10" value="4" allow-half required></puredashboard-rate>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.count === 10, "count attribute reflected");
  ok(el.value === 4, "value attribute reflected");
  ok(el.allowHalf === true, "allow-half boolean attribute reflected");
  ok(el.required === true, "required boolean attribute reflected");
  const s = el.querySelector(".js-puredashboard-rate__slider");
  ok(s.getAttribute("aria-valuemax") === "10", "count reaches the slider");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-rate");
  el.labels = { ariaLabel: "Đánh giá", valueText: (v, c) => `${v}/${c} sao` };
  el.value = 2;
  await tick();
  const s = el.querySelector(".js-puredashboard-rate__slider");
  ok(s.getAttribute("aria-label") === "Đánh giá", "ariaLabel override applied");
  ok(s.getAttribute("aria-valuetext") === "2/5 sao", "valueText override applied");
  const el2 = mount("puredashboard-rate");
  await tick();
  ok(el2._label("ariaLabel") === "Rating", "default label kept when not overridden");
}

// ---- form reset restores the default value ----
{
  document.body.innerHTML = `<puredashboard-rate value="2"></puredashboard-rate>`;
  const el = document.body.firstElementChild;
  await tick();
  el.value = 5;
  await tick();
  el.formResetCallback();
  await tick();
  ok(el.value === 2, "formResetCallback restores the attribute default");
}

console.log(`rate.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
