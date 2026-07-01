// Tests for alert.js (<puredashboard-alert>).
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
const mount = (tag) => { const el = document.createElement(tag); document.body.appendChild(el); return el; };

const { PuredashboardAlert } = await import("../src/alert.js");
void PuredashboardAlert;

// ---- type modifier class + live-region role per type ----
{
  const cases = [
    ["info",    "puredashboard-alert__box--info",    "status"],
    ["success", "puredashboard-alert__box--success", "status"],
    ["warning", "puredashboard-alert__box--warning", "alert"],
    ["error",   "puredashboard-alert__box--error",   "alert"],
  ];
  for (const [type, cls, role] of cases) {
    const el = mount("puredashboard-alert");
    el.type = type;
    await tick();
    const box = el.querySelector(".puredashboard-alert__box");
    ok(box && box.classList.contains(cls), `type=${type} → modifier class ${cls}`);
    ok(box && box.getAttribute("role") === role, `type=${type} → role="${role}"`);
  }
}

// ---- "danger" aliases "error"; unknown type falls back to "info" ----
{
  const el = mount("puredashboard-alert");
  el.type = "danger";
  await tick();
  let box = el.querySelector(".puredashboard-alert__box");
  ok(box.classList.contains("puredashboard-alert__box--error"), "danger aliases the error type");
  ok(box.getAttribute("role") === "alert", "danger is assertive (role=alert)");
  el.type = "bogus";
  await tick();
  box = el.querySelector(".puredashboard-alert__box");
  ok(box.classList.contains("puredashboard-alert__box--info"), "unknown type falls back to info");
  ok(box.getAttribute("role") === "status", "unknown type is polite (role=status)");
}

// ---- default type is info ----
{
  const el = mount("puredashboard-alert");
  await tick();
  const box = el.querySelector(".puredashboard-alert__box");
  ok(box.classList.contains("puredashboard-alert__box--info"), "default type is info");
}

// ---- title + message render as exact text (author content, escaped) ----
{
  const el = mount("puredashboard-alert");
  el.title = "Save failed";
  el.message = "Check your connection.";
  await tick();
  const title = el.querySelector(".puredashboard-alert__title");
  const msg = el.querySelector(".puredashboard-alert__message");
  ok(title && title.textContent === "Save failed", "title renders exact text");
  ok(msg && msg.textContent === "Check your connection.", "message renders exact text");
}

// ---- title is optional; message-only alert has no title node ----
{
  const el = mount("puredashboard-alert");
  el.message = "Just a note.";
  await tick();
  ok(!el.querySelector(".puredashboard-alert__title"), "no title node when title unset");
  ok(el.querySelector(".puredashboard-alert__message").textContent === "Just a note.", "message renders without a title");
}

// ---- author content is escaped, not treated as markup ----
{
  const el = mount("puredashboard-alert");
  el.message = "<img src=x onerror=alert(1)>";
  await tick();
  const msg = el.querySelector(".puredashboard-alert__message");
  ok(msg.textContent === "<img src=x onerror=alert(1)>", "message content is escaped verbatim");
  ok(!msg.querySelector("img"), "no element injected from author content");
}

// ---- showIcon toggles the leading glyph (default on) ----
{
  const el = mount("puredashboard-alert");
  el.type = "success";
  await tick();
  ok(el.querySelector(".puredashboard-alert__icon"), "icon shown by default");
  ok(el.querySelector(".puredashboard-alert__icon svg"), "per-type inline SVG glyph rendered");
  el.showIcon = false;
  await tick();
  ok(!el.querySelector(".puredashboard-alert__icon"), "showIcon=false hides the glyph");
}

// ---- closable renders a close button; default off ----
{
  const el = mount("puredashboard-alert");
  await tick();
  ok(!el.querySelector(".js-puredashboard-alert__close"), "no close button by default");
  el.closable = true;
  await tick();
  const btn = el.querySelector(".js-puredashboard-alert__close");
  ok(btn, "closable renders a close button");
  ok(btn.getAttribute("type") === "button", "close button is type=button");
  ok(btn.getAttribute("aria-label") === "Dismiss", "close button aria-label from LABELS.close");
}

// ---- close button emits a bubbling cancelable 'close' and removes the element ----
{
  const el = mount("puredashboard-alert");
  el.closable = true;
  await tick();
  const btn = el.querySelector(".js-puredashboard-alert__close");
  let seen = null, bubbled = false;
  el.addEventListener("close", (e) => { seen = e; });
  document.body.addEventListener("close", () => { bubbled = true; }, { once: true });
  btn.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(seen, "close event emitted");
  ok(seen.cancelable === true, "close event is cancelable");
  ok(bubbled, "close event bubbles to the document");
  ok(!el.isConnected, "element removes itself after close");
}

// ---- preventDefault on 'close' keeps the element mounted ----
{
  const el = mount("puredashboard-alert");
  el.closable = true;
  await tick();
  const btn = el.querySelector(".js-puredashboard-alert__close");
  el.addEventListener("close", (e) => e.preventDefault());
  btn.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(el.isConnected, "preventDefault keeps the element mounted");
}

// ---- declarative HTML attributes reflect into properties ----
{
  document.body.innerHTML = `<puredashboard-alert type="warning" title="Heads up" message="Disk almost full" closable></puredashboard-alert>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.type === "warning", "type attribute reflected to property");
  ok(el.title === "Heads up", "title attribute reflected");
  ok(el.message === "Disk almost full", "message attribute reflected");
  ok(el.closable === true, "closable boolean attribute reflected");
  const box = el.querySelector(".puredashboard-alert__box");
  ok(box.getAttribute("role") === "alert", "warning attribute yields role=alert");
  ok(el.querySelector(".js-puredashboard-alert__close"), "closable attribute renders the close button");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-alert");
  el.closable = true;
  el.labels = { close: "Bỏ qua" };
  await tick();
  ok(el._label("close") === "Bỏ qua", "labels override the default string");
  ok(el.querySelector(".js-puredashboard-alert__close").getAttribute("aria-label") === "Bỏ qua", "overridden label reaches the button aria-label");
  const el2 = mount("puredashboard-alert");
  await tick();
  ok(el2._label("close") === "Dismiss", "default label kept when not overridden");
}

console.log(`alert.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
