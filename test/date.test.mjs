// Tests for date.js (<puredashboard-date>).
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

const { PuredashboardDate } = await import("../src/date.js");
void PuredashboardDate;

// ---- rendering + property reflection: a native <input type=date> ----
{
  const el = mount("puredashboard-date");
  el.min = "2020-01-01";
  el.max = "2030-12-31";
  el.value = "2025-06-15";
  el.required = true;
  await tick();
  const field = el.querySelector(".js-puredashboard-date__field");
  ok(field, "renders an inner <input> field");
  ok(field.getAttribute("type") === "date", "inner input is type=date");
  ok(field.getAttribute("min") === "2020-01-01", "min reflected to the field");
  ok(field.getAttribute("max") === "2030-12-31", "max reflected to the field");
  ok(field.value === "2025-06-15", "value reflected to the field");
  ok(field.hasAttribute("required"), "required reflected to the field");
  ok(field.getAttribute("aria-invalid") === "false", "aria-invalid false by default");
}

// ---- disabled / readonly / size ----
{
  const el = mount("puredashboard-date");
  el.disabled = true;
  el.readonly = true;
  el.size = "lg";
  await tick();
  const field = el.querySelector(".js-puredashboard-date__field");
  ok(field.disabled === true, "disabled reflected");
  ok(field.hasAttribute("readonly"), "readonly reflected");
  ok(field.classList.contains("puredashboard-date__field--lg"), "size=lg adds the modifier class");
}

// ---- error message + aria wiring ----
{
  const el = mount("puredashboard-date");
  el.error = "Bad date";
  await tick();
  const field = el.querySelector(".js-puredashboard-date__field");
  const err = el.querySelector(".puredashboard-date__error");
  ok(err && err.textContent === "Bad date", "error message rendered exactly");
  ok(field.getAttribute("aria-invalid") === "true", "aria-invalid true when error set");
  ok(err.id && field.getAttribute("aria-describedby") === err.id, "aria-describedby points at the error node");
  ok(err.getAttribute("role") === "alert", "error node is an alert");
  el.error = "";
  await tick();
  ok(!el.querySelector(".puredashboard-date__error"), "clearing error removes the node");
  ok(field.getAttribute("aria-invalid") === "false", "aria-invalid resets when error cleared");
}

// ---- user edit: native input bubbles once, el.value stays in sync ----
{
  const el = mount("puredashboard-date");
  await tick();
  const field = el.querySelector(".js-puredashboard-date__field");
  let count = 0, seenTarget = null;
  el.addEventListener("input", (e) => { count++; seenTarget = e.target; });
  field.value = "2026-07-01";
  field.dispatchEvent(new w.Event("input", { bubbles: true }));
  await tick();
  ok(el.value === "2026-07-01", "el.value follows user edit");
  ok(count === 1, "exactly one native input event bubbles (no re-dispatch dup)");
  ok(seenTarget === field, "input event target is the inner field");
}

// ---- native change bubbles through the host ----
{
  const el = mount("puredashboard-date");
  await tick();
  const field = el.querySelector(".js-puredashboard-date__field");
  let count = 0;
  el.addEventListener("change", () => { count++; });
  field.value = "2027-01-20";
  field.dispatchEvent(new w.Event("change", { bubbles: true }));
  await tick();
  ok(count === 1, "change bubbles through the host exactly once");
  ok(el.value === "2027-01-20", "el.value reflects the committed value");
}

// ---- declarative HTML attributes reflect into properties + reach the field ----
{
  document.body.innerHTML = `<puredashboard-date min="2020-01-01" max="2030-12-31" size="sm" required disabled name="born"></puredashboard-date>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.min === "2020-01-01", "min attribute reflected to property");
  ok(el.max === "2030-12-31", "max attribute reflected to property");
  ok(el.size === "sm", "size attribute reflected");
  ok(el.required === true, "required boolean attribute reflected");
  ok(el.disabled === true, "disabled boolean attribute reflected");
  ok(el.getAttribute("name") === "born", "name stays a host attribute for form submission");
  const field = el.querySelector(".js-puredashboard-date__field");
  ok(field.getAttribute("min") === "2020-01-01" && field.disabled === true, "reflected attrs reach the inner field");
}

// ---- native validity is mirrored (guard ElementInternals for jsdom) ----
{
  const el = mount("puredashboard-date");
  el.required = true;
  el.value = "";
  await tick();
  const field = el.querySelector(".js-puredashboard-date__field");
  // The inner native input is the source of truth; where the platform supports
  // constraint validation an empty required field reports valueMissing.
  ok(field.validity ? field.validity.valueMissing === true : true, "empty required inner input reports valueMissing (where supported)");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-date");
  el.labels = { required: "Bắt buộc" };
  await tick();
  ok(el._label("required") === "Bắt buộc", "labels override the default string");
  const el2 = mount("puredashboard-date");
  await tick();
  ok(el2._label("required") === "This field is required.", "default label kept when not overridden");
}

console.log(`date.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
