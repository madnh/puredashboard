// Tests for datetime.js (<puredashboard-datetime>).
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

const { PuredashboardDatetime } = await import("../src/datetime.js");
void PuredashboardDatetime;

// ---- renders a native <input type="time"> + property reflection ----
{
  const el = mount("puredashboard-datetime");
  el.value = "2026-03-01T09:30";
  el.min = "2026-03-01T08:00";
  el.max = "2026-03-01T17:00";
  el.step = 60;
  el.required = true;
  await tick();
  const field = el.querySelector(".js-puredashboard-datetime__field");
  ok(field, "renders an inner field");
  ok(field.tagName === "INPUT" && field.getAttribute("type") === "datetime-local", "inner control is a native <input type=datetime-local>");
  ok(field.value === "2026-03-01T09:30", "value reflected to the field");
  ok(field.getAttribute("min") === "2026-03-01T08:00", "min reflected to the field");
  ok(field.getAttribute("max") === "2026-03-01T17:00", "max reflected to the field");
  ok(field.getAttribute("step") === "60", "step reflected to the field");
  ok(field.hasAttribute("required"), "required reflected to the field");
  ok(field.getAttribute("aria-invalid") === "false", "aria-invalid false by default");
}

// ---- disabled / readonly / size ----
{
  const el = mount("puredashboard-datetime");
  el.disabled = true;
  el.readonly = true;
  el.size = "sm";
  await tick();
  const field = el.querySelector(".js-puredashboard-datetime__field");
  ok(field.disabled === true, "disabled reflected");
  ok(field.hasAttribute("readonly"), "readonly reflected");
  ok(field.classList.contains("puredashboard-datetime__field--sm"), "size=sm adds the modifier class");
  const el2 = mount("puredashboard-datetime");
  el2.size = "lg";
  await tick();
  ok(el2.querySelector(".js-puredashboard-datetime__field").classList.contains("puredashboard-datetime__field--lg"), "size=lg adds the modifier class");
}

// ---- error message + aria wiring ----
{
  const el = mount("puredashboard-datetime");
  el.error = "Bad date";
  await tick();
  const field = el.querySelector(".js-puredashboard-datetime__field");
  const err = el.querySelector(".puredashboard-datetime__error");
  ok(err && err.textContent === "Bad date", "error message rendered exactly");
  ok(field.getAttribute("aria-invalid") === "true", "aria-invalid true when error set");
  ok(err.id && field.getAttribute("aria-describedby") === err.id, "aria-describedby points at the error node");
  ok(err.getAttribute("role") === "alert", "error node is an alert");
  el.error = "";
  await tick();
  ok(!el.querySelector(".puredashboard-datetime__error"), "clearing error removes the node");
  ok(field.getAttribute("aria-invalid") === "false", "aria-invalid resets when error cleared");
}

// ---- user edit: native input bubbles once, el.value stays in sync ----
{
  const el = mount("puredashboard-datetime");
  await tick();
  const field = el.querySelector(".js-puredashboard-datetime__field");
  let count = 0, seenTarget = null;
  el.addEventListener("input", (e) => { count++; seenTarget = e.target; });
  field.value = "2026-03-01T12:45";
  field.dispatchEvent(new w.Event("input", { bubbles: true }));
  await tick();
  ok(el.value === "2026-03-01T12:45", "el.value follows user edit");
  ok(count === 1, "exactly one native input event bubbles (no re-dispatch dup)");
  ok(seenTarget === field, "input event target is the inner field");
}

// ---- native change bubbles through the host ----
{
  const el = mount("puredashboard-datetime");
  await tick();
  const field = el.querySelector(".js-puredashboard-datetime__field");
  let count = 0;
  el.addEventListener("change", () => { count++; });
  field.value = "2026-03-01T23:15";
  field.dispatchEvent(new w.Event("change", { bubbles: true }));
  await tick();
  ok(count === 1, "change bubbles through the host exactly once");
  ok(el.value === "2026-03-01T23:15", "el.value reflects the committed value");
}

// ---- declarative HTML attributes reflect into properties ----
{
  document.body.innerHTML = `<puredashboard-datetime min="2026-03-01T09:00" max="2026-03-01T17:00" step="60" size="lg" required disabled></puredashboard-datetime>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.min === "2026-03-01T09:00", "min attribute reflected to property");
  ok(el.max === "2026-03-01T17:00", "max attribute reflected to property");
  ok(el.step === 60, "step attribute coerced to Number");
  ok(el.size === "lg", "size attribute reflected");
  ok(el.required === true, "required boolean attribute reflected");
  ok(el.disabled === true, "disabled boolean attribute reflected");
  const field = el.querySelector(".js-puredashboard-datetime__field");
  ok(field.getAttribute("min") === "2026-03-01T09:00" && field.disabled === true, "reflected attrs reach the inner field");
}

// ---- form reset restores the declarative default value ----
{
  document.body.innerHTML = `<puredashboard-datetime value="2026-03-01T10:00"></puredashboard-datetime>`;
  const el = document.body.firstElementChild;
  await tick();
  el.value = "2026-03-01T11:30";
  await tick();
  el.formResetCallback();
  await tick();
  ok(el.value === "2026-03-01T10:00", "formResetCallback restores the initial value attribute");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-datetime");
  el.labels = { required: "Bắt buộc" };
  await tick();
  ok(el._label("required") === "Bắt buộc", "labels override the default string");
  const el2 = mount("puredashboard-datetime");
  await tick();
  ok(el2._label("required") === "This field is required.", "default label kept when not overridden");
}

// ---- stylesheet is part of the bundle ----
{
  const { readFileSync } = await import("node:fs");
  const css = readFileSync(new URL("../src/components.css", import.meta.url), "utf8");
  ok(/@import\s+"datetime\.css"/.test(css), "components.css imports datetime.css");
}

console.log(`datetime.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
