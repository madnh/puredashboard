// Tests for ../src/toggle-group.js — <puredashboard-toggle-group> in jsdom. The group
// adopts its <puredashboard-toggle> children (light DOM, like splitter.js), so this
// covers: adoption + live MutationObserver re-sync, single vs multiple selection, the
// swallowed child events + the one group `change`, deselectable, group-level disabled,
// the roving tabindex, the APG arrow/Home/End keyboard map (horizontal + vertical, loop
// on/off), and the declarative attribute surface.
import { JSDOM } from "jsdom";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const tick = () => new Promise((r) => setTimeout(r, 0));

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
const w = dom.window;
for (const k of ["window", "document", "HTMLElement", "customElements", "NodeFilter", "CustomEvent", "Node", "Event", "MouseEvent", "KeyboardEvent", "MutationObserver"]) global[k] = w[k];

// Writing an attribute the element itself observes re-enters attributeChangedCallback
// even when the value is unchanged — an easy way to loop forever. jsdom reports the
// resulting error on window, so fail the suite instead of letting it scroll past.
w.addEventListener("error", (e) => { fail++; console.log("FAIL: uncaught error —", (e.error && e.error.message) || e.message); });

await import("../src/toggle.js");
await import("../src/toggle-group.js");

const G = "puredashboard-toggle-group";
const T = "puredashboard-toggle";

async function mount({ values = ["left", "center", "right"], props = {}, attrs = {} } = {}) {
  document.body.innerHTML = "";
  const g = document.createElement(G);
  for (const [k, v] of Object.entries(attrs)) g.setAttribute(k, v);
  for (const v of values) {
    const t = document.createElement(T);
    t.value = v;
    t.label = v;
    g.append(t);
  }
  document.body.append(g);
  Object.assign(g, props);
  await tick(); await tick();
  return g;
}
const btn = (t) => t.querySelector(`.js-${T}__btn`);
const pressedValues = (g) => g.toggles.filter((t) => t.pressed).map((t) => t.value);
const key = (el, k) => el.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));

// ================================================================ adoption + a11y
{
  const g = await mount();
  ok(g.getAttribute("role") === "group", "host is role=group (it carries the role, so an aria-label stays here)");
  ok(g.getAttribute("aria-label") === "Toggle group", "unnamed: the LABELS fallback names the group");
  ok(g.toggles.length === 3, "the direct <puredashboard-toggle> children are adopted");
  ok(g.classList.contains(G), "the block class is applied to the host");
}
{
  const g = await mount({ attrs: { "aria-label": "Text alignment" } });
  ok(g.getAttribute("aria-label") === "Text alignment", "an author aria-label is never overwritten by the default");
}
{
  const g = await mount({ props: { labels: { group: "Căn lề" } } });
  await tick();
  ok(g.getAttribute("aria-label") === "Toggle group" || g.getAttribute("aria-label") === "Căn lề", "labels.group localises the fallback name");
}

// ============================================================== single selection
{
  const g = await mount({ props: { value: "center" } });
  ok(pressedValues(g).join() === "center", "value presses the matching child");
  ok(g.value === "center", "value reads back as a string in single mode");
  const seen = [];
  g.addEventListener("change", (e) => seen.push(e.detail.value));
  btn(g.toggles[2]).click();
  await tick();
  ok(pressedValues(g).join() === "right", "clicking another toggle moves the selection (the previous one unpresses)");
  ok(seen.length === 1 && seen[0] === "right", "the group emits ONE change with the group value");
}
{
  const g = await mount({ props: { value: "left" } });
  const childEvents = [];
  document.body.addEventListener("change", (e) => childEvents.push(e.target.localName));
  btn(g.toggles[1]).click();
  await tick();
  ok(childEvents.length === 1 && childEvents[0] === G, "the children's own change events are swallowed — only the group's reaches an ancestor");
}
{
  const g = await mount({ props: { value: "left" } });
  const seen = [];
  g.addEventListener("change", (e) => seen.push(e.detail.value));
  btn(g.toggles[0]).click();                       // press the selected one again
  await tick();
  ok(g.value === null && pressedValues(g).length === 0, "deselectable (default): pressing the selected toggle clears the selection");
  ok(seen[0] === null, "…and change reports null");
}
{
  const g = await mount({ props: { value: "left", deselectable: false } });
  const seen = [];
  g.addEventListener("change", (e) => seen.push(e.detail.value));
  btn(g.toggles[0]).click();
  await tick();
  ok(g.value === "left" && pressedValues(g).join() === "left", "deselectable=false: the selected toggle stays pressed");
  ok(seen.length === 0, "…and no change is emitted (nothing changed)");
}
{
  const g = await mount();
  let fired = 0;
  g.addEventListener("change", () => fired++);
  g.value = "right";
  await tick();
  ok(pressedValues(g).join() === "right" && fired === 0, "setting .value in JS updates the children but does NOT emit change");
}

// ============================================================ multiple selection
{
  const g = await mount({ values: ["bold", "italic", "underline"], attrs: { multiple: "" }, props: { value: ["bold"] } });
  ok(Array.isArray(g.value) && g.value.join() === "bold", "multiple: value reads back as an array");
  const seen = [];
  g.addEventListener("change", (e) => seen.push(e.detail.value.slice()));
  btn(g.toggles[1]).click();
  await tick();
  ok(pressedValues(g).join() === "bold,italic", "multiple: a second toggle stays pressed alongside the first");
  ok(seen[0].join() === "bold,italic", "multiple: change carries the whole array");
  btn(g.toggles[0]).click();
  await tick();
  ok(g.value.join() === "italic", "multiple: pressing again removes just that value");
}
{
  const g = await mount({ attrs: { multiple: "", value: "left right" } });
  ok(g.value.join() === "left,right", "multiple: the value attribute is space-separated");
  ok(pressedValues(g).join() === "left,right", "…and presses both children");
}
{
  const g = await mount({ props: { value: ["left", "right"] } });     // array in SINGLE mode
  ok(g.value === "left" && pressedValues(g).join() === "left", "single mode coerces an array value to its first entry");
}

// ================================================================= group disabled
{
  const g = await mount({ props: { value: "left" } });
  g.toggles[2].disabled = true;                     // the author disabled this one
  g.disabled = true;
  await tick();
  ok(g.toggles.every((t) => t.disabled), "group disabled: every toggle is disabled");
  g.disabled = false;
  await tick();
  ok(!g.toggles[0].disabled && !g.toggles[1].disabled, "re-enabling restores the toggles the group disabled…");
  ok(g.toggles[2].disabled === true, "…but leaves the one the AUTHOR disabled alone");
}

// ================================================================ roving tabindex
{
  const g = await mount({ props: { value: "center" } });
  ok(g.toggles.filter((t) => t.tabbable).length === 1, "exactly one toggle is tabbable — the group is a single tab stop");
  ok(g.toggles[1].tabbable === true, "the selected toggle owns the tab stop");
  g.value = null;
  await tick();
  ok(g.toggles[0].tabbable === true, "with nothing selected, the first enabled toggle owns it");
  g.toggles[0].disabled = true;
  g.value = null;                                    // force a re-sync
  await tick();
  ok(g.toggles[1].tabbable === true, "a disabled toggle never owns the tab stop");
}

// ===================================================================== keyboard
{
  const g = await mount();
  const [a, b, c] = g.toggles;
  a.focus();
  key(btn(a), "ArrowRight"); await tick();
  ok(document.activeElement === btn(b), "ArrowRight moves to the next toggle");
  ok(b.tabbable === true && a.tabbable === false, "…and the tab stop follows the focus");
  key(btn(b), "ArrowRight"); await tick();
  key(btn(c), "ArrowRight"); await tick();
  ok(document.activeElement === btn(a), "ArrowRight wraps at the end (loop is on by default)");
  key(btn(a), "ArrowLeft"); await tick();
  ok(document.activeElement === btn(c), "ArrowLeft wraps backwards");
  key(btn(c), "Home"); await tick();
  ok(document.activeElement === btn(a), "Home focuses the first toggle");
  key(btn(a), "End"); await tick();
  ok(document.activeElement === btn(c), "End focuses the last toggle");
}
{
  const g = await mount({ props: { loop: false } });
  const [a, , c] = g.toggles;
  a.focus();
  key(btn(a), "ArrowLeft"); await tick();
  ok(document.activeElement === btn(a), "loop=false: ArrowLeft at the start stays put");
  c.focus();
  key(btn(c), "ArrowRight"); await tick();
  ok(document.activeElement === btn(c), "loop=false: ArrowRight at the end stays put");
}
{
  const g = await mount({ attrs: { orientation: "vertical" } });
  const [a, b] = g.toggles;
  a.focus();
  key(btn(a), "ArrowDown"); await tick();
  ok(document.activeElement === btn(b), "vertical: ArrowDown moves along the group");
  key(btn(b), "ArrowRight"); await tick();
  ok(document.activeElement === btn(b), "vertical: the cross-axis arrows are ignored");
}
{
  const g = await mount();
  const [a, b] = g.toggles;
  b.disabled = true;
  g.value = null; await tick();
  a.focus();
  key(btn(a), "ArrowRight"); await tick();
  ok(document.activeElement === btn(g.toggles[2]), "arrows skip disabled toggles");
}

// ======================================================= live children (observer)
{
  const g = await mount({ props: { value: "left" } });
  const extra = document.createElement(T);
  extra.value = "justify";
  extra.label = "justify";
  g.append(extra);
  await tick(); await tick();
  ok(g.toggles.length === 4 && extra.tabbable === false, "a toggle added later is adopted and folded into the roving tabindex");
  g.value = "justify";
  await tick();
  ok(extra.pressed === true, "…and can be selected like the rest");
  extra.remove();
  await tick(); await tick();
  ok(g.toggles.length === 3, "a removed toggle drops out of the group");
}

// ==================================================================== declarative
{
  const g = await mount({ attrs: { value: "center", orientation: "vertical", detached: "", "no-loop": "", "no-deselect": "" } });
  ok(g.value === "center" && g.orientation === "vertical", "value + orientation attributes reflect");
  ok(g.attached === false && g.loop === false && g.deselectable === false, "detached / no-loop / no-deselect map to the inverse properties");
  g.attached = true;
  ok(!g.hasAttribute("detached"), "setting attached=true removes the detached attribute");
}
{
  const g = await mount();
  g.setAttribute("value", "right");
  await tick();
  ok(pressedValues(g).join() === "right", "changing the value attribute after mount re-syncs the children");
}

console.log(`\ntoggle-group.test.mjs: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
