// Tests for ../src/menu.js — the anchored dropdown / action menu in jsdom. jsdom has
// no Popover API, so the module's fallback path (fixed + high z-index + outside
// pointerdown) is what runs here; top-layer painting and light-dismiss are verified in
// a real browser (test/gallery.html → Overlay/Menu). Everything else — structure, ARIA
// roles, the reserved icon/indicator gutters, groups, checkbox & radio items, submenus,
// the full keyboard map, typeahead, href hardening, and the resolved value — is
// exercised here against a real DOM.
import { JSDOM } from "jsdom";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };

function install() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const w = dom.window;
  for (const k of ["window", "document", "HTMLElement", "Node", "Event", "MouseEvent", "KeyboardEvent", "requestAnimationFrame", "cancelAnimationFrame"]) global[k] = w[k];
  return w;
}

const w = install();
const { menu } = await import("../src/menu.js");

const B = "puredashboard-menu";
const roots = () => [...document.body.querySelectorAll(`:scope > .${B}`)];
const root = () => roots()[roots().length - 1];
const items = (el = root()) => [...el.querySelectorAll(`.js-${B}__item`)].filter((n) => n.closest(`.${B}`) === el);
const labelOf = (n) => n.querySelector(`.${B}__label`).textContent;
const anchorEl = () => {
  const b = document.createElement("button");
  b.textContent = "Actions";
  document.body.append(b);
  return b;
};
const key = (k) => document.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
const hover = (n) => n.dispatchEvent(new w.Event("pointerenter"));
const ICON = '<svg viewBox="0 0 16 16"><path d="M0 0h16v16H0z"/></svg>';

// =========================================================== structure + a11y
{
  const a = anchorEl();
  const p = menu(a, [
    { label: "Edit", value: "edit" },
    { separator: true },
    { label: "Delete", value: "delete", danger: true },
  ]);
  const m = root();
  ok(m && m.getAttribute("role") === "menu", "root: role=menu, appended to body");
  ok(a.getAttribute("aria-haspopup") === "menu" && a.getAttribute("aria-expanded") === "true", "anchor: aria-haspopup/aria-expanded while open");
  ok(items().length === 2 && items().every((n) => n.getAttribute("role") === "menuitem"), "items: role=menuitem");
  ok(m.querySelector(`.${B}__separator`).getAttribute("role") === "separator", "separator: role=separator");
  ok(items()[1].classList.contains(`${B}__item--danger`), "danger item: --danger modifier");
  ok(document.activeElement === items()[0], "open: first item is focused");
  ok(items()[0].tabIndex === -1, "items: roving tabindex (-1)");
  items()[1].click();
  ok((await p) === "delete", "click: resolves with the item value");
  ok(roots().length === 0, "click: popup removed from the DOM");
  ok(!a.hasAttribute("aria-expanded") && !a.hasAttribute("aria-haspopup"), "close: anchor aria cleaned up");
  ok(document.activeElement === a, "close: focus returns to the anchor");
}

// =============================================== labels are text, never markup
{
  const p = menu(anchorEl(), [{ label: "<img src=x onerror=alert(1)>", value: "x" }]);
  ok(items()[0].querySelector("img") === null && labelOf(items()[0]) === "<img src=x onerror=alert(1)>", "label: inserted as text, not markup");
  p.close();
  await p;
}

// ============================================ icon + indicator gutters align
{
  const p = menu(anchorEl(), [
    { label: "With icon", value: "a", icon: ICON },
    { label: "No icon", value: "b" },
  ]);
  const m = root();
  ok(m.classList.contains(`${B}--icons`), "icons: menu gets the --icons modifier when any item has one");
  ok(!m.classList.contains(`${B}--indicators`), "icons: no indicator gutter without checkable items");
  const [withIcon, without] = items();
  ok(withIcon.querySelector(`.${B}__icon svg`) !== null, "icon: SVG markup mounted in the icon slot");
  ok(without.querySelector(`.${B}__icon`) !== null && without.querySelector(`.${B}__icon`).childNodes.length === 0,
    "icon gutter: item without an icon still reserves the empty slot (labels line up)");
  p.close();
  await p;
}
{
  const p = menu(anchorEl(), [
    { label: "Sidebar", checked: true, icon: ICON },
    { label: "Plain", value: "p" },
  ]);
  const m = root();
  ok(m.classList.contains(`${B}--indicators`) && m.classList.contains(`${B}--icons`), "checkable + icon: both gutters enabled");
  const [check, plain] = items();
  ok(check.querySelector(`.${B}__indicator svg`) !== null && check.querySelector(`.${B}__icon svg`) !== null,
    "checkable item: indicator and icon occupy separate slots");
  ok(plain.querySelector(`.${B}__indicator`).childNodes.length === 0, "indicator gutter: plain item reserves an empty slot");
  ok([...check.children].map((c) => c.className).join(",") === `${B}__indicator,${B}__icon,${B}__label`, "item order: indicator, icon, label");
  p.close();
  await p;
}

// ============================================================ shortcut + link
{
  const p = menu(anchorEl(), [
    { label: "Open", href: "#/nodes/web", value: "open" },
    { label: "Rename", value: "rename", shortcut: "F2" },
    { label: "Bad", href: "javascript:alert(1)", value: "bad" },
  ]);
  const its = items();
  ok(its[0].tagName === "A" && its[0].getAttribute("href") === "#/nodes/web", "link item: a real <a href>");
  ok(its[1].querySelector(`.${B}__shortcut`).textContent === "F2", "shortcut: rendered in the trailing slot");
  ok(its[2].getAttribute("href") === "#", "href: javascript: scheme neutralised");
  p.close();
  ok((await p) === null, "close(): dismissed resolves null");
}

// ================================================================== groups
{
  const p = menu(anchorEl(), [
    { group: "Danger zone", items: [{ label: "Delete", value: "del" }] },
  ]);
  const g = root().querySelector(`.${B}__group`);
  const lbl = g.querySelector(`.${B}__group-label`);
  ok(g.getAttribute("role") === "group", "group: role=group");
  ok(lbl.textContent === "Danger zone" && g.getAttribute("aria-labelledby") === lbl.id && !!lbl.id, "group: aria-labelledby points at the label");
  ok(items()[0].getAttribute("role") === "menuitem", "group: nested items are menu items of the level");
  p.close();
  await p;
}

// ========================================================== checkbox items
{
  const seen = [];
  const item = { label: "Show sidebar", checked: false, onSelect: (it, checked) => seen.push(checked) };
  const p = menu(anchorEl(), [item, { label: "Close", value: "close" }]);
  const cb = items()[0];
  ok(cb.getAttribute("role") === "menuitemcheckbox" && cb.getAttribute("aria-checked") === "false", "checkbox: role + aria-checked=false");
  cb.click();
  ok(cb.getAttribute("aria-checked") === "true" && item.checked === true, "checkbox: click toggles aria-checked and the item state");
  ok(seen.length === 1 && seen[0] === true, "checkbox: onSelect(item, checked) fired with the new state");
  ok(roots().length === 1, "checkbox: menu stays open (closeOnSelect defaults false)");
  cb.click();
  ok(cb.getAttribute("aria-checked") === "false" && seen[1] === false, "checkbox: second click toggles back");
  items()[1].click();
  ok((await p) === "close", "checkbox: a plain item still closes the menu");
}
{
  const p = menu(anchorEl(), [{ label: "One-shot", checked: false, closeOnSelect: true, value: "cb" }]);
  items()[0].click();
  ok((await p) === "cb", "checkbox: closeOnSelect:true closes and resolves with the value");
}

// ============================================================= radio groups
{
  const picked = [];
  const grp = { group: "Sort by", radio: "name", onSelect: (v) => picked.push(v), items: [
    { label: "Name", value: "name" }, { label: "Date", value: "date" },
  ] };
  const p = menu(anchorEl(), [grp]);
  const its = items();
  ok(its.every((n) => n.getAttribute("role") === "menuitemradio"), "radio: items get role=menuitemradio");
  ok(its[0].getAttribute("aria-checked") === "true" && its[1].getAttribute("aria-checked") === "false", "radio: the item matching group.radio is checked");
  its[1].click();
  ok(its[0].getAttribute("aria-checked") === "false" && its[1].getAttribute("aria-checked") === "true", "radio: click moves the checkmark");
  ok(picked.join() === "date" && grp.radio === "date", "radio: group onSelect(value) fired and the group value updated");
  ok(roots().length === 1, "radio: menu stays open by default");
  p.close();
  await p;
}

// ================================================================ keyboard
{
  const p = menu(anchorEl(), [
    { label: "Alpha", value: "a" },
    { label: "Blocked", value: "x", disabled: true },
    { label: "Beta", value: "b" },
    { label: "Gamma", value: "c" },
  ]);
  const its = items();
  ok(its[1].getAttribute("aria-disabled") === "true", "disabled: aria-disabled set");
  ok(document.activeElement === its[0], "keyboard: opens focused on the first item");
  key("ArrowDown");
  ok(document.activeElement === its[2], "ArrowDown: skips the disabled item");
  key("End");
  ok(document.activeElement === its[3], "End: focuses the last enabled item");
  key("ArrowDown");
  ok(document.activeElement === its[0], "ArrowDown: wraps to the first item");
  key("ArrowUp");
  ok(document.activeElement === its[3], "ArrowUp: wraps to the last item");
  key("Home");
  ok(document.activeElement === its[0], "Home: focuses the first item");
  key("g");
  ok(document.activeElement === its[3], "typeahead: jumps to the item starting with the typed letter");
  key("Enter");
  ok((await p) === "c", "Enter: activates the focused item");
}
{
  const p = menu(anchorEl(), [{ label: "A", value: "a" }]);
  key("Escape");
  ok((await p) === null && roots().length === 0, "Escape: closes and resolves null");
}
{
  const p = menu(anchorEl(), [{ label: "A", value: "a" }]);
  key("Tab");
  ok((await p) === null, "Tab: closes the menu");
}
{
  const a = anchorEl();
  const p = menu(a, [{ label: "A", value: "a" }]);
  document.dispatchEvent(new w.Event("pointerdown", { bubbles: true }));
  ok((await p) === null && roots().length === 0, "outside pointerdown: light-dismiss fallback closes");
}

// ================================================================= submenus
{
  const p = menu(anchorEl(), [
    { label: "Share", items: [{ label: "Copy link", value: "copy" }, { label: "Email", value: "mail" }] },
    { label: "Delete", value: "del" },
  ]);
  const trigger = items()[0];
  ok(trigger.getAttribute("aria-haspopup") === "menu" && trigger.getAttribute("aria-expanded") === "false", "submenu trigger: aria-haspopup + collapsed");
  ok(trigger.querySelector(`.${B}__chevron svg`) !== null, "submenu trigger: chevron rendered");
  ok(items().length === 2, "level items: only the level's own items are counted");

  trigger.click();
  const sub = root().querySelector(`.${B}--submenu`);
  ok(sub && sub.getAttribute("role") === "menu", "submenu: opens as a nested popup inside the parent (Popover nesting)");
  ok(sub.getAttribute("aria-label") === "Share submenu", "submenu: labelled from LABELS.submenu(label)");
  ok(trigger.getAttribute("aria-expanded") === "true", "submenu: trigger reports expanded");
  ok(items(sub).length === 2 && items().length === 2, "submenu: parent level item list unaffected");

  key("Escape");
  ok(root().querySelector(`.${B}--submenu`) === null && roots().length === 1, "Escape in a submenu: closes only that level");
  ok(document.activeElement === trigger, "Escape in a submenu: focus returns to its trigger");

  key("ArrowRight");
  const sub2 = root().querySelector(`.${B}--submenu`);
  ok(sub2 !== null && document.activeElement === items(sub2)[0], "ArrowRight: opens the submenu and focuses its first item");
  key("ArrowDown");
  ok(document.activeElement === items(sub2)[1], "submenu: arrow keys navigate the deepest level");
  key("ArrowLeft");
  ok(root().querySelector(`.${B}--submenu`) === null && document.activeElement === trigger, "ArrowLeft: leaves the submenu");

  key("Enter");
  const sub3 = root().querySelector(`.${B}--submenu`);
  ok(sub3 !== null && document.activeElement === items(sub3)[0], "Enter on a submenu trigger: opens and steps in");
  items(sub3)[0].click();
  ok((await p) === "copy", "submenu: picking an item resolves the root promise");
  ok(roots().length === 0, "submenu: the whole menu is torn down");
}
{
  const p = menu(anchorEl(), [
    { label: "Share", items: [{ label: "Copy link", value: "copy" }] },
    { label: "Delete", value: "del" },
  ]);
  const [trigger, plain] = items();
  trigger.click();
  ok(root().querySelector(`.${B}--submenu`) !== null, "submenu: open before hovering away");
  hover(plain);
  ok(root().querySelector(`.${B}--submenu`) === null, "hovering a sibling item closes the open submenu");
  p.close();
  await p;
}

// ================================================= controller on the promise
{
  const p = menu(anchorEl(), [{ label: "A", value: "a" }]);
  ok(p.el === root() && typeof p.close === "function", "promise: carries .el and .close() so a caller can drive it");
  p.close("forced");
  ok((await p) === "forced", "close(value): resolves with the forced value");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
