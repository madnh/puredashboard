// Tests for tag.js (<puredashboard-tag>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, events and logic.
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

const { PuredashboardTag } = await import("../src/tag.js");
void PuredashboardTag;

// ---- text children are preserved (author content, never clobbered) ----
{
  document.body.innerHTML = `<puredashboard-tag color="success">Online</puredashboard-tag>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.textContent === "Online", "author text children are preserved verbatim");
  ok(el.firstChild && el.firstChild.nodeType === 3 && el.firstChild.textContent === "Online", "text node stays as the first child");
}

// ---- color modifier applied ----
{
  document.body.innerHTML = `<puredashboard-tag color="success">S</puredashboard-tag>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.classList.contains("puredashboard-tag"), "base block class applied");
  ok(el.classList.contains("puredashboard-tag--success"), "color=success adds the modifier");
  // changing color swaps the modifier and drops the old one
  el.color = "danger";
  await tick();
  ok(el.classList.contains("puredashboard-tag--danger"), "changed color adds new modifier");
  ok(!el.classList.contains("puredashboard-tag--success"), "old color modifier removed");
}

// ---- unknown color falls back to default ----
{
  document.body.innerHTML = `<puredashboard-tag color="bogus">X</puredashboard-tag>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.classList.contains("puredashboard-tag--default"), "unknown color falls back to default modifier");
}

// ---- size + round modifiers ----
{
  document.body.innerHTML = `<puredashboard-tag size="sm" round>R</puredashboard-tag>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.classList.contains("puredashboard-tag--sm"), "size=sm adds the modifier");
  ok(el.classList.contains("puredashboard-tag--round"), "round adds the pill modifier");
}

// ---- closable renders a close button with aria-label ----
{
  document.body.innerHTML = `<puredashboard-tag closable>Tag</puredashboard-tag>`;
  const el = document.body.firstElementChild;
  await tick();
  const btn = el.querySelector(".js-puredashboard-tag__close");
  ok(btn, "closable renders a close button");
  ok(btn.tagName === "BUTTON" && btn.type === "button", "close button is a type=button <button>");
  ok(btn.getAttribute("aria-label") === "Remove", "close button has the LABELS.remove aria-label");
  ok(el.textContent.startsWith("Tag"), "author text still comes before the close button");
  ok(el.querySelectorAll(".js-puredashboard-tag__close").length === 1, "exactly one close button");
}

// ---- non-closable renders no button; toggling closable adds/removes it ----
{
  document.body.innerHTML = `<puredashboard-tag>Plain</puredashboard-tag>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(!el.querySelector(".js-puredashboard-tag__close"), "no close button when not closable");
  el.closable = true;
  await tick();
  ok(el.querySelector(".js-puredashboard-tag__close"), "setting closable adds the button");
  el.closable = false;
  await tick();
  ok(!el.querySelector(".js-puredashboard-tag__close"), "clearing closable removes the button");
}

// ---- clicking close emits a bubbling "close" and removes the element ----
{
  document.body.innerHTML = `<puredashboard-tag closable>Bye</puredashboard-tag>`;
  const el = document.body.firstElementChild;
  await tick();
  let seen = 0, bubbled = 0;
  el.addEventListener("close", () => { seen++; });
  document.body.addEventListener("close", () => { bubbled++; }, { once: true });
  const btn = el.querySelector(".js-puredashboard-tag__close");
  btn.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true }));
  await tick();
  ok(seen === 1, "clicking close emits one close event");
  ok(bubbled === 1, "close event bubbles up to the document");
  ok(!el.isConnected, "tag removes itself from the DOM on close");
}

// ---- preventDefault on close keeps the tag ----
{
  document.body.innerHTML = `<puredashboard-tag closable>Stay</puredashboard-tag>`;
  const el = document.body.firstElementChild;
  await tick();
  el.addEventListener("close", (e) => { e.preventDefault(); });
  const btn = el.querySelector(".js-puredashboard-tag__close");
  btn.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true }));
  await tick();
  ok(el.isConnected, "preventDefault keeps the tag in the DOM");
  ok(el.querySelector(".js-puredashboard-tag__close"), "kept tag still has its close button");
}

// ---- localisable labels (remove) ----
{
  document.body.innerHTML = `<puredashboard-tag>L</puredashboard-tag>`;
  const el = document.body.firstElementChild;
  el.labels = { remove: "Xóa" };
  el.closable = true;
  await tick();
  const btn = el.querySelector(".js-puredashboard-tag__close");
  ok(btn.getAttribute("aria-label") === "Xóa", "labels override the close aria-label");
  ok(el._label("remove") === "Xóa", "labels override the default string");
}

console.log(`tag.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
