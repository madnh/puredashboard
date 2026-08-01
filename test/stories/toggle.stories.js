import { el, hstack, vstack } from "./_util.js";

// <puredashboard-toggle> is a two-state BUTTON (aria-pressed) — a setting that applies
// immediately. Its form-input siblings are <puredashboard-switch> (role=switch) and
// <puredashboard-checkbox>; the last story puts the three side by side.

const svg = (path, opts = "") =>
  `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="overflow:visible" ${opts}>${path}</svg>`;
const ICON_BOLD = svg('<path d="M4.5 2.5h4a2.75 2.75 0 0 1 0 5.5h-4z"/><path d="M4.5 8h4.6a2.75 2.75 0 0 1 0 5.5H4.5z"/>');
const ICON_ITALIC = svg('<path d="M10.5 2.5h-4M9.5 13.5h-4M9.5 2.5 6.5 13.5"/>');
const ICON_UNDERLINE = svg('<path d="M4.5 2.5v5a3.5 3.5 0 0 0 7 0v-5M3.5 14h9"/>');
const ICON_STAR = svg('<path d="M8 1.8 10 6l4.5.6-3.3 3.1.8 4.5L8 12.1 4 14.2l.8-4.5L1.5 6.6 6 6z"/>');
const ICON_PIN = svg('<path d="M6 1.8h4l-.6 4 2.3 2.2H4.3L6.6 5.8z"/><path d="M8 8.2v6"/>');
const ICON_EYE = svg('<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>');

const toggle = (props, ariaLabel) => {
  const t = el("puredashboard-toggle", props);
  if (ariaLabel) t.setAttribute("aria-label", ariaLabel);
  t.addEventListener("change", (e) => console.log("toggle:", e.detail.value ?? e.detail, e.detail.pressed));
  return t;
};

export default {
  tag: "puredashboard-toggle",
  title: "General/Toggle",
  stories: [
    { name: "Icon toolbar", notes: "icon-only toggles need an aria-label — it is mirrored onto the inner <button>", render: () =>
      hstack([
        toggle({ icon: ICON_BOLD, value: "bold", pressed: true, variant: "text" }, "Bold"),
        toggle({ icon: ICON_ITALIC, value: "italic", variant: "text" }, "Italic"),
        toggle({ icon: ICON_UNDERLINE, value: "underline", variant: "text" }, "Underline"),
      ]) },

    { name: "With a label", notes: "text, or icon + text; the pressed state is a real visual state, not just hover", render: () =>
      hstack([
        toggle({ label: "Show archived", value: "archived" }),
        toggle({ label: "Favourite", icon: ICON_STAR, value: "fav", pressed: true }),
        toggle({ label: "Pinned", icon: ICON_PIN, value: "pin" }),
      ]) },

    { name: "Sizes", notes: "sm · md (default) · lg — icon-only toggles stay square at every size", render: () =>
      vstack([
        hstack([toggle({ label: "sm", size: "sm" }), toggle({ icon: ICON_EYE, size: "sm" }, "Preview (sm)")]),
        hstack([toggle({ label: "md" }), toggle({ icon: ICON_EYE }, "Preview (md)")]),
        hstack([toggle({ label: "lg", size: "lg" }), toggle({ icon: ICON_EYE, size: "lg" }, "Preview (lg)")]),
      ]) },

    { name: "States", notes: "off / on / disabled — disabled uses the native button, so it also drops out of the tab order", render: () =>
      vstack([
        hstack([toggle({ label: "Off" }), toggle({ label: "On", pressed: true }), toggle({ label: "Disabled", disabled: true }), toggle({ label: "On + disabled", pressed: true, disabled: true })]),
        hstack([toggle({ label: "Off", variant: "text" }), toggle({ label: "On", variant: "text", pressed: true }), toggle({ label: "Disabled", variant: "text", disabled: true })]),
      ]) },

    { name: "Toggle vs switch vs checkbox", notes: "same idea, different meaning: a toggle is a button that applies now; switch/checkbox are form inputs that submit", render: () =>
      vstack([
        el("div", { style: "font-size:12px;color:var(--muted)", textContent: "toggle — a command that applies immediately (role=button, aria-pressed)" }),
        toggle({ label: "Show archived", icon: ICON_EYE, value: "archived" }),
        el("div", { style: "font-size:12px;color:var(--muted)", textContent: "switch — a form setting (role=switch, submits under its name)" }),
        el("puredashboard-switch", { label: "Email notifications" }),
        el("div", { style: "font-size:12px;color:var(--muted)", textContent: "checkbox — a boolean value in a form" }),
        el("puredashboard-checkbox", { label: "I agree to the terms" }),
      ], "lg") },
  ],
};
