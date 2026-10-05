// Tests for router.js's view-transition path, against a SCRIPTED fake of
// document.startViewTransition (jsdom has none). Each fake reproduces one way a real
// browser settles the ViewTransition's three promises; the real-browser behaviour is
// not executed here. Unhandled rejections are counted through Node's process hook.
import { JSDOM } from "jsdom";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const tick = () => new Promise((r) => setTimeout(r));

const unhandled = [];
process.on("unhandledRejection", (e) => { unhandled.push(e); if (process.env.DBG) console.log("UNHANDLED", e && e.stack); });

const dom = new JSDOM("<!doctype html><html><body><div id=\"view\"></div></body></html>", { url: "http://localhost/" });
const w = dom.window;
for (const k of ["window", "document", "HTMLElement", "customElements", "location", "history", "MouseEvent", "Event", "URL", "URLSearchParams", "Node"])
  global[k] = w[k];

const { Router } = await import("../src/router.js");

const err = (name) => Object.assign(new Error(name), { name });
const deferred = () => { let resolve, reject; const p = new Promise((a, b) => { resolve = a; reject = b; }); return { p, resolve, reject }; };

// mode → how the fake settles. `hold` keeps `finished` pending until released (for the staleness case).
let mode = "normal", held = null;
document.startViewTransition = (cb) => {
  const ready = deferred(), ucd = deferred(), fin = deferred();
  const callCb = () => { try { const r = cb(); ucd.resolve(r); return null; } catch (e) { return e; } };
  queueMicrotask(() => {
    if (mode === "normal") { callCb(); ready.resolve(); fin.resolve(); }
    else if (mode === "abort-after-swap") { callCb(); ready.reject(err("InvalidStateError")); fin.resolve(); }
    else if (mode === "throw") { const e = callCb(); ucd.reject(e); ready.reject(e); fin.reject(e); }
    else if (mode === "drop-before-swap") {         // non-conforming: the callback is never invoked
      const a = err("AbortError");
      ready.reject(a); ucd.reject(a);
      if (held) held.push(() => fin.reject(a)); else fin.reject(a);
    }
  });
  return { ready: ready.p, updateCallbackDone: ucd.p, finished: fin.p };
};

let mounts = 0, boom = false;
const page = (label) => () => Promise.resolve({ default: (outlet) => { mounts++; if (boom) throw err("SwapError"); outlet.textContent = label; } });
const router = new Router({ outlet: "#view", mode: "hash", routes: { "/": { title: "Home", load: page("home") }, "/a": { title: "A", load: page("a") }, "/b": { title: "B", load: page("b") } } });
const view = document.getElementById("view");
const go = async (hash) => { w.location.hash = hash; for (let i = 0; i < 8; i++) await tick(); }; // the started router renders on hashchange

// ---- normal transition: swap once, nothing unhandled ----
await router.start(); for (let i = 0; i < 8; i++) await tick();   // location is "/" already (no hash → "/")
ok(view.textContent === "home" && mounts === 1, "normal: page mounted once inside the transition");
ok(unhandled.length === 0, `normal: no unhandled rejection (got ${unhandled.length})`);

// ---- aborted after swap (viewport resize mid-transition): page shown, no console error ----
mode = "abort-after-swap"; mounts = 0; unhandled.length = 0;
await go("#/a");
ok(view.textContent === "a" && mounts === 1, "abort after swap: page mounted once");
ok(unhandled.length === 0, `abort after swap: InvalidStateError handled (unhandled ${unhandled.length})`);

// ---- dropped before swap (non-conforming browser): swap still runs, once ----
mode = "drop-before-swap"; mounts = 0; unhandled.length = 0;
await go("#/b");
ok(view.textContent === "b" && mounts === 1, "drop before swap: the router runs swap itself, once");
ok(unhandled.length === 0, `drop before swap: AbortError handled (unhandled ${unhandled.length})`);

// ---- dropped before swap, and a newer navigation lands first: the stale swap must not run ----
mode = "drop-before-swap"; held = []; mounts = 0; unhandled.length = 0;
await go("#/a");                 // transition to /a dropped, its `finished` held back
mode = "normal";
await go("#/b");                 // newer navigation completes
const release = held; held = null;
release.forEach((f) => f()); for (let i = 0; i < 5; i++) await tick();
ok(view.textContent === "b", "stale fallback: an older dropped navigation does not overwrite the newer page: " + view.textContent);
ok(mounts === 1, `stale fallback: only the newer page mounted (mounts ${mounts})`);
ok(unhandled.length === 0, `stale fallback: nothing unhandled (got ${unhandled.length})`);

// ---- swap throws: its error still surfaces, exactly once ----
mode = "throw"; boom = true; mounts = 0; unhandled.length = 0;
await go("#/");
boom = false;
ok(mounts === 1, "throwing swap: called once");
ok(unhandled.length === 1 && unhandled[0].name === "SwapError", `throwing swap: the swap's own error surfaces once (got ${unhandled.map((e) => e.name).join(",") || "none"})`);

console.log(`router-transition.test.mjs: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
