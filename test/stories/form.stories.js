import { el, t } from "./_util.js";

export default {
  tag: "puredashboard-form",
  title: "Form/Form",
  stories: [
    { name: "Basic", notes: "submit collects values from the child fields", render: () =>
      el("puredashboard-form", {}, [
        el("puredashboard-input", { name: "name", placeholder: "Full name" }),
        el("puredashboard-input", { name: "email", type: "email", placeholder: "you@example.com", required: true }),
        el("puredashboard-button", { type: "submit", variant: "primary" }, [t("Save")]),
      ]) },
    { name: "Row direction (filter bar)", notes: "direction=row lays the fields side by side, wrapping; aria-label names the form", render: () => {
      const f = el("puredashboard-form", { "aria-label": "Filter services" }, [
        el("puredashboard-input", { name: "q", placeholder: "Search…" }),
        el("puredashboard-select", { name: "region", options: ["us-east", "eu-west", "ap-south"], placeholder: "Region" }),
        el("puredashboard-button", { type: "submit", variant: "primary" }, [t("Apply")]),
      ]);
      f.setAttribute("direction", "row");
      return f;
    } },
  ],
};
