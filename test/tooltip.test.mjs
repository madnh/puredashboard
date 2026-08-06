// Tests for tooltip.js (<puredashboard-tooltip>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, events and logic.
// (Viewport positioning / flip needs real layout, so those paths are guarded for
// jsdom's zero-sized rects and verified in a real browser.)
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
const w = dom.window;
for (const k of ["document", "HTMLElement", "customElements", "NodeFilter", "CustomEvent", "Node", "Event", "MouseEvent", "FocusEvent", "KeyboardEvent", "getComputedStyle"])
  global[k] = w[k];
global.window = w;
global.queueMicrotask = queueMicrotask;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const tick = () => new Promise((r) => queueMicrotask(() => queueMicrotask(r)));

// Mount a tooltip wrapping a fresh <button> trigger. delay=0 so show is synchronous.
const mount = (attrs = {}) => {
  const el = document.createElement("puredashboard-tooltip");
  const btn = document.createElement("button");
  btn.textContent = "Trigger";
  el.appendChild(btn);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.appendChild(el);
  return { el, btn };
};
const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: false }));

const { PuredashboardTooltip } = await import("../src/tooltip.js");
void PuredashboardTooltip;

// ---- structure: trigger preserved; tooltip node has role + id; aria wired ----
{
  const { el, btn } = mount({ text: "Save", delay: "0" });
  await tick();
  ok(el.firstElementChild === btn, "author trigger child is preserved (same live node)");
  const tip = el.querySelector(".js-puredashboard-tooltip__content");
  ok(tip, "creates a tooltip content node");
  ok(tip.getAttribute("role") === "tooltip", "tooltip node has role=tooltip");
  ok(tip.id && tip.id.length > 0, "tooltip node has a unique id");
  ok(btn.getAttribute("aria-describedby") === tip.id, "trigger aria-describedby points at the tooltip id");
  ok(tip.hidden === true, "tooltip is hidden initially");
}

// ---- text reaches the DOM via textContent (never parsed as HTML) ----
{
  const { el } = mount({ delay: "0" });
  el.text = "<b>x</b> & y";
  await tick();
  const tip = el.querySelector(".js-puredashboard-tooltip__content");
  ok(tip.textContent === "<b>x</b> & y", "text set via textContent verbatim");
  ok(tip.querySelector("b") === null, "text is NOT parsed as HTML (no injected element)");
}

// ---- focusin shows (keyboard parity), focusout hides ----
{
  const { el } = mount({ text: "Info", delay: "0" });
  await tick();
  const tip = el.querySelector(".js-puredashboard-tooltip__content");
  fire(el, "focusin");
  ok(tip.hidden === false, "focusin shows the tooltip (keyboard users)");
  ok(tip.getAttribute("aria-hidden") === "false", "aria-hidden false while shown");
  fire(el, "focusout");
  ok(tip.hidden === true, "focusout hides the tooltip");
}

// ---- mouseenter shows, mouseleave hides ----
{
  const { el } = mount({ text: "Info", delay: "0" });
  await tick();
  const tip = el.querySelector(".js-puredashboard-tooltip__content");
  fire(el, "mouseenter");
  ok(tip.hidden === false, "mouseenter shows the tooltip");
  fire(el, "mouseleave");
  ok(tip.hidden === true, "mouseleave hides the tooltip");
}

// ---- Escape dismisses ----
{
  const { el } = mount({ text: "Info", delay: "0" });
  await tick();
  const tip = el.querySelector(".js-puredashboard-tooltip__content");
  el.show();
  ok(tip.hidden === false, "shown before Escape");
  el.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  ok(tip.hidden === true, "Escape hides the tooltip");
}

// ---- disabled never shows ----
{
  const { el } = mount({ text: "Nope", delay: "0", disabled: "" });
  await tick();
  const tip = el.querySelector(".js-puredashboard-tooltip__content");
  fire(el, "mouseenter");
  fire(el, "focusin");
  el.show();
  ok(tip.hidden === true, "disabled tooltip never shows via events or show()");
}

// ---- delay: show is deferred, then fires ----
{
  const { el } = mount({ text: "Later" });
  el.delay = 20;
  await tick();
  const tip = el.querySelector(".js-puredashboard-tooltip__content");
  fire(el, "mouseenter");
  ok(tip.hidden === true, "still hidden immediately after mouseenter (delay pending)");
  await new Promise((r) => setTimeout(r, 40));
  ok(tip.hidden === false, "tooltip shows after the delay elapses");
  // leaving before the timer would cancel it
  fire(el, "mouseleave");
  ok(tip.hidden === true, "mouseleave after show hides it");
}

// ---- empty text: nothing shows ----
{
  const { el } = mount({ delay: "0" });
  await tick();
  const tip = el.querySelector(".js-puredashboard-tooltip__content");
  fire(el, "mouseenter");
  ok(tip.hidden === true, "no text → tooltip stays hidden");
}

// ---- declarative attributes reflect into properties ----
{
  document.body.innerHTML = `<puredashboard-tooltip text="Hi" placement="bottom" delay="5"><button>b</button></puredashboard-tooltip>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.text === "Hi", "text attribute reflected to property");
  ok(el.placement === "bottom", "placement attribute reflected");
  ok(el.delay === 5, "delay attribute reflected as a number");
}

// ---- localisable labels ----
{
  const el = document.createElement("puredashboard-tooltip");
  el.labels = { tooltip: "Chú thích" };
  document.body.appendChild(el);
  await tick();
  ok(el._label("tooltip") === "Chú thích", "labels override the default string");
  const el2 = mount({ text: "x" }).el;
  await tick();
  ok(el2._label("tooltip") === "Tooltip", "default label kept when not overridden");
}

// ============ a relocation must not kill the tooltip ============================
// disconnectedCallback removes every listener, and _wrap() is guarded to run once across
// reconnects — so with the wiring inside that guard, a moved tooltip came back permanently
// dead. Re-parenting a node is a remove plus an insert, so a keyed repeat() reorder or a
// filter runs both; nothing about this needs a reorder to reach it.
{
  const el = document.createElement("puredashboard-tooltip");
  const btn = document.createElement("button");
  btn.textContent = "T";
  el.appendChild(btn);
  document.body.appendChild(el);
  await tick();
  el.text = "Tip";
  el.delay = 0;
  await tick();

  btn.dispatchEvent(new w.Event("focusin", { bubbles: true }));
  await tick();
  ok(el._shown === true, "relocation: focus shows the tooltip before the move");
  el.hide();
  await tick();

  const host = document.createElement("div");
  document.body.appendChild(host);
  host.appendChild(el);                     // MOVE — disconnect + reconnect
  await tick();

  btn.dispatchEvent(new w.Event("focusin", { bubbles: true }));
  await tick();
  ok(el._shown === true, "relocation: focus still shows it AFTER the move");
  btn.dispatchEvent(new w.Event("focusout", { bubbles: true }));
  await tick();
  ok(el._shown === false, "relocation: focusout still hides it after the move");

  // a second move keeps working — the rebind is not one-shot
  document.body.appendChild(el);
  await tick();
  btn.dispatchEvent(new w.Event("focusin", { bubbles: true }));
  await tick();
  ok(el._shown === true, "relocation: a second move re-binds again");
  el.hide();
  await tick();

  // a tip that was SHOWING when the row moved, with nothing focused, must not be stranded
  btn.dispatchEvent(new w.Event("focusin", { bubbles: true }));
  await tick();
  ok(el._shown === true, "relocation: showing before the move");
  const host2 = document.createElement("div");
  document.body.appendChild(host2);
  host2.appendChild(el);
  await tick();
  ok(
    el._shown === false,
    "relocation: a tip whose trigger no longer holds focus is hidden, not left floating",
  );
}

console.log(`tooltip.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
