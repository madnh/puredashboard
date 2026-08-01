import { el, vstack } from "./_util.js";

// <puredashboard-toggle-group> owns the selection across its <puredashboard-toggle>
// children (which are real light-DOM children, like splitter's panels). It swallows their
// individual `change` events and emits ONE with the group value.

const svg = (path) =>
  `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="overflow:visible">${path}</svg>`;
const ICON_ALIGN_LEFT = svg('<path d="M2.5 4h11M2.5 8h7M2.5 12h9"/>');
const ICON_ALIGN_CENTER = svg('<path d="M2.5 4h11M4.5 8h7M3.5 12h9"/>');
const ICON_ALIGN_RIGHT = svg('<path d="M2.5 4h11M6.5 8h7M4.5 12h9"/>');
const ICON_BOLD = svg('<path d="M4.5 2.5h4a2.75 2.75 0 0 1 0 5.5h-4z"/><path d="M4.5 8h4.6a2.75 2.75 0 0 1 0 5.5H4.5z"/>');
const ICON_ITALIC = svg('<path d="M10.5 2.5h-4M9.5 13.5h-4M9.5 2.5 6.5 13.5"/>');
const ICON_UNDERLINE = svg('<path d="M4.5 2.5v5a3.5 3.5 0 0 0 7 0v-5M3.5 14h9"/>');
const ICON_LIST = svg('<path d="M6 4h7.5M6 8h7.5M6 12h7.5M2.8 4h.01M2.8 8h.01M2.8 12h.01"/>');
const ICON_GRID = svg('<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/>');

// build a group from [value, label|icon] tuples
const group = (opts, items) => {
  const g = el("puredashboard-toggle-group", opts.props || {});
  if (opts.ariaLabel) g.setAttribute("aria-label", opts.ariaLabel);
  for (const it of items) {
    const t = el("puredashboard-toggle", { value: it.value, label: it.label, icon: it.icon, disabled: it.disabled, variant: opts.variant });
    if (it.ariaLabel) t.setAttribute("aria-label", it.ariaLabel);
    g.append(t);
  }
  g.addEventListener("change", (e) => console.log("toggle-group:", e.detail.value));
  return g;
};

export default {
  tag: "puredashboard-toggle-group",
  title: "General/Toggle group",
  stories: [
    { name: "Single select", notes: "one selection; the group is ONE tab stop — ←/→ move between toggles, Home/End jump to the ends", render: () =>
      group({ ariaLabel: "Text alignment", props: { value: "center" } }, [
        { value: "left", icon: ICON_ALIGN_LEFT, ariaLabel: "Align left" },
        { value: "center", icon: ICON_ALIGN_CENTER, ariaLabel: "Align center" },
        { value: "right", icon: ICON_ALIGN_RIGHT, ariaLabel: "Align right" },
      ]) },

    { name: "Multiple", notes: "multiple → any number pressed at once; change carries the whole array", render: () =>
      group({ ariaLabel: "Formatting", props: { multiple: true, value: ["bold"] } }, [
        { value: "bold", icon: ICON_BOLD, ariaLabel: "Bold" },
        { value: "italic", icon: ICON_ITALIC, ariaLabel: "Italic" },
        { value: "underline", icon: ICON_UNDERLINE, ariaLabel: "Underline" },
      ]) },

    { name: "With labels", notes: "text (or icon + text) instead of icon-only", render: () =>
      group({ ariaLabel: "View mode", props: { value: "list" } }, [
        { value: "list", label: "List", icon: ICON_LIST },
        { value: "grid", label: "Grid", icon: ICON_GRID },
      ]) },

    { name: "Always one selected", notes: "deselectable=false — pressing the selected toggle again keeps it on (a view switcher can't be empty)", render: () =>
      group({ ariaLabel: "Density", props: { value: "cozy", deselectable: false } }, [
        { value: "compact", label: "Compact" },
        { value: "cozy", label: "Cozy" },
        { value: "roomy", label: "Roomy" },
      ]) },

    { name: "Detached & vertical", notes: "attached=false keeps them separate; orientation=vertical stacks them and swaps the arrow keys", render: () =>
      vstack([
        group({ ariaLabel: "Formatting (detached)", variant: "text", props: { multiple: true, attached: false, value: ["bold"] } }, [
          { value: "bold", icon: ICON_BOLD, ariaLabel: "Bold" },
          { value: "italic", icon: ICON_ITALIC, ariaLabel: "Italic" },
          { value: "underline", icon: ICON_UNDERLINE, ariaLabel: "Underline" },
        ]),
        // wrapped in a plain div so the group hugs its content here; a vertical group
        // placed directly in a grid/flex column will stretch to the container's width.
        el("div", {}, [group({ ariaLabel: "Alignment (vertical)", props: { orientation: "vertical", value: "left" } }, [
          { value: "left", label: "Left", icon: ICON_ALIGN_LEFT },
          { value: "center", label: "Center", icon: ICON_ALIGN_CENTER },
          { value: "right", label: "Right", icon: ICON_ALIGN_RIGHT },
        ])]),
      ], "lg") },

    { name: "Disabled", notes: "a disabled group disables every toggle; a single disabled toggle is skipped by the arrow keys", render: () =>
      vstack([
        group({ ariaLabel: "View mode (one disabled)", props: { value: "list" } }, [
          { value: "list", label: "List" },
          { value: "grid", label: "Grid" },
          { value: "map", label: "Map", disabled: true },
        ]),
        group({ ariaLabel: "View mode (all disabled)", props: { value: "list", disabled: true } }, [
          { value: "list", label: "List" },
          { value: "grid", label: "Grid" },
        ]),
      ], "lg") },
  ],
};
