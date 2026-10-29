// Tests for ../src/active-link.js (routechange, currentRoute, markActive, matching) and the
// `follow-route` attribute of <puredashboard-nav> / <puredashboard-tabs>, driven by a real Router.
// Run in isolation via Docker (no host install): `make -C test`.
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/", runScripts: "outside-only" });
const w = dom.window;
for (const k of ["window", "document", "HTMLElement", "customElements", "NodeFilter", "CustomEvent", "Node", "Event", "MouseEvent", "KeyboardEvent", "location", "history", "URL", "URLSearchParams"])
  global[k] = w[k];
global.queueMicrotask = queueMicrotask;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const tick = () => new Promise((r) => setTimeout(r));

const { publishRoute, currentRoute, bestLink, linkPath, markActive } = await import("../src/active-link.js");
await import("../src/nav.js");
await import("../src/tabs.js");
const { Router } = await import("../src/router.js");

// ---- nothing published yet: everything is inert ----
{
  ok(currentRoute() === null, "no route before any navigation");
  ok(bestLink(["#/"]) === -1, "bestLink: -1 before any navigation");
  const box = document.createElement("div");
  box.innerHTML = '<a href="#/">Home</a>';
  ok(markActive(box) === null && !box.querySelector("[aria-current]"), "markActive: no-op before any navigation");
  const nav = document.createElement("puredashboard-nav");
  nav.setAttribute("follow-route", "");
  nav.items = [{ label: "Home", href: "#/" }];
  nav.current = "#/";
  document.body.appendChild(nav);
  await tick();
  ok(nav.current === "#/", "follow-route without a router leaves current alone");
  nav.remove();
}

// ---- matching rules (hash mode) ----
{
  const s = { path: "/scans/new/3", mode: "hash", base: "" };
  const hrefs = ["#/", "#/scans", "#/scans/new", "#/scansx", "#/scans?tab=a"];
  ok(bestLink(hrefs, {}, s) === 2, "longest segment prefix wins (#/scans/new on /scans/new/3)");
  ok(bestLink(["#/", "#/scansx"], {}, s) === -1, "root matches only itself; #/scansx is not a segment prefix");
  ok(bestLink(["#/scans", "#/scans/new"], { exact: true }, s) === -1, "exact: prefixes do not match");
  ok(bestLink(["#/scans?tab=a"], {}, { path: "/scans", mode: "hash" }) === 0, "query on the link is ignored");
  ok(bestLink(["#/", "#/scans"], {}, { path: "/", mode: "hash" }) === 0, "root matches /");
  ok(bestLink(["#/scans/", "#/x"], {}, { path: "/scans/5", mode: "hash" }) === 0, "a trailing-slash link is a prefix too");
  ok(linkPath("/scans", s) === null && linkPath("https://x/#/a", s) === null, "hash mode: non-# hrefs are not in-app");
  ok(linkPath("#scans", s) === "/scans", "hash mode: #scans normalises to /scans");
}

// ---- matching rules (history mode, base) ----
{
  const s = { path: "/nodes/web", mode: "history", base: "/admin" };
  ok(linkPath("/admin/nodes", s) === "/nodes", "history: base stripped");
  ok(linkPath("/admin", s) === "/", "history: the base itself is /");
  ok(linkPath("/adminx/nodes", s) === null && linkPath("/other", s) === null, "history: outside the base is not in-app");
  ok(linkPath("#/nodes", s) === null && linkPath("//cdn/x", s) === null, "history: # and protocol-relative hrefs are not in-app");
  ok(bestLink(["/admin", "/admin/nodes", "/admin/nodes/db"], {}, s) === 1, "history: /admin/nodes active on /nodes/web");
}

// ---- a real Router publishes routechange + currentRoute after the commit, and never touches links ----
document.body.innerHTML =
  '<header><nav class="tabs"><a href="#/">Home</a><a href="#/scans">Scans</a></nav>' +
  '<a id="status" href="#/session">Session</a></header><div id="view"></div>';
const page = (name) => () => Promise.resolve({ default: (el) => { el.textContent = name; } });
const events = [];
document.addEventListener("routechange", (e) => events.push(e.detail.path));
const router = new Router({
  outlet: "#view", mode: "hash", transition: false,
  beforeEach: (ctx) => ctx.path !== "/forbidden",
  routes: {
    "/": { title: "Home", load: page("home") },
    "/scans": { title: "Scans", load: page("scans") },
    "/scans/new": { title: "New scan", load: page("new") },
    "/scans/:id": { title: "Scan", load: page("scan") },
    "/session": { title: "Session", load: page("session") },
    "/forbidden": { title: "No", load: page("no") },
  },
});
w.location.hash = "#/scans/5";
await router.start();
{
  ok(events.at(-1) === "/scans/5", "routechange fired with the path: " + JSON.stringify(events));
  const r = currentRoute();
  ok(r && r.path === "/scans/5" && r.params.id === "5" && r.mode === "hash", "currentRoute(): path, params, mode");
  ok(!document.querySelector("[aria-current]"), "the router sets no aria-current anywhere");
  const tabs = document.querySelector("nav.tabs");
  const a = markActive(tabs);
  ok(a && a.textContent === "Scans" && a.getAttribute("aria-current") === "page", "markActive: Scans tab current on /scans/5 (prefix)");
  w.location.hash = "#/session";
  await router.render();
  markActive(tabs);
  ok(!tabs.querySelector("[aria-current]"), "markActive: no tab current on /session");
  ok(!document.getElementById("status").hasAttribute("aria-current"), "a content link outside the container is never touched");
  const n = events.length;
  w.location.hash = "#/forbidden";
  await router.render();
  ok(events.length === n && currentRoute().path === "/session", "a navigation cancelled by a guard publishes nothing");
}

// ---- <puredashboard-nav follow-route>: connect after a navigation, follow, items change, re-attach ----
{
  w.location.hash = "#/scans/new";
  await router.render();
  const nav = document.createElement("puredashboard-nav");
  nav.setAttribute("follow-route", "");
  nav.items = [
    { label: "Home", href: "#/" },
    { label: "Scans", children: [{ label: "All", href: "#/scans" }, { label: "New", href: "#/scans/new" }] },
  ];
  document.body.appendChild(nav);
  await tick();
  ok(nav.current === "#/scans/new", "nav: catches up on connect, longest match in a group: " + nav.current);
  const cur = () => nav.querySelector('a[aria-current="page"]');
  ok(cur() && cur().textContent === "New", "nav: the New leaf carries aria-current");
  ok(nav.querySelector('[aria-expanded="true"]'), "nav: the group holding the current leaf is open");

  w.location.hash = "#/scans/42";
  await router.render();
  await tick();
  ok(nav.current === "#/scans" && cur() && cur().textContent === "All", "nav: routechange moves current to the prefix match (All on /scans/42)");

  nav.items = [{ label: "Home", href: "#/" }, { label: "Scans", href: "#/scans" }];
  await tick();
  ok(nav.current === "#/scans", "nav: recomputed when items change");

  nav.remove();
  w.location.hash = "#/";
  await router.render();
  ok(nav.current === "#/scans", "nav: detached nav does not follow (listener removed)");
  document.body.appendChild(nav);
  await tick();
  ok(nav.current === "#/", "nav: re-attach catches up from currentRoute()");
  w.location.hash = "#/scans/7";
  await router.render();
  await tick();
  ok(nav.current === "#/scans" && cur() && cur().textContent === "Scans", "nav: after re-attach, routechange still drives it");

  nav.setAttribute("follow-route", "exact");
  await tick();
  ok(nav.current === "", "nav: follow-route=exact — no item on /scans/7");
  nav.remove();
}

// ---- <puredashboard-tabs follow-route> (link mode) ----
{
  w.location.hash = "#/scans/new";
  await router.render();
  const t = document.createElement("puredashboard-tabs");
  t.setAttribute("follow-route", "");
  t.tabs = [{ id: "all", label: "All", href: "#/scans" }, { id: "new", label: "New", href: "#/scans/new" }];
  document.body.appendChild(t);
  await tick();
  const cur = () => t.querySelector('a[aria-current="page"]');
  ok(t.value === "new" && cur() && cur().textContent === "New", "tabs: longest match on connect");
  t.remove();
  document.body.appendChild(t);
  w.location.hash = "#/scans/9";
  await router.render();
  await tick();
  ok(t.value === "all" && cur() && cur().textContent === "All", "tabs: after re-attach, follows routechange");
  w.location.hash = "#/session";
  await router.render();
  await tick();
  ok(t.value === "" && !cur(), "tabs: no tab current on an unrelated route");
  t.remove();
}

router.stop();
console.log(`active-link.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
