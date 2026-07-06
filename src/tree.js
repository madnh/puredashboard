// <puredashboard-tree> — a single-select hierarchical tree view. Zero-dep, no build,
// CSP-safe. Built on the Reactive base.
//
// Family: a Reactive custom element whose render() returns a reactive.js html`` tree
// (it's not a form control and holds no submittable value). It follows the WAI-ARIA
// APG "Tree View" (single-select) pattern by hand — a role="tree" container holding
// role="treeitem" rows (nested role="group" lists for children), roving tabindex
// (exactly one treeitem tabbable), and the full Arrow/Home/End/Enter/Space keyboard
// map with type-ahead. Sibling in spirit to nav.js (a group/leaf tree with real
// links + icons) and radio-group.js (roving tabindex + APG keyboard), but selection
// is a first-class, single-value concept here and is kept SEPARATE from focus.
//
// Class naming (BEM, block = the component tag): style classes are namespaced
// `puredashboard-tree__<element>[--<modifier>]`. Script hooks are SEPARATE `js-…`
// classes / data-* attributes — don't style those. Node icons are author-provided
// inline SVG markup, treated as TRUSTED (same contract as nav.js / menu.js icons):
// rendered via raw() from html.js. Node labels are author CONTENT and are escaped
// html`` interpolation (never raw()). The built-in twisty is a self-contained SVG.
//
// Navigation model: on every render we FLATTEN the tree to the list of currently
// VISIBLE nodes (a node is visible iff every ancestor is expanded) in document
// order, each tagged with its depth/level and its parent. Arrow-Up/Down step through
// that flat list, so collapsed subtrees are skipped for free. Arrow-Right/Left
// implement the APG twisty semantics against the same model (see _onKeydown).
import { Reactive, html, repeat } from "./reactive.js";
import { raw } from "./html.js";

// All FIXED user-facing strings (English defaults). Override any subset via the
// `labels` property to localise — e.g. tree.labels = { ariaLabel: "Cây" }. NB: node
// labels are CONTENT (they live on each node), NOT here. Function-valued keys
// interpolate.
const LABELS = {
  ariaLabel: "Tree",
};

// Built-in twisty (disclosure) icon — a right-pointing chevron that CSS rotates when
// the parent is expanded. Trusted author-free markup, so raw() is fine.
const twisty = raw('<svg class="puredashboard-tree__twisty-icon" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-.14em;overflow:visible;flex:none" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>');

/**
 * Single-select hierarchical tree view. Renders a `role="tree"` container built from a
 * tree of `nodes`; every node is a `role="treeitem"` and each node's children live in a
 * nested `role="group"` list. Implements the WAI-ARIA APG "Tree View" (single-select)
 * pattern: `aria-level` / `aria-setsize` / `aria-posinset` on every item, `aria-expanded`
 * on every parent, `aria-selected` on the selected item, roving tabindex (exactly one
 * treeitem tabbable), and the full keyboard map (Arrow keys, Home/End, Enter/Space,
 * type-ahead). Selection is kept separate from focus. Configure entirely via JS
 * properties.
 *
 * Not a form control — it holds no submittable value; it exposes the selection via the
 * `selectedKey` property and a bubbling `select` event.
 *
 * @element puredashboard-tree
 *
 * @prop {Array} nodes - Hierarchical data. A node is `{ id, label, icon?, children? }`:
 *   `id` (string, required) is its stable key; `label` (string|Node, required) is the visible
 *   text — it accepts a string (auto-escaped) OR a DOM node / nested `html` template / array,
 *   so pass a node or template to embed a custom element (you build it, you own its safety;
 *   plain strings stay escaped); `icon` (string of trusted SVG markup) renders before
 *   the label; `children` (node[]) makes it an expandable parent. Default `[]`.
 * @prop {string} selectedKey - `id` of the selected node (get/set). Default `""` (none).
 * @prop {Array<string>|Set<string>} expandedKeys - `id`s of expanded parents; accepts an
 *   array or a `Set` (normalised to a `Set` internally). Default `[]`.
 * @prop {Object} [labels] - Override UI strings (English defaults). Keys: `ariaLabel`.
 * @attr {string} aria-label      - Accessible name for the tree (mirrored to the tree root).
 * @attr {string} aria-labelledby - IDs labelling the tree (mirrored to the tree root).
 *
 * @fires select - Bubbling `CustomEvent` on selection. `detail`: `{ key, node }`.
 * @fires toggle - Bubbling `CustomEvent` on expand/collapse. `detail`: `{ key, expanded }`.
 *
 * @method focus - `focus() => void` — focus the current roving-tabindex treeitem.
 *
 * @cssprop [--pd-tree-item-height] - Row height (defaults to `--control-height-md`).
 * @cssprop [--pd-tree-indent]      - Per-level indent (defaults to `--sp-4`).
 *
 * @example
 * const tree = document.createElement("puredashboard-tree");
 * tree.nodes = [
 *   { id: "src", label: "src", children: [
 *     { id: "app", label: "app.js" },
 *     { id: "lib", label: "lib", children: [{ id: "util", label: "util.js" }] },
 *   ] },
 *   { id: "readme", label: "README.md" },
 * ];
 * tree.expandedKeys = ["src"];
 * tree.selectedKey = "app";
 * tree.addEventListener("select", (e) => console.log(e.detail.key, e.detail.node));
 * document.body.append(tree);
 */
class PuredashboardTree extends Reactive {
  static properties = { nodes: {}, selectedKey: {}, expandedKeys: {}, labels: {} };

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    if (this.nodes == null) this.nodes = [];
    if (this.selectedKey == null) this.selectedKey = "";
  }

  focus() { (this.$(`.js-puredashboard-tree__item[tabindex="0"]`) || this.$(`.js-puredashboard-tree__item`))?.focus(); }

  // The list of root nodes, always an array.
  _nodes() { return Array.isArray(this.nodes) ? this.nodes : []; }

  // A node is a parent when it declares children.
  _isParent(node) { return !!(node && node.children && node.children.length); }

  // expandedKeys accepts a Set or an array; normalise to a Set for membership checks.
  _expandedSet() {
    const e = this.expandedKeys;
    if (e instanceof Set) return e;
    return new Set(Array.isArray(e) ? e : []);
  }
  _isOpen(node) { return this._isParent(node) && this._expandedSet().has(node.id); }

  // Flatten the tree to the currently VISIBLE nodes (document order), each row tagged
  // with { node, level, setsize, posinset, parent }. A node is visible iff every
  // ancestor is expanded, so collapsed subtrees are naturally excluded — this is the
  // single source of truth for Arrow-Up/Down navigation and roving tabindex.
  _visible() {
    const out = [];
    const expanded = this._expandedSet();
    const walk = (siblings, level, parent) => {
      for (let i = 0; i < siblings.length; i++) {
        const node = siblings[i];
        out.push({ node, level, setsize: siblings.length, posinset: i + 1, parent });
        if (this._isParent(node) && expanded.has(node.id)) walk(node.children, level + 1, node);
      }
    };
    walk(this._nodes(), 1, null);
    return out;
  }

  // Roving-tabindex owner id: the selected node if it's currently visible, else the
  // first visible node — exactly one treeitem is tabbable at a time.
  _tabOwnerId(visible) {
    const sel = visible.find((r) => r.node.id === this.selectedKey);
    if (sel) return sel.node.id;
    return visible.length ? visible[0].node.id : null;
  }

  // Select a node by id: update state, move focus to its row, and emit `select` when the
  // selection actually changes. Central to click and keyboard activation.
  _select(id) {
    const node = this._findNode(id);
    if (!node) return;
    const changed = this.selectedKey !== id;
    this.selectedKey = id;
    queueMicrotask(() => this._focusId(id));
    if (changed) this.emit("select", { key: id, node });
  }

  // Toggle a parent's expanded state (add/remove from expandedKeys) and emit `toggle`.
  // Always writes back a fresh Set so the reactive setter sees a new value and re-renders.
  _toggle(id, force) {
    const node = this._findNode(id);
    if (!this._isParent(node)) return;
    const set = new Set(this._expandedSet());
    const open = force === undefined ? !set.has(id) : force;
    if (open === set.has(id)) return;
    if (open) set.add(id); else set.delete(id);
    this.expandedKeys = set;
    this.emit("toggle", { key: id, expanded: open });
  }

  // Move DOM focus to a node's row (after the render that created it exists).
  _focusId(id) { this.$(`.js-puredashboard-tree__item[data-id="${cssEsc(id)}"]`)?.focus(); }

  // Find a node anywhere in the tree by id.
  _findNode(id, nodes = this._nodes()) {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (this._isParent(n)) { const r = this._findNode(id, n.children); if (r) return r; }
    }
    return null;
  }

  // Keyboard: the WAI-ARIA APG "Tree View" map, run against the flat visible list.
  //   ArrowDown / ArrowUp — next / previous VISIBLE node (collapsed subtrees skipped).
  //   ArrowRight — on a collapsed parent: expand it; on an already-expanded parent:
  //                move focus to its first child; on a leaf: nothing.
  //   ArrowLeft  — on an expanded parent: collapse it; otherwise: move focus to the
  //                node's PARENT (closing the branch you came down).
  //   Home / End — first / last visible node.
  //   Enter / Space — select the focused node.
  //   printable char — type-ahead to the next visible node whose label starts with it.
  // Moving focus updates the roving tabindex on the next render; selection is separate.
  _onKeydown(e) {
    const id = e.currentTarget.dataset.id;
    const visible = this._visible();
    const at = visible.findIndex((r) => r.node.id === id);
    if (at < 0) return;
    const row = visible[at];
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        if (at + 1 < visible.length) this._focusId(visible[at + 1].node.id);
        return;
      }
      case "ArrowUp": {
        e.preventDefault();
        if (at - 1 >= 0) this._focusId(visible[at - 1].node.id);
        return;
      }
      case "ArrowRight": {
        e.preventDefault();
        if (this._isParent(row.node)) {
          if (this._isOpen(row.node)) this._focusId(row.node.children[0].id); // already open → first child
          else this._toggle(row.node.id, true);                              // collapsed → expand in place
        }
        return;
      }
      case "ArrowLeft": {
        e.preventDefault();
        if (this._isParent(row.node) && this._isOpen(row.node)) this._toggle(row.node.id, false); // open → collapse
        else if (row.parent) this._focusId(row.parent.id);                                        // else → parent
        return;
      }
      case "Home": {
        e.preventDefault();
        if (visible.length) this._focusId(visible[0].node.id);
        return;
      }
      case "End": {
        e.preventDefault();
        if (visible.length) this._focusId(visible[visible.length - 1].node.id);
        return;
      }
      case "Enter": case " ": case "Spacebar": {
        e.preventDefault();
        this._select(row.node.id);
        return;
      }
      default: {
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) this._typeAhead(e.key, at, visible);
      }
    }
  }

  // Type-ahead: focus the next visible node (wrapping) whose label starts with `ch`.
  _typeAhead(ch, from, visible) {
    const c = ch.toLowerCase();
    for (let k = 1; k <= visible.length; k++) {
      const r = visible[(from + k) % visible.length];
      if (String(r.node.label ?? "").toLowerCase().startsWith(c)) { this._focusId(r.node.id); return; }
    }
  }

  // Click on a row: the twisty toggles expansion; anywhere else selects the node.
  _onClick(e, node) {
    if (e.target.closest(".js-puredashboard-tree__twisty")) { this._toggle(node.id); return; }
    this._select(node.id);
  }

  // Render one treeitem <li> plus (for an expanded parent) its nested role="group" list.
  // `meta` is { level, setsize, posinset } from the flatten pass' sibling context; we
  // recompute it here directly from the sibling array so recursion stays self-contained.
  _renderNode(node, level, setsize, posinset, ownerId) {
    const isParent = this._isParent(node);
    const open = this._isOpen(node);
    const selected = node.id === this.selectedKey;
    const tabbable = node.id === ownerId;
    return html`<li class="puredashboard-tree__item js-puredashboard-tree__item${selected ? " puredashboard-tree__item--selected" : ""}${isParent ? " puredashboard-tree__item--parent" : ""}" role="treeitem" data-id="${node.id}" aria-level="${String(level)}" aria-setsize="${String(setsize)}" aria-posinset="${String(posinset)}" aria-selected="${selected ? "true" : "false"}" aria-expanded="${isParent ? (open ? "true" : "false") : null}" tabindex="${tabbable ? "0" : "-1"}" style="--pd-tree-depth:${String(level - 1)}" @click="${(e) => this._onClick(e, node)}" @keydown="${(e) => this._onKeydown(e)}"><span class="puredashboard-tree__row">${isParent ? html`<span class="puredashboard-tree__twisty js-puredashboard-tree__twisty" aria-hidden="true">${twisty}</span>` : html`<span class="puredashboard-tree__twisty puredashboard-tree__twisty--leaf" aria-hidden="true"></span>`}${node.icon ? html`<span class="puredashboard-tree__icon">${raw(node.icon)}</span>` : ""}<span class="puredashboard-tree__label">${node.label}</span></span></li>${isParent && open ? html`<li role="none" class="puredashboard-tree__group-wrap"><ul class="puredashboard-tree__group" role="group">${repeat(node.children, (c) => c.id, (c, i) => this._renderNode(c, level + 1, node.children.length, i + 1, ownerId))}</ul></li>` : ""}`;
  }

  render() {
    const roots = this._nodes();
    const ownerId = this._tabOwnerId(this._visible());
    const label = this.getAttribute("aria-label");
    const labelledby = this.getAttribute("aria-labelledby");
    return html`<ul class="puredashboard-tree__tree" role="tree" aria-label="${label ?? this._label("ariaLabel")}" aria-labelledby="${labelledby ?? ""}">${repeat(roots, (n) => n.id, (n, i) => this._renderNode(n, 1, roots.length, i + 1, ownerId))}</ul>`;
  }
}

// Minimal escape for an id used inside a [data-id="…"] attribute selector.
function cssEsc(s) { return String(s).replace(/["\\]/g, "\\$&"); }

PuredashboardTree.define("puredashboard-tree");

export { PuredashboardTree };
