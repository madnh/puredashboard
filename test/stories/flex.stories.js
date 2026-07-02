import { el, t } from "./_util.js";

// A visible block so the layout is actually observable in the gallery.
const box = (label) => el("div", {
  style: "padding:8px 14px;background:var(--panel-2,#eee);border:1px solid var(--border,#ccc);border-radius:6px;font-size:12px",
}, [t(label)]);

const boxes = (n) => Array.from({ length: n }, (_, i) => box(`Item ${i + 1}`));

// A framed row so justify/align distribution is visible against a full-width track.
const frame = (kids) => el("div", {
  style: "border:1px dashed var(--border,#ccc);border-radius:8px;padding:8px",
}, [kids]);

export default {
  tag: "puredashboard-flex",
  title: "Layout/Flex",
  stories: [
    {
      name: "Horizontal gap",
      render: () => el("puredashboard-flex", { gap: "md" }, boxes(4)),
      notes: "Default row direction with a medium (--sp-3) gap between items.",
    },
    {
      name: "Vertical",
      render: () => el("puredashboard-flex", { vertical: true, gap: "sm" }, boxes(3)),
      notes: "vertical=true stacks children in a column.",
    },
    {
      name: "Justify variants",
      render: () => el("puredashboard-flex", { vertical: true, gap: "md" },
        ["start", "center", "end", "between", "around", "evenly"].map((j) =>
          frame(el("puredashboard-flex", {
            justify: j, gap: "sm",
            style: "min-width:320px",
          }, [box(j), box(j), box(j)])))),
      notes: "Main-axis distribution: start | center | end | between | around | evenly.",
    },
    {
      name: "Align (cross axis)",
      render: () => el("puredashboard-flex", { gap: "md" },
        ["start", "center", "end", "stretch", "baseline"].map((a) =>
          frame(el("puredashboard-flex", {
            align: a, gap: "sm",
            style: "height:80px",
          }, [
            el("div", { style: "padding:4px 10px;background:var(--panel-2,#eee);border:1px solid var(--border,#ccc);border-radius:6px;font-size:12px" }, [t(a)]),
            el("div", { style: "padding:16px 10px;background:var(--panel-2,#eee);border:1px solid var(--border,#ccc);border-radius:6px;font-size:12px" }, [t("tall")]),
          ])))),
      notes: "Cross-axis alignment: start | center | end | stretch | baseline.",
    },
    {
      name: "Wrap",
      render: () => el("puredashboard-flex", {
        wrap: true, gap: "sm",
        style: "max-width:260px",
      }, boxes(10)),
      notes: "wrap=true lets items flow onto multiple lines within a constrained width.",
    },
    {
      name: "Raw gap length",
      render: () => el("puredashboard-flex", { gap: "28px" }, boxes(3)),
      notes: "gap accepts a raw CSS length (e.g. 28px) used verbatim.",
    },
  ],
};
