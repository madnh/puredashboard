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
    { name: "Status (solid)", render: () => hstack([
      b({ variant: "primary", status: "success" }, "Start"), b({ variant: "primary", status: "warning" }, "Stop"), b({ variant: "primary", status: "danger" }, "Kill"),
    ]) },
    { name: "Status (outlined)", render: () => hstack([
      b({ status: "success" }, "Approve"), b({ status: "warning" }, "Hold"), b({ status: "danger" }, "Reject"),
    ]) },
    { name: "Shape", render: () => hstack([
      b({ shape: "round", variant: "primary" }, "Rounded"),
      el("puredashboard-button", { shape: "circle", icon: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>' }, []),
      el("puredashboard-button", { shape: "circle", variant: "primary", status: "success", icon: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>' }, []),
    ]) },
    { name: "Sizes", render: () => hstack([
      b({ size: "sm" }, "Small"), b({ size: "md" }, "Medium"), b({ size: "lg" }, "Large"),
    ]) },
  ],
};
