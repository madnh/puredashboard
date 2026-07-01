// Tests for avatar.js (<puredashboard-avatar>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, initials/colour
// derivation, size/shape modifiers and the <img> onerror fallback.
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
const w = dom.window;
for (const k of ["document", "HTMLElement", "HTMLImageElement", "Image", "customElements", "NodeFilter", "CustomEvent", "Node", "Event", "MouseEvent"])
  global[k] = w[k];
global.window = w;
global.queueMicrotask = queueMicrotask;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const tick = () => new Promise((r) => queueMicrotask(() => queueMicrotask(r)));
const mount = (tag) => { const el = document.createElement(tag); document.body.appendChild(el); return el; };

const { PuredashboardAvatar, initials, colorIndex } = await import("../src/avatar.js");
void PuredashboardAvatar;

// ---- src renders an <img> with correct alt ----
{
  const el = mount("puredashboard-avatar");
  el.src = "/u/ada.png";
  el.name = "Ada Lovelace";
  await tick();
  const img = el.querySelector(".puredashboard-avatar__img");
  ok(img, "renders an <img> when src is set");
  ok(img.getAttribute("src") === "/u/ada.png", "img src reflected");
  ok(img.getAttribute("alt") === "Ada Lovelace", "img alt is the name");
  ok(el.getAttribute("role") === "img", "host role=img for a person avatar");
  ok(el.getAttribute("aria-label") === "Ada Lovelace", "host aria-label is the name");
}

// ---- no src → initials from the name ----
{
  const el = mount("puredashboard-avatar");
  el.name = "Ada Lovelace";
  await tick();
  ok(!el.querySelector(".puredashboard-avatar__img"), "no <img> without a src");
  const ini = el.querySelector(".puredashboard-avatar__initials");
  ok(ini && ini.textContent === "AL", "two-word name yields two-letter initials");
}

// ---- single-word name → one letter ----
{
  const el = mount("puredashboard-avatar");
  el.name = "cher";
  await tick();
  const ini = el.querySelector(".puredashboard-avatar__initials");
  ok(ini && ini.textContent === "C", "single-word name yields one uppercased letter");
}

// ---- empty (no src, no name) → placeholder glyph ----
{
  const el = mount("puredashboard-avatar");
  await tick();
  ok(el.querySelector(".puredashboard-avatar__placeholder"), "neutral placeholder when neither src nor name");
  ok(el.querySelector(".puredashboard-avatar__placeholder svg"), "placeholder contains an inline svg glyph");
  ok(el.getAttribute("aria-label") === "No image", "placeholder host aria-label falls back to the label");
}

// ---- pure functions: initials + deterministic colour ----
{
  ok(initials("Ada Lovelace") === "AL", "initials('Ada Lovelace') === 'AL'");
  ok(initials("cher") === "C", "initials('cher') === 'C'");
  ok(initials("  ") === "", "initials of blank is empty");
  ok(initials("grace   brewster   hopper") === "GH", "initials use first + last word");
  const a = colorIndex("Ada Lovelace"), b = colorIndex("Ada Lovelace");
  ok(a === b, "colorIndex is deterministic for the same name");
  ok(a >= 0 && a < 6, "colorIndex is within the fixed palette range");
}

// ---- deterministic colour applied to the rendered initials ----
{
  const el1 = mount("puredashboard-avatar"); el1.name = "Ada Lovelace";
  const el2 = mount("puredashboard-avatar"); el2.name = "Ada Lovelace";
  await tick();
  const s1 = el1.querySelector(".puredashboard-avatar__initials").getAttribute("style");
  const s2 = el2.querySelector(".puredashboard-avatar__initials").getAttribute("style");
  ok(s1 === s2 && /--pd-avatar-c\d/.test(s1), "identical names get an identical palette background");
}

// ---- explicit color overrides the derived one ----
{
  const el = mount("puredashboard-avatar");
  el.name = "Ada"; el.color = "hotpink";
  await tick();
  const ini = el.querySelector(".puredashboard-avatar__initials");
  ok(/hotpink/.test(ini.getAttribute("style")), "explicit color prop wins over the derived hue");
}

// ---- size + shape modifiers ----
{
  const el = mount("puredashboard-avatar");
  el.name = "Ada"; el.size = "lg"; el.shape = "square";
  await tick();
  const box = el.querySelector(".puredashboard-avatar__box");
  ok(box.classList.contains("puredashboard-avatar--lg"), "size=lg adds the modifier class");
  ok(box.classList.contains("puredashboard-avatar--square"), "shape=square adds the modifier class");
}

// ---- numeric size sets the size custom property inline ----
{
  const el = mount("puredashboard-avatar");
  el.name = "Ada"; el.size = "48";
  await tick();
  const box = el.querySelector(".puredashboard-avatar__box");
  ok(/--pd-avatar-size:48px/.test(box.getAttribute("style")), "numeric size sets --pd-avatar-size");
  ok(!box.classList.contains("puredashboard-avatar--lg"), "numeric size adds no named-size class");
}

// ---- onerror fallback: broken image flips to initials ----
{
  const el = mount("puredashboard-avatar");
  el.src = "/does-not-exist.png"; el.name = "Ada Lovelace";
  await tick();
  const img = el.querySelector(".puredashboard-avatar__img");
  ok(img, "img present before the load fails");
  img.dispatchEvent(new w.Event("error"));
  await tick();
  ok(!el.querySelector(".puredashboard-avatar__img"), "broken img is removed after onerror");
  const ini = el.querySelector(".puredashboard-avatar__initials");
  ok(ini && ini.textContent === "AL", "onerror falls back to the initials");
}

// ---- a new working src retries the image after a prior error ----
{
  const el = mount("puredashboard-avatar");
  el.src = "/bad.png"; el.name = "Ada Lovelace";
  await tick();
  el.querySelector(".puredashboard-avatar__img").dispatchEvent(new w.Event("error"));
  await tick();
  ok(!el.querySelector(".puredashboard-avatar__img"), "fell back to initials on error");
  el.src = "/good.png";
  await tick();
  ok(el.querySelector(".puredashboard-avatar__img"), "a new src retries the image");
}

// ---- decorative → aria-hidden, no role ----
{
  const el = mount("puredashboard-avatar");
  el.name = "Ada"; el.decorative = true;
  await tick();
  ok(el.getAttribute("aria-hidden") === "true", "decorative avatar is aria-hidden");
  ok(!el.hasAttribute("role"), "decorative avatar has no role");
}

// ---- declarative HTML attributes reflect into properties ----
{
  document.body.innerHTML = `<puredashboard-avatar name="Ada Lovelace" size="lg" shape="square"></puredashboard-avatar>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.name === "Ada Lovelace", "name attribute reflected to property");
  ok(el.size === "lg", "size attribute reflected");
  ok(el.shape === "square", "shape attribute reflected");
  ok(el.querySelector(".puredashboard-avatar__initials").textContent === "AL", "attributes drive the render");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-avatar");
  el.labels = { placeholder: "Người dùng" };
  await tick();
  ok(el._label("placeholder") === "Người dùng", "labels override the default string");
  ok(el.getAttribute("aria-label") === "Người dùng", "overridden label reaches the host aria-label");
  const el2 = mount("puredashboard-avatar");
  await tick();
  ok(el2._label("placeholder") === "No image", "default label kept when not overridden");
}

console.log(`avatar.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
