import { el } from "./_util.js";

const columns = [
  { key: "name", label: "Service", sortable: true },
  { key: "region", label: "Region" },
  { key: "reqs", label: "Requests", align: "right", sortable: true },
  { key: "status", label: "Status", render: (row) => row.up ? "● up" : "● down" },
];

const rows = [
  { id: 1, name: "api-gateway", region: "us-east", reqs: 128400, up: true },
  { id: 2, name: "auth", region: "eu-west", reqs: 42100, up: true },
  { id: 3, name: "billing-cron", region: "us-east", reqs: 980, up: false },
  { id: 4, name: "search", region: "ap-south", reqs: 76550, up: true },
  { id: 5, name: "notifier", region: "eu-west", reqs: 15320, up: true },
  { id: 6, name: "image-proc", region: "us-west", reqs: 3210, up: false },
];

export default {
  tag: "puredashboard-table",
  title: "Data display/Table",
  stories: [
    { name: "Basic", render: () => el("puredashboard-table", {
      columns,
      rows,
    }) },
    { name: "Selectable + actions + pagination", render: () => el("puredashboard-table", {
      columns,
      rows,
      selectable: true,
      pageSize: 4,
      actions: [
        { name: "restart", label: "Restart" },
        { name: "delete", label: "Delete", danger: true },
      ],
      bulkActions: [
        { name: "restart-all", label: "Restart selected" },
      ],
    }) },
  ],
};
