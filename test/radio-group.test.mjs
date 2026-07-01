// Tests for radio-group.js (<puredashboard-radio-group>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, events and logic.
// (Form-associated validity via ElementInternals is partly unsupported in jsdom;
// those paths are guarded and verified in a real browser.)
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

const { PuredashboardRadioGroup } = await import("../src/radio-group.js");
void PuredashboardRadioGroup;

const OPTS = () => [
  { value: "s", label: "Small" },
  { value: "m", label: "Medium" },
  { value: "l", label: "Large" },
];
const opts = (el) => el.querySelectorAll(".js-puredashboard-radio-group__option");
const key = (el, k) => el.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));

// ---- rendering options (keyed by value) ----
{
  const el = mount("puredashboard-radio-group");
  el.options = OPTS();
  el.setAttribute("aria-label", "Size");
  await tick();
  const group = el.querySelector(".puredashboard-radio-group__group");
  ok(group && group.getAttribute("role") === "radiogroup", "renders a role=radiogroup container");
  ok(group.getAttribute("aria-label") === "Size", "aria-label mirrored to the group");
  const o = opts(el);
  ok(o.length === 3, "renders one element per option");
  ok(o[0].getAttribute("role") === "radio", "each option has role=radio");
  ok(o[1].querySelector(".puredashboard-radio-group__text").textContent === "Medium", "option label text is the content");
}

// ---- roving tabindex: none selected → first tabbable ----
{
  const el = mount("puredashboard-radio-group");
  el.options = OPTS();
  await tick();
  const o = opts(el);
  ok(o[0].getAttribute("tabindex") === "0", "no selection → first option is tabbable");
  ok(o[1].getAttribute("tabindex") === "-1" && o[2].getAttribute("tabindex") === "-1", "the rest are tabindex=-1");
}

// ---- roving tabindex: selected value is the tabbable one ----
{
  const el = mount("puredashboard-radio-group");
  el.options = OPTS();
  el.value = "m";
  await tick();
  const o = opts(el);
  ok(o[1].getAttribute("tabindex") === "0", "selected option is the tabbable one");
  ok(o[0].getAttribute("tabindex") === "-1", "unselected option is not tabbable");
  ok(o[1].getAttribute("aria-checked") === "true", "selected option is aria-checked=true");
  ok(o[0].getAttribute("aria-checked") === "false", "unselected option is aria-checked=false");
}

// ---- click selection + change event detail ----
{
  const el = mount("puredashboard-radio-group");
  el.options = OPTS();
  await tick();
  let detail = null, count = 0;
  el.addEventListener("change", (e) => { detail = e.detail; count++; });
  opts(el)[2].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(el.value === "l", "click selects the option");
  ok(count === 1 && detail && detail.value === "l", "change fires once with detail.value");
  ok(opts(el)[2].getAttribute("aria-checked") === "true", "clicked option becomes aria-checked");
  // clicking the already-selected option does not re-fire change
  opts(el)[2].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(count === 1, "clicking the selected option again does not re-fire change");
}

// ---- keyboard: ArrowDown/ArrowRight moves to next + selects, wraps ----
{
  const el = mount("puredashboard-radio-group");
  el.options = OPTS();
  el.value = "s";
  await tick();
  key(opts(el)[0], "ArrowDown");
  await tick();
  ok(el.value === "m", "ArrowDown selects the next option");
  key(opts(el)[1], "ArrowRight");
  await tick();
  ok(el.value === "l", "ArrowRight selects the next option");
  key(opts(el)[2], "ArrowDown");
  await tick();
  ok(el.value === "s", "ArrowDown wraps from last to first");
}

// ---- keyboard: ArrowUp/ArrowLeft moves to previous + selects, wraps ----
{
  const el = mount("puredashboard-radio-group");
  el.options = OPTS();
  el.value = "s";
  await tick();
  key(opts(el)[0], "ArrowUp");
  await tick();
  ok(el.value === "l", "ArrowUp wraps from first to last");
  key(opts(el)[2], "ArrowLeft");
  await tick();
  ok(el.value === "m", "ArrowLeft selects the previous option");
}

// ---- keyboard: Home / End ----
{
  const el = mount("puredashboard-radio-group");
  el.options = OPTS();
  el.value = "m";
  await tick();
  key(opts(el)[1], "End");
  await tick();
  ok(el.value === "l", "End selects the last option");
  key(opts(el)[2], "Home");
  await tick();
  ok(el.value === "s", "Home selects the first option");
}

// ---- keyboard: Space selects the focused option ----
{
  const el = mount("puredashboard-radio-group");
  el.options = OPTS();
  await tick();
  key(opts(el)[2], " ");
  await tick();
  ok(el.value === "l", "Space selects the focused option");
}

// ---- disabled options are skipped by keyboard nav ----
{
  const el = mount("puredashboard-radio-group");
  el.options = [
    { value: "a", label: "A" },
    { value: "b", label: "B", disabled: true },
    { value: "c", label: "C" },
  ];
  el.value = "a";
  await tick();
  key(opts(el)[0], "ArrowDown");
  await tick();
  ok(el.value === "c", "ArrowDown skips the disabled option");
  key(opts(el)[2], "ArrowDown");
  await tick();
  ok(el.value === "a", "wrap skips disabled and lands on first enabled");
  // clicking a disabled option does nothing
  let count = 0;
  el.addEventListener("change", () => count++);
  opts(el)[1].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(count === 0 && el.value === "a", "clicking a disabled option does not select it");
}

// ---- per-option disabled tabindex + aria-disabled ----
{
  const el = mount("puredashboard-radio-group");
  el.options = [
    { value: "a", label: "A", disabled: true },
    { value: "b", label: "B" },
  ];
  await tick();
  const o = opts(el);
  ok(o[0].getAttribute("aria-disabled") === "true", "disabled option is aria-disabled");
  ok(o[0].getAttribute("tabindex") === "-1", "disabled option is never tabbable");
  ok(o[1].getAttribute("tabindex") === "0", "first enabled option owns the roving tabindex");
}

// ---- group-level disabled blocks selection ----
{
  const el = mount("puredashboard-radio-group");
  el.options = OPTS();
  el.disabled = true;
  await tick();
  let count = 0;
  el.addEventListener("change", () => count++);
  opts(el)[1].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  key(opts(el)[0], "ArrowDown");
  await tick();
  ok(count === 0 && !el.value, "disabled group ignores click and keyboard");
  ok(opts(el)[0].classList.contains("puredashboard-radio-group__option--disabled"), "options carry the disabled modifier");
}

// ---- error message + aria wiring ----
{
  const el = mount("puredashboard-radio-group");
  el.options = OPTS();
  el.error = "Pick one";
  await tick();
  const group = el.querySelector(".puredashboard-radio-group__group");
  const err = el.querySelector(".puredashboard-radio-group__error");
  ok(err && err.textContent === "Pick one", "error message rendered exactly");
  ok(group.getAttribute("aria-invalid") === "true", "aria-invalid true when error set");
  ok(err.id && group.getAttribute("aria-describedby") === err.id, "aria-describedby points at the error node");
  ok(err.getAttribute("role") === "alert", "error node is an alert");
  el.error = "";
  await tick();
  ok(!el.querySelector(".puredashboard-radio-group__error"), "clearing error removes the node");
  ok(group.getAttribute("aria-invalid") === "false", "aria-invalid resets when error cleared");
}

// ---- declarative attributes + form reset ----
{
  document.body.innerHTML = `<puredashboard-radio-group name="size" value="m" required></puredashboard-radio-group>`;
  const el = document.body.firstElementChild;
  el.options = OPTS();
  await tick();
  ok(el.value === "m", "value attribute reflected to property");
  ok(el.required === true, "required boolean attribute reflected");
  el.value = "l";
  await tick();
  el.formResetCallback();
  await tick();
  ok(el.value === "m", "formResetCallback restores the initial value");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-radio-group");
  el.labels = { required: "Bắt buộc" };
  await tick();
  ok(el._label("required") === "Bắt buộc", "labels override the default string");
  const el2 = mount("puredashboard-radio-group");
  await tick();
  ok(el2._label("required") === "This field is required.", "default label kept when not overridden");
}

console.log(`radio-group.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
