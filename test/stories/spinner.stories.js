import { el, t, hstack } from "./_util.js";

const s = (props) => el("puredashboard-spinner", props);

export default {
  tag: "puredashboard-spinner",
  title: "Feedback/Spinner",
  stories: [
    { name: "Sizes", render: () => hstack([
      s({ size: "sm" }),
      s({ size: "md" }),
      s({ size: "lg" }),
    ], "md") },
    { name: "With label", render: () => s({ label: "Loading dashboard…", labelVisible: true }) },
    { name: "Inline", render: () => el("span", {}, [
      t("Fetching results "),
      s({ size: "sm", inline: true }),
      t(" please wait."),
    ]) },
  ],
};
