// Tests for input.js (<puredashboard-input>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, events and logic.
// (Form-associated validity via ElementInternals is partly unsupported in jsdom;
// those paths are guarded and verified in a real browser via input-harness.html.)
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

const { PuredashboardInput } = await import("../src/input.js");
void PuredashboardInput;

// ---- rendering + property reflection ----
{
  const el = mount("puredashboard-input");
  el.type = "email";
  el.placeholder = "you@example.com";
  el.value = "hi@x.com";
  await tick();
  const field = el.querySelector(".js-puredashboard-input__field");
  ok(field, "renders an inner <input> field");
  ok(field.getAttribute("type") === "email", "type is reflected to the field");
  ok(field.getAttribute("placeholder") === "you@example.com", "placeholder reflected");
  ok(field.value === "hi@x.com", "value reflected to the field");
  ok(field.getAttribute("aria-invalid") === "false", "aria-invalid false by default");
}

// ---- disabled / readonly / size ----
{
  const el = mount("puredashboard-input");
  el.disabled = true;
  el.readonly = true;
  el.size = "sm";
  await tick();
  const field = el.querySelector(".js-puredashboard-input__field");
  ok(field.disabled === true, "disabled reflected");
  ok(field.hasAttribute("readonly"), "readonly reflected");
  ok(field.classList.contains("puredashboard-input__field--sm"), "size=sm adds the modifier class");
}

// ---- error message + aria wiring ----
{
  const el = mount("puredashboard-input");
  el.error = "Bad value";
  await tick();
  const field = el.querySelector(".js-puredashboard-input__field");
  const err = el.querySelector(".puredashboard-input__error");
  ok(err && err.textContent === "Bad value", "error message rendered exactly");
  ok(field.getAttribute("aria-invalid") === "true", "aria-invalid true when error set");
  ok(err.id && field.getAttribute("aria-describedby") === err.id, "aria-describedby points at the error node");
  ok(err.getAttribute("role") === "alert", "error node is an alert");
  // clearing the error removes the node and resets aria
  el.error = "";
  await tick();
  ok(!el.querySelector(".puredashboard-input__error"), "clearing error removes the node");
  ok(field.getAttribute("aria-invalid") === "false", "aria-invalid resets when error cleared");
}

// ---- user typing: native input bubbles once, el.value stays in sync ----
{
  const el = mount("puredashboard-input");
  await tick();
  const field = el.querySelector(".js-puredashboard-input__field");
  let count = 0, seenTarget = null;
  el.addEventListener("input", (e) => { count++; seenTarget = e.target; });
  field.value = "typed";
  field.dispatchEvent(new w.Event("input", { bubbles: true }));
  await tick();
  ok(el.value === "typed", "el.value follows user typing");
  ok(count === 1, "exactly one native input event bubbles (no re-dispatch dup)");
  ok(seenTarget === field, "input event target is the inner field");
}

// ---- native change bubbles through the host ----
{
  const el = mount("puredashboard-input");
  await tick();
  const field = el.querySelector(".js-puredashboard-input__field");
  let count = 0;
  el.addEventListener("change", () => { count++; });
  field.value = "done";
  field.dispatchEvent(new w.Event("change", { bubbles: true }));
  await tick();
  ok(count === 1, "change bubbles through the host exactly once");
  ok(el.value === "done", "el.value reflects the committed value");
}

// ---- declarative HTML attributes reflect into properties ----
{
  document.body.innerHTML = `<puredashboard-input type="email" placeholder="p" size="lg" required disabled></puredashboard-input>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.type === "email", "type attribute reflected to property");
  ok(el.placeholder === "p", "placeholder attribute reflected");
  ok(el.size === "lg", "size attribute reflected");
  ok(el.required === true, "required boolean attribute reflected");
  ok(el.disabled === true, "disabled boolean attribute reflected");
  const field = el.querySelector(".js-puredashboard-input__field");
  ok(field.getAttribute("type") === "email" && field.disabled === true, "reflected attrs reach the inner field");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-input");
  el.labels = { required: "Bắt buộc" };
  await tick();
  ok(el._label("required") === "Bắt buộc", "labels override the default string");
  const el2 = mount("puredashboard-input");
  await tick();
  ok(el2._label("required") === "This field is required.", "default label kept when not overridden");
}

console.log(`input.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
