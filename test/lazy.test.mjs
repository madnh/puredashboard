// Tests for ../src/lazy.js — <puredashboard-lazy> in jsdom. jsdom has no
// IntersectionObserver, so the suite installs a controllable stub (that IS the point of
// the test: we drive "scrolled into view" by hand) and also checks the no-IO degradation.
// Covered: the three content sources (<template>, render fn, load module), the
// placeholder + reserved height, state reflection, events, unrender/reset, the print
// hook, error handling, and that a <template>'s content really stays inert until then.
import { JSDOM } from "jsdom";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const tick = () => new Promise((r) => setTimeout(r, 0));
// A real frame, not just microtasks: the "eager" trigger uses requestAnimationFrame and
// jsdom schedules that on a ~16ms timer.
const settle = async () => { await new Promise((r) => setTimeout(r, 24)); };

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
const w = dom.window;

// A controllable IntersectionObserver: every instance is registered so a test can say
// "this element is now on screen" and see what the component does about it.
const observers = new Set();
class FakeIO {
  constructor(cb, opts) { this.cb = cb; this.opts = opts || {}; this.targets = new Set(); observers.add(this); }
  observe(el) { this.targets.add(el); }
  unobserve(el) { this.targets.delete(el); }
  disconnect() { this.targets.clear(); observers.delete(this); }
}
const setVisible = (el, isIntersecting) => {
  for (const io of [...observers]) if (io.targets.has(el)) io.cb([{ target: el, isIntersecting }], io);
};
w.IntersectionObserver = FakeIO;

for (const k of ["window", "document", "HTMLElement", "customElements", "NodeFilter", "CustomEvent", "Node", "Event", "IntersectionObserver", "requestAnimationFrame", "cancelAnimationFrame"]) global[k] = w[k];
w.addEventListener("error", (e) => { fail++; console.log("FAIL: uncaught error —", (e.error && e.error.stack) || e.message); });

await import("../src/lazy.js");
await import("../src/json-view.js");        // a genuinely expensive component to defer

const B = "puredashboard-lazy";
const mountHTML = async (html) => {
  document.body.innerHTML = html;
  await settle();
  return document.body.querySelector(B);
};
const placeholder = (el) => el.querySelector("[data-lazy-placeholder]");

// ======================================================= the pending state (default)
{
  const el = await mountHTML(`<puredashboard-lazy><template><puredashboard-json-view></puredashboard-json-view></template></puredashboard-lazy>`);
  ok(el.getAttribute("data-state") === "pending", "starts pending — nothing is built yet");
  ok(placeholder(el) !== null, "a built-in placeholder is shown while waiting");
  ok(el.getAttribute("aria-busy") === "true" && el.getAttribute("aria-label") === "Loading…", "pending: aria-busy + a name so a screen reader knows something is coming");
  ok(el.querySelector("puredashboard-json-view") === null, "the <template>'s content is NOT in the document…");
  // An un-upgraded custom element is still a plain HTMLElement; once upgraded its
  // constructor is the component class. That is the whole basis of the deferral.
  ok(el.querySelector("template").content.querySelector("puredashboard-json-view").constructor.name === "HTMLElement",
    "…and is NOT upgraded either — a template's content is inert, which is what makes the deferral real");
}
{
  const el = await mountHTML(`<puredashboard-lazy height="180px"><template><div>x</div></template></puredashboard-lazy>`);
  ok(el.style.getPropertyValue("--pd-lazy-h") === "180px", "height reserves the space up front (no layout jump on swap)");
}
{
  const el = await mountHTML(`<puredashboard-lazy><template><div>x</div></template><div data-lazy-fallback>my skeleton</div></puredashboard-lazy>`);
  ok(placeholder(el) === null, "an author [data-lazy-fallback] replaces the built-in placeholder");
  const own = el.querySelector("[data-lazy-fallback]");
  ok(own.hidden === false, "the author's fallback is visible while pending");
  setVisible(el, true);
  await settle();
  ok(own.hidden === true && el.querySelector("div:not([data-lazy-fallback])") !== null, "…and is hidden once the content lands");
}

// ============================================================= trigger: visible (IO)
{
  const el = await mountHTML(`<puredashboard-lazy root-margin="400px"><template><puredashboard-json-view></puredashboard-json-view></template></puredashboard-lazy>`);
  const io = [...observers].find((o) => o.targets.has(el));
  ok(io && io.opts.rootMargin === "400px", "the observer uses the given rootMargin (render just BEFORE it scrolls in)");
  const seen = [];
  el.addEventListener("render", (e) => seen.push(e.detail.reason));
  setVisible(el, false);
  await settle();
  ok(el.getAttribute("data-state") === "pending", "an off-screen report does not render it");
  setVisible(el, true);
  await settle();
  ok(el.getAttribute("data-state") === "rendered", "scrolling into view renders it");
  ok(el.querySelector("puredashboard-json-view") !== null, "the template content is now live in the document");
  ok(el.querySelector("puredashboard-json-view").constructor.name !== "HTMLElement", "…and upgraded (the component only pays its cost now)");
  ok(placeholder(el) === null && !el.hasAttribute("aria-busy"), "the placeholder and the busy state are gone");
  ok(seen.join() === "visible", "one render event, with the reason");
  ok([...observers].every((o) => !o.targets.has(el)), "the observer is disconnected once the work is done (no idle overhead)");
}
{
  const el = await mountHTML(`<puredashboard-lazy><template><div>a</div></template></puredashboard-lazy>`);
  setVisible(el, true);
  setVisible(el, true);                                   // a second report (scroll jitter)
  await settle();
  ok(el.querySelectorAll("div:not([data-lazy-placeholder])").length === 1, "rendering is idempotent — a repeated trigger doesn't duplicate the content");
}

// ================================================= triggers: eager / idle / manual
{
  const el = await mountHTML(`<puredashboard-lazy trigger="eager"><template><div>e</div></template></puredashboard-lazy>`);
  await settle();
  ok(el.getAttribute("data-state") === "rendered", 'trigger="eager" renders on the next frame');
}
{
  const el = await mountHTML(`<puredashboard-lazy trigger="idle"><template><div>i</div></template></puredashboard-lazy>`);
  await new Promise((r) => setTimeout(r, 20));
  ok(el.getAttribute("data-state") === "rendered", 'trigger="idle" renders when the browser is idle');
}
{
  const el = await mountHTML(`<puredashboard-lazy trigger="manual"><template><div>m</div></template></puredashboard-lazy>`);
  setVisible(el, true);
  await settle();
  ok(el.getAttribute("data-state") === "pending", 'trigger="manual" ignores visibility');
  ok([...observers].every((o) => !o.targets.has(el)), "…and doesn't even create an observer");
  await el.renderNow();
  await settle();
  ok(el.getAttribute("data-state") === "rendered" && el.querySelector("div"), "renderNow() renders on demand");
}

// ============================================================ content sources: JS
{
  const el = await mountHTML(`<puredashboard-lazy trigger="manual"></puredashboard-lazy>`);
  let gotHost = null;
  el.render = (host) => { gotHost = host; const d = document.createElement("section"); d.textContent = "built"; return d; };
  await el.renderNow();
  await settle();
  ok(gotHost === el && el.querySelector("section").textContent === "built", "render(host): a returned node is appended");
}
{
  const el = await mountHTML(`<puredashboard-lazy trigger="manual"></puredashboard-lazy>`);
  el.render = (host) => { host.appendChild(document.createElement("aside")); };
  await el.renderNow();
  await settle();
  ok(el.querySelector("aside") !== null, "render(host): appending to the host yourself works too");
}
{
  const el = await mountHTML(`<puredashboard-lazy trigger="manual"></puredashboard-lazy>`);
  el.render = () => new Promise((r) => setTimeout(() => r(document.createElement("p")), 5));
  const p = el.renderNow();
  ok(el.getAttribute("data-state") === "rendering", "an async source reports data-state=rendering while it works");
  await p;
  ok(el.getAttribute("data-state") === "rendered" && el.querySelector("p"), "…then rendered when it resolves");
}
{
  // the router's page contract: default export is a TAG NAME …
  const el = await mountHTML(`<puredashboard-lazy trigger="manual"></puredashboard-lazy>`);
  el.load = async () => ({ default: "puredashboard-json-view" });
  await el.renderNow();
  await settle();
  ok(el.querySelector("puredashboard-json-view") !== null, "load(): a default export that is a tag name is created");
}
{
  // … or a mount function returning a cleanup
  const el = await mountHTML(`<puredashboard-lazy trigger="manual"></puredashboard-lazy>`);
  let cleaned = 0;
  el.load = async () => ({ default: (host) => { host.appendChild(document.createElement("b")); return () => cleaned++; } });
  await el.renderNow();
  await settle();
  ok(el.querySelector("b") !== null, "load(): a mount function is called with the host");
  el.reset();
  ok(cleaned === 1, "reset() runs the cleanup the mount function returned");
}
{
  const el = await mountHTML(`<puredashboard-lazy trigger="manual"><template><div>tpl</div></template></puredashboard-lazy>`);
  el.render = () => document.createElement("span");
  await el.renderNow();
  await settle();
  ok(el.querySelector("div") !== null && el.querySelector("span") === null, "a <template> child wins over `render` (the zero-JS path first)");
}

// ==================================================================== error handling
{
  const el = await mountHTML(`<puredashboard-lazy trigger="manual"></puredashboard-lazy>`);
  const errs = [];
  el.addEventListener("loaderror", (e) => errs.push(e.detail.error.message));
  el.load = async () => { throw new Error("chunk 404"); };
  await el.renderNow();
  ok(el.getAttribute("data-state") === "error", "a failed load reports data-state=error");
  ok(errs.join() === "chunk 404", "…emits `loaderror` carrying the cause (not a bubbling `error`, which window monitors would report as a page error)");
  ok(placeholder(el) !== null, "…and keeps the placeholder instead of collapsing to nothing");
}

// ================================================================ unrender / reset
{
  const el = await mountHTML(`<puredashboard-lazy unrender><template><div>heavy</div></template></puredashboard-lazy>`);
  setVisible(el, true);
  await settle();
  ok(el.querySelector("div:not([data-lazy-placeholder])") !== null, "unrender: renders on entry as usual");
  ok([...observers].some((o) => o.targets.has(el)), "unrender: keeps observing (it needs the leave event)");
  let unrendered = 0;
  el.addEventListener("unrender", () => unrendered++);
  setVisible(el, false);
  await settle();
  ok(el.querySelector("div:not([data-lazy-placeholder])") === null && el.getAttribute("data-state") === "pending", "unrender: leaving the viewport tears the content down again");
  ok(unrendered === 1, "…and emits `unrender`");
  ok(el.querySelector("template") !== null, "…while the <template> survives, so it can render again");
  setVisible(el, true);
  await settle();
  ok(el.querySelector("div:not([data-lazy-placeholder])") !== null, "unrender: coming back re-renders");
}
{
  const el = await mountHTML(`<puredashboard-lazy trigger="manual"><template><div>x</div></template></puredashboard-lazy>`);
  await el.renderNow();
  await settle();
  el.reset();
  ok(el.getAttribute("data-state") === "pending" && placeholder(el) !== null, "reset() goes back to the placeholder");
  await el.renderNow();
  await settle();
  ok(el.querySelectorAll("div:not([data-lazy-placeholder])").length === 1, "…and the content can be rendered again exactly once");
}

// ======================================================================= printing
{
  const el = await mountHTML(`<puredashboard-lazy><template><div>print me</div></template></puredashboard-lazy>`);
  ok(el.getAttribute("data-state") === "pending", "still pending before printing");
  w.dispatchEvent(new w.Event("beforeprint"));
  await settle();
  ok(el.getAttribute("data-state") === "rendered" && el.querySelector("div"), "beforeprint materialises pending content so it appears on paper");
}

// ================================================== no IntersectionObserver at all
{
  const saved = w.IntersectionObserver;
  delete w.IntersectionObserver;
  global.IntersectionObserver = undefined;
  const el = await mountHTML(`<puredashboard-lazy><template><div>fallback</div></template></puredashboard-lazy>`);
  await settle();
  ok(el.getAttribute("data-state") === "rendered", "without IntersectionObserver it renders immediately — content is never lost");
  w.IntersectionObserver = saved;
  global.IntersectionObserver = saved;
}

// ==================================================================== disconnection
{
  const el = await mountHTML(`<puredashboard-lazy><template><div>x</div></template></puredashboard-lazy>`);
  el.remove();
  await settle();
  ok([...observers].every((o) => !o.targets.has(el)), "removing the element disconnects its observer (no leak)");
  w.dispatchEvent(new w.Event("beforeprint"));
  await settle();
  ok(el.getAttribute("data-state") === "pending", "…and a detached element is no longer materialised by printing");
}

console.log(`\nlazy.test.mjs: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
