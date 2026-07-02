import { el } from "./_util.js";

const period = ["Day", "Week", "Month"];

export default {
  tag: "puredashboard-segmented",
  title: "General/Segmented",
  stories: [
    { name: "Basic", render: () => el("puredashboard-segmented", {
      options: period, value: "Week", "aria-label": "Period",
    }) },
    { name: "Block", render: () => el("puredashboard-segmented", {
      options: period, value: "Day", block: true, "aria-label": "Period",
    }) },
    { name: "Sizes", render: () => el("puredashboard-space", { direction: "vertical", size: "md", align: "start" }, [
      el("puredashboard-segmented", { options: period, value: "Day", size: "sm", "aria-label": "Small" }),
      el("puredashboard-segmented", { options: period, value: "Week", size: "md", "aria-label": "Medium" }),
      el("puredashboard-segmented", { options: period, value: "Month", size: "lg", "aria-label": "Large" }),
    ]) },
    { name: "Disabled", render: () => el("puredashboard-segmented", {
      options: period, value: "Week", disabled: true, "aria-label": "Period",
    }) },
    { name: "Per-option disabled", render: () => el("puredashboard-segmented", {
      options: [
        { value: "list", label: "List" },
        { value: "grid", label: "Grid" },
        { value: "map", label: "Map", disabled: true },
      ],
      value: "list", "aria-label": "View",
    }) },
  ],
};
