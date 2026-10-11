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

// ---- subtle attribute: author-owned, survives renders; CSS styles the active row through it ----
{
  const el = mount("puredashboard-nav");
  el.setAttribute("subtle", "");
  el.items = [{ label: "A", href: "#/a" }, { label: "B", href: "#/b" }];
  el.current = "#/a";
  await tick();
  el.current = "#/b";
  await tick();
  ok(el.hasAttribute("subtle"), "subtle stays on the host across renders");
  ok(el.querySelector(".puredashboard-nav__link--active")?.getAttribute("href") === "#/b", "subtle does not change which row is active");
  const { readFileSync } = await import("node:fs");
  const css = readFileSync(new URL("../src/nav.css", import.meta.url), "utf8");
  ok(/puredashboard-nav\[subtle\] \.puredashboard-nav__link--active,[^{]*\{[^}]*background:\s*var\(--pd-panel-3\)[^}]*box-shadow:\s*inset 3px 0 0 var\(--pd-accent\)/.test(css), "subtle active row: panel fill + inset accent bar (CSS contract)");
  ok(/puredashboard-nav\[subtle\] \.puredashboard-nav__link--active:focus-visible[^{]*\{[^}]*var\(--pd-focus-ring\)/.test(css), "subtle active row keeps the focus ring");
  ok(/--pd-nav-icon-size:\s*16px/.test(css), "--pd-nav-icon-size defaults to 16px");
  ok(/\.puredashboard-nav__icon svg\s*\{[^}]*width:\s*var\(--pd-nav-icon-size\)[^}]*height:\s*var\(--pd-nav-icon-size\)/.test(css), "item icon SVG is sized by --pd-nav-icon-size");
}


// ---- sections: heading + flat list; collapsible heading toggles ----
{
  const el = mount("puredashboard-nav");
  el.items = [
    { heading: "Platform", children: [{ label: "Home", href: "#/" }, { label: "Nodes", children: [{ label: "Web", href: "#/w" }] }] },
    { heading: "Projects", collapsible: true, children: [{ label: "Acme", href: "#/acme" }] },
  ];
  await tick();
  const sections = el.querySelectorAll(".puredashboard-nav__section");
  ok(sections.length === 2, "each heading node renders a section");
  const h1 = sections[0].querySelector(".puredashboard-nav__heading");
  ok(h1 && h1.tagName === "DIV" && h1.textContent === "Platform", "a plain section heading is a <div> with the heading text");
  const list1 = sections[0].querySelector(".puredashboard-nav__list--section");
  ok(list1 && list1.getAttribute("aria-labelledby") === h1.id && h1.id, "section list is labelled by its heading");
  ok(!list1.hasAttribute("hidden"), "a section starts open");
  ok(!list1.classList.contains("puredashboard-nav__list--sub"), "a section list is flat (not a nested sub-list)");
  ok(list1.querySelector(".puredashboard-nav__list--sub"), "groups still nest inside a section");
  const h2 = sections[1].querySelector(".puredashboard-nav__heading");
  ok(h2.tagName === "BUTTON" && h2.getAttribute("aria-expanded") === "true", "a collapsible heading is a <button aria-expanded=true>");
  let detail = null;
  el.addEventListener("toggle", (e) => { detail = e.detail; });
  h2.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  const h2b = el.querySelectorAll(".puredashboard-nav__section")[1].querySelector(".puredashboard-nav__heading");
  const list2 = el.querySelectorAll(".puredashboard-nav__section")[1].querySelector(".puredashboard-nav__list--section");
  ok(h2b.getAttribute("aria-expanded") === "false" && list2.hasAttribute("hidden"), "clicking a collapsible heading closes its section");
  ok(detail && detail.label === "Projects" && detail.expanded === false, "toggle event carries the section heading + expanded=false");
}

// ---- row action: a sibling <button> that emits `action` with the node ----
{
  const el = mount("puredashboard-nav");
  const node = { label: "Acme", href: "#/acme", action: { icon: '<svg data-tag="more"></svg>', label: "More" } };
  el.items = [node, { label: "Plain", href: "#/p" }];
  await tick();
  const items = el.querySelectorAll(".puredashboard-nav__item");
  const btn = items[0].querySelector("button.js-puredashboard-nav__action");
  ok(btn, "a node with `action` renders an action button");
  ok(btn.parentElement === items[0] && btn.previousElementSibling.tagName === "A", "the action sits beside the link, not inside it");
  ok(btn.getAttribute("aria-label") === "More" && btn.querySelector('svg[data-tag="more"]'), "action button carries the label + icon");
  ok(items[0].classList.contains("puredashboard-nav__item--has-action"), "the row is flagged so its text clears the button");
  ok(!items[1].querySelector(".puredashboard-nav__action"), "no action button without `action`");
  let detail = null;
  el.addEventListener("action", (e) => { detail = e.detail; });
  btn.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  ok(detail && detail.item === node && detail.href === "#/acme" && detail.label === "Acme", "action event carries the node");
}

// ---- icon-only: titles on string labels; CSS contract for the rail look ----
{
  const el = mount("puredashboard-nav");
  el.items = [{ label: "Home", href: "#/" }, { label: "Nodes", children: [{ label: "Web", href: "#/w" }] }];
  await tick();
  ok(!el.querySelector("a").hasAttribute("title"), "no title while expanded");
  el.setAttribute("icon-only", "");
  await tick();
  ok(el.querySelector("a").getAttribute("title") === "Home", "icon-only: a leaf link's title is its label");
  ok(el.querySelector("button.js-puredashboard-nav__group").getAttribute("title") === "Nodes", "icon-only: a group button's title is its label");
  ok(el.querySelector(".puredashboard-nav__label").textContent === "Home", "icon-only: the label text stays in the DOM (accessible name)");
  el.removeAttribute("icon-only");
  await tick();
  ok(!el.querySelector("a").hasAttribute("title"), "removing icon-only drops the titles again");
  const { readFileSync } = await import("node:fs");
  const css = readFileSync(new URL("../src/nav.css", import.meta.url), "utf8");
  ok(/puredashboard-nav\[icon-only\] \.puredashboard-nav__label\s*\{[^}]*position:\s*absolute[^}]*clip-path:\s*inset\(50%\)/.test(css), "icon-only: labels are clipped (visually hidden, still named)");
  ok(!/puredashboard-nav\[icon-only\] \.puredashboard-nav__label\s*\{[^}]*display:\s*none/.test(css), "icon-only: labels are not display:none");
  ok(/puredashboard-nav\[icon-only\] \.puredashboard-nav__badge,[\s\S]*?\.puredashboard-nav__toggle,[\s\S]*?\.puredashboard-nav__action,[\s\S]*?\.puredashboard-nav__list--sub,[\s\S]*?\{\s*display:\s*none/.test(css), "icon-only: badges, chevrons, actions and sub-lists are hidden");
  ok(/puredashboard-nav\[icon-only\] \.puredashboard-nav__link\s*\{[^}]*justify-content:\s*center/.test(css), "icon-only: the icon is centred in the row");
  ok(!/\.puredashboard-nav__list--sub \.puredashboard-nav__link\s*\{[^}]*border-radius:\s*0/.test(css), "nested rows have no rule of their own for the row shape");
  ok(/--pd-radius:\s*var\(--pd-nav-radius,\s*0\)/.test(css), "rows are square by default (--pd-nav-radius opts into rounding)");
  ok(/--pd-text:\s*var\(--pd-nav-text,\s*var\(--text/.test(css), "row text colour goes through the --pd-nav-text knob (sider palette hook)");
}

// ---- loading: skeleton rows + aria-busy ----
{
  const el = mount("puredashboard-nav");
  el.items = [{ label: "Home", href: "#/" }];
  el.loading = true;
  await tick();
  ok(el.querySelector("nav").getAttribute("aria-busy") === "true", "loading marks the nav aria-busy");
  ok(el.querySelectorAll(".puredashboard-nav__item--skeleton").length === 5, "loading=true renders 5 skeleton rows");
  ok(!el.querySelector("a"), "no real links while loading");
  el.loading = 3;
  await tick();
  ok(el.querySelectorAll(".puredashboard-nav__item--skeleton").length === 3, "loading=3 renders 3 skeleton rows");
  el.loading = false;
  await tick();
  ok(!el.querySelector("nav").hasAttribute("aria-busy") && el.querySelector("a"), "loading=false renders the items again, not busy");
}

console.log(`nav.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
