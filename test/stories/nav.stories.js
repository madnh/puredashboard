import { el } from "./_util.js";

export default {
  tag: "puredashboard-nav",
  title: "Navigation/Nav",
  stories: [
    { name: "Sidebar", notes: "leaf links + one expandable group; Web is current", render: () =>
      el("div", { style: "width:240px" }, el("puredashboard-nav", {
        current: "#/nodes/web",
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
    { name: "In a sider", notes: "nav as the sider's child: inset from the sider edges (--pd-sider-nav-inset), 16px icons (--pd-nav-icon-size), subtle active row; collapse to see the rail", render: () => {
      const nav = el("puredashboard-nav", {
          current: "#/alerts",
          items: [
            { label: "Dashboard", href: "#/", icon: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>' },
            { label: "Alerts", href: "#/alerts", badge: "3", icon: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>' },
            { label: "Settings", href: "#/settings", icon: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>' },
          ],
        });
      nav.setAttribute("subtle", "");
      return el("div", { style: "height:260px;display:flex;border:1px solid var(--border,#d0d5dd)" },
        el("puredashboard-sider", { collapsible: true }, nav));
    } },
  ],
};
