import { el } from "./_util.js";

const SAMPLE = {
  service: "web-01",
  up: true,
  replicas: 3,
  ratio: 0.9821,
  tags: ["edge", "prod", "eu-west"],
  env: { REGION: "eu-west-1", DEBUG: false, retries: 2 },
  ports: [80, 443, 8080],
  lastError: null,
};

export default {
  tag: "puredashboard-json-view",
  title: "Data display/JSON view",
  stories: [
    { name: "Basic", notes: "collapsible tree; hover a leaf to reveal its copy button", render: () =>
      el("puredashboard-json-view", { data: SAMPLE }) },
    { name: "Auto-collapse (level=1)", notes: "root open, its children collapsed — still toggleable", render: () =>
      el("puredashboard-json-view", { data: SAMPLE, level: 1 }) },
    { name: "Pinned theme (dracula)", notes: "one of 10 built-in palettes (theme=…)", render: () =>
      el("puredashboard-json-view", { data: SAMPLE, theme: "dracula" }) },
    { name: "Custom palette", notes: "themes prop overrides colours per mode", render: () =>
      el("puredashboard-json-view", { data: SAMPLE, theme: "dark", themes: { dark: { key: "#f0abfc", string: "#fde68a", number: "#67e8f9", boolean: "#fca5a5", null: "#a78bfa" } } }) },
  ],
};
