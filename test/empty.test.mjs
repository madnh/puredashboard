// Tests for empty.js (<puredashboard-empty>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, wrapping and reflection.
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

const { PuredashboardEmpty } = await import("../src/empty.js");
void PuredashboardEmpty;

// ---- default description ----
{
  const el = mount("puredashboard-empty");
  await tick();
  const desc = el.querySelector(".puredashboard-empty__desc");
  ok(desc, "renders a description node");
  ok(desc.textContent === "No data", "default description shows LABELS.description");
}

// ---- custom description (content property wins, reflects on change) ----
{
  const el = mount("puredashboard-empty");
  el.description = "No projects yet";
  await tick();
  const desc = el.querySelector(".puredashboard-empty__desc");
  ok(desc.textContent === "No projects yet", "custom description content is shown");
  el.description = "Nothing here";
  await tick();
  ok(desc.textContent === "Nothing here", "description reflects on update to the same node");
}

// ---- declarative description attribute ----
{
  document.body.innerHTML = `<puredashboard-empty description="Empty inbox"></puredashboard-empty>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.querySelector(".puredashboard-empty__desc").textContent === "Empty inbox", "description attribute reflected to the desc node");
  document.body.innerHTML = "";
}

// ---- author action children preserved & moved into __actions ----
{
  const el = document.createElement("puredashboard-empty");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Create";
  let clicks = 0;
  btn.addEventListener("click", () => { clicks++; });
  el.appendChild(btn);
  document.body.appendChild(el);
  await tick();
  const actions = el.querySelector(".puredashboard-empty__actions");
  ok(actions, "renders an actions region");
  ok(actions.firstElementChild === btn, "the SAME author button node is moved into __actions");
  ok(actions.firstElementChild.textContent === "Create", "author button label preserved");
  btn.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  ok(clicks === 1, "listener on the moved button still fires (node not cloned)");
}

// ---- default illustration present and aria-hidden ----
{
  const el = mount("puredashboard-empty");
  await tick();
  const icon = el.querySelector(".puredashboard-empty__icon");
  ok(icon, "renders an icon container");
  ok(icon.getAttribute("aria-hidden") === "true", "icon is aria-hidden (decorative)");
  ok(icon.querySelector("svg"), "default illustration is an inline SVG glyph");
}

// ---- custom icon markup string overrides the default ----
{
  const el = document.createElement("puredashboard-empty");
  el.icon = '<svg data-custom="1"></svg>';
  document.body.appendChild(el);
  await tick();
  const icon = el.querySelector(".puredashboard-empty__icon");
  ok(icon.querySelector('svg[data-custom="1"]'), "custom icon markup string is used");
}

// ---- idempotent connect (no re-wrap / duplication) ----
{
  const el = mount("puredashboard-empty");
  await tick();
  el.remove();
  document.body.appendChild(el);   // reconnect → connectedCallback runs again
  await tick();
  ok(el.querySelectorAll(".puredashboard-empty__icon").length === 1, "reconnect does not duplicate the icon");
  ok(el.querySelectorAll(".puredashboard-empty__desc").length === 1, "reconnect does not duplicate the description");
  ok(el.querySelectorAll(".puredashboard-empty__actions").length === 1, "reconnect does not duplicate the actions region");
}

// ---- compact modifier ----
{
  const el = mount("puredashboard-empty");
  el.compact = true;
  await tick();
  ok(el.hasAttribute("compact"), "compact=true sets the attribute (style hook)");
  el.compact = false;
  await tick();
  ok(!el.hasAttribute("compact"), "compact=false removes the attribute");
  document.body.innerHTML = `<puredashboard-empty compact></puredashboard-empty>`;
  await tick();
  ok(document.body.firstElementChild.compact === true, "compact attribute reflected to the property");
}

// ---- localisable labels (fallback description; set before connect) ----
{
  const el = document.createElement("puredashboard-empty");
  el.labels = { description: "Không có dữ liệu" };
  document.body.appendChild(el);
  await tick();
  ok(el.querySelector(".puredashboard-empty__desc").textContent === "Không có dữ liệu", "labels override the default description fallback");
}

console.log(`empty.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
