// Tests for switch.js (<puredashboard-switch>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, events and logic.
// (Form-associated validity via ElementInternals is partly unsupported in jsdom;
// those paths are guarded in the component and verified in a real browser.)
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

const { PuredashboardSwitch } = await import("../src/switch.js");
void PuredashboardSwitch;

// ---- rendering + role=switch + property reflection ----
{
  const el = mount("puredashboard-switch");
  el.label = "Enable it";
  el.checked = true;
  await tick();
  const input = el.querySelector(".js-puredashboard-switch__input");
  ok(input, "renders an inner checkbox input");
  ok(input.getAttribute("type") === "checkbox", "inner input is a checkbox");
  ok(input.getAttribute("role") === "switch", "inner input has role=switch");
  ok(input.checked === true, "checked reflected to the inner input");
  ok(input.getAttribute("aria-invalid") === "false", "aria-invalid false by default");
  const label = el.querySelector(".puredashboard-switch__label");
  ok(label && label.textContent === "Enable it", "label content rendered beside the switch");
  const track = el.querySelector(".puredashboard-switch__track");
  const knob = el.querySelector(".puredashboard-switch__knob");
  ok(track && knob, "renders track + knob visual");
}

// ---- disabled / required ----
{
  const el = mount("puredashboard-switch");
  el.disabled = true;
  el.required = true;
  await tick();
  const input = el.querySelector(".js-puredashboard-switch__input");
  ok(input.disabled === true, "disabled reflected to the inner input");
  ok(input.hasAttribute("required"), "required reflected to the inner input");
}

// ---- error message + aria wiring ----
{
  const el = mount("puredashboard-switch");
  el.error = "You must accept";
  await tick();
  const input = el.querySelector(".js-puredashboard-switch__input");
  const err = el.querySelector(".puredashboard-switch__error");
  ok(err && err.textContent === "You must accept", "error message rendered exactly");
  ok(input.getAttribute("aria-invalid") === "true", "aria-invalid true when error set");
  ok(err.id && input.getAttribute("aria-describedby") === err.id, "aria-describedby points at the error node");
  ok(err.getAttribute("role") === "alert", "error node is an alert");
  // clearing the error removes the node and resets aria
  el.error = "";
  await tick();
  ok(!el.querySelector(".puredashboard-switch__error"), "clearing error removes the node");
  ok(input.getAttribute("aria-invalid") === "false", "aria-invalid resets when error cleared");
}

// ---- user toggling: native change bubbles once, el.checked stays in sync ----
{
  const el = mount("puredashboard-switch");
  await tick();
  const input = el.querySelector(".js-puredashboard-switch__input");
  let count = 0, seenTarget = null;
  el.addEventListener("change", (e) => { count++; seenTarget = e.target; });
  input.checked = true;
  input.dispatchEvent(new w.Event("change", { bubbles: true }));
  await tick();
  ok(el.checked === true, "el.checked follows user toggling");
  ok(count === 1, "exactly one native change event bubbles (no re-dispatch dup)");
  ok(seenTarget === input, "change event target is the inner input");
  // toggle back off
  input.checked = false;
  input.dispatchEvent(new w.Event("change", { bubbles: true }));
  await tick();
  ok(el.checked === false, "el.checked reflects toggling back off");
}

// ---- value property drives what would submit (default "on") ----
{
  const el = mount("puredashboard-switch");
  await tick();
  ok((el.value ?? "on") === "on", "value defaults to \"on\"");
  el.value = "yes";
  await tick();
  ok(el.value === "yes", "value property is settable");
}

// ---- declarative HTML attributes reflect into properties ----
{
  document.body.innerHTML = `<puredashboard-switch label="Wifi" value="1" checked required disabled></puredashboard-switch>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.label === "Wifi", "label attribute reflected to property");
  ok(el.value === "1", "value attribute reflected");
  ok(el.checked === true, "checked boolean attribute reflected");
  ok(el.required === true, "required boolean attribute reflected");
  ok(el.disabled === true, "disabled boolean attribute reflected");
  const input = el.querySelector(".js-puredashboard-switch__input");
  ok(input.checked === true && input.disabled === true, "reflected attrs reach the inner input");
}

// ---- form reset restores the initial checked state ----
{
  document.body.innerHTML = `<puredashboard-switch checked></puredashboard-switch>`;
  const el = document.body.firstElementChild;
  await tick();
  el.checked = false;
  await tick();
  el.formResetCallback();
  await tick();
  ok(el.checked === true, "formResetCallback restores the initial checked state");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-switch");
  el.labels = { required: "Bắt buộc" };
  await tick();
  ok(el._label("required") === "Bắt buộc", "labels override the default string");
  const el2 = mount("puredashboard-switch");
  await tick();
  ok(el2._label("required") === "This field is required.", "default label kept when not overridden");
}

console.log(`switch.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
