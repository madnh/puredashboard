import { el, t } from "./_util.js";

export default {
  tag: "puredashboard-empty",
  title: "Data display/Empty",
  stories: [
    { name: "Default", render: () => el("puredashboard-empty", {}) },
    { name: "Custom description", render: () => el("puredashboard-empty", {
      description: "No projects match your filters.",
    }) },
    { name: "With action", render: () => el("puredashboard-empty", {
      description: "No projects yet",
    }, [
      el("puredashboard-button", { variant: "primary" }, [t("Create project")]),
    ]) },
    { name: "Compact", render: () => el("puredashboard-empty", {
      description: "No results", compact: true,
    }) },
  ],
};
