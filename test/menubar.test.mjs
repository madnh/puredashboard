// Tests for ../src/menubar.js — <puredashboard-menubar> in jsdom. The bar is a Reactive
// custom element; each dropdown is opened by menu() (top-layer overlay), which in jsdom
// falls back to a fixed high-z element — so structure, ARIA wiring, roving tabindex, the
// Arrow/Home/End keyboard map, open/close/toggle, hover-to-switch, walking between open
// menus, and the select/openchange events are all exercised here against a real DOM.
import { JSDOM } from "jsdom";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const tick = () => new Promise((r) => setTimeout(r, 0));

function install() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const w = dom.window;
  for (const k of ["window", "document", "HTMLElement", "Node", "Event", "CustomEvent", "MouseEvent", "KeyboardEvent", "customElements", "NodeFilter", "requestAnimationFrame", "cancelAnimationFrame"]) global[k] = w[k];
  return w;
}

const w = install();
await import("../src/menubar.js");

const MB = "puredashboard-menubar";
const M = "puredashboard-menu";
const menus = () => [
  { label: "File", items: [
    { label: "New file", value: "new", shortcut: "⌘N" },
    { separator: true },
    { label: "Export as", items: [{ label: "JSON", value: "json" }] },
  ] },
  { label: "Edit", items: [{ label: "Undo", value: "undo" }] },
  { label: "Locked", disabled: true, items: [{ label: "Nope", value: "nope" }] },
  { label: "View", items: [{ label: "Sidebar", checked: true }] },
];

async function mount(props = {}) {
  document.body.innerHTML = "";
  const bar = document.createElement(MB);
  Object.assign(bar, { menus: menus() }, props);
  document.body.append(bar);
  await tick();
  return bar;
}
const triggers = (bar) => [...bar.querySelectorAll(`.js-${MB}__trigger`)];
const popup = () => document.body.querySelector(`:scope > .${M}`);
const popupItems = () => [...popup().querySelectorAll(`.js-${M}__item`)].filter((n) => n.closest(`.${M}`) === popup());
const key = (el, k) => el.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));

// ========================================================== structure + a11y
{
  const bar = await mount();
  const barEl = bar.querySelector(`.${MB}__bar`);
  ok(barEl.getAttribute("role") === "menubar", "bar: role=menubar");
  ok(barEl.getAttribute("aria-orientation") === "horizontal", "bar: aria-orientation=horizontal by default");
  ok(barEl.getAttribute("aria-label") === "Application menu", "bar: default accessible name from LABELS");
  const t = triggers(bar);
  ok(t.length === 4 && t.every((n) => n.getAttribute("role") === "menuitem"), "triggers: one role=menuitem per menu");
  ok(t.every((n) => n.getAttribute("aria-haspopup") === "menu" && n.getAttribute("aria-expanded") === "false"), "triggers: aria-haspopup + collapsed");
  ok(t[0].textContent === "File" && t[3].textContent === "View", "triggers: labels rendered in order");
  ok(t[2].disabled && t[2].classList.contains(`${MB}__trigger--disabled`), "triggers: a disabled menu is a disabled button");
  ok(t.filter((n) => n.tabIndex === 0).length === 1 && t[0].tabIndex === 0, "triggers: roving tabindex — exactly one tabbable");
}
{
  const bar = await mount({ labels: { bar: "Thanh menu" } });
  ok(bar.querySelector(`.${MB}__bar`).getAttribute("aria-label") === "Thanh menu", "labels: bar name overridable");
  bar.setAttribute("aria-label", "App");
  await tick();
  ok(bar.querySelector(`.${MB}__bar`).getAttribute("aria-label") === "App", "aria-label attribute wins over LABELS");
}
{
  const bar = await mount({ orientation: "vertical" });
  ok(bar.querySelector(`.${MB}__bar`).getAttribute("aria-orientation") === "vertical", "vertical: aria-orientation reflects");
  ok(bar.querySelector(`.${MB}__bar`).classList.contains(`${MB}__bar--vertical`), "vertical: --vertical modifier");
}
{
  const bar = await mount();
  bar.setAttribute("disabled", "");
  await tick();
  ok(bar.disabled === true && triggers(bar).every((n) => n.disabled), "disabled attribute: reflects into the property and every trigger");
  triggers(bar)[0].click();
  ok(popup() === null && bar.openIndex === -1, "disabled: clicking a trigger does not open");
}
{
  const ICON = '<svg viewBox="0 0 16 16"><path d="M0 0h16v16H0z"/></svg>';
  const withIcons = [{ label: "One", icon: ICON, items: [{ label: "x", value: "x" }] }, { label: "Two", items: [{ label: "y", value: "y" }] }];
  const bar = await mount({ menus: withIcons });
  ok(triggers(bar)[0].querySelector(`.${MB}__icon svg`) !== null, "trigger icon: trusted SVG markup mounted in its own slot");
  ok(triggers(bar)[1].querySelector(`.${MB}__icon`) === null, "horizontal bar: a title without an icon gets no empty slot (no stray gap)");
  const vbar = await mount({ menus: withIcons, orientation: "vertical" });
  const empty = triggers(vbar)[1].querySelector(`.${MB}__icon`);
  ok(empty !== null && empty.childNodes.length === 0, "vertical bar: titles reserve the icon slot so labels line up");
}

// ============================================================== open / close
{
  const bar = await mount();
  const events = [];
  bar.addEventListener("openchange", (e) => events.push(["openchange", e.detail.open, e.detail.index]));
  bar.addEventListener("select", (e) => events.push(["select", e.detail.value, e.detail.index]));
  const t = triggers(bar);

  t[0].click();
  await tick();
  ok(popup() !== null && bar.openIndex === 0, "click: opens the first menu");
  ok(t[0].getAttribute("aria-expanded") === "true", "open: trigger reports expanded");
  ok(popupItems()[0].querySelector(`.${M}__shortcut`).textContent === "⌘N", "open: the dropdown is a full menu() (shortcut hints, separators, submenus)");
  ok(events[0][0] === "openchange" && events[0][1] === true && events[0][2] === 0, "open: openchange{open:true,index} fired");

  popupItems()[0].click();
  await tick();
  ok(popup() === null && bar.openIndex === -1, "pick: the menu closes");
  ok(t[0].getAttribute("aria-expanded") === "false", "pick: trigger back to collapsed");
  ok(events.some((e) => e[0] === "select" && e[1] === "new" && e[2] === 0), "pick: select{value,index} emitted");
  ok(events[events.length - 1][0] === "openchange" && events[events.length - 1][1] === false, "pick: openchange{open:false} emitted");
}
{
  const bar = await mount();
  const t = triggers(bar);
  t[0].click(); await tick();
  t[0].click(); await tick();
  ok(popup() === null && bar.openIndex === -1, "click on the open menu's own trigger: toggles it closed");
  t[1].click(); await tick();
  ok(popup() !== null && bar.openIndex === 1, "click another trigger: opens that menu");
  ok(triggers(bar)[0].getAttribute("aria-expanded") === "false" && triggers(bar)[1].getAttribute("aria-expanded") === "true", "switch: only one trigger is expanded");
  ok(popupItems()[0].textContent.includes("Undo"), "switch: the new menu's items are shown");
  bar.close(); await tick();
  ok(popup() === null, "close(): closes the open menu");
}
{
  const bar = await mount();
  triggers(bar)[2].click(); await tick();
  ok(popup() === null, "disabled menu: clicking its trigger does nothing");
}
{
  const bar = await mount();
  bar.openIndex = 1;                       // set the property directly
  await tick();
  ok(popup() !== null && triggers(bar)[1].getAttribute("aria-expanded") === "true", "openIndex property: setting it opens that menu");
  bar.openIndex = -1;
  await tick();
  ok(popup() === null, "openIndex = -1: closes");
}
{
  const bar = await mount();
  bar.open(0); await tick();
  ok(popup() !== null, "open(index): opens programmatically");
  bar.remove(); await tick();
  ok(popup() === null, "disconnect: the open menu is torn down with the bar");
}

// ============================================================ hover to switch
{
  const bar = await mount();
  const t = triggers(bar);
  t[3].dispatchEvent(new w.Event("pointerenter"));
  await tick();
  ok(popup() === null, "hover with nothing open: does NOT open a menu");
  t[0].click(); await tick();
  t[3].dispatchEvent(new w.Event("pointerenter"));
  await tick();
  ok(bar.openIndex === 3 && popupItems()[0].textContent.includes("Sidebar"), "hover while open: switches to the hovered menu");
}

// ================================================================= keyboard
{
  const bar = await mount();
  const t = triggers(bar);
  t[0].focus();
  key(t[0], "ArrowRight"); await tick();
  ok(document.activeElement === triggers(bar)[1], "ArrowRight: moves to the next menu title");
  key(triggers(bar)[1], "ArrowRight"); await tick();
  ok(document.activeElement === triggers(bar)[3], "ArrowRight: skips a disabled menu");
  key(triggers(bar)[3], "ArrowRight"); await tick();
  ok(document.activeElement === triggers(bar)[0], "ArrowRight: wraps to the first");
  key(triggers(bar)[0], "ArrowLeft"); await tick();
  ok(document.activeElement === triggers(bar)[3], "ArrowLeft: wraps backwards");
  key(triggers(bar)[3], "Home"); await tick();
  ok(document.activeElement === triggers(bar)[0], "Home: first menu title");
  key(triggers(bar)[0], "End"); await tick();
  ok(document.activeElement === triggers(bar)[3], "End: last enabled menu title");
  ok(triggers(bar)[3].tabIndex === 0 && triggers(bar)[0].tabIndex === -1, "roving tabindex follows the focused title");
}
{
  const bar = await mount();
  const t = triggers(bar);
  key(t[0], "ArrowDown"); await tick();
  ok(popup() !== null && bar.openIndex === 0, "ArrowDown on a title: opens its menu");
  ok(document.activeElement === popupItems()[0], "ArrowDown: focus moves into the menu's first item");
}
{
  const bar = await mount();
  key(triggers(bar)[1], "Enter"); await tick();
  ok(bar.openIndex === 1, "Enter on a title: opens its menu");
  key(document, "Escape"); await tick();
  ok(popup() === null && bar.openIndex === -1, "Escape: closes the menu");
  ok(document.activeElement === triggers(bar)[1], "Escape: focus returns to the menu's title");
}
{
  const bar = await mount({ orientation: "vertical" });
  const t = triggers(bar);
  t[0].focus();
  key(t[0], "ArrowDown"); await tick();
  ok(document.activeElement === triggers(bar)[1], "vertical: ArrowDown moves along the bar");
  key(triggers(bar)[1], "ArrowRight"); await tick();
  ok(bar.openIndex === 1, "vertical: ArrowRight opens the menu");
}

// =============================== walking between menus while one is open (APG)
{
  const bar = await mount();
  triggers(bar)[0].click(); await tick();
  key(document, "ArrowRight"); await tick();
  ok(bar.openIndex === 1 && popupItems()[0].textContent.includes("Undo"), "ArrowRight inside an open menu: opens the next menu in the bar");
  ok(document.activeElement === popupItems()[0], "walk: focus lands on the new menu's first item");
  key(document, "ArrowLeft"); await tick();
  ok(bar.openIndex === 0, "ArrowLeft inside an open menu: back to the previous menu");
  key(document, "ArrowLeft"); await tick();
  ok(bar.openIndex === 3, "walk: wraps around, skipping the disabled menu");
  bar.close(); await tick();
}
{
  const bar = await mount();
  triggers(bar)[0].click(); await tick();
  const subTrigger = popupItems().find((n) => n.getAttribute("aria-haspopup") === "menu");
  subTrigger.focus();
  key(document, "ArrowRight"); await tick();
  ok(bar.openIndex === 0 && popup().querySelector(`.${M}--submenu`) !== null, "ArrowRight on a submenu item: opens the SUBMENU, not the next bar menu");
  key(document, "ArrowLeft"); await tick();
  ok(bar.openIndex === 0 && popup().querySelector(`.${M}--submenu`) === null, "ArrowLeft in a submenu: leaves the submenu, keeps the bar menu open");
  bar.close(); await tick();
}

console.log(`\n${MB}: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
