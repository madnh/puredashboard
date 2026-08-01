import { el } from "./_util.js";
import { menu } from "../../src/menu.js";

// <puredashboard-menubar> is the horizontal parent of menu(): every dropdown is a full
// menu(), so items get icons in a reserved gutter, shortcut hints, separators, groups,
// checkbox / radio items and submenus for free.

const svg = (path) =>
  `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="overflow:visible">${path}</svg>`;
const ICON_FILE = svg('<path d="M9 1.5H4.5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V5z"/><path d="M9 1.5V5h3.5"/>');
const ICON_UNDO = svg('<path d="M3 8h7a3 3 0 0 1 0 6H7"/><path d="M5.5 5.5 3 8l2.5 2.5"/>');
const ICON_COPY = svg('<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 3.5h-7a1 1 0 0 0-1 1v7"/>');
const ICON_TRASH = svg('<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5"/>');
const ICON_HELP = svg('<circle cx="8" cy="8" r="6.5"/><path d="M6.4 6.2a1.6 1.6 0 1 1 1.9 1.7v1.1"/><path d="M8.3 11.6h.01"/>');

const APP_MENUS = () => [
  { label: "File", icon: ICON_FILE, items: [
    { label: "New file", value: "new", shortcut: "⌘N" },
    { label: "Open…", value: "open", shortcut: "⌘O" },
    { separator: true },
    { label: "Export as", items: [
      { label: "JSON", value: "export:json" },
      { label: "CSV", value: "export:csv" },
      { label: "More formats", items: [
        { label: "YAML", value: "export:yaml" },
        { label: "Parquet", value: "export:parquet" },
      ] },
    ] },
    { separator: true },
    { label: "Delete project", value: "delete", icon: ICON_TRASH, danger: true },
  ] },
  { label: "Edit", items: [
    { label: "Undo", value: "undo", icon: ICON_UNDO, shortcut: "⌘Z" },
    { label: "Redo", value: "redo", shortcut: "⇧⌘Z", disabled: true },
    { separator: true },
    { label: "Copy", value: "copy", icon: ICON_COPY, shortcut: "⌘C" },
    { label: "Paste", value: "paste", shortcut: "⌘V" },
  ] },
  { label: "View", items: [
    { group: "Panels", items: [
      { label: "Sidebar", checked: true, shortcut: "⌘B", onSelect: (it, on) => console.log("sidebar:", on) },
      { label: "Status bar", checked: false, onSelect: (it, on) => console.log("statusbar:", on) },
    ] },
    { separator: true },
    { group: "Density", radio: "cozy", onSelect: (v) => console.log("density:", v), items: [
      { label: "Compact", value: "compact" },
      { label: "Cozy", value: "cozy" },
    ] },
  ] },
  { label: "Help", icon: ICON_HELP, items: [
    { label: "Documentation", href: "#/docs" },
    { label: "Keyboard shortcuts", value: "shortcuts", shortcut: "?" },
  ] },
];

const bar = (props) => {
  const b = el("puredashboard-menubar", props);
  b.addEventListener("select", (e) => console.log("menubar select:", e.detail.value));
  return b;
};

export default {
  tag: "puredashboard-menubar",
  title: "Navigation/Menubar",
  stories: [
    { name: "Application bar", notes: "click a title, then hover the others to switch; ←/→ walk between open menus", render: () =>
      bar({ menus: APP_MENUS() }) },

    { name: "Disabled menu", notes: "a disabled title is skipped by the keyboard and can't open", render: () =>
      bar({ menus: [
        { label: "File", items: [{ label: "New", value: "new" }] },
        { label: "Deploy", disabled: true, items: [{ label: "Ship it", value: "ship" }] },
        { label: "Help", items: [{ label: "About", value: "about" }] },
      ] }) },

    { name: "Vertical", notes: "orientation=\"vertical\" — arrows follow the bar's axis, menus open beside it", render: () =>
      bar({ menus: APP_MENUS(), orientation: "vertical" }) },

    { name: "Whole bar disabled", notes: "disabled bar: nothing opens, one flat opacity", render: () =>
      bar({ menus: APP_MENUS(), disabled: true }) },

    // Narrow screens: the same `menus` array folds into ONE hamburger — each menu
    // becomes a submenu, so no item is lost and nothing new has to be authored.
    { name: "Collapsed into a hamburger", notes: "no room for a bar? map the same menus into one ☰ trigger — each title becomes a submenu", render: () => {
      const menus = APP_MENUS();
      const burger = el("puredashboard-button", {
        variant: "text", shape: "circle", size: "sm", "aria-label": "Open menu",
        icon: svg('<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/>'),
      });
      burger.addEventListener("click", (e) =>
        menu(e.currentTarget.querySelector(".js-puredashboard-button__el") || e.currentTarget, menus.map((m) => ({ label: m.label, icon: m.icon, disabled: m.disabled, items: m.items })))
          .then((v) => console.log("menubar (collapsed) select:", v)));
      return el("div", { style: "display:flex;align-items:center;gap:10px;width:280px;padding:8px 10px;border:1px solid var(--border);border-radius:10px" }, [
        burger, el("div", { style: "font-weight:600", textContent: "Editor" }),
      ]);
    } },
  ],
};
