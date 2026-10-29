// active-link.js — which link points at the current route. Zero-dep, no build, CSP-safe.
//
// The router does not touch links. After every COMMITTED navigation (guards passed,
// modules loaded) it calls publishRoute(), which records the route here and dispatches
// `routechange` on `document`. Whoever renders links decides which one is active:
//   * <puredashboard-nav follow-route> / <puredashboard-tabs follow-route> listen for
//     `routechange` and set their own `current` / `value`;
//   * plain links (e.g. the theme shell's `.tab`s) call markActive(container) from a
//     `routechange` listener.
// Matching is by path segments: a link is active when its path equals the route, or
// is a segment prefix of it (`#/scans` for `#/scans/5`, never for `#/scansx`). Among
// the links of ONE container the longest match wins, so `#/scans/new` beats
// `#/scans` on `#/scans/new/3`. The root `/` matches only itself. `exact` turns
// prefix matching off. Queries are ignored on both sides.
//
// Module state is shared because every importer gets the same module instance
// (same URL), so a nav that connects AFTER a navigation reads currentRoute() at once.

let state = null; // { path, params, query, route, mode, base } of the last committed navigation

// Called by router.js only.
export function publishRoute(detail) {
  state = detail;
  document.dispatchEvent(new CustomEvent("routechange", { detail }));
}

/**
 * The last committed route published by `router.js`, or `null` when no router has
 * navigated yet. The same object is the `detail` of the `routechange` event that
 * `router.js` dispatches on `document` after every committed navigation (guards
 * passed, modules loaded, before the page mounts).
 *
 * @function currentRoute
 * @returns {Object|null} `{ path, params, query, route, mode, base }` — `path` is the router path (`"/scans/5"`, no `#`, no base).
 *
 * @example
 * import { currentRoute } from "LIB/active-link.js";
 * document.addEventListener("routechange", (e) => console.log(e.detail.path));
 * currentRoute()?.params.id;
 */
export function currentRoute() { return state; }

// linkPath(href) → the router path an href points at, or null when it is not an in-app
// link for the router's mode: hash mode takes `#/…` hrefs, history mode takes `/…`
// (with the base stripped; outside the base is not in-app).
export function linkPath(href, s = state) {
  if (!s || href == null) return null;
  href = String(href);
  if (s.mode === "hash") {
    if (!href.startsWith("#")) return null;
    const p = href.slice(1).split("?")[0] || "/";
    return p.startsWith("/") ? p : "/" + p;
  }
  if (!href.startsWith("/") || href.startsWith("//")) return null;
  let p = href.split(/[?#]/)[0] || "/";
  if (s.base) {
    if (p !== s.base && !p.startsWith(s.base + "/")) return null;
    p = p.slice(s.base.length) || "/";
  }
  return p;
}

// matchLength(href) → how strongly an href matches the current route: the length of its
// path when it matches (exactly, or as a segment prefix unless `exact`), else -1.
function matchLength(href, exact, s) {
  const lp = linkPath(href, s);
  if (lp == null) return -1;
  const cur = s.path || "/";
  if (lp === cur) return lp.length;
  if (exact || lp === "/") return -1;
  const prefix = lp.endsWith("/") ? lp : lp + "/";
  return cur.startsWith(prefix) ? lp.length : -1;
}

// bestLink(hrefs) → the index of the href that best matches the current route (longest
// match wins; first one on a tie), or -1 when none matches or nothing was published yet.
export function bestLink(hrefs, { exact = false } = {}, s = state) {
  if (!s) return -1;
  let best = -1, len = -1;
  hrefs.forEach((h, i) => { const n = matchLength(h, exact, s); if (n > len) { len = n; best = i; } });
  return best;
}

/**
 * Mark the link inside `container` that best matches the current route with
 * `aria-current="page"` and remove it from every other `a[href]` in there. Only that
 * container is touched — never the whole document — so content links that happen to
 * point at the current page are left alone. Matching: the link path equals the route
 * or is a segment prefix of it (`#/scans` on `#/scans/5`); the longest match wins; the
 * root `/` matches only itself; `exact: true` turns prefix matching off. Call it from a
 * `routechange` listener. Components that render links (`<puredashboard-nav>`,
 * `<puredashboard-tabs>`) do this themselves with the `follow-route` attribute.
 *
 * @function markActive
 * @param {Element} container - The element whose links are marked (e.g. the shell's `nav.tabs`).
 * @param {Object} [opts] - `{ exact?: boolean }` (default `false`: segment-prefix matching).
 * @returns {Element|null} The link now marked current, or `null` when none matches (or no router has navigated yet).
 *
 * @example
 * import { markActive } from "LIB/active-link.js";
 * const tabs = document.querySelector("header nav.tabs");
 * document.addEventListener("routechange", () => markActive(tabs));
 */
export function markActive(container, opts = {}) {
  if (!container || !state) return null;
  const links = [...container.querySelectorAll("a[href]")];
  const i = bestLink(links.map((a) => a.getAttribute("href")), opts);
  links.forEach((a, j) => { if (j === i) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  return i >= 0 ? links[i] : null;
}
