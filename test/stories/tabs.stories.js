import { el } from "./_util.js";

export default {
  tag: "puredashboard-tabs",
  title: "Navigation/Tabs",
  stories: [
    { name: "Basic", notes: "three tabs, second active", render: () =>
      el("puredashboard-tabs", { value: "metrics", tabs: [
        { id: "overview", label: "Overview" },
        { id: "metrics", label: "Metrics" },
        { id: "logs", label: "Logs" },
      ] }) },
    { name: "With disabled tab", render: () =>
      el("puredashboard-tabs", { value: "overview", tabs: [
        { id: "overview", label: "Overview" },
        { id: "metrics", label: "Metrics" },
        { id: "billing", label: "Billing", disabled: true },
      ] }) },
    { name: "Link mode", notes: "any tab with href renders a <nav> of real links (aria-current); navigation is the browser's", render: () =>
      el("puredashboard-tabs", { value: "metrics", tabs: [
        { id: "overview", label: "Overview", href: "#overview" },
        { id: "metrics", label: "Metrics", href: "#metrics" },
        { id: "billing", label: "Billing", href: "#billing", disabled: true },
      ] }) },
  ],
};
