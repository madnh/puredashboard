import { el, t } from "./_util.js";

// A visible block so each column's width is obvious.
const block = (label) => el("div", {
  style: "padding:12px;background:var(--panel-2,#eee);border-radius:4px;text-align:center",
}, [t(label)]);

// A col carrying a visible block. Responsive spans (md/sm/…) are plain observed
// attributes (no property accessor), so set them via setAttribute.
const col = (span, label, responsive) => {
  const c = el("puredashboard-col", { span: String(span) }, [block(label)]);
  if (responsive) for (const [k, v] of Object.entries(responsive)) c.setAttribute(k, String(v));
  return c;
};

const row = (kids) => el("puredashboard-row", { gutter: "md" }, kids);

export default {
  tag: "puredashboard-row",
  title: "Layout/Grid",
  stories: [
    { name: "Thirds (8 / 8 / 8)", render: () => row([
      col(8, "span 8"), col(8, "span 8"), col(8, "span 8"),
    ]) },
    { name: "Quarters (6 / 6 / 6 / 6)", render: () => row([
      col(6, "6"), col(6, "6"), col(6, "6"), col(6, "6"),
    ]) },
    { name: "Halves (12 / 12)", render: () => row([
      col(12, "span 12"), col(12, "span 12"),
    ]) },
    {
      name: "Responsive",
      notes: "Full width on small screens, then thirds from the md breakpoint up. Resize to see it reflow.",
      render: () => row([
        col(24, "24 / md 8", { md: 8 }),
        col(24, "24 / md 8", { md: 8 }),
        col(24, "24 / md 8", { md: 8 }),
      ]),
    },
  ],
};
