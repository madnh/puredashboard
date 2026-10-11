// Tests for layout.js (<puredashboard-layout> family).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual elements, events and logic.
// (matchMedia is absent in jsdom — the breakpoint path is feature-detected and
// verified in a real browser; here we only assert it never throws.)
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only", url: "http://localhost/" }); // a real origin so localStorage exists
const w = dom.window;
for (const k of ["document", "HTMLElement", "customElements", "CustomEvent", "Node", "Event", "MouseEvent", "KeyboardEvent", "MutationObserver"])
  global[k] = w[k];
global.localStorage = w.localStorage;
global.window = w;               // NB: jsdom window has NO matchMedia — the guard must hold
global.queueMicrotask = queueMicrotask;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const mount = (tag) => { const el = document.createElement(tag); document.body.appendChild(el); return el; };
const tick = () => new Promise((r) => setTimeout(r, 0));

const mod = await import("../src/layout.js");
void mod;

// ---- all five elements are defined ----
{
  for (const tag of ["puredashboard-layout", "puredashboard-header", "puredashboard-content", "puredashboard-footer", "puredashboard-sider"])
    ok(customElements.get(tag), `${tag} is defined`);
}

// ---- each element preserves its author children ----
{
  const lay = document.createElement("puredashboard-layout");
  const kid = document.createElement("puredashboard-header");
  lay.appendChild(kid);
  document.body.appendChild(lay);
  ok(lay.firstElementChild === kid, "layout preserves its author children");

  for (const tag of ["puredashboard-header", "puredashboard-content", "puredashboard-footer"]) {
    const el = document.createElement(tag);
    const span = document.createElement("span");
    span.textContent = "x";
    el.appendChild(span);
    document.body.appendChild(el);
    ok(el.firstElementChild === span && el.contains(span), `${tag} preserves its author children`);
  }
}

// ---- layout is a flex container / becomes a row with a sider (CSS contract) ----
{
  const css = readFileSync(new URL("../src/layout.css", import.meta.url), "utf8");
  ok(/puredashboard-layout\s*\{[^}]*display:\s*flex/.test(css), "layout is a flex container");
  ok(/puredashboard-layout\s*\{[^}]*flex-direction:\s*column/.test(css), "layout stacks (column) by default");
  ok(/:has\(>\s*puredashboard-sider\)/.test(css), "layout becomes a row when it has a direct sider (:has)");
  ok(/puredashboard-header\s*\{[^}]*display:\s*flex/.test(css), "header renders as a flex bar");
  ok(/puredashboard-content\s*\{[^}]*overflow:\s*auto/.test(css), "content scrolls its overflow");
}

// ---- layout hasSider property reflects to the has-sider attribute ----
{
  const lay = mount("puredashboard-layout");
  ok(lay.hasSider === false, "hasSider defaults to false");
  lay.hasSider = true;
  ok(lay.hasAttribute("has-sider"), "hasSider=true reflects to the has-sider attribute");
  lay.hasSider = false;
  ok(!lay.hasAttribute("has-sider"), "hasSider=false removes the attribute");
}

// ---- sider preserves children by moving them into an inner scroll region ----
{
  const sider = document.createElement("puredashboard-sider");
  const link = document.createElement("a");
  link.href = "#/";
  link.textContent = "Home";
  sider.appendChild(link);
  document.body.appendChild(sider);
  const inner = sider.querySelector(".puredashboard-sider__inner");
  ok(inner, "sider builds an inner scroll region");
  ok(sider.contains(link), "sider preserves its author child");
  ok(inner.contains(link), "author child is moved into the inner scroll region");
}

// ---- sider reflects width via the --pd-sider-w custom property ----
{
  const sider = mount("puredashboard-sider");
  ok(sider.width === 220, "width defaults to 220");
  ok(sider.collapsedWidth === 64, "collapsedWidth defaults to 64");
  ok(sider.style.getPropertyValue("--pd-sider-w") === "220px", "expanded width applied via --pd-sider-w");
  sider.width = 300;
  ok(sider.getAttribute("width") === "300" && sider.width === 300, "width property/attribute stay in sync");
  ok(sider.style.getPropertyValue("--pd-sider-w") === "300px", "changing width updates --pd-sider-w");
}

// ---- collapsible renders a trigger; non-collapsible does not ----
{
  const plain = mount("puredashboard-sider");
  ok(!plain.querySelector(".js-puredashboard-sider__trigger"), "no trigger when not collapsible");

  const sider = mount("puredashboard-sider");
  sider.collapsible = true;
  const trigger = sider.querySelector(".js-puredashboard-sider__trigger");
  ok(trigger, "collapsible renders a trigger");
  ok(trigger.tagName === "BUTTON" && trigger.type === "button", "trigger is a native <button>");
  ok(trigger.querySelector("svg"), "trigger carries an inline SVG icon");
  ok(trigger.getAttribute("aria-label") === "Collapse sidebar", "trigger aria-label is 'collapse' when expanded");

  sider.collapsible = false;
  ok(!sider.querySelector(".js-puredashboard-sider__trigger"), "trigger removed when collapsible turns off");
}

// ---- toggling flips collapsed (property + attribute + width) and emits "collapse" ----
{
  const sider = mount("puredashboard-sider");
  sider.collapsible = true;
  let ev = null;
  sider.addEventListener("collapse", (e) => { ev = e; });

  sider.toggle();
  ok(sider.collapsed === true, "toggle flips collapsed to true");
  ok(sider.hasAttribute("collapsed"), "collapsed reflects to the attribute");
  ok(sider.style.getPropertyValue("--pd-sider-w") === "64px", "collapsed width applied");
  ok(ev && ev.detail.collapsed === true, "collapse event fired with detail.collapsed=true");
  ok(ev.bubbles === true, "collapse event bubbles");
  const trigger = sider.querySelector(".js-puredashboard-sider__trigger");
  ok(trigger.getAttribute("aria-label") === "Expand sidebar", "trigger aria-label becomes 'expand' when collapsed");

  ev = null;
  sider.toggle();
  ok(sider.collapsed === false, "toggle flips collapsed back to false");
  ok(sider.style.getPropertyValue("--pd-sider-w") === "220px", "expanded width restored");
  ok(ev && ev.detail.collapsed === false, "collapse event fired again with detail.collapsed=false");
}

// ---- clicking the trigger toggles and emits ----
{
  const sider = mount("puredashboard-sider");
  sider.collapsible = true;
  let count = 0, last = null;
  sider.addEventListener("collapse", (e) => { count++; last = e.detail.collapsed; });
  const trigger = sider.querySelector(".js-puredashboard-sider__trigger");
  trigger.click();
  ok(count === 1 && last === true && sider.collapsed === true, "clicking the trigger collapses + emits once");
  trigger.click();
  ok(count === 2 && last === false && sider.collapsed === false, "clicking again expands + emits once");
}

// ---- declarative attributes reflect into properties ----
{
  document.body.innerHTML = `<puredashboard-sider width="180" collapsed-width="48" collapsible collapsed></puredashboard-sider>`;
  const sider = document.body.firstElementChild;
  ok(sider.width === 180, "width attribute reflected to property");
  ok(sider.collapsedWidth === 48, "collapsed-width attribute reflected to property");
  ok(sider.collapsible === true, "collapsible attribute reflected to property");
  ok(sider.collapsed === true, "collapsed attribute reflected to property");
  ok(sider.style.getPropertyValue("--pd-sider-w") === "48px", "starts at collapsed width when collapsed at parse");
  ok(sider.querySelector(".js-puredashboard-sider__trigger"), "declarative collapsible renders the trigger");
}

// ---- breakpoint is guarded when matchMedia is unavailable (jsdom) ----
{
  ok(typeof window.matchMedia !== "function", "sanity: jsdom has no matchMedia");
  const sider = mount("puredashboard-sider");
  let threw = false;
  try { sider.breakpoint = "md"; } catch { threw = true; }
  ok(!threw, "setting breakpoint does not throw when matchMedia is unavailable");
  ok(sider.breakpoint === "md", "breakpoint reflected despite no matchMedia");
}

// ---- localisable labels ----
{
  const sider = mount("puredashboard-sider");
  sider.labels = { collapse: "Thu gọn", expand: "Mở rộng" };
  ok(sider._label("collapse") === "Thu gọn", "labels override the default string");
  const other = mount("puredashboard-sider");
  ok(other._label("collapse") === "Collapse sidebar", "default label kept when not overridden");
}

// ---- a nav in the sider is inset (CSS contract); the rail look itself lives in nav.css ----
{
  const css = readFileSync(new URL("../src/layout.css", import.meta.url), "utf8");
  ok(/\.puredashboard-sider__inner > puredashboard-nav\s*\{[^}]*padding:\s*var\(--pd-sider-nav-inset/.test(css), "a direct nav child of the sider is padded by --pd-sider-nav-inset");
  ok(/puredashboard-sider\s*\{[^}]*--pd-nav-text:\s*var\(--pd-sider-text\)/.test(css), "the sider maps its palette onto the nav's --pd-nav-* knobs");
  ok(/--pd-sider-text:\s*var\(--sidebar-text,\s*var\(--text/.test(css), "the sider palette comes from the theme's --sidebar-* tokens, then the page tokens");
  ok(/puredashboard-sider\[collapsed\] \.puredashboard-sider__expanded-only\s*\{\s*display:\s*none !important/.test(css), "collapsed: author content marked expanded-only is hidden");
  ok(/puredashboard-sider\[variant="floating"\]\s*\{[^}]*border-radius/.test(css), "floating variant is a rounded card");
  ok(/puredashboard-layout:has\(> puredashboard-sider\[variant="inset"\]\) > puredashboard-content/.test(css), "inset variant turns the sibling content into the card");
  ok(/puredashboard-sider\[overlay\]\s*\{[^}]*position:\s*absolute/.test(css), "overlay (drawer) takes the sider out of the flow");
  ok(/puredashboard-layout:has\(> puredashboard-sider\[overlay\]\)::after/.test(css), "the layout paints a backdrop behind an open drawer");
  const tokens = readFileSync(new URL("../src/theme/tokens.css", import.meta.url), "utf8");
  ok(/--sidebar-bg:\s*var\(--panel\)/.test(tokens) && /--sidebar-active:\s*var\(--panel-3\)/.test(tokens), "tokens.css ships --sidebar-* defaults that equal the page panel");
}

// ---- collapsed mirrors onto nav descendants as icon-only (incl. a nav added later) ----
{
  const sider = mount("puredashboard-sider");
  const nav = document.createElement("puredashboard-nav");
  sider.appendChild(nav);
  await tick();
  ok(!nav.hasAttribute("icon-only"), "expanded: nav has no icon-only");
  sider.collapsed = true;
  ok(nav.hasAttribute("icon-only"), "collapsed: the nav inside gets icon-only");
  const late = document.createElement("puredashboard-nav");
  sider.querySelector(".puredashboard-sider__inner").appendChild(late);
  await tick();
  ok(late.hasAttribute("icon-only"), "a nav added while collapsed gets icon-only too (observer)");
  sider.collapsed = false;
  ok(!nav.hasAttribute("icon-only") && !late.hasAttribute("icon-only"), "expanding removes icon-only from every nav");
}

// ---- slot="header" / slot="footer" children land in sticky header/footer regions ----
{
  const sider = document.createElement("puredashboard-sider");
  const brand = document.createElement("div"); brand.setAttribute("slot", "header"); brand.textContent = "Acme";
  const nav = document.createElement("a"); nav.href = "#/"; nav.textContent = "Home";
  const user = document.createElement("div"); user.setAttribute("slot", "footer"); user.textContent = "me";
  sider.append(brand, nav, user);
  sider.collapsible = true;
  document.body.appendChild(sider);
  const header = sider.querySelector(".puredashboard-sider__header");
  const inner = sider.querySelector(".puredashboard-sider__inner");
  const footer = sider.querySelector(".puredashboard-sider__footer");
  ok(header && header.contains(brand), "slot=header child moves into the header region");
  ok(inner.contains(nav) && !inner.contains(brand) && !inner.contains(user), "unslotted children stay in the scroll region");
  ok(footer && footer.contains(user), "slot=footer child moves into the footer region");
  const kids = [...sider.children].map((c) => c.className.split(" ")[0]);
  ok(kids.join(",") === "puredashboard-sider__header,puredashboard-sider__inner,puredashboard-sider__footer,puredashboard-sider__trigger", "order: header, scroll region, footer, trigger — got " + kids.join(","));
  const plain = mount("puredashboard-sider");
  ok(!plain.querySelector(".puredashboard-sider__header") && !plain.querySelector(".puredashboard-sider__footer"), "no header/footer regions when nothing is slotted");
}

// ---- variant / rail / shortcut / persist reflect ----
{
  const sider = mount("puredashboard-sider");
  ok(sider.variant === "" && sider.collapseMode === "icon", "variant defaults to '' and collapseMode to icon");
  sider.variant = "floating";
  ok(sider.getAttribute("variant") === "floating", "variant reflects to the attribute");
  sider.variant = "";
  ok(!sider.hasAttribute("variant"), "empty variant removes the attribute");
  sider.shortcut = true;
  ok(sider.getAttribute("shortcut") === "b" && sider.shortcut === "b", "shortcut=true means the b key");
  sider.setAttribute("shortcut", "");
  ok(sider.shortcut === "b", "a bare shortcut attribute means the b key");
  sider.shortcut = "K";
  ok(sider.shortcut === "k", "shortcut is lower-cased");
  sider.shortcut = "";
  ok(!sider.hasAttribute("shortcut") && sider.shortcut === "", "clearing shortcut removes the attribute");
}

// ---- collapsible="offcanvas" collapses to 0 width ----
{
  document.body.innerHTML = `<puredashboard-sider collapsible="offcanvas" rail></puredashboard-sider>`;
  const sider = document.body.firstElementChild;
  ok(sider.collapsible === true && sider.collapseMode === "offcanvas", "collapsible=offcanvas is collapsible in offcanvas mode");
  const viaProp = mount("puredashboard-sider");
  viaProp.collapsible = "offcanvas";
  ok(viaProp.getAttribute("collapsible") === "offcanvas" && viaProp.collapseMode === "offcanvas", "collapsible = 'offcanvas' (property) keeps the mode");
  viaProp.collapsible = true;
  ok(viaProp.getAttribute("collapsible") === "" && viaProp.collapseMode === "icon", "collapsible = true (property) is the bare attribute, icon mode");
  ok(sider.querySelector(".js-puredashboard-sider__trigger"), "offcanvas still renders the trigger");
  sider.toggle();
  ok(sider.style.getPropertyValue("--pd-sider-w") === "0px", "offcanvas collapsed width is 0");
  sider.toggle();
  ok(sider.style.getPropertyValue("--pd-sider-w") === "220px", "offcanvas expands back to width");
}

// ---- rail: an edge handle that toggles ----
{
  const sider = mount("puredashboard-sider");
  ok(!sider.querySelector(".js-puredashboard-sider__rail"), "no rail by default");
  sider.rail = true;
  const rail = sider.querySelector(".js-puredashboard-sider__rail");
  ok(rail && rail.tagName === "BUTTON" && rail.getAttribute("aria-label") === "Toggle sidebar", "rail renders a labelled <button>");
  let n = 0;
  sider.addEventListener("collapse", () => n++);
  rail.click();
  ok(sider.collapsed === true && n === 1, "clicking the rail collapses + emits");
  sider.rail = false;
  ok(!sider.querySelector(".js-puredashboard-sider__rail"), "rail=false removes it");
}

// ---- shortcut: Cmd/Ctrl + key toggles, other modifiers don't ----
{
  const sider = mount("puredashboard-sider");
  sider.shortcut = "b";
  const key = (init) => { const e = new w.KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }); w.dispatchEvent(e); return e; };
  let e = key({ key: "b", ctrlKey: true });
  ok(sider.collapsed === true && e.defaultPrevented, "Ctrl+B toggles and is consumed");
  e = key({ key: "B", metaKey: true });
  ok(sider.collapsed === false, "Cmd+Shift-less capital B (caps) toggles back");
  e = key({ key: "b" });
  ok(sider.collapsed === false && !e.defaultPrevented, "a bare b does nothing");
  e = key({ key: "b", ctrlKey: true, shiftKey: true });
  ok(sider.collapsed === false, "Ctrl+Shift+B is left to the page");
  sider.remove();
  key({ key: "b", ctrlKey: true });
  ok(sider.collapsed === false, "a disconnected sider stops listening");
}

// ---- persist: remembered in localStorage, restored on connect ----
{
  localStorage.removeItem("puredashboard-sider:t");
  const a = document.createElement("puredashboard-sider");
  a.setAttribute("persist", "t");
  document.body.appendChild(a);
  ok(a.collapsed === false, "nothing stored → default expanded");
  a.toggle();
  ok(localStorage.getItem("puredashboard-sider:t") === "collapsed", "toggle() stores the state under the persist name");
  const b = document.createElement("puredashboard-sider");
  b.setAttribute("persist", "t");
  document.body.appendChild(b);
  ok(b.collapsed === true && b.style.getPropertyValue("--pd-sider-w") === "64px", "a new sider with the same persist name restores collapsed");
  localStorage.removeItem("puredashboard-sider:t");
}

// ---- drawer below the breakpoint (matchMedia stubbed) ----
{
  let listener = null, matches = true;
  w.matchMedia = () => ({ get matches() { return matches; }, addEventListener: (_t, fn) => { listener = fn; }, removeEventListener: () => { listener = null; } });
  try {
    const lay = mount("puredashboard-layout");
    const sider = document.createElement("puredashboard-sider");
    const link = document.createElement("a"); link.href = "#/x"; link.textContent = "x";
    sider.appendChild(link);
    lay.appendChild(sider);
    sider.breakpoint = "md";
    ok(sider.collapsed === true && !sider.hasAttribute("overlay"), "a matching breakpoint collapses; collapsed = no overlay");
    let n = 0; sider.addEventListener("collapse", () => n++);
    sider.toggle();
    ok(sider.collapsed === false && sider.hasAttribute("overlay"), "expanding under the breakpoint opens it as a drawer (overlay)");
    lay.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    ok(sider.collapsed === true && !sider.hasAttribute("overlay") && n === 2, "a click on the backdrop (the layout itself) closes the drawer + emits");
    sider.toggle();
    document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    ok(sider.collapsed === true && !sider.hasAttribute("overlay"), "Escape closes the drawer");
    sider.toggle();
    link.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    ok(sider.collapsed === true, "following a link inside the drawer closes it");
    sider.toggle();
    matches = false; listener({ matches: false });
    ok(sider.collapsed === false && !sider.hasAttribute("overlay"), "growing past the breakpoint keeps it open but drops the overlay");
    matches = true; listener({ matches: true });
    ok(sider.collapsed === true && !sider.hasAttribute("overlay"), "shrinking below the breakpoint collapses it again");
  } finally {
    delete w.matchMedia;
  }
}

console.log(`layout.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
