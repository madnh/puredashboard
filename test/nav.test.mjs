// Tests for nav.js (<puredashboard-nav>).
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

const { PuredashboardNav } = await import("../src/nav.js");
void PuredashboardNav;

// ---- nav landmark + aria-label ----
{
  const el = mount("puredashboard-nav");
  el.items = [{ label: "Home", href: "#/" }];
  await tick();
  const nav = el.querySelector("nav");
  ok(nav, "renders a <nav> landmark");
  ok(nav.getAttribute("aria-label") === "Main", "nav has default aria-label Main");
}

// ---- leaf items render real <a href> with the label ----
{
  const el = mount("puredashboard-nav");
  el.items = [{ label: "Dashboard", href: "#/dash" }];
  await tick();
  const a = el.querySelector("a.puredashboard-nav__link");
  ok(a, "leaf renders an <a> link");
  ok(a.getAttribute("href") === "#/dash", "leaf link has the href");
  ok(a.querySelector(".puredashboard-nav__label").textContent === "Dashboard", "leaf shows its label");
}

// ---- active item (href === current) gets aria-current=page + modifier ----
{
  const el = mount("puredashboard-nav");
  el.items = [{ label: "A", href: "#/a" }, { label: "B", href: "#/b" }];
  el.current = "#/b";
  await tick();
  const links = el.querySelectorAll("a.puredashboard-nav__link");
  const active = [...links].find((l) => l.getAttribute("href") === "#/b");
  const inactive = [...links].find((l) => l.getAttribute("href") === "#/a");
  ok(active.getAttribute("aria-current") === "page", "active leaf has aria-current=page");
  ok(active.classList.contains("puredashboard-nav__link--active"), "active leaf has the active modifier");
  ok(inactive.getAttribute("aria-current") !== "page", "inactive leaf is not aria-current=page");
}

// ---- group renders a <button aria-expanded> that toggles the nested list ----
{
  const el = mount("puredashboard-nav");
  el.items = [{ label: "Nodes", children: [{ label: "Web", href: "#/nodes/web" }] }];
  await tick();
  const btn = el.querySelector("button.js-puredashboard-nav__group");
  ok(btn, "group renders a <button>");
  ok(btn.querySelector(".puredashboard-nav__label").textContent === "Nodes", "group button shows its label");
  const sub = el.querySelector(".puredashboard-nav__list--sub");
  ok(sub, "group renders a nested sub-list");
  ok(btn.getAttribute("aria-controls") === sub.getAttribute("id"), "button aria-controls points at the sub-list id");
  // collapsed by default (no current inside) → aria-expanded false + list hidden
  ok(btn.getAttribute("aria-expanded") === "false", "group starts collapsed (aria-expanded false)");
  ok(sub.hasAttribute("hidden"), "collapsed sub-list is hidden");
  // click toggles it open
  btn.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  const btn2 = el.querySelector("button.js-puredashboard-nav__group");
  const sub2 = el.querySelector(".puredashboard-nav__list--sub");
  ok(btn2.getAttribute("aria-expanded") === "true", "click expands the group (aria-expanded true)");
  ok(!sub2.hasAttribute("hidden"), "expanded sub-list is visible");
}

// ---- a group containing the current item starts expanded ----
{
  const el = mount("puredashboard-nav");
  el.items = [{ label: "Nodes", children: [{ label: "Web", href: "#/nodes/web" }] }];
  el.current = "#/nodes/web";
  await tick();
  const btn = el.querySelector("button.js-puredashboard-nav__group");
  const sub = el.querySelector(".puredashboard-nav__list--sub");
  ok(btn.getAttribute("aria-expanded") === "true", "group with current item starts expanded");
  ok(!sub.hasAttribute("hidden"), "sub-list holding the current item is visible");
  const active = sub.querySelector('a[aria-current="page"]');
  ok(active && active.getAttribute("href") === "#/nodes/web", "nested current item is aria-current=page");
}

// ---- toggle event carries {label, expanded} ----
{
  const el = mount("puredashboard-nav");
  el.items = [{ label: "Settings", children: [{ label: "Team", href: "#/team" }] }];
  await tick();
  let detail = null;
  el.addEventListener("toggle", (e) => { detail = e.detail; });
  el.querySelector("button.js-puredashboard-nav__group").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(detail && detail.label === "Settings", "toggle event carries the group label");
  ok(detail && detail.expanded === true, "toggle event reports expanded state");
}

// ---- author icon markup is rendered (trusted) ----
{
  const el = mount("puredashboard-nav");
  el.items = [{ label: "Home", href: "#/", icon: '<svg data-tag="home"></svg>' }];
  await tick();
  const icon = el.querySelector(".puredashboard-nav__icon svg");
  ok(icon, "author-provided SVG icon markup is rendered");
  ok(icon.getAttribute("data-tag") === "home", "icon markup is inserted as trusted content");
}

// ---- badge shown only when present ----
{
  const el = mount("puredashboard-nav");
  el.items = [{ label: "Inbox", href: "#/inbox", badge: "7" }, { label: "Sent", href: "#/sent" }];
  await tick();
  const links = el.querySelectorAll("a.puredashboard-nav__link");
  const withBadge = [...links].find((l) => l.getAttribute("href") === "#/inbox");
  const without = [...links].find((l) => l.getAttribute("href") === "#/sent");
  const b = withBadge.querySelector(".puredashboard-nav__badge");
  ok(b && b.textContent === "7", "badge is shown with its value when present");
  ok(!without.querySelector(".puredashboard-nav__badge"), "no badge node when the node has none");
}

// ---- labels override ----
{
  const el = mount("puredashboard-nav");
  el.labels = { ariaLabel: "Điều hướng", expand: (g) => `Mở ${g}` };
  el.items = [{ label: "Nhóm", children: [{ label: "Con", href: "#/c" }] }];
  await tick();
  ok(el.querySelector("nav").getAttribute("aria-label") === "Điều hướng", "ariaLabel override applied");
  const btn = el.querySelector("button.js-puredashboard-nav__group");
  ok(btn.getAttribute("aria-label") === "Mở Nhóm", "expand(group) label override applied (collapsed group)");
  ok(el._label("collapse", "X") === "Collapse X", "unset label keeps the English default");
}

console.log(`nav.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
