// <puredashboard-popover> — a click-triggered floating panel that lives in the
// TOP LAYER. Zero-dep, no build, CSP-safe. Extends plain HTMLElement (NOT
// Reactive) — a Reactive render() would blow away the author's light-DOM
// children, and this component's whole job is to PRESERVE the author's trigger
// and content nodes while wiring them together (like form.js wraps children).
//
// Why the native Popover API: setting popover="auto" puts the content in the
// browser's TOP LAYER (paints above page content, escapes overflow:hidden
// ancestors) and grants light-dismiss (click-outside) + Esc for FREE. Where the
// Popover API is missing (older engines, jsdom) we fall back to a fixed,
// high-z-index element and replicate outside-click + Esc + focus-return by hand
// — the same feature-detect + fallback strategy menu.js uses.
//
// Author markup: a trigger (first element child, or [data-popover-trigger]) and a
// content element ([data-popover-content]). On connect we identify both, keep the
// trigger in place, make the content a popover, and wire ARIA:
//
//   <puredashboard-popover placement="bottom-start">
//     <button data-popover-trigger>Menu</button>
//     <div data-popover-content>…any markup…</div>
//   </puredashboard-popover>
//
// The content stays a light-DOM node — it is MOVED into the top layer, never
// serialized — so live nodes, listeners and focus survive.

// All FIXED user-facing strings live here (English defaults). Override any subset
// via the `labels` property — e.g. pop.labels = { dialog: "Bảng" }. These are
// only fallbacks (authors supply their own trigger/content); currently just the
// aria-label applied to the content when it has no accessible name.
const LABELS = {
  dialog: "Popover",
};

let uid = 0;

// The eight supported placements. `<side>` positions the panel relative to the
// trigger; the optional `-start`/`-end` aligns it along the cross axis.
const PLACEMENTS = new Set([
  "bottom-start", "bottom-end", "bottom",
  "top-start", "top-end", "top",
  "left", "right",
]);

/**
 * A click-triggered floating panel rendered in the TOP LAYER. It keeps the
 * author's trigger and content as ordinary light-DOM children (moved, never
 * serialized) and wires them together: clicking the trigger toggles the panel;
 * Escape and outside-click close it; focus returns to the trigger on close.
 *
 * Uses the native Popover API (`popover="auto"`) for top-layer painting and
 * light-dismiss, with a fixed/high-z fallback where the API is unavailable
 * (mirrors `menu.js`). It is NOT form-associated — it is a presentational
 * container, not a value-bearing control.
 *
 * Mark the trigger with `[data-popover-trigger]` (or leave it as the first
 * element child) and the content with `[data-popover-content]`. Configure via JS
 * properties or declarative attributes.
 *
 * @element puredashboard-popover
 *
 * @prop {string}  placement - Where the panel opens relative to the trigger:
 *   `"bottom-start"` (default) | `"bottom"` | `"bottom-end"` | `"top-start"` |
 *   `"top"` | `"top-end"` | `"left"` | `"right"`.
 * @prop {boolean} open      - Whether the panel is open (get/set). Reflected to the
 *   `open` attribute; setting it programmatically shows/hides the panel.
 * @prop {Object}  labels    - Override UI strings. Keys: `dialog`. Unset keys keep
 *   the English default.
 * @attr {string}  placement - Declarative form of `placement`.
 * @attr {boolean} open      - Declarative form of `open`.
 *
 * @fires open  - `CustomEvent` (bubbles) after the panel opens. `detail = {}`.
 * @fires close - `CustomEvent` (bubbles) after the panel closes. `detail = {}`.
 *
 * @method show   - `show() => void` — open the panel programmatically.
 * @method hide   - `hide() => void` — close the panel and return focus to the trigger.
 * @method toggle - `toggle() => void` — open if closed, close if open.
 *
 * @cssprop [--pd-popover-gap]     - Gap between trigger and panel (defaults to `--sp-2`).
 * @cssprop [--pd-popover-padding] - Panel padding (defaults to `--sp-3`).
 *
 * @example
 * // <puredashboard-popover placement="bottom-start">
 * //   <button data-popover-trigger>Options</button>
 * //   <div data-popover-content>Hello</div>
 * // </puredashboard-popover>
 * const pop = document.querySelector("puredashboard-popover");
 * pop.addEventListener("open", () => console.log("opened"));
 * pop.show();
 */
class PuredashboardPopover extends HTMLElement {
  static get observedAttributes() { return ["placement", "open"]; }

  constructor() {
    super();
    this._wired = false;
    this._trigger = null;
    this._content = null;
    this._open = false;
    // Feature-detect the native Popover API once; the rest of the module branches
    // on this flag, exactly like menu.js.
    this._usePopover = false;
    // A template engine may set these properties before upgrade, leaving a plain
    // own-property that shadows the prototype accessor. Reconcile so the setters
    // run — same pattern as form.js.
    this._upgrade("placement");
    this._upgrade("open");
    this._upgrade("labels");
  }

  _upgrade(p) {
    if (Object.prototype.hasOwnProperty.call(this, p)) { const v = this[p]; delete this[p]; this[p] = v; }
  }

  attributeChangedCallback(name, _old, val) {
    if (name === "placement") { this._placement = PLACEMENTS.has(val) ? val : "bottom-start"; this._reposition(); }
    // Defer "open" until connected — connectedCallback picks it up once the
    // author's children exist and can be wired. Acting now would wire (and find
    // no children) before they're appended.
    else if (name === "open" && this.isConnected) { if ((val !== null) !== this._open) this._setOpen(val !== null); }
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  // ---- properties ----------------------------------------------------------
  get placement() { return this._placement || "bottom-start"; }
  set placement(v) {
    this._placement = PLACEMENTS.has(v) ? v : "bottom-start";
    if (this._placement === v) this.setAttribute("placement", v);
    this._reposition();
  }

  get open() { return this._open; }
  set open(v) { this._setOpen(!!v); }

  connectedCallback() {
    this._wire();
    // Honour a declarative open="" once wired.
    if (this.hasAttribute("open")) this._setOpen(true);
    // A RELOCATION looks like a reconnect: re-parenting a node is a remove plus an insert,
    // so any keyed list that moves this row (a repeat() reorder, and a filter that leaves
    // survivors non-adjacent) runs this again. The panel is positioned once from
    // getBoundingClientRect on open and has no reposition listener, so it needs re-anchoring
    // to a trigger that has travelled. The line above cannot do it: _setOpen returns early
    // when the state is already open. Re-assert the PANEL itself instead — deliberately not
    // _setOpen, which would re-fire "open" and re-run the focus move. Closing here instead
    // would be worse than doing nothing: _setOpen(false) runs _returnFocus(), which takes
    // focus off whatever the user was actually using and puts it on our trigger, and emits a
    // "close" nobody asked for. Same shape combobox.js already uses (_syncPopup on every
    // render). Measured in Chrome, row sent to the end of a five-row list: without this the
    // panel is left 331px from its trigger under an atomic move, or hidden while `open` and
    // aria-expanded still say true under insertBefore; with it the gap after equals the gap
    // at open, on both.
    if (this._open) { this._showPanel(); this._reposition(); }
  }

  disconnectedCallback() {
    // Tear down global listeners so a detached popover leaves nothing behind.
    this._removeGlobals();
    if (this._trigger) this._trigger.removeEventListener("click", this._onTriggerClick);
  }

  // Identify the trigger + content, keep the trigger in place, promote the content
  // to a top-layer popover, and wire ARIA + the trigger click. Guarded so it runs
  // exactly once even across disconnect/reconnect.
  _wire() {
    if (this._wired) return;
    this._wired = true;

    if (!this._placement) this._placement = PLACEMENTS.has(this.getAttribute("placement")) ? this.getAttribute("placement") : "bottom-start";

    // Trigger: explicit [data-popover-trigger], else the first element child.
    this._trigger = this.querySelector("[data-popover-trigger]") || this.firstElementChild;
    // Content: explicit [data-popover-content], else the next element sibling of
    // the trigger (best-effort so minimal markup works).
    this._content = this.querySelector("[data-popover-content]");
    if (!this._content && this._trigger) {
      let n = this._trigger.nextElementSibling;
      while (n && n === this._trigger) n = n.nextElementSibling;
      this._content = n;
    }
    if (!this._trigger || !this._content) return;   // nothing to wire

    this._content.classList.add("puredashboard-popover__panel", "js-puredashboard-popover__panel");
    if (!this._content.id) this._content.id = `js-puredashboard-popover__panel-${++uid}`;

    // Promote the content to the top layer where the API exists; otherwise mark it
    // as the fallback (a plain fixed element toggled via [data-open]).
    this._usePopover = typeof this._content.showPopover === "function";
    if (this._usePopover) {
      this._content.setAttribute("popover", "auto");
      // The browser fires "toggle" on popover state changes (incl. light-dismiss
      // / Esc); keep our state + ARIA in sync when the platform closes it.
      this._content.addEventListener("toggle", this._onToggle);
    } else {
      this._content.classList.add("puredashboard-popover__panel--fallback");
    }

    // Give the panel an accessible name if the author didn't.
    if (!this._content.getAttribute("aria-label") && !this._content.getAttribute("aria-labelledby")) {
      this._content.setAttribute("aria-label", this._label("dialog"));
    }
    if (!this._content.getAttribute("role")) this._content.setAttribute("role", "dialog");

    // Wire the trigger: it controls a dialog-like panel.
    this._trigger.setAttribute("aria-haspopup", "dialog");
    this._trigger.setAttribute("aria-expanded", "false");
    this._trigger.setAttribute("aria-controls", this._content.id);
    this._trigger.addEventListener("click", this._onTriggerClick);
  }

  _onTriggerClick = (e) => {
    e.preventDefault();
    this.toggle();
  };

  // The platform "toggle" event tells us the popover's real state — reconcile so
  // outside-click / Esc dismiss (handled by the browser) flip our state + ARIA and
  // emit our own close event.
  _onToggle = (e) => {
    const nowOpen = e.newState === "open";
    if (nowOpen === this._open) return;
    this._open = nowOpen;
    this._reflectOpen();
    if (nowOpen) { this._reposition(); this.emit("open"); }
    else { this.emit("close"); this._returnFocus(); }
  };

  // ---- open/close ----------------------------------------------------------
  show() { this._setOpen(true); }
  hide() { this._setOpen(false); }
  toggle() { this._setOpen(!this._open); }

  _setOpen(next) {
    if (!this._wired) this._wire();
    if (!this._trigger || !this._content) return;
    if (next === this._open) return;
    this._open = next;
    this._reflectOpen();

    if (next) {
      this._showPanel();
      this._reposition();
      this._addGlobals();
      this.emit("open");
    } else {
      this._hidePanel();
      this._removeGlobals();
      this.emit("close");
      this._returnFocus();
    }
  }

  // Reflect state onto the host attribute + the trigger's aria-expanded.
  _reflectOpen() {
    if (this._open) { if (!this.hasAttribute("open")) this.setAttribute("open", ""); }
    else if (this.hasAttribute("open")) this.removeAttribute("open");
    if (this._trigger) this._trigger.setAttribute("aria-expanded", this._open ? "true" : "false");
  }

  _showPanel() {
    if (this._usePopover) {
      // Guard the API call: even where showPopover exists it can throw (already
      // open, disconnected). Fall through to the visual fallback marker.
      try { if (!this._content.matches(":popover-open")) this._content.showPopover(); }
      catch { this._content.setAttribute("data-open", ""); }
    } else {
      this._content.setAttribute("data-open", "");
    }
  }

  _hidePanel() {
    if (this._usePopover) {
      try { if (this._content.matches(":popover-open")) this._content.hidePopover(); } catch { /* */ }
    }
    this._content.removeAttribute("data-open");
  }

  // Return focus to the trigger when the panel closes, so keyboard users aren't
  // stranded on a now-hidden element.
  _returnFocus() {
    if (this._trigger && typeof this._trigger.focus === "function") this._trigger.focus();
  }

  // ---- fallback dismiss (Esc + outside-click) ------------------------------
  // The native popover=auto handles these for free; we only add manual handlers
  // in the fallback path.
  _addGlobals() {
    if (this._usePopover) return;
    document.addEventListener("keydown", this._onKey, true);
    document.addEventListener("pointerdown", this._onOutside, true);
  }
  _removeGlobals() {
    document.removeEventListener("keydown", this._onKey, true);
    document.removeEventListener("pointerdown", this._onOutside, true);
  }
  _onKey = (e) => { if (e.key === "Escape" && this._open) { e.preventDefault(); this.hide(); } };
  _onOutside = (e) => {
    if (!this._open) return;
    const t = e.target;
    if (this._content && this._content.contains(t)) return;
    if (this._trigger && this._trigger.contains(t)) return;
    this.hide();
  };

  // ---- positioning ---------------------------------------------------------
  // Anchor the panel to the trigger per `placement`, computed from
  // getBoundingClientRect on open, flipping within the viewport best-effort.
  // Guarded for jsdom, where layout metrics are 0 and window sizes are absent.
  _reposition() {
    if (!this._open || !this._trigger || !this._content) return;
    let r;
    try { r = this._trigger.getBoundingClientRect(); } catch { return; }
    if (!r || (r.width === 0 && r.height === 0 && r.top === 0 && r.left === 0)) {
      // jsdom / not laid out — nothing sensible to compute; leave it to CSS.
      return;
    }
    const gap = 8;
    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;
    const pw = this._content.offsetWidth || 200;
    const ph = this._content.offsetHeight || 120;
    const p = this.placement;

    let top, left;
    const side = p.startsWith("top") ? "top" : p.startsWith("bottom") ? "bottom" : p;

    if (side === "top" || side === "bottom") {
      top = side === "bottom" ? r.bottom + gap : r.top - gap - ph;
      // flip vertically if it would overflow and the other side fits
      if (vh) {
        if (side === "bottom" && top + ph > vh && r.top - gap - ph > 0) top = r.top - gap - ph;
        else if (side === "top" && top < 0 && r.bottom + gap + ph < vh) top = r.bottom + gap;
      }
      // cross-axis alignment
      if (p.endsWith("-end")) left = r.right - pw;
      else if (p === "top" || p === "bottom") left = r.left + (r.width - pw) / 2;
      else left = r.left;   // -start (default)
    } else {   // left / right
      left = side === "right" ? r.right + gap : r.left - gap - pw;
      if (vw) {
        if (side === "right" && left + pw > vw && r.left - gap - pw > 0) left = r.left - gap - pw;
        else if (side === "left" && left < 0 && r.right + gap + pw < vw) left = r.right + gap;
      }
      top = r.top + (r.height - ph) / 2;
    }

    if (vw) left = Math.max(8, Math.min(left, vw - pw - 8));
    if (vh) top = Math.max(8, Math.min(top, vh - ph - 8));

    this._content.style.top = top + "px";
    this._content.style.left = left + "px";
  }

  // ---- events --------------------------------------------------------------
  emit(name, detail = {}) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
  }
}

customElements.define("puredashboard-popover", PuredashboardPopover);

export { PuredashboardPopover };
