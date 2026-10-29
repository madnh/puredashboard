// Tests for ../src/router.js — hash mode + history mode. Real jsdom location /
// history / hashchange / click events, so the matcher, lazy-load cache, catch-all,
// title, routechange + markActive and history-mode click interception are exercised for real.
import { JSDOM } from "jsdom";

let pass = 0,
  fail = 0;
const ok = (c, m) => {
  if (c) pass++;
  else {
    fail++;
    console.log("FAIL:", m);
  }
};
const tick = () => new Promise((r) => setTimeout(r));
// poll until pred() is true or timeout — robust against jsdom's deferred history
// traversal (back/forward apply after a few tasks, not synchronously).
async function until(pred, ms = 500) {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > ms) break;
    await tick();
  }
  return pred();
}

function install(url) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url });
  const w = dom.window;
  for (const k of [
    "window",
    "document",
    "HTMLElement",
    "customElements",
    "location",
    "history",
    "MouseEvent",
    "Event",
    "CustomEvent",
    "URL",
    "URLSearchParams",
    "Node",
  ])
    global[k] = w[k];
  return w;
}

// A loader factory that records how many times each route was imported (lazy cache).
function loaders() {
  const calls = {};
  const make = (label) => {
    calls[label] = 0;
    const fn = () => {
      calls[label]++;
      return Promise.resolve({
        default: (outlet, ctx) => {
          const ps = Object.values(ctx.params);
          outlet.textContent = label + (ps.length ? ":" + ps.join(",") : "");
        },
      });
    };
    return fn;
  };
  return { calls, make };
}

const { Router, markActive } = await import("../src/router.js");

// ============================ hash mode =====================================
{
  const w = install("http://localhost/");
  document.body.innerHTML =
    '<nav><a id="l-home" href="#/">Home</a><a id="l-nodes" href="#/nodes">Nodes</a></nav><div id="view"></div>';
  const view = document.getElementById("view");
  const { calls, make } = loaders();
  const router = new Router({
    outlet: "#view",
    appName: "Plexus",
    mode: "hash",
    routes: {
      "/": { title: "Overview", load: make("home") },
      "/nodes": { title: "Nodes", load: make("nodes") },
      "/nodes/:name": { title: (p) => `Node ${p.name}`, load: make("node") },
      "*": { title: "Not found", load: make("404") },
    },
  });

  const seen = [];
  document.addEventListener("routechange", (e) => seen.push(e.detail));
  w.location.hash = "#/";
  await router.start();
  ok(view.textContent === "home", "hash: home rendered: " + view.textContent);
  ok(
    document.title === "Overview · Plexus",
    "hash: title set: " + document.title,
  );
  ok(
    document.getElementById("l-home").getAttribute("aria-current") === null,
    "hash: the router itself leaves links alone (no aria-current)",
  );
  ok(
    seen.length === 1 && seen[0].path === "/" && seen[0].mode === "hash",
    "hash: routechange on document after the navigation: " + JSON.stringify(seen.map((d) => d.path)),
  );

  w.location.hash = "#/nodes/web";
  await router.render();
  ok(
    view.textContent === "node:web",
    "hash: param route rendered: " + view.textContent,
  );
  ok(
    document.title === "Node web · Plexus",
    "hash: fn title with param: " + document.title,
  );

  w.location.hash = "#/nodes";
  await router.render();
  ok(
    view.textContent === "nodes",
    "hash: static /nodes (not the :name route): " + view.textContent,
  );
  const nav = document.querySelector("nav");
  ok(markActive(nav) === document.getElementById("l-nodes"), "hash: markActive returns the nodes link");
  ok(
    document.getElementById("l-nodes").getAttribute("aria-current") === "page",
    "hash: nodes link active",
  );
  ok(
    document.getElementById("l-home").getAttribute("aria-current") === null,
    "hash: home link not active (root matches only itself)",
  );
  ok(seen.at(-1).path === "/nodes", "hash: routechange carries the new path");

  w.location.hash = "#/totally/unknown";
  await router.render();
  ok(view.textContent === "404", "hash: catch-all 404: " + view.textContent);

  // lazy-load cache: revisit /nodes — module imported only once total
  w.location.hash = "#/nodes";
  await router.render();
  w.location.hash = "#/nodes";
  await router.render();
  ok(
    calls.nodes === 1,
    "hash: /nodes module imported exactly once (cached): " + calls.nodes,
  );

  // programmatic navigate (post-action redirect)
  await router.navigate("/");
  ok(
    view.textContent === "home" && location.hash === "#/",
    "hash: navigate('/') works: " + location.hash,
  );
  router.stop();
}

// =========================== history mode ===================================
{
  const w = install("http://localhost/");
  document.body.innerHTML =
    '<a id="lnk" href="/nodes">Nodes</a><a id="ext" href="https://example.com/x">ext</a><div id="view"></div>';
  const view = document.getElementById("view");
  const { calls, make } = loaders();
  const router = new Router({
    outlet: "#view",
    appName: "Plexus",
    mode: "history",
    routes: {
      "/": { title: "Overview", load: make("home") },
      "/nodes": { title: "Nodes", load: make("nodes") },
      "*": { title: "Not found", load: make("404") },
    },
  });
  await router.start();
  ok(
    view.textContent === "home" && location.pathname === "/",
    "history: initial / rendered",
  );

  // a plain left-click on an in-app link is intercepted into pushState (no reload)
  document
    .getElementById("lnk")
    .dispatchEvent(
      new w.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
    );
  await tick();
  ok(
    location.pathname === "/nodes",
    "history: click pushState'd to /nodes: " + location.pathname,
  );
  ok(
    view.textContent === "nodes",
    "history: click rendered the page: " + view.textContent,
  );
  ok(
    markActive(document.body) === document.getElementById("lnk") &&
      document.getElementById("lnk").getAttribute("aria-current") === "page",
    "history: markActive marks the clicked link",
  );

  // a modified (⌘/Ctrl) click must NOT be intercepted (lets open-in-new-tab work)
  await router.navigate("/");
  document
    .getElementById("lnk")
    .dispatchEvent(
      new w.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
        metaKey: true,
      }),
    );
  await tick();
  ok(
    location.pathname === "/",
    "history: modified-click NOT intercepted (stays /): " + location.pathname,
  );

  // an external link must fall through (origin differs)
  await router.navigate("/nodes");
  document
    .getElementById("ext")
    .dispatchEvent(
      new w.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
    );
  await tick();
  ok(location.pathname === "/nodes", "history: external link not intercepted");
  router.stop();
}

// ===================== history mode under a base path =======================
{
  const w = install("http://localhost/admin/nodes");
  document.body.innerHTML =
    '<a id="a" href="/admin/nodes">N</a><div id="view"></div>';
  const view = document.getElementById("view");
  const { make } = loaders();
  const router = new Router({
    outlet: "#view",
    mode: "history",
    base: "/admin",
    routes: {
      "/": { title: "H", load: make("home") },
      "/nodes": { title: "N", load: make("nodes") },
      "*": { title: "x", load: make("404") },
    },
  });
  await router.start();
  ok(
    view.textContent === "nodes",
    "base: /admin/nodes matched /nodes: " + view.textContent,
  );
  ok(
    markActive(document.body) === document.getElementById("a"),
    "base: markActive strips the base (/admin/nodes on /nodes)",
  );
  router.stop();
}

// ============ dynamic-data page: /items/:id → custom-element page ===========
// This is the real shape for a detail page: the route carries the id, the router
// hands it to the page element as `.params`, and the page fetches/renders from it.
{
  const w = install("http://localhost/");
  class ItemPage extends w.HTMLElement {
    connectedCallback() {
      this.textContent =
        "item#" +
        (this.params && this.params.id != null ? this.params.id : "?");
    }
  }
  w.customElements.define("item-page", ItemPage);
  document.body.innerHTML = '<div id="view"></div>';
  const view = document.getElementById("view");
  const router = new Router({
    outlet: "#view",
    mode: "hash",
    routes: {
      "/items/:id": {
        title: (p) => `Item ${p.id}`,
        load: () => Promise.resolve({ default: "item-page" }),
      },
      "*": {
        title: "x",
        load: () =>
          Promise.resolve({ default: (o) => (o.textContent = "404") }),
      },
    },
  });

  w.location.hash = "#/items/123";
  await router.start();
  const el = view.querySelector("item-page");
  ok(
    el && el.params.id === "123",
    "dynamic: params.id available on the page element: " + (el && el.params.id),
  );
  ok(
    el && el.textContent === "item#123",
    "dynamic: page rendered from params.id: " + (el && el.textContent),
  );
  ok(
    document.title === "Item 123",
    "dynamic: title derived from id: " + document.title,
  );
  ok(
    el.ctx && el.ctx.path === "/items/123",
    "dynamic: full ctx (path/query/router) passed too",
  );

  // navigating to another id re-mounts a fresh element (fresh data load)
  w.location.hash = "#/items/456";
  await router.render();
  const el2 = view.querySelector("item-page");
  ok(
    el2 !== el && el2.textContent === "item#456",
    "dynamic: id 123→456 re-mounts with new id",
  );

  // query string is parsed and exposed for things like ?tab=logs
  w.location.hash = "#/items/789?tab=logs";
  await router.render();
  ok(
    view.querySelector("item-page").ctx.query.tab === "logs",
    "dynamic: query string exposed (?tab=logs)",
  );
  router.stop();
}

// ===================== back / forward (history mode) ========================
// Browser back/forward fire `popstate`; the router re-renders from the new URL.
// Real history.back()/forward() drive a real session-history stack here.
{
  const w = install("http://localhost/");
  document.body.innerHTML = '<div id="view"></div>';
  const view = document.getElementById("view");
  const { make } = loaders();
  const router = new Router({
    outlet: "#view",
    mode: "history",
    routes: {
      "/": { title: "H", load: make("home") },
      "/nodes": { title: "N", load: make("nodes") },
      "/items/:id": { title: "I", load: make("item") },
      "*": { title: "x", load: make("404") },
    },
  });
  await router.start(); // "/"
  await router.navigate("/nodes"); // pushState
  await router.navigate("/items/7"); // pushState
  ok(
    view.textContent === "item:7",
    "histnav: at /items/7: " + view.textContent,
  );

  history.back();
  await until(() => location.pathname === "/nodes");
  ok(
    location.pathname === "/nodes" && view.textContent === "nodes",
    "back → /nodes: " + location.pathname + " / " + view.textContent,
  );
  history.back();
  await until(() => location.pathname === "/");
  ok(
    location.pathname === "/" && view.textContent === "home",
    "back → /: " + location.pathname + " / " + view.textContent,
  );
  history.forward();
  await until(() => location.pathname === "/nodes");
  ok(
    location.pathname === "/nodes" && view.textContent === "nodes",
    "forward → /nodes: " + location.pathname + " / " + view.textContent,
  );
  router.stop();
}

// ===================== back / forward (hash mode) ===========================
// In hash mode back/forward fire `hashchange`; same idea.
{
  const w = install("http://localhost/");
  document.body.innerHTML = '<div id="view"></div>';
  const view = document.getElementById("view");
  const { make } = loaders();
  const router = new Router({
    outlet: "#view",
    mode: "hash",
    routes: {
      "/": { title: "H", load: make("home") },
      "/nodes": { title: "N", load: make("nodes") },
      "*": { title: "x", load: make("404") },
    },
  });
  w.location.hash = "#/";
  await router.start();
  await router.navigate("/nodes");
  await tick();
  ok(view.textContent === "nodes", "hash histnav: at /nodes");
  history.back();
  await until(() => location.hash === "#/" || location.hash === "");
  ok(
    (location.hash === "#/" || location.hash === "") &&
      view.textContent === "home",
    "hash back → /: " + location.hash + " / " + view.textContent,
  );
  history.forward();
  await until(() => location.hash === "#/nodes");
  ok(
    location.hash === "#/nodes" && view.textContent === "nodes",
    "hash forward → /nodes: " + location.hash + " / " + view.textContent,
  );
  router.stop();
}

// layout loaders that count how many times each layout is actually MOUNTED
function layoutLoaders() {
  const mounts = {};
  const make = (label) => {
    mounts[label] = 0;
    const mod = {
      default: (container) => {
        mounts[label]++;
        const root = document.createElement("div");
        root.className = "layout-" + label;
        const inner = document.createElement("div");
        inner.className = "inner";
        root.append(inner);
        container.replaceChildren(root);
        return inner; // inner outlet for pages
      },
    };
    return () => Promise.resolve(mod);
  };
  return { mounts, make };
}

// ===================== nested layouts (persistent chrome) ===================
{
  const w = install("http://localhost/");
  document.body.innerHTML = '<div id="view"></div>';
  const view = document.getElementById("view");
  const { make } = loaders();
  const L = layoutLoaders();
  const router = new Router({
    outlet: "#view",
    mode: "hash",
    layouts: { dashboard: L.make("dashboard") },
    routes: {
      "/": { title: "Home", layout: "dashboard", load: make("home") },
      "/nodes": { title: "Nodes", layout: "dashboard", load: make("nodes") },
      "/login": { title: "Login", load: make("login") }, // no layout
    },
  });
  w.location.hash = "#/";
  await router.start();
  const layoutEl = view.querySelector(".layout-dashboard");
  ok(
    layoutEl && view.querySelector(".inner"),
    "layout: dashboard chrome rendered",
  );
  ok(
    view.querySelector(".inner").textContent === "home",
    "layout: page mounted into inner outlet",
  );

  w.location.hash = "#/nodes";
  await router.render();
  ok(
    view.querySelector(".layout-dashboard") === layoutEl,
    "layout: SAME chrome node reused across same-layout nav",
  );
  ok(
    view.querySelector(".inner").textContent === "nodes",
    "layout: only inner content swapped",
  );
  ok(
    L.mounts.dashboard === 1,
    "layout: dashboard mounted exactly ONCE for two routes: " +
      L.mounts.dashboard,
  );

  w.location.hash = "#/login";
  await router.render();
  ok(
    !view.querySelector(".layout-dashboard") && view.textContent === "login",
    "layout: no-layout route replaces the chrome",
  );

  w.location.hash = "#/";
  await router.render();
  ok(
    L.mounts.dashboard === 2 &&
      view.querySelector(".inner").textContent === "home",
    "layout: re-entering dashboard rebuilds chrome (was torn down)",
  );
  router.stop();
}

// ===================== auth guard / middleware redirect =====================
{
  const w = install("http://localhost/");
  document.body.innerHTML = '<div id="view"></div>';
  const view = document.getElementById("view");
  const { make } = loaders();
  let authed = false;
  const seen = [];
  const router = new Router({
    outlet: "#view",
    mode: "hash",
    routes: {
      "/login": { title: "Login", load: make("login") },
      "/": { title: "Home", meta: { auth: true }, load: make("home") },
      "/nodes": { title: "Nodes", meta: { auth: true }, load: make("nodes") },
      "*": { title: "404", load: make("404") },
    },
    beforeEach: async (to) => {
      seen.push(to.path);
      if (to.route.meta && to.route.meta.auth && !authed) return "/login";
    },
  });

  w.location.hash = "#/";
  await router.start();
  await until(
    () => location.hash === "#/login" && view.textContent === "login",
  );
  ok(
    location.hash === "#/login" && view.textContent === "login",
    "guard: unauthenticated → redirected to /login",
  );
  ok(
    seen.includes("/") && seen.includes("/login"),
    "guard: beforeEach ran for both the blocked route and the redirect target",
  );

  authed = true; // "log in"
  w.location.hash = "#/nodes";
  await router.render();
  await until(() => view.textContent === "nodes");
  ok(
    location.hash === "#/nodes" && view.textContent === "nodes",
    "guard: authenticated → protected route allowed",
  );
  router.stop();
}

// ============================ afterEach: fires once the navigation is committed =====
{
  const w = install("http://localhost/");
  document.body.innerHTML = '<div id="view"></div>';
  const view = document.getElementById("view");
  const { make } = loaders();
  const after = [], errors = [];
  let blockNodes = false, boom = false;
  const router = new Router({
    outlet: "#view",
    mode: "hash",
    routes: {
      "/": { title: "Home", load: make("home") },
      "/nodes": { title: "Nodes", load: make("nodes") },
      "/broken": { title: "Broken", load: () => Promise.reject(new Error("no module")) },
      "*": { title: "404", load: make("404") },
    },
    beforeEach: (to) => (blockNodes && to.path === "/nodes" ? false : undefined),
    afterEach: (ctx, hit) => {
      if (boom) throw new Error("hook failed");
      after.push({ path: ctx.path, same: ctx.route === hit.route, current: router.current === hit, mounted: view.textContent });
    },
    onError: (e) => errors.push(e.message),
  });

  w.location.hash = "#/";
  await router.start();
  ok(after.length === 1 && after[0].path === "/" && after[0].same, "afterEach: called once with (ctx, hit) for the first render");
  ok(after[0].current === true, "afterEach: router.current already points at the new hit");
  ok(after[0].mounted === "", "afterEach: runs BEFORE the page is mounted (before the swap)");
  ok(view.textContent === "home", "afterEach: the page still mounts afterwards");

  blockNodes = true;
  w.location.hash = "#/nodes";
  await router.render();
  ok(after.length === 1 && view.textContent === "home", "afterEach: not called when a guard cancels");

  blockNodes = false;
  w.location.hash = "#/broken";
  await router.render();
  ok(after.length === 1 && errors.length === 1 && errors[0] === "no module", "afterEach: not called when the module fails to load (onError is)");

  boom = true;
  w.location.hash = "#/nodes";
  await router.render();
  ok(errors.length === 2 && errors[1] === "hook failed" && view.textContent === "nodes", "afterEach: a throwing hook goes to onError and the page still mounts");
  router.stop();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
