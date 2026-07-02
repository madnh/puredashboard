import { el, t, hstack } from "./_util.js";

const tag = (props, label) => el("puredashboard-tag", props, [t(label)]);

export default {
  tag: "puredashboard-tag",
  title: "Data display/Tag",
  stories: [
    { name: "Colors", render: () => hstack([
      tag({}, "default"),
      tag({ color: "accent" }, "accent"),
      tag({ color: "success" }, "success"),
      tag({ color: "warning" }, "warning"),
      tag({ color: "danger" }, "danger"),
      tag({ color: "info" }, "info"),
    ]) },
    { name: "Round", render: () => hstack([
      tag({ color: "success", round: true }, "Online"),
      tag({ color: "danger", round: true }, "Offline"),
    ]) },
    { name: "Closable", render: () => hstack([
      tag({ color: "info", closable: true }, "frontend"),
      tag({ color: "accent", closable: true }, "urgent"),
    ]) },
    { name: "Sizes", render: () => hstack([
      tag({ size: "sm", color: "success" }, "small"),
      tag({ size: "md", color: "success" }, "medium"),
    ]) },
  ],
};
