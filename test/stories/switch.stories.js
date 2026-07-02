import { el, vstack } from "./_util.js";

export default {
  tag: "puredashboard-switch",
  title: "Form/Switch",
  stories: [
    { name: "Off", render: () => el("puredashboard-switch") },
    { name: "On", render: () => el("puredashboard-switch", { checked: true }) },
    { name: "With label", render: () => vstack([
      el("puredashboard-switch", { label: "Enable notifications", checked: true }),
      el("puredashboard-switch", { label: "Weekly digest email" }),
    ]) },
    { name: "Disabled", render: () => vstack([
      el("puredashboard-switch", { label: "Maintenance mode", disabled: true }),
      el("puredashboard-switch", { label: "Read-only replica", disabled: true, checked: true }),
    ]) },
  ],
};
