// Tiny helpers for PureBook stories (dev-only). Not part of the library.
export const el = (tag, props, kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    // hyphenated keys (data-*, aria-*, …) are real ATTRIBUTES, not properties —
    // so component selectors like [data-popover-content] actually match.
    if (k.includes("-")) n.setAttribute(k, v === true ? "" : v);
    else n[k] = v;
  }
  if (kids != null) n.append(...[].concat(kids).filter((k) => k != null));
  return n;
};
export const t = (s) => document.createTextNode(s);
// stack children vertically / horizontally via <puredashboard-space>
// A vertical stack whose children STRETCH to full width (a grid, not a flex row) —
// so full-width block components (progress, input, alert…) don't collapse.
export const vstack = (kids, gap = "12px") => {
  const g = { sm: "8px", md: "12px", lg: "16px" }[gap] || gap;
  return el("div", { style: `display:grid; gap:${g}` }, kids);
};
export const hstack = (kids, size = "sm") => el("puredashboard-space", { direction: "horizontal", size }, kids);
