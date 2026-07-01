// Tests for number.js (<puredashboard-number>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, events and logic.
// (Form-associated validity via ElementInternals is partly unsupported in jsdom;
// those paths are guarded and verified in a real browser via number-harness.html.)
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

const { PuredashboardNumber } = await import("../src/number.js");
void PuredashboardNumber;

// ---- rendering + property reflection ----
{
  const el = mount("puredashboard-number");
  el.min = 0; el.max = 10; el.step = 2;
  el.placeholder = "qty";
  el.value = "4";
  await tick();
  const field = el.querySelector(".js-puredashboard-number__field");
  ok(field, "renders an inner <input> field");
  ok(field.getAttribute("type") === "number", "type is number");
  ok(field.getAttribute("placeholder") === "qty", "placeholder reflected");
  ok(field.value === "4", "value reflected to the field");
  ok(field.getAttribute("min") === "0" && field.getAttribute("max") === "10" && field.getAttribute("step") === "2", "min/max/step reflected");
  ok(field.getAttribute("aria-invalid") === "false", "aria-invalid false by default");
  ok(el.querySelector(".js-puredashboard-number__dec") && el.querySelector(".js-puredashboard-number__inc"), "renders decrement + increment steppers");
}

// ---- stepper aria-labels (localisable) ----
{
  const el = mount("puredashboard-number");
  await tick();
  const dec = el.querySelector(".js-puredashboard-number__dec");
  const inc = el.querySelector(".js-puredashboard-number__inc");
  ok(dec.getAttribute("aria-label") === "Decrement", "decrement button has aria-label");
  ok(inc.getAttribute("aria-label") === "Increment", "increment button has aria-label");
  ok(dec.getAttribute("type") === "button" && inc.getAttribute("type") === "button", "steppers are type=button");
}

// ---- increment / decrement steps the value ----
{
  const el = mount("puredashboard-number");
  el.step = 3; el.value = "5";
  await tick();
  const field = el.querySelector(".js-puredashboard-number__field");
  const inc = el.querySelector(".js-puredashboard-number__inc");
  const dec = el.querySelector(".js-puredashboard-number__dec");
  inc.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(field.value === "8", "increment adds step");
  ok(el.value === "8", "el.value follows the stepper");
  dec.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  dec.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(field.value === "2", "decrement subtracts step");
}

// ---- exactly one input + one change event escapes per stepper click ----
{
  const el = mount("puredashboard-number");
  el.value = "1";
  await tick();
  const field = el.querySelector(".js-puredashboard-number__field");
  const inc = el.querySelector(".js-puredashboard-number__inc");
  let inputs = 0, changes = 0, target = null;
  el.addEventListener("input", (e) => { inputs++; target = e.target; });
  el.addEventListener("change", () => { changes++; });
  inc.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(inputs === 1, "exactly one input event escapes per stepper click");
  ok(changes === 1, "exactly one change event escapes per stepper click");
  ok(target === field, "the escaping event's target is the inner field");
  ok(el.value === "2", "value updated through the native path");
}

// ---- clamping to min / max ----
{
  const el = mount("puredashboard-number");
  el.min = 0; el.max = 4; el.step = 5; el.value = "3";
  await tick();
  const field = el.querySelector(".js-puredashboard-number__field");
  const inc = el.querySelector(".js-puredashboard-number__inc");
  const dec = el.querySelector(".js-puredashboard-number__dec");
  inc.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(field.value === "4", "increment clamps to max");
  dec.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(field.value === "0", "decrement clamps to min");
}

// ---- steppers disabled at bounds ----
{
  const el = mount("puredashboard-number");
  el.min = 0; el.max = 10; el.value = "0";
  await tick();
  let dec = el.querySelector(".js-puredashboard-number__dec");
  let inc = el.querySelector(".js-puredashboard-number__inc");
  ok(dec.disabled === true, "decrement disabled at min");
  ok(inc.disabled === false, "increment enabled below max");
  el.value = "10";
  await tick();
  dec = el.querySelector(".js-puredashboard-number__dec");
  inc = el.querySelector(".js-puredashboard-number__inc");
  ok(inc.disabled === true, "increment disabled at max");
  ok(dec.disabled === false, "decrement enabled above min");
}

// ---- disabled / readonly / size ----
{
  const el = mount("puredashboard-number");
  el.disabled = true;
  el.size = "sm";
  await tick();
  const field = el.querySelector(".js-puredashboard-number__field");
  const dec = el.querySelector(".js-puredashboard-number__dec");
  const inc = el.querySelector(".js-puredashboard-number__inc");
  ok(field.disabled === true, "disabled reflected to field");
  ok(dec.disabled === true && inc.disabled === true, "steppers disabled when control disabled");
  ok(el.querySelector(".puredashboard-number__control--sm"), "size=sm adds the modifier class");
}

// ---- readonly disables steppers and blocks stepping ----
{
  const el = mount("puredashboard-number");
  el.readonly = true; el.value = "5";
  await tick();
  const field = el.querySelector(".js-puredashboard-number__field");
  const inc = el.querySelector(".js-puredashboard-number__inc");
  ok(field.hasAttribute("readonly"), "readonly reflected to field");
  ok(inc.disabled === true, "steppers disabled when readonly");
  inc.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(field.value === "5", "stepping is a no-op when readonly");
}

// ---- error message + aria wiring ----
{
  const el = mount("puredashboard-number");
  el.error = "Bad value";
  await tick();
  const field = el.querySelector(".js-puredashboard-number__field");
  const err = el.querySelector(".puredashboard-number__error");
  ok(err && err.textContent === "Bad value", "error message rendered exactly");
  ok(field.getAttribute("aria-invalid") === "true", "aria-invalid true when error set");
  ok(err.id && field.getAttribute("aria-describedby") === err.id, "aria-describedby points at the error node");
  ok(err.getAttribute("role") === "alert", "error node is an alert");
  el.error = "";
  await tick();
  ok(!el.querySelector(".puredashboard-number__error"), "clearing error removes the node");
  ok(field.getAttribute("aria-invalid") === "false", "aria-invalid resets when error cleared");
}

// ---- user typing: native input bubbles once, el.value stays in sync ----
{
  const el = mount("puredashboard-number");
  await tick();
  const field = el.querySelector(".js-puredashboard-number__field");
  let count = 0, seenTarget = null;
  el.addEventListener("input", (e) => { count++; seenTarget = e.target; });
  field.value = "42";
  field.dispatchEvent(new w.Event("input", { bubbles: true }));
  await tick();
  ok(el.value === "42", "el.value follows user typing");
  ok(count === 1, "exactly one native input event bubbles (no re-dispatch dup)");
  ok(seenTarget === field, "input event target is the inner field");
}

// ---- native change bubbles through the host ----
{
  const el = mount("puredashboard-number");
  await tick();
  const field = el.querySelector(".js-puredashboard-number__field");
  let count = 0;
  el.addEventListener("change", () => { count++; });
  field.value = "7";
  field.dispatchEvent(new w.Event("change", { bubbles: true }));
  await tick();
  ok(count === 1, "change bubbles through the host exactly once");
  ok(el.value === "7", "el.value reflects the committed value");
}

// ---- declarative HTML attributes reflect into properties ----
{
  document.body.innerHTML = `<puredashboard-number min="1" max="9" step="2" placeholder="p" size="lg" required disabled></puredashboard-number>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.min === 1 && el.max === 9 && el.step === 2, "min/max/step attributes coerced to numbers");
  ok(el.placeholder === "p", "placeholder attribute reflected");
  ok(el.size === "lg", "size attribute reflected");
  ok(el.required === true, "required boolean attribute reflected");
  ok(el.disabled === true, "disabled boolean attribute reflected");
  const field = el.querySelector(".js-puredashboard-number__field");
  ok(field.getAttribute("type") === "number" && field.disabled === true, "reflected attrs reach the inner field");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-number");
  el.labels = { increment: "Tăng", decrement: "Giảm" };
  await tick();
  ok(el._label("increment") === "Tăng", "labels override the increment string");
  ok(el._label("decrement") === "Giảm", "labels override the decrement string");
  const el2 = mount("puredashboard-number");
  await tick();
  ok(el2._label("required") === "This field is required.", "default label kept when not overridden");
}

console.log(`number.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
