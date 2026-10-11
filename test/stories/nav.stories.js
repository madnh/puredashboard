import { el, t } from "./_util.js";

// Inline 24px stroke icons (trusted author markup, like any nav `icon`).
const ic = (d) => `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {
  home: ic('<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>'),
  alert: ic('<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>'),
  nodes: ic('<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M6 6h.01M6 18h.01"/>'),
  folder: ic('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  settings: ic('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  more: ic('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),
  logo: ic('<path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>'),
  chevrons: ic('<path d="m7 15 5 5 5-5M7 9l5-5 5 5"/>'),
  menu: ic('<path d="M4 6h16M4 12h16M4 18h16"/>'),
};

// The items an app shell shows: two titled sections, a nested group, badges, row actions.
const appItems = () => [
  { heading: "Platform", children: [
    { label: "Dashboard", href: "#/", icon: I.home },
    { label: "Alerts", href: "#/alerts", icon: I.alert, badge: "3" },
    { label: "Nodes", icon: I.nodes, children: [
      { label: "Web", href: "#/nodes/web" },
      { label: "DB", href: "#/nodes/db", badge: "1" },
      { label: "Cache", href: "#/nodes/cache" },
    ] },
    { label: "Settings", href: "#/settings", icon: I.settings },
  ] },
  { heading: "Projects", collapsible: true, children: [
    { label: "Acme Store", href: "#/p/acme", icon: I.folder, action: { icon: I.more, label: "Acme Store: more" } },
    { label: "Internal tools", href: "#/p/tools", icon: I.folder, action: { icon: I.more, label: "Internal tools: more" } },
    { label: "Data pipeline", href: "#/p/data", icon: I.folder, action: { icon: I.more, label: "Data pipeline: more" } },
  ] },
];

// Sticky header: logo tile + brand text (hidden in the rail) — a workspace switcher's shell.
const brand = () => {
  const tile = el("span", { style: "display:grid;place-items:center;width:32px;height:32px;flex:none;border-radius:8px;background:var(--accent,#3b82f6);color:var(--accent-ink,#fff)" });
  tile.innerHTML = I.logo;
  const text = el("span", { className: "puredashboard-sider__expanded-only", style: "min-width:0;line-height:1.2" }, [
    el("strong", { style: "display:block;font-size:var(--font-size-md,13px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" }, [t("Acme Inc")]),
    el("span", { style: "display:block;font-size:var(--font-size-xs,11px);color:var(--muted,#99a0ad)" }, [t("Enterprise")]),
  ]);
  const chev = el("span", { className: "puredashboard-sider__expanded-only", style: "margin-inline-start:auto;color:var(--muted,#99a0ad);display:inline-flex" });
  chev.innerHTML = I.chevrons;
  return el("button", { type: "button", slot: "header", style: "display:flex;align-items:center;gap:8px;width:100%;padding:4px;margin:0;font:inherit;color:inherit;background:transparent;border:0;border-radius:8px;cursor:pointer;text-align:left" }, [tile, text, chev]);
};
// Sticky footer: avatar + name/email (hidden in the rail).
const user = () => el("button", { type: "button", slot: "footer", style: "display:flex;align-items:center;gap:8px;width:100%;padding:4px;margin:0;font:inherit;color:inherit;background:transparent;border:0;border-radius:8px;cursor:pointer;text-align:left" }, [
  el("puredashboard-avatar", { name: "Mạnh Đỗ", size: "sm", decorative: true }),
  el("span", { className: "puredashboard-sider__expanded-only", style: "min-width:0;line-height:1.2" }, [
    el("strong", { style: "display:block;font-size:var(--font-size-md,13px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" }, [t("Mạnh Đỗ")]),
    el("span", { style: "display:block;font-size:var(--font-size-xs,11px);color:var(--muted,#99a0ad);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" }, [t("manh@acme.dev")]),
  ]),
]);

const nav = (props = {}) => {
  const n = el("puredashboard-nav", { current: "#/nodes/db", items: appItems(), ...props });
  n.setAttribute("subtle", "");
  return n;
};
const frame = (kids, h = 420) => el("div", { style: `height:${h}px;border:1px solid var(--border,#d0d5dd);border-radius:8px;overflow:hidden` }, kids);
const para = (s) => el("p", { style: "margin:0 0 12px;color:var(--text,#1a1f2b);font-size:var(--font-size-md,13px)" }, [t(s)]);
const content = (title, ...ps) => el("puredashboard-content", {}, [
  el("h2", { style: "margin:0 0 12px;font-size:var(--font-size-xl,18px)" }, [t(title)]),
  ...ps.map(para),
]);

export default {
  tag: "puredashboard-nav",
  title: "Navigation/Nav",
  stories: [
    { name: "Sidebar", notes: "leaf links + one expandable group; DB is current. Rows are square at every depth (--pd-nav-radius rounds them)", render: () =>
      el("div", { style: "width:240px" }, el("puredashboard-nav", {
        current: "#/nodes/db",
        items: [
          { label: "Dashboard", href: "#/" },
          { label: "Alerts", href: "#/alerts", badge: "3" },
          { label: "Nodes", children: [
            { label: "Web", href: "#/nodes/web" },
            { label: "DB", href: "#/nodes/db" },
          ] },
          { label: "Settings", href: "#/settings" },
        ],
      })) },
    { name: "App shell", notes: "the whole shadcn-style sidebar: slot=header brand, two titled sections (Projects collapsible), nested group, badges, row actions (hover a project), slot=footer user, subtle active row; collapsible + rail + Cmd/Ctrl+B + persisted. Collapse to see the icon rail with titles", render: () => {
      const n = nav();
      n.addEventListener("action", (e) => { e.target.closest("puredashboard-nav"); console.log("nav action", e.detail.label); });
      const sider = el("puredashboard-sider", { collapsible: true, rail: true, persist: "purebook-app-shell" }, [brand(), n, user()]);
      sider.setAttribute("shortcut", "b");
      return frame(el("puredashboard-layout", { style: "height:100%" }, [
        sider,
        el("puredashboard-layout", { style: "flex:1;min-height:0" }, [
          el("puredashboard-header", {}, [el("strong", {}, [t("Nodes / DB")])]),
          content("Database nodes", "Sections group rows under a small heading; a collapsible section's heading is a button. A group nests rows under a guide line.", "Row actions sit at the row's end and show on hover, focus, or when the row is active. Press Cmd/Ctrl+B or click the sider's edge to collapse."),
        ]),
      ]));
    } },
    { name: "Icon rail", notes: "starts collapsed: centred icons, labels as titles (hover a row), section headings become separators, header/footer text hidden via puredashboard-sider__expanded-only", render: () => {
      const sider = el("puredashboard-sider", { collapsible: true, collapsed: true, rail: true }, [brand(), nav(), user()]);
      return frame(el("puredashboard-layout", { style: "height:100%" }, [
        sider,
        content("Rail", "The sider mirrors `collapsed` onto its navs as `icon-only`. Expand it to get labels, badges and sections back."),
      ]), 360);
    } },
    { name: "Floating", notes: 'variant="floating": the sider is a rounded, bordered, shadowed card inset from the layout edges', render: () => {
      const sider = el("puredashboard-sider", { collapsible: true, variant: "floating" }, [brand(), nav(), user()]);
      return frame(el("puredashboard-layout", { style: "height:100%" }, [
        sider,
        content("Floating sider", "The card keeps its margin while collapsing; the trigger rounds its bottom corners to match."),
      ]), 380);
    } },
    { name: "Inset", notes: 'variant="inset": the sider sits on the page background and the content beside it becomes the raised card', render: () => {
      const sider = el("puredashboard-sider", { collapsible: true, variant: "inset" }, [brand(), nav(), user()]);
      return frame(el("puredashboard-layout", { style: "height:100%;background:var(--bg,#f4f6fa)" }, [
        sider,
        el("puredashboard-layout", { style: "flex:1;min-height:0" }, [
          el("puredashboard-header", {}, [el("strong", {}, [t("Inset")])]),
          content("Inset content", "The nested layout (header + content) is the card; the sider has no edge border."),
        ]),
      ]), 380);
    } },
    { name: "Offcanvas", notes: 'collapsible="offcanvas" + rail: collapsing slides the sider out completely; bring it back with the rail at the left edge, the header button, or Cmd/Ctrl+B', render: () => {
      const sider = el("puredashboard-sider", { collapsible: "offcanvas", rail: true }, [brand(), nav(), user()]);
      sider.setAttribute("shortcut", "");
      const btn = el("puredashboard-button", { variant: "ghost", "aria-label": "Toggle sidebar" });
      btn.innerHTML = I.menu;
      btn.addEventListener("click", () => sider.toggle());
      return frame(el("puredashboard-layout", { style: "height:100%" }, [
        sider,
        el("puredashboard-layout", { style: "flex:1;min-height:0" }, [
          el("puredashboard-header", {}, [btn, el("strong", {}, [t("Offcanvas")])]),
          content("Offcanvas", "With no icon rail to fall back on, the author wires a header button to sider.toggle(); the edge rail and the shortcut work as well."),
        ]),
      ]), 380);
    } },
    { name: "Loading", notes: "loading=true renders skeleton rows (aria-busy) until items arrive — this story swaps them in after 2.5s", render: () => {
      const n = nav({ loading: true });
      setTimeout(() => { n.loading = false; }, 2500);
      return el("div", { style: "width:240px" }, n);
    } },
    { name: "Sidebar palette", notes: "the theme's --sidebar-* tokens give the sider (and the nav inside) its own palette — here a darker rail; the same nav outside a sider keeps the page colours", render: () => {
      const sider = el("puredashboard-sider", { collapsible: true, style: "--sidebar-bg:#0b0d12;--sidebar-border:#1c2029;--sidebar-hover:#161a23;--sidebar-active:#1f2430;--sidebar-text:#e6e9ef;--sidebar-muted:#7d8694" }, [brand(), nav(), user()]);
      return frame(el("puredashboard-layout", { style: "height:100%" }, [
        sider,
        content("Palette", "Set --sidebar-bg / -text / -muted / -border / -hover / -active on :root (or the sider) to retheme every sidebar at once."),
      ]), 380);
    } },
  ],
};
