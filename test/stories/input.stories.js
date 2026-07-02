import { el, vstack } from "./_util.js";

export default {
  tag: "puredashboard-input",
  title: "Form/Input",
  stories: [
    { name: "Basic", render: () => el("puredashboard-input", { type: "email", placeholder: "you@example.com" }) },
    { name: "Sizes", render: () => vstack([
      el("puredashboard-input", { size: "sm", placeholder: "small" }),
      el("puredashboard-input", { size: "md", placeholder: "medium" }),
      el("puredashboard-input", { size: "lg", placeholder: "large" }),
    ]) },
    { name: "Invalid", render: () => el("puredashboard-input", { value: "not-an-email", error: "That email looks invalid." }) },
    { name: "Disabled", render: () => el("puredashboard-input", { value: "read only", disabled: true }) },
  ],
};
