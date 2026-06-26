// Proves a Reactive component can be a router LAYOUT: it renders reactive chrome
// (a sidebar with a live badge) plus a STABLE outlet node, and the router mounts
// pages into that outlet. The critical property: when the layout re-renders (a
// reactive prop changes), the page mounted inside survives — because the parts
// engine short-circuits the unchanged ${this.outlet} node.
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

const dom = new JSDOM(
  "<!doctype html><html><body><div id='view'></div></body></html>",
  { url: "http://localhost/" },
);
const w = dom.window;
for (const k of [
  "window",
  "document",
  "HTMLElement",
  "customElements",
  "NodeFilter",
  "CustomEvent",
  "Node",
  "Event",
  "location",
  "history",
  "URL",
  "URLSearchParams",
])
  global[k] = w[k];

const { Reactive, html } = await import("../src/reactive.js");
const { Router } = await import("../src/router.js");

// A Reactive layout: stable outlet created once in the constructor; render() puts it
// back via ${this.outlet} every time, but the parts engine keeps the same node.
class DashLayout extends Reactive {
  static properties = { count: {} };
  constructor() {
    super();
    this.outlet = document.createElement("main");
    this.outlet.className = "dash-main";
  }
  render() {
    return html`<aside class="sidebar">
        <span class="badge">${this.count ?? 0}</span>
      </aside>
      ${this.outlet}`;
  }
}
DashLayout.define("dash-layout");

const view = document.getElementById("view");
const router = new Router({
  outlet: "#view",
  mode: "hash",
  layouts: { dashboard: () => Promise.resolve({ default: "dash-layout" }) }, // layout = tag name
  routes: {
    "/": {
      title: "Home",
      layout: "dashboard",
      load: () => Promise.resolve({ default: (o) => (o.textContent = "HOME") }),
    },
    "/nodes": {
      title: "Nodes",
      layout: "dashboard",
      load: () =>
        Promise.resolve({ default: (o) => (o.textContent = "NODES") }),
    },
  },
});

w.location.hash = "#/";
await router.start();
await tick(); // let the reactive layout run its first render

const layoutEl = view.querySelector("dash-layout");
ok(layoutEl, "reactive layout element mounted");
ok(
  layoutEl.querySelector(".sidebar .badge").textContent === "0",
  "layout reactive chrome rendered (badge=0)",
);
const outlet = layoutEl.querySelector(".dash-main");
ok(
  outlet && outlet.textContent === "HOME",
  "page mounted into the reactive layout's stable outlet",
);

// CRITICAL: change a layout reactive prop → layout re-renders → the page must survive.
layoutEl.count = 7;
await tick();
ok(
  layoutEl.querySelector(".sidebar .badge").textContent === "7",
  "layout re-rendered on prop change (badge=7)",
);
ok(
  layoutEl.querySelector(".dash-main") === outlet,
  "stable outlet is the SAME node across the layout re-render",
);
ok(
  layoutEl.querySelector(".dash-main").textContent === "HOME",
  "page content SURVIVES the layout re-render",
);

// navigate within the same layout → chrome persists, only the inner page swaps.
w.location.hash = "#/nodes";
await router.render();
await tick();
ok(
  view.querySelector("dash-layout") === layoutEl,
  "same reactive layout instance reused across nav",
);
ok(
  layoutEl.querySelector(".dash-main") === outlet,
  "outlet still the same node after route change",
);
ok(
  layoutEl.querySelector(".dash-main").textContent === "NODES",
  "inner page swapped to NODES (chrome untouched)",
);
ok(
  layoutEl.querySelector(".badge").textContent === "7",
  "reactive chrome state (badge=7) preserved across nav",
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
