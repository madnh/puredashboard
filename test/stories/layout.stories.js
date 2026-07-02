import { el, t } from "./_util.js";

// Constrain each story to a bordered, fixed-height box so it reads as an app frame.
const frame = (kids) => el("div", {
  style: "height:320px;border:1px solid var(--border,#d0d5dd);border-radius:8px;overflow:hidden",
}, kids);

// A brand lockup for the header.
const brand = (name) => el("strong", { style: "font-size:var(--font-size-lg,15px)" }, [t(name)]);

// A simple sider nav row (plain links keep the story dependency-free).
const navLink = (label, active) => el("a", {
  href: "#",
  style:
    "display:block;padding:8px 16px;color:var(--text,#1a1f2b);text-decoration:none;font-size:var(--font-size-md,13px)" +
    (active ? ";background:var(--panel-2,#eef1f6);font-weight:600" : ""),
}, [t(label)]);

const sideNav = (current) => [
  navLink("Dashboard", current === "dashboard"),
  navLink("Nodes", current === "nodes"),
  navLink("Alerts", current === "alerts"),
  navLink("Settings", current === "settings"),
];

const para = (s) => el("p", { style: "margin:0 0 12px;color:var(--text,#1a1f2b);font-size:var(--font-size-md,13px)" }, [t(s)]);

export default {
  tag: "puredashboard-layout",
  title: "Layout/Layout",
  stories: [
    {
      name: "App frame",
      notes: "header + sider + content + footer — the classic admin shell",
      render: () => frame(
        el("puredashboard-layout", { style: "height:100%" }, [
          el("puredashboard-header", {}, [
            brand("Acme Admin"),
            el("span", { style: "margin-inline-start:auto;color:var(--muted,#5b6472);font-size:var(--font-size-sm,12px)" }, [t("ai@admin")]),
          ]),
          // Nested layout so the sider sits BESIDE the content (row via :has).
          el("puredashboard-layout", { style: "flex:1;min-height:0" }, [
            el("puredashboard-sider", {}, sideNav("dashboard")),
            el("puredashboard-content", {}, [
              el("h2", { style: "margin:0 0 12px;font-size:var(--font-size-xl,18px)" }, [t("Dashboard")]),
              para("A vanilla, zero-dependency layout frame. The header, content and footer stack; a direct sider child flips the frame to a row."),
              para("Everything you place inside is preserved as-is — this is a structural container, not a Reactive component."),
            ]),
          ]),
          el("puredashboard-footer", {}, [t("© 2026 Acme — PureDashboard")]),
        ]),
      ),
    },
    {
      name: "Collapsible sider",
      notes: "collapsible sider with a trigger; click the chevron at the bottom to collapse to icons width",
      render: () => frame(
        el("puredashboard-layout", { style: "height:100%" }, [
          el("puredashboard-sider", { collapsible: true, collapsed: false, breakpoint: "md" }, sideNav("nodes")),
          el("puredashboard-layout", { style: "flex:1;min-height:0" }, [
            el("puredashboard-header", {}, [brand("Nodes")]),
            el("puredashboard-content", {}, [
              para("The sider below is collapsible — the trigger button at its bottom toggles between the full and collapsed width."),
              para("It also auto-collapses under the md breakpoint via a matchMedia listener. Resize the window to see it react."),
            ]),
          ]),
        ]),
      ),
    },
  ],
};
