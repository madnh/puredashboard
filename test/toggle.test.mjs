// Tests for ../src/toggle.js — <puredashboard-toggle> in jsdom. It renders a real
// <button aria-pressed>, so this covers the ARIA contract, click/keyboard activation via
// the native button, the `change` event (and that a programmatic set stays silent), the
// pressed attribute reflection, disabled, icon/label rendering, the accessible name
// mirrored onto the inner button, roving-tabindex support for the group, and the
// declarative attribute surface.
import { JSDOM } from "jsdom";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const tick = () => new Promise((r) => setTimeout(r, 0));

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
const w = dom.window;
for (const k of ["window", "document", "HTMLElement", "customElements", "NodeFilter", "CustomEvent", "Node", "Event", "MouseEvent", "KeyboardEvent"]) global[k] = w[k];

await import("../src/toggle.js");

const B = "puredashboard-toggle";
async function mount(props = {}, attrs = {}) {
  document.body.innerHTML = "";
  const el = document.createElement(B);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  Object.assign(el, props);
  document.body.append(el);
  await tick(); await tick();
  return el;
}
const btn = (el) => el.querySelector(`.js-${B}__btn`);
const ICON = '<svg viewBox="0 0 16 16"><path d="M0 0h16v16H0z"/></svg>';

// ============================================================ structure + ARIA
{
  const el = await mount({ label: "Bold" });
  const b = btn(el);
  ok(b && b.tagName === "BUTTON" && b.getAttribute("type") === "button", "renders a real <button type=button>");
  ok(b.getAttribute("aria-pressed") === "false", "off: aria-pressed=false (a button that stays pressed, NOT role=switch/checkbox)");
  ok(el.querySelector(`.${B}__label`).textContent === "Bold", "label rendered");
  ok(el.querySelector(`.${B}__icon`) === null, "no icon slot when no icon is set");
  ok(!el.hasAttribute("pressed"), "off: no pressed attribute on the host");
}
{
  const el = await mount({ label: "Bold", pressed: true });
  ok(btn(el).getAttribute("aria-pressed") === "true", "on: aria-pressed=true");
  ok(btn(el).classList.contains(`${B}__btn--pressed`), "on: --pressed modifier for the visual state");
  ok(el.hasAttribute("pressed"), "on: the host reflects the pressed attribute (CSS/tests can select it)");
}
{
  const el = await mount({ icon: ICON }, { "aria-label": "Bold" });
  ok(el.querySelector(`.${B}__icon svg`) !== null, "icon: trusted SVG markup mounted");
  ok(btn(el).getAttribute("aria-label") === "Bold", "icon-only: the name is mirrored onto the inner <button>");
  ok(btn(el).classList.contains(`${B}__btn--icon-only`), "icon-only: square modifier so a toolbar lines up");
}
{
  const el = await mount({ label: "<img src=x onerror=alert(1)>" });
  ok(el.querySelector("img") === null && el.querySelector(`.${B}__label`).textContent === "<img src=x onerror=alert(1)>",
    "label: a string is escaped, never parsed as markup");
}
{
  const node = document.createElement("strong");
  node.textContent = "B";
  const el = await mount({ label: node });
  ok(el.querySelector(`.${B}__label strong`) !== null, "label: a DOM node renders as-is");
}

// ================================================================ interaction
{
  const el = await mount({ label: "Mute" });
  const seen = [];
  el.addEventListener("change", (e) => seen.push(e.detail));
  btn(el).click();
  await tick();
  ok(el.pressed === true && btn(el).getAttribute("aria-pressed") === "true", "click: turns on");
  ok(seen.length === 1 && seen[0].pressed === true, "click: emits change{pressed:true}");
  btn(el).click();
  await tick();
  ok(el.pressed === false && seen.length === 2 && seen[1].pressed === false, "click again: turns off and emits change{pressed:false}");
}
{
  const el = await mount({ label: "Pin", value: "pin" });
  let detail = null;
  el.addEventListener("change", (e) => (detail = e.detail));
  btn(el).click();
  ok(detail.value === "pin", "change carries the toggle's `value` (its identity in a group)");
}
{
  const el = await mount({ label: "Pin" });
  let fired = 0;
  el.addEventListener("change", () => fired++);
  el.pressed = true;
  await tick();
  ok(btn(el).getAttribute("aria-pressed") === "true" && fired === 0, "setting .pressed in JS updates the UI but does NOT emit change");
  el.toggle();
  await tick();
  ok(el.pressed === false && fired === 1, "toggle() flips it as a click would (and emits)");
}
{
  const el = await mount({ label: "Nope", disabled: true });
  let fired = 0;
  el.addEventListener("change", () => fired++);
  ok(btn(el).disabled === true, "disabled: the native button is disabled (blocks clicks + skips tab)");
  el.toggle();
  await tick();
  ok(el.pressed !== true && fired === 0, "disabled: toggle() is a no-op and emits nothing");
}
{
  // the platform gives us keyboard activation: a native <button> fires click on Space/Enter.
  const el = await mount({ label: "Bold" });
  const b = btn(el);
  b.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));   // what Space/Enter produce
  await tick();
  ok(el.pressed === true, "keyboard activation goes through the native button's click");
}
{
  const el = await mount({ label: "Bold" });
  let bubbled = false;
  document.body.addEventListener("change", () => (bubbled = true));
  btn(el).click();
  ok(bubbled, "change bubbles, so a toolbar/group can listen on an ancestor");
}

// ============================================ roving tabindex (for toggle-group)
{
  const el = await mount({ label: "A" });
  ok(btn(el).getAttribute("tabindex") === "0", "standalone: the button is tabbable");
  el.tabbable = false;
  await tick();
  ok(btn(el).getAttribute("tabindex") === "-1", "tabbable=false: taken out of the tab order (the group drives a roving tabindex)");
  el.focus();
  ok(document.activeElement === btn(el), "focus() focuses the inner button even when not tabbable");
}

// ================================================================ declarative
{
  const el = await mount({}, { pressed: "", value: "bold", label: "B", size: "sm", variant: "text" });
  ok(el.pressed === true && el.value === "bold", "boolean + string attributes reflect into properties");
  ok(btn(el).getAttribute("aria-pressed") === "true", "…and drive the state");
  ok(btn(el).classList.contains(`${B}__btn--sm`) && btn(el).classList.contains(`${B}__btn--text`), "size + variant modifiers");
}
{
  const el = await mount({ label: "B" });
  el.setAttribute("pressed", "");
  await tick();
  ok(el.pressed === true && btn(el).getAttribute("aria-pressed") === "true", "adding the pressed attribute after mount turns it on");
  el.removeAttribute("pressed");
  await tick();
  ok(el.pressed === false && btn(el).getAttribute("aria-pressed") === "false", "removing it turns it off");
}
{
  const el = await mount({ label: "B", pressed: true });
  el.pressed = false; await tick();
  ok(!el.hasAttribute("pressed"), "the reflected attribute follows the property both ways (no attribute/property drift)");
  el.pressed = true; await tick(); el.pressed = true; await tick();
  ok(el.hasAttribute("pressed") && btn(el).getAttribute("aria-pressed") === "true", "re-setting the same value is stable (no attribute write loop)");
}
{
  const el = await mount({ icon: ICON }, { "aria-label": "Bold" });
  el.setAttribute("aria-label", "Bold text");
  await tick();
  ok(btn(el).getAttribute("aria-label") === "Bold text", "a later aria-label change re-syncs to the inner button");
}

console.log(`\ntoggle.test.mjs: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
