// Tests for checkbox.js (<puredashboard-checkbox>).
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

const { PuredashboardCheckbox } = await import("../src/checkbox.js");
void PuredashboardCheckbox;

// ---- rendering + property reflection ----
{
  const el = mount("puredashboard-checkbox");
  el.label = "I agree";
  el.checked = true;
  await tick();
  const box = el.querySelector(".js-puredashboard-checkbox__box");
  ok(box, "renders an inner <input type=checkbox>");
  ok(box.getAttribute("type") === "checkbox", "inner input is a checkbox");
  ok(box.checked === true, "checked reflected to the box");
  const text = el.querySelector(".puredashboard-checkbox__text");
  ok(text && text.textContent === "I agree", "label content rendered beside the box");
  ok(box.getAttribute("aria-invalid") === "false", "aria-invalid false by default");
}

// ---- default value + no label ----
{
  const el = mount("puredashboard-checkbox");
  await tick();
  const box = el.querySelector(".js-puredashboard-checkbox__box");
  ok(box.getAttribute("value") === "on", "value defaults to 'on'");
  ok(!el.querySelector(".puredashboard-checkbox__text"), "no label span when label unset");
  ok(el.checked === false, "checked defaults to false");
}

// ---- disabled / required ----
{
  const el = mount("puredashboard-checkbox");
  el.disabled = true;
  el.required = true;
  await tick();
  const box = el.querySelector(".js-puredashboard-checkbox__box");
  ok(box.disabled === true, "disabled reflected to the box");
  ok(box.hasAttribute("required"), "required reflected to the box");
}

// ---- indeterminate is set as the .indeterminate PROPERTY (no attribute) ----
{
  const el = mount("puredashboard-checkbox");
  el.indeterminate = true;
  await tick();
  const box = el.querySelector(".js-puredashboard-checkbox__box");
  ok(box.indeterminate === true, "indeterminate applied as the input property");
  ok(!box.hasAttribute("indeterminate"), "indeterminate is not set as an attribute");
  // toggling clears it
  el.indeterminate = false;
  await tick();
  ok(box.indeterminate === false, "indeterminate cleared when set false");
}

// ---- error message + aria wiring ----
{
  const el = mount("puredashboard-checkbox");
  el.error = "Please accept";
  await tick();
  const box = el.querySelector(".js-puredashboard-checkbox__box");
  const err = el.querySelector(".puredashboard-checkbox__error");
  ok(err && err.textContent === "Please accept", "error message rendered exactly");
  ok(box.getAttribute("aria-invalid") === "true", "aria-invalid true when error set");
  ok(err.id && box.getAttribute("aria-describedby") === err.id, "aria-describedby points at the error node");
  ok(err.getAttribute("role") === "alert", "error node is an alert");
  // clearing the error removes the node and resets aria
  el.error = "";
  await tick();
  ok(!el.querySelector(".puredashboard-checkbox__error"), "clearing error removes the node");
  ok(box.getAttribute("aria-invalid") === "false", "aria-invalid resets when error cleared");
}

// ---- user toggling: native change bubbles once, el.checked stays in sync ----
{
  const el = mount("puredashboard-checkbox");
  await tick();
  const box = el.querySelector(".js-puredashboard-checkbox__box");
  let count = 0, seenTarget = null;
  el.addEventListener("change", (e) => { count++; seenTarget = e.target; });
  box.checked = true;
  box.dispatchEvent(new w.Event("change", { bubbles: true }));
  await tick();
  ok(el.checked === true, "el.checked follows user toggling");
  ok(count === 1, "exactly one native change event bubbles (no re-dispatch dup)");
  ok(seenTarget === box, "change event target is the inner box");
}

// ---- toggling off syncs back to false ----
{
  const el = mount("puredashboard-checkbox");
  el.checked = true;
  await tick();
  const box = el.querySelector(".js-puredashboard-checkbox__box");
  box.checked = false;
  box.dispatchEvent(new w.Event("change", { bubbles: true }));
  await tick();
  ok(el.checked === false, "el.checked reflects being unchecked");
}

// ---- declarative HTML attributes reflect into properties ----
{
  document.body.innerHTML = `<puredashboard-checkbox label="Agree" value="yes" checked required disabled></puredashboard-checkbox>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.label === "Agree", "label attribute reflected to property");
  ok(el.value === "yes", "value attribute reflected");
  ok(el.checked === true, "checked boolean attribute reflected");
  ok(el.required === true, "required boolean attribute reflected");
  ok(el.disabled === true, "disabled boolean attribute reflected");
  const box = el.querySelector(".js-puredashboard-checkbox__box");
  ok(box.checked === true && box.disabled === true, "reflected attrs reach the inner box");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-checkbox");
  el.labels = { required: "Bắt buộc" };
  await tick();
  ok(el._label("required") === "Bắt buộc", "labels override the default string");
  const el2 = mount("puredashboard-checkbox");
  await tick();
  ok(el2._label("required") === "This field is required.", "default label kept when not overridden");
}

console.log(`checkbox.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
