import { el, t, hstack } from "./_util.js";

const b = (props, label) => el("puredashboard-button", props, [t(label)]);

export default {
  tag: "puredashboard-button",
  title: "General/Button",
  stories: [
    { name: "Variants", render: () => hstack([
      b({ variant: "primary" }, "Primary"), b({}, "Default"), b({ variant: "dashed" }, "Dashed"),
      b({ variant: "text" }, "Text"), b({ variant: "link" }, "Link"),
    ]) },
    { name: "Danger / loading / disabled", render: () => hstack([
      b({ danger: true }, "Delete"), b({ variant: "primary", loading: true }, "Saving"), b({ disabled: true }, "Disabled"),
    ]) },
    { name: "Sizes", render: () => hstack([
      b({ size: "sm" }, "Small"), b({ size: "md" }, "Medium"), b({ size: "lg" }, "Large"),
    ]) },
  ],
};
