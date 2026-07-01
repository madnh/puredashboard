// Tests for button.js (<puredashboard-button>).
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

const { PuredashboardButton } = await import("../src/button.js");
void PuredashboardButton;

// ---- author label children are MOVED into the inner <button> ----
{
  const el = mount("puredashboard-button");
  const span = document.createElement("span");
  span.textContent = "Save";
  el.appendChild(span);
  await tick();
  const inner = el.querySelector(".js-puredashboard-button__el");
  ok(inner && inner.tagName === "BUTTON", "renders an inner <button> by default");
  ok(inner.contains(span), "the author's label child is moved INTO the inner button");
  ok(el.querySelector(".js-puredashboard-button__label").textContent === "Save", "label content preserved exactly");
  ok(el.firstElementChild === inner, "host has exactly the inner element as its child");
}

// ---- variant / size / danger / block modifier classes ----
{
  const el = mount("puredashboard-button");
  el.variant = "primary"; el.size = "lg"; el.danger = true; el.block = true;
  await tick();
  const inner = el.querySelector(".js-puredashboard-button__el");
  ok(inner.classList.contains("puredashboard-button__el--primary"), "variant=primary adds the modifier class");
  ok(inner.classList.contains("puredashboard-button__el--lg"), "size=lg adds the modifier class");
  ok(inner.classList.contains("puredashboard-button__el--danger"), "danger adds the modifier class");
  ok(inner.classList.contains("puredashboard-button__el--block"), "block adds the modifier class");
  ok(el.classList.contains("puredashboard-button--block"), "block sets the host modifier too");
}

// ---- default variant/size add NO class (base) ----
{
  const el = mount("puredashboard-button");
  await tick();
  const inner = el.querySelector(".js-puredashboard-button__el");
  ok(!inner.className.includes("--primary") && !inner.className.includes("--default"), "default variant adds no variant modifier");
  ok(!inner.className.includes("--md"), "md size adds no size modifier");
}

// ---- loading: spinner glyph + aria-busy + blocks click ----
{
  const el = mount("puredashboard-button");
  el.append("Go");
  el.loading = true;
  await tick();
  const inner = el.querySelector(".js-puredashboard-button__el");
  ok(el.querySelector(".js-puredashboard-button__spinner"), "loading shows the spinner glyph");
  ok(el.getAttribute("aria-busy") === "true", "loading sets aria-busy on the host");
  ok(inner.disabled === true, "loading disables the inner button");
  let clicks = 0;
  el.addEventListener("click", () => { clicks++; });
  inner.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true }));
  await tick();
  ok(clicks === 0, "click is blocked while loading");
  // clearing loading removes the spinner + aria-busy
  el.loading = false;
  await tick();
  ok(!el.querySelector(".js-puredashboard-button__spinner"), "clearing loading removes the spinner");
  ok(!el.hasAttribute("aria-busy"), "clearing loading removes aria-busy");
}

// ---- href renders an <a href> (no inner button) ----
{
  const el = mount("puredashboard-button");
  el.append("Docs");
  el.href = "/docs";
  await tick();
  const inner = el.querySelector(".js-puredashboard-button__el");
  ok(inner.tagName === "A", "href renders an <a> element");
  ok(inner.getAttribute("href") === "/docs", "href is applied to the anchor");
  ok(!el.querySelector("button"), "no inner <button> when rendered as a link");
  ok(el.querySelector(".js-puredashboard-button__label").textContent === "Docs", "label preserved on the link");
}

// ---- disabled link: aria-disabled + href removed + navigation blocked ----
{
  const el = mount("puredashboard-button");
  el.href = "/x"; el.disabled = true;
  await tick();
  const inner = el.querySelector(".js-puredashboard-button__el");
  ok(inner.getAttribute("aria-disabled") === "true", "disabled link sets aria-disabled");
  ok(!inner.hasAttribute("href"), "disabled link drops its href so it is not navigable");
}

// ---- type=submit reflected onto the inner button ----
{
  const el = mount("puredashboard-button");
  el.type = "submit";
  await tick();
  const inner = el.querySelector(".js-puredashboard-button__el");
  ok(inner.getAttribute("type") === "submit", "type=submit is applied to the inner button");
}
{
  const el = mount("puredashboard-button");
  await tick();
  const inner = el.querySelector(".js-puredashboard-button__el");
  ok(inner.getAttribute("type") === "button", "type defaults to button on the inner element");
}

// ---- disabled reflected to the inner button ----
{
  const el = mount("puredashboard-button");
  el.disabled = true;
  await tick();
  const inner = el.querySelector(".js-puredashboard-button__el");
  ok(inner.disabled === true, "disabled reflected to the inner button");
  let clicks = 0;
  el.addEventListener("click", () => { clicks++; });
  inner.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true }));
  await tick();
  ok(clicks === 0, "click is blocked while disabled");
}

// ---- icon rendered (trusted SVG markup), leading by default, trailing with iconRight ----
{
  const el = mount("puredashboard-button");
  el.append("Add");
  el.icon = '<svg class="tst-icon"></svg>';
  await tick();
  const iconWrap = el.querySelector(".js-puredashboard-button__icon");
  ok(iconWrap && iconWrap.querySelector(".tst-icon"), "icon SVG markup is rendered (trusted)");
  const inner = el.querySelector(".js-puredashboard-button__el");
  const label = el.querySelector(".js-puredashboard-button__label");
  ok(iconWrap.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING, "icon is placed BEFORE the label by default");
  el.iconRight = true;
  await tick();
  const label2 = el.querySelector(".js-puredashboard-button__label");
  const icon2 = el.querySelector(".js-puredashboard-button__icon");
  ok(label2.compareDocumentPosition(icon2) & Node.DOCUMENT_POSITION_FOLLOWING, "iconRight places the icon AFTER the label");
  void inner;
}

// ---- native click bubbles through the host when enabled ----
{
  const el = mount("puredashboard-button");
  el.append("Ok");
  await tick();
  const inner = el.querySelector(".js-puredashboard-button__el");
  let clicks = 0, seenTarget = null;
  el.addEventListener("click", (e) => { clicks++; seenTarget = e.target; });
  inner.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true }));
  await tick();
  ok(clicks === 1, "native click bubbles through the host exactly once");
  ok(seenTarget === inner, "click target is the inner element");
}

// ---- declarative HTML attributes reflect into properties + the inner element ----
{
  document.body.innerHTML = `<puredashboard-button variant="primary" size="sm" danger block type="submit">Hi</puredashboard-button>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.variant === "primary" && el.size === "sm", "variant/size attributes reflect to properties");
  ok(el.danger === true && el.block === true, "boolean attributes reflect to properties");
  const inner = el.querySelector(".js-puredashboard-button__el");
  ok(inner.classList.contains("puredashboard-button__el--primary") && inner.getAttribute("type") === "submit", "declarative attrs reach the inner button");
  ok(el.querySelector(".js-puredashboard-button__label").textContent === "Hi", "declarative label content preserved");
}

// ---- localisable loading label ----
{
  const el = mount("puredashboard-button");
  el.labels = { loading: "Đang tải" };
  el.loading = true;
  await tick();
  ok(el.getAttribute("aria-label") === "Đang tải", "labels override the loading aria-label");
  const el2 = mount("puredashboard-button");
  el2.loading = true;
  await tick();
  ok(el2.getAttribute("aria-label") === "Loading", "default loading label kept when not overridden");
}

// ---- idempotent connect: re-connecting does not re-wrap or move children again ----
{
  const el = mount("puredashboard-button");
  el.append("Once");
  await tick();
  const inner1 = el.querySelector(".js-puredashboard-button__el");
  el.remove();
  document.body.appendChild(el);         // reconnect
  await tick();
  const inners = el.querySelectorAll(".js-puredashboard-button__el");
  ok(inners.length === 1, "reconnect does not create a second inner element");
  ok(el.querySelector(".js-puredashboard-button__label").textContent === "Once", "label content survives reconnect");
  void inner1;
}

console.log(`button.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
