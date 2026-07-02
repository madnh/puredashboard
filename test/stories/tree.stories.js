import { el } from "./_util.js";

const nodes = [
  { id: "src", label: "src", children: [
    { id: "index", label: "index.js" },
    { id: "reactive", label: "reactive.js" },
    { id: "theme", label: "theme", children: [
      { id: "tokens", label: "tokens.css" },
      { id: "base", label: "base.css" },
    ] },
  ] },
  { id: "readme", label: "README.md" },
];

export default {
  tag: "puredashboard-tree",
  title: "Data display/Tree",
  stories: [
    { name: "File tree", notes: "expandedKeys + selectedKey preset", render: () =>
      el("puredashboard-tree", { nodes, expandedKeys: ["src"], selectedKey: "reactive" }) },
    { name: "Nested folder expanded", render: () =>
      el("puredashboard-tree", { nodes, expandedKeys: ["src", "theme"], selectedKey: "tokens" }) },
    { name: "All collapsed", render: () =>
      el("puredashboard-tree", { nodes, expandedKeys: [], selectedKey: "" }) },
  ],
};
