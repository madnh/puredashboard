// Tests for popover.js (<puredashboard-popover>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, events and logic.
// NOTE: jsdom has no real Popover API / top layer, so the component's FALLBACK
// path is what runs here (feature-detect finds no showPopover) — which is exactly
// what we want to cover: outside-click/Esc dismiss and focus-return are handled
// manually in that path. Popover-API-specific calls are guarded in the source.
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

// Mount a popover with a trigger + content (explicit data-* markers).
function mountPopover(placement) {
  const el = document.createElement("puredashboard-popover");
  if (placement) el.setAttribute("placement", placement);
  const trigger = document.createElement("button");
  trigger.setAttribute("data-popover-trigger", "");
  trigger.textContent = "Open";
  const content = document.createElement("div");
  content.setAttribute("data-popover-content", "");
  content.textContent = "Panel body";
  el.appendChild(trigger);
  el.appendChild(content);
  document.body.appendChild(el);
  return { el, trigger, content };
}

const { PuredashboardPopover } = await import("../src/popover.js");
void PuredashboardPopover;

// ---- trigger + content identified and preserved --------------------------
{
  const { el, trigger, content } = mountPopover();
  await tick();
  ok(el._trigger === trigger, "trigger element identified (data-popover-trigger)");
  ok(el._content === content, "content element identified (data-popover-content)");
  ok(el.contains(trigger), "trigger preserved as a child (kept in place)");
  ok(content.textContent === "Panel body", "content node preserved verbatim");
  ok(content.classList.contains("puredashboard-popover__panel"), "content gets the BEM panel class");
  ok(content.classList.contains("js-puredashboard-popover__panel"), "content gets the js- hook class");
}

// ---- trigger identified as first element child when unmarked --------------
{
  const el = document.createElement("puredashboard-popover");
  const trigger = document.createElement("button"); trigger.textContent = "T";
  const content = document.createElement("div"); content.setAttribute("data-popover-content", ""); content.textContent = "C";
  el.appendChild(trigger); el.appendChild(content);
  document.body.appendChild(el);
  await tick();
  ok(el._trigger === trigger, "first element child used as trigger when unmarked");
}

// ---- ARIA wiring ----------------------------------------------------------
{
  const { el, trigger, content } = mountPopover();
  await tick();
  ok(trigger.getAttribute("aria-haspopup") === "dialog", "trigger has aria-haspopup=dialog");
  ok(trigger.getAttribute("aria-expanded") === "false", "aria-expanded false when closed");
  ok(content.id && trigger.getAttribute("aria-controls") === content.id, "aria-controls points at the content id");
  ok(content.getAttribute("role") === "dialog", "content gets role=dialog");
  ok(!!content.getAttribute("aria-label"), "content gets a fallback accessible name");
  void el;
}

// ---- trigger click toggles open (aria-expanded flips, panel shown/hidden) -
{
  const { el, trigger, content } = mountPopover();
  await tick();
  trigger.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(el.open === true, "click opens the popover");
  ok(trigger.getAttribute("aria-expanded") === "true", "aria-expanded true after open");
  ok(el.hasAttribute("open"), "open attribute reflected on host");
  ok(content.hasAttribute("data-open"), "fallback panel marked data-open when shown");
  trigger.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(el.open === false, "second click closes the popover");
  ok(trigger.getAttribute("aria-expanded") === "false", "aria-expanded false after close");
  ok(!content.hasAttribute("data-open"), "fallback panel data-open removed when hidden");
}

// ---- show()/hide()/toggle() ----------------------------------------------
{
  const { el } = mountPopover();
  await tick();
  el.show();
  ok(el.open === true, "show() opens");
  el.hide();
  ok(el.open === false, "hide() closes");
  el.toggle();
  ok(el.open === true, "toggle() opens when closed");
  el.toggle();
  ok(el.open === false, "toggle() closes when open");
}

// ---- open/close CustomEvents fire (bubbling) ------------------------------
{
  const { el } = mountPopover();
  await tick();
  let opened = 0, closed = 0, openBubbles = false;
  document.addEventListener("open", (e) => { if (e.target === el) { opened++; openBubbles = e.bubbles; } });
  document.addEventListener("close", (e) => { if (e.target === el) closed++; });
  el.show();
  await tick();
  el.hide();
  await tick();
  ok(opened === 1, "open event fires once on show()");
  ok(closed === 1, "close event fires once on hide()");
  ok(openBubbles === true, "open event bubbles");
}

// ---- programmatic open="" attribute opens on connect ----------------------
{
  const el = document.createElement("puredashboard-popover");
  el.setAttribute("open", "");
  const trigger = document.createElement("button"); trigger.setAttribute("data-popover-trigger", "");
  const content = document.createElement("div"); content.setAttribute("data-popover-content", "");
  el.appendChild(trigger); el.appendChild(content);
  document.body.appendChild(el);
  await tick();
  ok(el.open === true, "open attribute opens the panel on connect");
}

// ---- Escape closes (fallback path) + focus returns to trigger -------------
{
  const { el, trigger } = mountPopover();
  await tick();
  el.show();
  await tick();
  ok(el.open === true, "opened before Esc");
  document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await tick();
  ok(el.open === false, "Escape closes the popover (fallback path)");
  ok(document.activeElement === trigger, "focus returns to the trigger on close");
}

// ---- outside-click closes (fallback path) ---------------------------------
{
  const { el, content } = mountPopover();
  await tick();
  el.show();
  await tick();
  // click inside the content should NOT close
  content.dispatchEvent(new w.MouseEvent("pointerdown", { bubbles: true }));
  await tick();
  ok(el.open === true, "click inside the panel keeps it open");
  // click on the body (outside) should close
  document.body.dispatchEvent(new w.MouseEvent("pointerdown", { bubbles: true }));
  await tick();
  ok(el.open === false, "outside-click closes the popover (fallback path)");
}

// ---- placement property/attribute -----------------------------------------
{
  const { el } = mountPopover("top-end");
  await tick();
  ok(el.placement === "top-end", "placement attribute reflected to property");
  el.placement = "right";
  ok(el.placement === "right" && el.getAttribute("placement") === "right", "placement setter reflects to attribute");
  el.placement = "bogus";
  ok(el.placement === "bottom-start", "invalid placement falls back to bottom-start");
}

// ---- localisable labels ---------------------------------------------------
{
  const { el } = mountPopover();
  await tick();
  ok(el._label("dialog") === "Popover", "default label kept when not overridden");
  el.labels = { dialog: "Bảng" };
  ok(el._label("dialog") === "Bảng", "labels override the default string");
}

console.log(`popover.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
