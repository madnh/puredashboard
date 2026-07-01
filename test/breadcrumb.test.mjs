// Tests for breadcrumb.js (<puredashboard-breadcrumb>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, links and logic.
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

const { PuredashboardBreadcrumb } = await import("../src/breadcrumb.js");
void PuredashboardBreadcrumb;

// ---- nav landmark + list structure ----
{
  const el = mount("puredashboard-breadcrumb");
  el.items = [{ label: "Home", href: "#/" }, { label: "Nodes", href: "#/nodes" }, { label: "web-01" }];
  await tick();
  const nav = el.querySelector("nav.puredashboard-breadcrumb");
  ok(nav, "renders a <nav> landmark");
  ok(nav.getAttribute("aria-label") === "Breadcrumb", "nav has default aria-label 'Breadcrumb'");
  const list = el.querySelector("ol.puredashboard-breadcrumb__list");
  ok(list, "renders an <ol> list");
  const lis = el.querySelectorAll("li.puredashboard-breadcrumb__item");
  ok(lis.length === 3, "one <li> per item");
}

// ---- links on non-last crumbs, current on the last ----
{
  const el = mount("puredashboard-breadcrumb");
  el.items = [{ label: "Home", href: "#/" }, { label: "Nodes", href: "#/nodes" }, { label: "web-01", href: "#/nodes/web-01" }];
  await tick();
  const links = el.querySelectorAll("a.puredashboard-breadcrumb__link");
  ok(links.length === 2, "non-last crumbs with href become real <a> links");
  ok(links[0].getAttribute("href") === "#/" && links[1].getAttribute("href") === "#/nodes", "hrefs reflected onto the links");
  const lis = el.querySelectorAll("li.puredashboard-breadcrumb__item");
  const lastLi = lis[lis.length - 1];
  ok(!lastLi.querySelector("a"), "last crumb is NOT a link even when it has an href");
  const current = el.querySelector(".puredashboard-breadcrumb__current");
  ok(current && current.getAttribute("aria-current") === "page", "last crumb marked aria-current=page");
  ok(current.textContent === "web-01", "current crumb shows its label text");
}

// ---- non-last crumb WITHOUT href → plain text, not a link ----
{
  const el = mount("puredashboard-breadcrumb");
  el.items = [{ label: "Home" }, { label: "Current" }];
  await tick();
  ok(!el.querySelector("a"), "crumb without href renders no link");
  const text = el.querySelector(".puredashboard-breadcrumb__text");
  ok(text && text.textContent === "Home", "hrefless non-last crumb is plain text");
}

// ---- maxItems collapses the middle into an ellipsis ----
{
  const el = mount("puredashboard-breadcrumb");
  el.items = [
    { label: "A", href: "#a" }, { label: "B", href: "#b" }, { label: "C", href: "#c" },
    { label: "D", href: "#d" }, { label: "E" },
  ];
  el.maxItems = 3;
  await tick();
  const ell = el.querySelector(".puredashboard-breadcrumb__item--ellipsis");
  ok(ell && ell.getAttribute("aria-hidden") === "true", "collapsed middle is a decorative aria-hidden ellipsis");
  const links = [...el.querySelectorAll("a.puredashboard-breadcrumb__link")].map((a) => a.textContent);
  ok(links.join(",") === "A,D", "keeps the first crumb and the linked last-two parent (A + D)");
  const current = el.querySelector(".puredashboard-breadcrumb__current");
  ok(current && current.textContent === "E", "current page stays visible after collapse");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-breadcrumb");
  el.items = [{ label: "Home", href: "#/" }, { label: "Now" }];
  el.labels = { ariaLabel: "Đường dẫn" };
  await tick();
  const nav = el.querySelector("nav.puredashboard-breadcrumb");
  ok(nav.getAttribute("aria-label") === "Đường dẫn", "labels override the nav aria-label");
  const el2 = mount("puredashboard-breadcrumb");
  el2.items = [{ label: "X" }];
  await tick();
  ok(el2._label("ariaLabel") === "Breadcrumb", "default label kept when not overridden");
}

console.log(`breadcrumb.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
