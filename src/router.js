// Router — a zero-dependency SPA router for embedded admin UIs. No build, CSP-safe.
//
// Two modes (pick per app; default "hash"):
//   * "hash" — URLs look like `#/nodes/web`. Needs NO server config, works from any
//     mount point or file path; ideal for a UI embedded in a backend binary. Links
//     are real <a href="#/nodes"> anchors and the router only REACTS to hashchange —
//     it never attaches click handlers, so ⌘-click / open-in-new-tab / copy-link
//     all keep working.
//   * "history" — clean URLs like `/nodes/web` via the History API. Nicer URLs, but:
//       (1) the SERVER must serve the SPA shell for every unknown path (catch-all
//           rewrite) — a deep link hits the server directly; and
//       (2) the router intercepts same-origin <a> clicks (pushState) while still
//           letting modified clicks (⌘/Ctrl/Shift/middle), target=_blank, downloads
//           and cross-origin links fall through to the browser.
//     Set `base` if the app is mounted under a sub-path (e.g. "/admin").
//
// Patterns: static (`/nodes`), params (`/nodes/:name`), and a catch-all (`*`) that
// renders a 404 page when nothing else matches. Each route lazy-loads its page via
// `load()` (typically `() => import("./pages/nodes.js")`); the module is imported on
// first visit and cached. A page module's default export is either a custom-element
// tag name (string) or a mount function `(outlet, ctx) => cleanup?`.
//
//   const router = new Router({
//     outlet: "#view", appName: "CompanyX", mode: "hash",
//     routes: {
//       "/":            { title: "Overview", load: () => import("./pages/home.js") },
//       "/nodes":       { title: "Nodes",    load: () => import("./pages/nodes.js") },
//       "/nodes/:name": { title: (p) => `Node ${p.name}`, load: () => import("./pages/node.js") },
//       "*":            { title: "Not found", load: () => import("./pages/404.js") },
//     },
//   });
//   router.start();

export class Router {
  constructor(opts) {
    this.outletSel = opts.outlet;
    this.appName = opts.appName || "";
    this.mode = opts.mode === "history" ? "history" : "hash";
    this.base = (opts.base || "").replace(/\/$/, "");
    this.useTransition = opts.transition !== false;
    this.onError = opts.onError;
    this.routes = compileRoutes(opts.routes || {});
    this.catchAll = this.routes.find((r) => r.catchAll) || null;
    this.layouts = opts.layouts || {};   // key → loader (lazy module of a layout)
    this.beforeEach = opts.beforeEach;   // (ctx) => true | false | "/redirect" | void
    this.modules = new Map();            // pattern → resolved page module (lazy cache)
    this.layoutModules = new Map();      // key → resolved layout module (lazy cache)
    this.current = null;                 // { route, params, query, path }
    this.cleanup = null;                 // teardown returned by the last mounted page
    this._layoutKey = null;              // currently-mounted layout (persists across routes)
    this._innerOutlet = null;            // where pages mount inside the current layout
    this._token = 0;                     // guards against out-of-order async mounts
    this._onPop = () => this.render();
    this._onClick = (e) => this._intercept(e);
  }

  start() {
    this.outlet = typeof this.outletSel === "string" ? document.querySelector(this.outletSel) : this.outletSel;
    if (this.mode === "hash") {
      window.addEventListener("hashchange", this._onPop);
    } else {
      window.addEventListener("popstate", this._onPop);
      document.addEventListener("click", this._onClick);
    }
    return this.render();
  }
  stop() {
    window.removeEventListener("hashchange", this._onPop);
    window.removeEventListener("popstate", this._onPop);
    document.removeEventListener("click", this._onClick);
  }

  // navigate is for POST-ACTION redirects only (e.g. go to the list after a delete).
  // Things the user clicks to open must be real <a href> links, not this.
  navigate(path, opts = {}) {
    if (this.mode === "hash") {
      const h = "#" + path;
      if (opts.replace) location.replace(h);             // redirect without a back-trap
      else if (location.hash !== h) location.hash = h;
      return this.render();
    }
    history[opts.replace ? "replaceState" : "pushState"]({}, "", (this.base || "") + path);
    return this.render();
  }

  // _loc reads the active { path, query } from the URL for the current mode.
  _loc() {
    if (this.mode === "hash") {
      const raw = location.hash.replace(/^#/, "") || "/";
      const [p, q = ""] = raw.split("?");
      return { path: p.startsWith("/") ? p : "/" + p, query: q };
    }
    let p = location.pathname || "/";
    if (this.base && p.startsWith(this.base)) p = p.slice(this.base.length) || "/";
    return { path: p, query: location.search.replace(/^\?/, "") };
  }

  match() {
    const { path, query: queryStr } = this._loc();
    const query = Object.fromEntries(new URLSearchParams(queryStr));
    for (const route of this.routes) {
      if (route.catchAll) continue;
      const m = route.re.exec(path);
      if (m) {
        const params = {};
        route.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
        return { route, params, query, path };
      }
    }
    return this.catchAll ? { route: this.catchAll, params: {}, query, path } : null;
  }

  async _load(map, key, loader) {
    let mod = map.get(key);
    if (!mod) { mod = await loader(); map.set(key, mod); }
    return mod;
  }

  async render() {
    const hit = this.match();
    const token = ++this._token;
    if (!hit) { if (this.outlet) this.outlet.replaceChildren(); return; }
    const ctx = { path: hit.path, params: hit.params, query: hit.query, route: hit.route, router: this };

    // navigation guards: global beforeEach, then a per-route beforeEnter. Each may
    // return false (cancel) or a path string (redirect, replacing history).
    for (const guard of [this.beforeEach, hit.route.beforeEnter]) {
      if (typeof guard !== "function") continue;
      let res;
      try { res = await guard(ctx); }
      catch (e) { if (token !== this._token) return; if (this.onError) this.onError(e, hit); return; }
      if (token !== this._token) return;
      if (res === false) return;
      if (typeof res === "string") { this.navigate(res, { replace: true }); return; }
    }

    // resolve page (+ layout) modules, lazily and cached
    let pageMod, layoutMod;
    try {
      pageMod = await this._load(this.modules, hit.route.pattern, hit.route.load);
      if (hit.route.layout && this.layouts[hit.route.layout]) layoutMod = await this._load(this.layoutModules, hit.route.layout, this.layouts[hit.route.layout]);
    } catch (e) {
      if (token !== this._token) return;
      if (this.onError) this.onError(e, hit); else if (this.outlet) this.outlet.textContent = String(e);
      return;
    }
    if (token !== this._token) return;

    document.title = titleFor(hit.route.title, hit.params, this.appName);
    const swap = () => this._mountWithLayout(hit, pageMod, layoutMod, ctx);
    if (this.useTransition && document.startViewTransition) document.startViewTransition(swap);
    else swap();
    this.current = hit;
    this._setActiveLinks(hit.path);
    // Reactive layouts/pages render their links on a microtask, after this point —
    // re-run once the queue drains so their <a> links also get aria-current.
    if (typeof queueMicrotask === "function") queueMicrotask(() => this._setActiveLinks(hit.path));
  }

  // Mount the layout (reusing it across routes that share it — chrome like a sidebar
  // keeps its DOM/scroll/state) then mount the page into the layout's inner outlet.
  _mountWithLayout(hit, pageMod, layoutMod, ctx) {
    const layoutKey = hit.route.layout || null;
    let inner;
    if (layoutKey && layoutMod) {
      if (this._layoutKey === layoutKey && this._innerOutlet && this._innerOutlet.isConnected) {
        inner = this._innerOutlet;                    // same layout → reuse, don't rebuild chrome
      } else {
        this._teardownPage();
        this.outlet.replaceChildren();
        const def = layoutMod.default;
        if (typeof def === "string") {                // layout = custom element exposing `.outlet`
          const lel = document.createElement(def);    // e.g. a Reactive component whose render()
          lel.ctx = ctx;                              // includes a stable ${this.outlet} node
          this.outlet.replaceChildren(lel);
          inner = lel.outlet || lel;
        } else if (typeof def === "function") {       // (container, ctx) => inner outlet element
          inner = def(this.outlet, ctx) || this.outlet;
        } else {
          inner = this.outlet;
        }
        this._layoutKey = layoutKey;
        this._innerOutlet = inner;
      }
    } else {
      if (this._layoutKey) { this._teardownPage(); this.outlet.replaceChildren(); }
      this._layoutKey = null; this._innerOutlet = null;
      inner = this.outlet;
    }
    this._mountInto(inner, pageMod, hit, ctx);
  }

  _teardownPage() { if (typeof this.cleanup === "function") { try { this.cleanup(); } catch { /* */ } } this.cleanup = null; }

  _mountInto(target, mod, hit, ctx) {
    this._teardownPage();
    const page = mod && mod.default;
    if (typeof page === "string") {                   // page is a custom-element tag name
      const el = document.createElement(page);
      el.params = hit.params; el.ctx = ctx;
      target.replaceChildren(el);
      this.cleanup = () => el.remove();
    } else if (typeof page === "function") {          // page is a mount function
      target.replaceChildren();
      const ret = page(target, ctx);                  // may return a cleanup fn
      if (typeof ret === "function") this.cleanup = ret;
    } else {
      target.replaceChildren();
    }
  }

  // history-mode click interception: hijack same-origin in-app links into pushState,
  // but let every "the user means a real navigation" case fall through to the browser.
  _intercept(e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.target === "_blank" || a.hasAttribute("download") || a.getAttribute("rel") === "external") return;
    const href = a.getAttribute("href");
    if (!href || href.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(href)) return; // in-page anchor / external scheme
    const url = new URL(a.href);
    if (url.origin !== location.origin) return;
    if (this.base && !url.pathname.startsWith(this.base)) return; // outside the app mount
    e.preventDefault();
    this.navigate(url.pathname.slice(this.base.length) + url.search || "/");
  }

  // Mark the in-app link whose target equals the active path with aria-current.
  // CSS styles [aria-current="page"]; no JS click handlers are involved.
  _setActiveLinks(path) {
    for (const a of document.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href");
      let lp = null;
      if (href.startsWith("#")) lp = href.slice(1).split("?")[0] || "/";
      else if (this.mode === "history" && href.startsWith("/")) {
        lp = href.split("?")[0];
        if (this.base && lp.startsWith(this.base)) lp = lp.slice(this.base.length) || "/";
      }
      if (lp == null) continue;
      if (lp === path) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
  }
}

// compileRoutes turns the routes map into ordered matchers. `*` (or `/*`) is the
// catch-all. `:name` segments become capture groups; their names are collected.
function compileRoutes(map) {
  return Object.entries(map).map(([pattern, def]) => {
    if (pattern === "*" || pattern === "/*") return { pattern, ...def, catchAll: true };
    const keys = [];
    const src = pattern.replace(/:[^/]+/g, (seg) => { keys.push(seg.slice(1)); return "([^/]+)"; });
    return { pattern, ...def, keys, re: new RegExp("^" + src + "$") };
  });
}

function titleFor(title, params, appName) {
  const base = typeof title === "function" ? title(params) : (title || "");
  if (base && appName) return `${base} · ${appName}`;
  return base || appName || "";
}
