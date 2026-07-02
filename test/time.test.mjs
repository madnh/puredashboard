// Tests for time.js (<puredashboard-time>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, events and logic.
// (Form-associated validity via ElementInternals is partly unsupported in jsdom;
// those paths are guarded and verified in a real browser.)
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

const { PuredashboardTime } = await import("../src/time.js");
void PuredashboardTime;

// ---- renders a native <input type="time"> + property reflection ----
{
  const el = mount("puredashboard-time");
  el.value = "09:30";
  el.min = "08:00";
  el.max = "17:00";
  el.step = 60;
  el.required = true;
  await tick();
  const field = el.querySelector(".js-puredashboard-time__field");
  ok(field, "renders an inner field");
  ok(field.tagName === "INPUT" && field.getAttribute("type") === "time", "inner control is a native <input type=time>");
  ok(field.value === "09:30", "value reflected to the field");
  ok(field.getAttribute("min") === "08:00", "min reflected to the field");
  ok(field.getAttribute("max") === "17:00", "max reflected to the field");
  ok(field.getAttribute("step") === "60", "step reflected to the field");
  ok(field.hasAttribute("required"), "required reflected to the field");
  ok(field.getAttribute("aria-invalid") === "false", "aria-invalid false by default");
}

// ---- disabled / readonly / size ----
{
  const el = mount("puredashboard-time");
  el.disabled = true;
  el.readonly = true;
  el.size = "sm";
  await tick();
  const field = el.querySelector(".js-puredashboard-time__field");
  ok(field.disabled === true, "disabled reflected");
  ok(field.hasAttribute("readonly"), "readonly reflected");
  ok(field.classList.contains("puredashboard-time__field--sm"), "size=sm adds the modifier class");
  const el2 = mount("puredashboard-time");
  el2.size = "lg";
  await tick();
  ok(el2.querySelector(".js-puredashboard-time__field").classList.contains("puredashboard-time__field--lg"), "size=lg adds the modifier class");
}

// ---- error message + aria wiring ----
{
  const el = mount("puredashboard-time");
  el.error = "Bad time";
  await tick();
  const field = el.querySelector(".js-puredashboard-time__field");
  const err = el.querySelector(".puredashboard-time__error");
  ok(err && err.textContent === "Bad time", "error message rendered exactly");
  ok(field.getAttribute("aria-invalid") === "true", "aria-invalid true when error set");
  ok(err.id && field.getAttribute("aria-describedby") === err.id, "aria-describedby points at the error node");
  ok(err.getAttribute("role") === "alert", "error node is an alert");
  el.error = "";
  await tick();
  ok(!el.querySelector(".puredashboard-time__error"), "clearing error removes the node");
  ok(field.getAttribute("aria-invalid") === "false", "aria-invalid resets when error cleared");
}

// ---- user edit: native input bubbles once, el.value stays in sync ----
{
  const el = mount("puredashboard-time");
  await tick();
  const field = el.querySelector(".js-puredashboard-time__field");
  let count = 0, seenTarget = null;
  el.addEventListener("input", (e) => { count++; seenTarget = e.target; });
  field.value = "12:45";
  field.dispatchEvent(new w.Event("input", { bubbles: true }));
  await tick();
  ok(el.value === "12:45", "el.value follows user edit");
  ok(count === 1, "exactly one native input event bubbles (no re-dispatch dup)");
  ok(seenTarget === field, "input event target is the inner field");
}

// ---- native change bubbles through the host ----
{
  const el = mount("puredashboard-time");
  await tick();
  const field = el.querySelector(".js-puredashboard-time__field");
  let count = 0;
  el.addEventListener("change", () => { count++; });
  field.value = "23:15";
  field.dispatchEvent(new w.Event("change", { bubbles: true }));
  await tick();
  ok(count === 1, "change bubbles through the host exactly once");
  ok(el.value === "23:15", "el.value reflects the committed value");
}

// ---- declarative HTML attributes reflect into properties ----
{
  document.body.innerHTML = `<puredashboard-time min="09:00" max="17:00" step="60" size="lg" required disabled></puredashboard-time>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.min === "09:00", "min attribute reflected to property");
  ok(el.max === "17:00", "max attribute reflected to property");
  ok(el.step === 60, "step attribute coerced to Number");
  ok(el.size === "lg", "size attribute reflected");
  ok(el.required === true, "required boolean attribute reflected");
  ok(el.disabled === true, "disabled boolean attribute reflected");
  const field = el.querySelector(".js-puredashboard-time__field");
  ok(field.getAttribute("min") === "09:00" && field.disabled === true, "reflected attrs reach the inner field");
}

// ---- form reset restores the declarative default value ----
{
  document.body.innerHTML = `<puredashboard-time value="10:00"></puredashboard-time>`;
  const el = document.body.firstElementChild;
  await tick();
  el.value = "11:30";
  await tick();
  el.formResetCallback();
  await tick();
  ok(el.value === "10:00", "formResetCallback restores the initial value attribute");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-time");
  el.labels = { required: "Bắt buộc" };
  await tick();
  ok(el._label("required") === "Bắt buộc", "labels override the default string");
  const el2 = mount("puredashboard-time");
  await tick();
  ok(el2._label("required") === "This field is required.", "default label kept when not overridden");
}

console.log(`time.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
