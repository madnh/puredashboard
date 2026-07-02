import { el } from "./_util.js";

const items = [
  { label: "Region", value: "eu-west-1" },
  { label: "Status", value: "Running" },
  { label: "Version", value: "v0.1.0" },
  { label: "Requests", value: "1,204 / min" },
];

export default {
  tag: "puredashboard-descriptions",
  title: "Data display/Descriptions",
  stories: [
    { name: "Spec sheet (2 columns)", render: () => el("puredashboard-descriptions", {
      title: "Service", columns: 2, items,
    }) },
    { name: "Bordered", render: () => el("puredashboard-descriptions", {
      title: "Service", columns: 2, bordered: true, items,
    }) },
    { name: "Single column", render: () => el("puredashboard-descriptions", {
      columns: 1, items,
    }) },
    { name: "Spanning row", render: () => el("puredashboard-descriptions", {
      title: "Node", columns: 2, bordered: true, items: [
        { label: "Hostname", value: "web-01" },
        { label: "Region", value: "eu-west-1" },
        { label: "Notes", value: "Primary node, do not drain during business hours.", span: 2 },
      ],
    }) },
  ],
};
