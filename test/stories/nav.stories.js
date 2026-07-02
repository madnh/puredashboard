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
  ],
};
