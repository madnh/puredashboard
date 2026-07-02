import { el } from "./_util.js";

// A visible panel: padded content on a --panel-2 surface so the split is obvious.
const panel = (label, size) =>
  el("div", { "data-size": size, style: "padding:12px; background:var(--panel-2); height:100%; box-sizing:border-box" }, label);

// Wrap a splitter in a bordered, fixed-height box so the drag area is visible.
const box = (kids) =>
  el("div", { style: "height:240px; border:1px solid var(--border); border-radius:8px; overflow:hidden" }, kids);

export default {
  tag: "puredashboard-splitter",
  title: "Layout/Splitter",
  stories: [
    { name: "Horizontal (two panels)", render: () => box(
      el("puredashboard-splitter", { style: "height:100%" }, [
        panel("Left", 60),
        panel("Right", 40),
      ])) },
    { name: "Vertical", notes: "stacked panels with a horizontal gutter", render: () => box(
      el("puredashboard-splitter", { vertical: true, style: "height:100%" }, [
        panel("Top", 50),
        panel("Bottom", 50),
      ])) },
    { name: "Three panels", render: () => box(
      el("puredashboard-splitter", { style: "height:100%" }, [
        panel("One", 25),
        panel("Two", 50),
        panel("Three", 25),
      ])) },
  ],
};
