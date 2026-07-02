import { el } from "./_util.js";

export default {
  tag: "puredashboard-popconfirm",
  title: "Overlay/Popconfirm",
  stories: [
    { name: "Danger delete", notes: "click to confirm", render: () =>
      el("puredashboard-popconfirm", {
        title: "Delete this row?",
        description: "This action cannot be undone.",
        okDanger: true,
      }, el("button", { type: "button" }, "Delete")) },
    { name: "Plain confirm", notes: "click to confirm", render: () =>
      el("puredashboard-popconfirm", {
        title: "Archive this item?",
        placement: "bottom",
      }, el("button", { type: "button" }, "Archive")) },
    { name: "Title only", notes: "click to confirm", render: () =>
      el("puredashboard-popconfirm", {
        title: "Log out?",
        okDanger: true,
        placement: "right",
      }, el("button", { type: "button" }, "Log out")) },
  ],
};
