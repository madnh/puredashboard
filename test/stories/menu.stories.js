import { el, hstack } from "./_util.js";
import { menu } from "../../src/menu.js";

// menu() is an IMPERATIVE overlay (a function, not a custom element), so each story
// renders a trigger button you click to open the menu in the top layer.

// Anchor the menu on the INNER native <button> (the component's documented `js-` hook):
// that's the element that actually takes focus and carries aria-haspopup/aria-expanded.
const inner = (host) => host.querySelector(".js-puredashboard-button__el") || host;

const trigger = (label, onClick) => {
  const b = el("puredashboard-button", { variant: "default" }, [document.createTextNode(label)]);
  b.addEventListener("click", (e) => onClick(inner(e.currentTarget)));
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
const ICON_MOVE = svg('<path d="M2.5 5.5V4a1 1 0 0 1 1-1h2.2l1 1.5h4.8a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1z"/>');
const ICON_DOWNLOAD = svg('<path d="M8 2.5v7M5.5 7.5 8 10l2.5-2.5M3 12.5h10"/>');
// The two "collapse the rest in here" triggers: a kebab (⋯) for an item's own overflow
// actions, and a hamburger (☰) for a whole navigation / command set.
const ICON_KEBAB = svg('<circle cx="8" cy="3.2" r="1.3" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none"/><circle cx="8" cy="12.8" r="1.3" fill="currentColor" stroke="none"/>');
const ICON_BURGER = svg('<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/>');
const ICON_USER = svg('<circle cx="8" cy="5.5" r="2.5"/><path d="M3 13.5a5 5 0 0 1 10 0"/>');
const ICON_GEAR = svg('<circle cx="8" cy="8" r="2.2"/><path d="M8 1.8v1.6M8 12.6v1.6M14.2 8h-1.6M3.4 8H1.8M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1M12.4 12.4l-1.1-1.1M4.7 4.7 3.6 3.6"/>');

const log = (msg) => (v) => console.log(msg, v);

// An icon-only trigger has no visible text, so it MUST carry an accessible name —
// aria-label (a plain string, read by screen readers) on the button itself.
const iconTrigger = (icon, ariaLabel, onClick) => {
  const b = el("puredashboard-button", { variant: "text", shape: "circle", size: "sm", icon, "aria-label": ariaLabel });
  b.addEventListener("click", (e) => onClick(inner(e.currentTarget)));
  return b;
};

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

    // ---- the "keep the UI tidy" pattern: show the 1–2 common actions, collapse the
    // rest behind one icon trigger. Kebab = actions for THIS row; hamburger = the whole
    // navigation / command set (typically on narrow screens).
    { name: "Kebab (⋯) — overflow row actions", notes: "one or two frequent actions stay visible; the rare ones fold into ⋯ (placement bottom-end so it hugs the edge)", render: () => {
      const rowActions = (name) => [
        { label: "Open logs", href: "#/nodes/" + name + "/logs", icon: ICON_OPEN },
        { label: "Duplicate", value: "dup", icon: ICON_COPY, shortcut: "⌘D" },
        { label: "Move to…", value: "move", icon: ICON_MOVE },
        { label: "Download config", value: "download", icon: ICON_DOWNLOAD },
        { separator: true },
        { label: "Delete", value: "delete", icon: ICON_TRASH, danger: true },
      ];
      const row = (name, meta) => {
        const info = el("div", { style: "display:grid;gap:2px;flex:1;min-width:0" }, [
          el("div", { style: "font-weight:600", textContent: name }),
          el("div", { style: "font-size:12px;color:var(--muted)", textContent: meta }),
        ]);
        const restart = el("puredashboard-button", { size: "sm" }, [document.createTextNode("Restart")]);
        const more = iconTrigger(ICON_KEBAB, "More actions for " + name, (btn) =>
          menu(btn, rowActions(name), { placement: "bottom-end" }).then(log("row action:")));
        return el("div", { style: "display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--border);border-radius:10px" }, [info, restart, more]);
      };
      return el("div", { style: "display:grid;gap:8px;min-width:420px" }, [
        row("api-gateway", "us-east-1 · healthy"),
        row("billing-cron", "eu-west-1 · degraded"),
      ]);
    } },

    { name: "Hamburger (☰) — collapsed nav", notes: "everything folds into one button when there's no room for a bar: links, a submenu, settings", render: () => {
      const items = [
        { label: "Dashboard", href: "#/", icon: ICON_OPEN },
        { label: "Services", href: "#/services", icon: ICON_SHARE },
        { label: "Reports", icon: ICON_DOWNLOAD, items: [
          { label: "Usage", href: "#/reports/usage" },
          { label: "Billing", href: "#/reports/billing" },
        ] },
        { separator: true },
        { group: "Account", items: [
          { label: "Profile", href: "#/me", icon: ICON_USER },
          { label: "Settings", value: "settings", icon: ICON_GEAR, shortcut: "⌘," },
        ] },
        { separator: true },
        { label: "Sign out", value: "signout", danger: true },
      ];
      const bar = el("div", { style: "display:flex;align-items:center;gap:10px;min-width:320px;padding:8px 10px;border:1px solid var(--border);border-radius:10px" });
      bar.append(
        iconTrigger(ICON_BURGER, "Open navigation", (btn) => menu(btn, items).then(log("nav picked:"))),
        el("div", { style: "font-weight:600", textContent: "PureDashboard" }),
        el("div", { style: "flex:1" }),
        iconTrigger(ICON_KEBAB, "More", (btn) => menu(btn, [
          { label: "Refresh", value: "refresh", shortcut: "R" },
          { label: "Keyboard shortcuts", value: "keys", shortcut: "?" },
          { separator: true },
          { label: "Help", href: "#/help" },
        ], { placement: "bottom-end" }).then(log("more picked:"))),
      );
      return bar;
    } },

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
