// Tests for popconfirm.js (<puredashboard-popconfirm>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, events and logic.
// NOTE: jsdom has no real Popover API / top layer, so the component's FALLBACK
// path is what runs here (feature-detect finds no showPopover) — exactly what we
// want to cover: outside-click/Esc dismiss and focus-return handled manually.
// Popover-API-specific calls are guarded in the source (try/catch + fallback).
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

// Mount a popconfirm with a single <button> trigger child.
function mount(attrs = {}) {
  const el = document.createElement("puredashboard-popconfirm");
  for (const [k, v] of Object.entries(attrs)) {
    if (v === true) el.setAttribute(k, "");
    else if (v != null) el.setAttribute(k, v);
  }
  const trigger = document.createElement("button");
  trigger.textContent = "Delete";
  el.appendChild(trigger);
  document.body.appendChild(el);
  return { el, trigger };
}
const panelOf = (el) => el.querySelector(".js-puredashboard-popconfirm__panel");
const okOf = (el) => el.querySelector(".js-puredashboard-popconfirm__ok");
const cancelOf = (el) => el.querySelector(".js-puredashboard-popconfirm__cancel");

const { PuredashboardPopconfirm } = await import("../src/popconfirm.js");
void PuredashboardPopconfirm;

// ---- trigger preserved + ARIA wired --------------------------------------
{
  const { el, trigger } = mount({ title: "Delete this row?" });
  ok(el.firstElementChild === trigger, "author trigger preserved as the first child");
  ok(trigger.getAttribute("aria-haspopup") === "dialog", "trigger has aria-haspopup=dialog");
  ok(trigger.getAttribute("aria-expanded") === "false", "trigger aria-expanded starts false");
  const panel = panelOf(el);
  ok(panel && trigger.getAttribute("aria-controls") === panel.id, "aria-controls points at the panel");
}

// ---- clicking the trigger opens the panel (role=dialog, content, buttons) --
{
  const { el, trigger } = mount({ title: "Delete this row?", description: "This cannot be undone." });
  trigger.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  const panel = panelOf(el);
  ok(el.open === true, "open is true after clicking the trigger");
  ok(trigger.getAttribute("aria-expanded") === "true", "aria-expanded true when open");
  ok(panel.getAttribute("role") === "dialog", "panel role=dialog");
  ok(el.querySelector(".puredashboard-popconfirm__title").textContent === "Delete this row?", "title text shown");
  ok(el.querySelector(".puredashboard-popconfirm__desc").textContent === "This cannot be undone.", "description text shown");
  ok(okOf(el) && cancelOf(el), "OK and Cancel buttons present");
  ok(okOf(el).textContent === "OK" && cancelOf(el).textContent === "Cancel", "default OK/Cancel labels");
  const labelledby = panel.getAttribute("aria-labelledby");
  ok(labelledby && labelledby === el.querySelector(".puredashboard-popconfirm__title").id, "aria-labelledby points at the title");
}

// ---- clicking OK emits "confirm" then closes -----------------------------
{
  const { el, trigger } = mount({ title: "Proceed?" });
  trigger.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  let confirmed = 0, cancelled = 0;
  el.addEventListener("confirm", () => confirmed++);
  el.addEventListener("cancel", () => cancelled++);
  okOf(el).dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(confirmed === 1, "OK emits exactly one confirm event");
  ok(cancelled === 0, "OK does not emit cancel");
  ok(el.open === false, "panel closes after confirm");
}

// ---- clicking Cancel emits "cancel" then closes --------------------------
{
  const { el, trigger } = mount({ title: "Proceed?" });
  trigger.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  let confirmed = 0, cancelled = 0;
  el.addEventListener("confirm", () => confirmed++);
  el.addEventListener("cancel", () => cancelled++);
  cancelOf(el).dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(cancelled === 1, "Cancel emits exactly one cancel event");
  ok(confirmed === 0, "Cancel does not emit confirm");
  ok(el.open === false, "panel closes after cancel");
}

// ---- Escape closes with "cancel" (fallback path) -------------------------
{
  const { el, trigger } = mount({ title: "Proceed?" });
  trigger.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  let cancelled = 0;
  el.addEventListener("cancel", () => cancelled++);
  document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await tick();
  ok(cancelled === 1, "Escape emits cancel");
  ok(el.open === false, "Escape closes the panel");
}

// ---- outside-click closes with "cancel" (fallback path) ------------------
{
  const { el, trigger } = mount({ title: "Proceed?" });
  trigger.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  let cancelled = 0;
  el.addEventListener("cancel", () => cancelled++);
  document.body.dispatchEvent(new w.MouseEvent("pointerdown", { bubbles: true }));
  await tick();
  ok(cancelled === 1, "outside-click emits cancel");
  ok(el.open === false, "outside-click closes the panel");
}

// ---- okDanger → danger button + alertdialog role -------------------------
{
  const { el, trigger } = mount({ title: "Delete?", "ok-danger": true });
  trigger.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(el.okDanger === true, "okDanger reflects the ok-danger attribute");
  ok(okOf(el).classList.contains("puredashboard-popconfirm__btn--danger"), "OK button gets the danger modifier");
  ok(panelOf(el).getAttribute("role") === "alertdialog", "destructive confirm uses role=alertdialog");
}

// ---- placement reflected onto the panel ----------------------------------
{
  const { el } = mount({ title: "Move?", placement: "bottom" });
  ok(el.placement === "bottom", "placement property reflects the attribute");
  ok(panelOf(el).getAttribute("data-placement") === "bottom", "panel carries data-placement=bottom");
  el.placement = "left";
  ok(panelOf(el).getAttribute("data-placement") === "left", "changing placement updates data-placement");
  el.placement = "nonsense";
  ok(el.placement === "top", "invalid placement falls back to top");
}

// ---- labels override -----------------------------------------------------
{
  const { el, trigger } = mount({ title: "Xoá?" });
  el.labels = { ok: "Đồng ý", cancel: "Huỷ" };
  trigger.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(okOf(el).textContent === "Đồng ý", "OK label overridden via labels");
  ok(cancelOf(el).textContent === "Huỷ", "Cancel label overridden via labels");
  const el2 = mount({ title: "x" }).el;
  await tick();
  ok(el2._label("ok") === "OK" && el2._label("cancel") === "Cancel", "default labels kept when not overridden");
}

// ---- disabled trigger does not open --------------------------------------
{
  const { el, trigger } = mount({ title: "Proceed?", disabled: true });
  trigger.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(el.open === false, "disabled trigger click does not open the panel");
}

console.log(`popconfirm.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
