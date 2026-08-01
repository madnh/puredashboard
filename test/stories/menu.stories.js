import { el, hstack } from "./_util.js";
import { menu } from "../../src/menu.js";

// menu() is an IMPERATIVE overlay (a function, not a custom element), so each story
// renders a trigger button you click to open the menu in the top layer.

const trigger = (label, onClick) => {
  const b = el("puredashboard-button", { variant: "default" }, [document.createTextNode(label)]);
  b.addEventListener("click", (e) => onClick(e.currentTarget));
  return b;
};

// Icons are TRUSTED author config — inline SVG markup strings (or DOM nodes). Every
// item in a menu reserves the same leading slot, so labels line up even when only
// SOME items carry an icon.
const svg = (path) =>
  `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="overflow:visible">${path}</svg>`;
const ICON_PENCIL = svg('<path d="M11.5 2.5 13.5 4.5 5.5 12.5 2.5 13.5 3.5 10.5z"/>');
const ICON_COPY = svg('<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 3.5h-7a1 1 0 0 0-1 1v7"/>');
const ICON_SHARE = svg('<circle cx="12" cy="4" r="2"/><circle cx="4" cy="8" r="2"/><circle cx="12" cy="12" r="2"/><path d="M5.8 7 10.2 5M5.8 9l4.4 2"/>');
const ICON_TRASH = svg('<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5"/>');
const ICON_OPEN = svg('<path d="M9 3.5h3.5V7M12.5 3.5 7 9M11 9.5v3h-8v-8h3"/>');

const log = (msg) => (v) => console.log(msg, v);

export default {
  tag: "menu",
  title: "Overlay/Menu",
  stories: [
    { name: "Actions", notes: "icons + shortcut hints + a danger action; resolves with the picked value", render: () =>
      trigger("Row actions ▾", (btn) => menu(btn, [
        { label: "Open", href: "#/nodes/web", icon: ICON_OPEN },
        { label: "Rename", value: "rename", icon: ICON_PENCIL, shortcut: "F2" },
        { label: "Duplicate", value: "dup", icon: ICON_COPY, shortcut: "⌘D" },
        { separator: true },
        { label: "Delete", value: "delete", icon: ICON_TRASH, danger: true, shortcut: "⌫" },
      ]).then(log("menu picked:"))) },

    { name: "Mixed icons", notes: "items without an icon still reserve the gutter, so every label lines up", render: () =>
      trigger("Mixed ▾", (btn) => menu(btn, [
        { label: "Edit", value: "edit", icon: ICON_PENCIL },
        { label: "Move to…", value: "move" },
        { label: "Share", value: "share", icon: ICON_SHARE },
        { label: "Archive", value: "archive" },
      ]).then(log("menu picked:"))) },

    { name: "Groups, checkbox & radio", notes: "labelled groups; checkable items keep the menu open (indicator gutter)", render: () =>
      trigger("View ▾", (btn) => menu(btn, [
        { group: "Columns", items: [
          { label: "Status", checked: true, onSelect: (it, c) => console.log("status:", c) },
          { label: "Region", checked: true, onSelect: (it, c) => console.log("region:", c) },
          { label: "Owner", checked: false, onSelect: (it, c) => console.log("owner:", c) },
        ] },
        { separator: true },
        { group: "Sort by", radio: "name", onSelect: log("sort:"), items: [
          { label: "Name", value: "name" },
          { label: "Created", value: "created" },
          { label: "Size", value: "size" },
        ] },
      ]).then(log("menu closed:"))) },

    { name: "Submenus", notes: "nested levels: hover or ArrowRight to open, ArrowLeft / Esc to leave", render: () =>
      trigger("File ▾", (btn) => menu(btn, [
        { label: "New file", value: "new", shortcut: "⌘N" },
        { label: "Share", icon: ICON_SHARE, items: [
          { label: "Copy link", value: "copy", icon: ICON_COPY },
          { label: "Email", value: "email" },
          { label: "Export as", items: [
            { label: "JSON", value: "json" },
            { label: "CSV", value: "csv" },
          ] },
        ] },
        { separator: true },
        { label: "Delete", value: "delete", icon: ICON_TRASH, danger: true },
      ]).then(log("menu picked:"))) },

    { name: "Disabled & placement", notes: "disabled items are skipped by the keyboard; placement aligns the popup", render: () =>
      hstack([
        trigger("bottom-start ▾", (btn) => menu(btn, [
          { label: "Restart", value: "restart" },
          { label: "Scale (no permission)", value: "scale", disabled: true },
          { label: "Logs", value: "logs" },
        ]).then(log("menu picked:"))),
        trigger("bottom-end ▾", (btn) => menu(btn, [
          { label: "Restart", value: "restart" },
          { label: "Logs", value: "logs" },
        ], { placement: "bottom-end" }).then(log("menu picked:"))),
      ]) },
  ],
};
