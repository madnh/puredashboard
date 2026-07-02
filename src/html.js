// In-house tagged-template HTML builder. Auto-escapes every ${...} interpolation
// so callers can't forget to escape (the XSS footgun of string concatenation).
// Zero dependencies, CSP-safe (no eval). Returns a SafeString (marked) so nested
// html`` results and arrays of them are inserted verbatim, while plain values are
// escaped. Use raw() ONLY for trusted pre-built markup (e.g. an inline SVG icon).
const SAFE = Symbol.for("puredashboard.safe");   // shared so reactive.js recognizes SafeStrings

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function mark(str) { return { [SAFE]: true, toString() { return str; } }; }

// piece renders one interpolated value: SafeString → verbatim; array → each piece
// joined (so html`${items.map(i => html`...`)}` works with no .join); null/undefined
// → ""; anything else → escaped.
function piece(v) {
  if (v == null) return "";
  if (v[SAFE]) return v.toString();
  if (Array.isArray(v)) return v.map(piece).join("");
  return esc(v);
}

export function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += piece(vals[i]) + strings[i + 1];
  return mark(out);
}

// raw marks an ALREADY-TRUSTED string as safe (no escaping). Use sparingly — only
// for markup we generate ourselves (never for anything derived from server data).
export const raw = (s) => mark(String(s ?? ""));

// icon renders a Lucide sprite reference as trusted markup. `name` is validated to
// a strict charset because avatar names can round-trip through the server (operator-
// chosen), so an unguarded raw() here would be an XSS hole. Unknown/empty → nothing.
export const icon = (name, cls = "") =>
  /^[a-z0-9-]+$/.test(name) ? raw(`<svg class="ic ${esc(cls)}"><use href="#i-${name}"/></svg>`) : html``;

export { esc as escapeHTML };
