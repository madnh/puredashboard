import { el } from "./_util.js";

const items = [
  { title: "web-01", description: "us-east-1", extra: "online" },
  { title: "web-02", description: "us-west-2", extra: "offline" },
  { title: "web-03", description: "eu-central-1", extra: "online" },
];

export default {
  tag: "puredashboard-list",
  title: "Data display/List",
  stories: [
    { name: "Bordered with header", render: () =>
      el("puredashboard-list", { header: "Recent nodes", items, bordered: true }) },
    { name: "Plain", render: () =>
      el("puredashboard-list", { items }) },
    { name: "Empty", notes: "no items → empty state", render: () =>
      el("puredashboard-list", { header: "Recent nodes", items: [], bordered: true }) },
    { name: "Loading", notes: "skeleton placeholder rows", render: () =>
      el("puredashboard-list", { header: "Recent nodes", loading: true, bordered: true }) },
  ],
};
