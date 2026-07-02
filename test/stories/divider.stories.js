import { el, t } from "./_util.js";

const para = (s) => el("p", { style: "margin:0" }, [t(s)]);
const div = (props) => el("puredashboard-divider", props);

export default {
  tag: "puredashboard-divider",
  title: "Layout/Divider",
  stories: [
    { name: "Horizontal", render: () => el("div", null, [
      para("Above the line."), div({}), para("Below the line."),
    ]) },
    { name: "With text", render: () => el("div", null, [
      div({ text: "Center" }),
      div({ text: "Left", textAlign: "left" }),
      div({ text: "Right", textAlign: "right" }),
    ]) },
    { name: "Dashed", render: () => el("div", null, [
      para("Above the dashed line."), div({ dashed: true }), para("Below the dashed line."),
    ]) },
    { name: "Vertical", render: () => el("div", { style: "display:flex;align-items:center" }, [
      el("span", null, [t("Home")]),
      div({ orientation: "vertical" }),
      el("span", null, [t("Docs")]),
      div({ orientation: "vertical" }),
      el("span", null, [t("Settings")]),
    ]) },
  ],
};
