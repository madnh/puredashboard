// Tiny helpers for PureBook stories (dev-only). Not part of the library.
export const el = (tag, props, kids) => {
  const n = Object.assign(document.createElement(tag), props || {});
  if (kids != null) n.append(...[].concat(kids).filter((k) => k != null));
  return n;
};
export const t = (s) => document.createTextNode(s);
// stack children vertically / horizontally via <puredashboard-space>
export const vstack = (kids, size = "sm") => el("puredashboard-space", { direction: "vertical", size }, kids);
export const hstack = (kids, size = "sm") => el("puredashboard-space", { direction: "horizontal", size }, kids);
