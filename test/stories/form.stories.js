import { el } from "./_util.js";

export default {
  tag: "puredashboard-form",
  title: "Form/Form",
  stories: [
    { name: "Basic", notes: "submit collects values from the child fields", render: () =>
      el("puredashboard-form", {}, [
        el("puredashboard-input", { name: "name", placeholder: "Full name" }),
        el("puredashboard-input", { name: "email", type: "email", placeholder: "you@example.com", required: true }),
        el("button", { type: "submit", textContent: "Save" }),
      ]) },
  ],
};
