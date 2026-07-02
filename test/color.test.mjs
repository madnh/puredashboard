// Tests for color.js (<puredashboard-color>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, events and logic.
// (Form-associated validity via ElementInternals is partly unsupported in jsdom;
// those paths are guarded and verified in a real browser via color-harness.html.)
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

const { PuredashboardColor } = await import("../src/color.js");
void PuredashboardColor;

// ---- wraps a native <input type=color>; value reflected ----
{
  const el = mount("puredashboard-color");
  el.value = "#4f9cf9";
  await tick();
  const input = el.querySelector(".js-puredashboard-color__input");
  ok(input, "renders an inner input");
  ok(input.tagName === "INPUT" && input.getAttribute("type") === "color", "inner element is <input type=color>");
  ok(input.value === "#4f9cf9", "value reflected to the inner input");
}

// ---- default value is #000000 ----
{
  const el = mount("puredashboard-color");
  await tick();
  const input = el.querySelector(".js-puredashboard-color__input");
  ok(input.value === "#000000", "defaults to #000000");
}

// ---- aria-label from LABELS.choose ----
{
  const el = mount("puredashboard-color");
  await tick();
  const input = el.querySelector(".js-puredashboard-color__input");
  ok(input.getAttribute("aria-label") === "Choose a colour", "inner input carries the LABELS.choose aria-label");
}

// ---- showValue renders the hex text (mono, textContent) ----
{
  const el = mount("puredashboard-color");
  el.value = "#abcdef";
  await tick();
  ok(!el.querySelector(".puredashboard-color__value"), "hex label absent by default");
  el.showValue = true;
  await tick();
  const label = el.querySelector(".puredashboard-color__value");
  ok(label && label.textContent === "#abcdef", "showValue renders the hex code exactly");
}

// ---- hex label updates on native input ----
{
  const el = mount("puredashboard-color");
  el.showValue = true;
  await tick();
  const input = el.querySelector(".js-puredashboard-color__input");
  let count = 0, seenTarget = null;
  el.addEventListener("input", (e) => { count++; seenTarget = e.target; });
  input.value = "#123456";
  input.dispatchEvent(new w.Event("input", { bubbles: true }));
  await tick();
  ok(el.value === "#123456", "el.value follows the inner input");
  ok(count === 1, "exactly one native input event bubbles (no re-dispatch dup)");
  ok(seenTarget === input, "input event target is the inner field");
  const label = el.querySelector(".puredashboard-color__value");
  ok(label.textContent === "#123456", "hex label updates on input");
}

// ---- native change bubbles through the host once ----
{
  const el = mount("puredashboard-color");
  await tick();
  const input = el.querySelector(".js-puredashboard-color__input");
  let count = 0;
  el.addEventListener("change", () => { count++; });
  input.value = "#00ff00";
  input.dispatchEvent(new w.Event("change", { bubbles: true }));
  await tick();
  ok(count === 1, "change bubbles through the host exactly once");
  ok(el.value === "#00ff00", "el.value reflects the committed value");
}

// ---- size variant adds the modifier class ----
{
  const el = mount("puredashboard-color");
  el.size = "lg";
  await tick();
  const input = el.querySelector(".js-puredashboard-color__input");
  ok(input.classList.contains("puredashboard-color__swatch--lg"), "size=lg adds the modifier class");
}

// ---- disabled reflected to the inner input ----
{
  const el = mount("puredashboard-color");
  el.disabled = true;
  await tick();
  const input = el.querySelector(".js-puredashboard-color__input");
  ok(input.disabled === true, "disabled reflected to the inner input");
}

// ---- declarative HTML attributes reflect into properties ----
{
  document.body.innerHTML = `<puredashboard-color value="#ff0000" show-value disabled></puredashboard-color>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.value === "#ff0000", "value attribute reflected to property");
  ok(el.showValue === true, "show-value boolean attribute reflected");
  ok(el.disabled === true, "disabled boolean attribute reflected");
  const input = el.querySelector(".js-puredashboard-color__input");
  ok(input.value === "#ff0000" && input.disabled === true, "reflected attrs reach the inner input");
  ok(el.querySelector(".puredashboard-color__value").textContent === "#ff0000", "hex label present from show-value attr");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-color");
  el.labels = { choose: "Chọn màu" };
  await tick();
  ok(el._label("choose") === "Chọn màu", "labels override the default string");
  const input = el.querySelector(".js-puredashboard-color__input");
  ok(input.getAttribute("aria-label") === "Chọn màu", "override reaches the inner input aria-label");
  const el2 = mount("puredashboard-color");
  await tick();
  ok(el2._label("choose") === "Choose a colour", "default label kept when not overridden");
}

// ---- form reset restores the initial value ----
{
  document.body.innerHTML = `<puredashboard-color value="#010203"></puredashboard-color>`;
  const el = document.body.firstElementChild;
  await tick();
  el.value = "#0a0b0c";
  await tick();
  el.formResetCallback();
  await tick();
  ok(el.value === "#010203", "formResetCallback restores the initial value");
}

console.log(`color.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
