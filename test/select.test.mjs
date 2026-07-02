// Tests for select.js (<puredashboard-select>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, events and logic.
// (Form-associated validity via ElementInternals is partly unsupported in jsdom;
// those paths are guarded and verified in a real browser via select-harness.html.)
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

const { PuredashboardSelect } = await import("../src/select.js");
void PuredashboardSelect;

// ---- options render (object form) + value reflection ----
{
  const el = mount("puredashboard-select");
  el.options = [{ value: "us", label: "United States" }, { value: "vn", label: "Vietnam" }];
  el.value = "vn";
  await tick();
  const field = el.querySelector(".js-puredashboard-select__field");
  ok(field && field.tagName === "SELECT", "renders an inner native <select>");
  const opts = [...field.querySelectorAll("option")];
  ok(opts.length === 2, "renders one <option> per object option");
  ok(opts[0].value === "us" && opts[0].textContent === "United States", "object option value + label rendered");
  ok(field.value === "vn", "value reflected to the inner select");
  ok(field.getAttribute("aria-invalid") === "false", "aria-invalid false by default");
}

// ---- options render (string[] form: value === label) ----
{
  const el = mount("puredashboard-select");
  el.options = ["Low", "High"];
  await tick();
  const opts = [...el.querySelectorAll(".js-puredashboard-select__field option")];
  ok(opts.length === 2, "renders one <option> per string option");
  ok(opts[0].value === "Low" && opts[0].textContent === "Low", "string option: value equals label");
}

// ---- placeholder option present when set ----
{
  const el = mount("puredashboard-select");
  el.placeholder = "Choose one";
  el.options = ["a", "b"];
  await tick();
  const field = el.querySelector(".js-puredashboard-select__field");
  const first = field.querySelector("option");
  ok(first.value === "" && first.disabled, "leading placeholder option is empty + disabled");
  ok(first.textContent === "Choose one", "placeholder option text rendered exactly");
  ok(field.querySelectorAll("option").length === 3, "placeholder + 2 real options present");
  // with no placeholder, no leading empty option
  const el2 = mount("puredashboard-select");
  el2.options = ["a", "b"];
  await tick();
  ok(el2.querySelector(".js-puredashboard-select__field option").value === "a", "no placeholder option when unset");
}

// ---- inner <select> is nameless (no duplicate form submission) ----
{
  const el = mount("puredashboard-select");
  el.setAttribute("name", "country");
  el.options = ["a", "b"];
  await tick();
  const field = el.querySelector(".js-puredashboard-select__field");
  ok(!field.hasAttribute("name"), "inner <select> has no name attribute (only ElementInternals submits)");
}

// ---- native change bubbles through the host once; el.value stays in sync ----
{
  const el = mount("puredashboard-select");
  el.options = ["a", "b", "c"];
  await tick();
  const field = el.querySelector(".js-puredashboard-select__field");
  let count = 0, seenTarget = null;
  el.addEventListener("change", (e) => { count++; seenTarget = e.target; });
  field.value = "c";
  field.dispatchEvent(new w.Event("change", { bubbles: true }));
  await tick();
  ok(count === 1, "change bubbles through the host exactly once (no re-dispatch dup)");
  ok(seenTarget === field, "change event target is the inner select");
  ok(el.value === "c", "el.value mirrors the committed selection");
}

// ---- error message + aria wiring ----
{
  const el = mount("puredashboard-select");
  el.options = ["a", "b"];
  el.error = "Pick something";
  await tick();
  const field = el.querySelector(".js-puredashboard-select__field");
  const err = el.querySelector(".puredashboard-select__error");
  ok(err && err.textContent === "Pick something", "error message rendered exactly");
  ok(field.getAttribute("aria-invalid") === "true", "aria-invalid true when error set");
  ok(err.id && field.getAttribute("aria-describedby") === err.id, "aria-describedby points at the error node");
  ok(err.getAttribute("role") === "alert", "error node is an alert");
  el.error = "";
  await tick();
  ok(!el.querySelector(".puredashboard-select__error"), "clearing error removes the node");
  ok(field.getAttribute("aria-invalid") === "false", "aria-invalid resets when error cleared");
}

// ---- chevron is decorative + non-interactive ----
{
  const el = mount("puredashboard-select");
  el.options = ["a"];
  await tick();
  const chevron = el.querySelector(".puredashboard-select__chevron");
  ok(chevron && chevron.getAttribute("aria-hidden") === "true", "chevron is aria-hidden (decorative)");
}

// ---- size + disabled ----
{
  const el = mount("puredashboard-select");
  el.options = ["a"];
  el.size = "sm";
  el.disabled = true;
  await tick();
  const field = el.querySelector(".js-puredashboard-select__field");
  ok(field.classList.contains("puredashboard-select__field--sm"), "size=sm adds the modifier class");
  ok(field.disabled === true, "disabled reflected to the inner select");
}

// ---- declarative HTML attributes reflect into properties ----
{
  document.body.innerHTML = `<puredashboard-select size="lg" required disabled></puredashboard-select>`;
  const el = document.body.firstElementChild;
  el.options = ["a", "b"];
  await tick();
  ok(el.size === "lg", "size attribute reflected to property");
  ok(el.required === true, "required boolean attribute reflected");
  ok(el.disabled === true, "disabled boolean attribute reflected");
  const field = el.querySelector(".js-puredashboard-select__field");
  ok(field.disabled === true && field.required === true, "reflected attrs reach the inner select");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-select");
  el.labels = { required: "Bắt buộc" };
  await tick();
  ok(el._label("required") === "Bắt buộc", "labels override the default string");
  const el2 = mount("puredashboard-select");
  await tick();
  ok(el2._label("required") === "This field is required.", "default label kept when not overridden");
}

console.log(`select.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
