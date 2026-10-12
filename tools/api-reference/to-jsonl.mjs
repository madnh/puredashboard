// Transform a Custom Elements Manifest (from @custom-elements-manifest/analyzer)
// into ONE-LINE-PER-COMPONENT JSON Lines, for AI agents.
//
//   node to-jsonl.mjs <custom-elements.json> <srcDir> > _components.jsonl
//
// Each line is a complete, self-contained descriptor of one custom element —
// tag, summary, props, attrs, events, slots, CSS custom props, and a usage
// example — so an agent can `grep '"tag":"puredashboard-x"'` a single line and
// have everything, then pipe it to `jq`/node/python to read a field.
//
// The IMPERATIVE APIs (dialog, drawer, alert, menu, toast…) are plain functions, which
// the manifest does not describe (it attaches no JSDoc to them), so they used to be
// missing entirely and agents guessed their options. Every `/** … @function name … */`
// block in src/*.js now becomes a line too: `grep '"function":"dialog"'`.
//
// Why a transform and not the raw manifest: the CEM is ~65k tokens of nested
// JSON (unreadable in slices) AND it drops @example. This flattens the useful
// parts and folds the JSDoc @example back in, while filtering analyzer noise
// (private #/_ fields, the reactive `properties` bag, and spurious dynamically
// dispatched events — kept out by requiring a description).

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const [, , manifestPath, srcDir] = process.argv;
if (!manifestPath || !srcDir) {
  console.error("usage: node to-jsonl.mjs <custom-elements.json> <srcDir>");
  process.exit(1);
}

const cem = JSON.parse(readFileSync(manifestPath, "utf8"));

// Pull the class-level @example block out of a source file's JSDoc: the lines
// between `@example` and the next `@tag` / end of comment, with ` * ` stripped.
function exampleFor(path) {
  let text;
  try { text = readFileSync(path, "utf8"); } catch { return ""; }
  const at = text.indexOf("@example");
  if (at < 0) return "";
  const lines = text.slice(at).split("\n").slice(1); // drop the "@example" line
  const out = [];
  for (const raw of lines) {
    if (/^\s*\*?\s*@\w+/.test(raw)) break; // next JSDoc tag → stop
    if (/\*\//.test(raw)) break;           // end of comment → stop
    out.push(raw.replace(/^\s*\*\/?/, "").replace(/^ /, "")); // strip " * "
  }
  return out.join("\n").trim();
}

// First sentence of the class description, protecting common abbreviations
// (e.g., i.e., etc.) so their period doesn't end the summary prematurely.
const ABBR = /\b(e\.g|i\.e|etc|vs|cf|Dr|Mr|Ms|Fig|No)\./g;
const DOT = "\u0000"; // sentinel standing in for a protected abbreviation dot
function firstSentence(s) {
  if (!s) return "";
  const prot = s.replace(/\s+/g, " ").trim().replace(ABBR, `$1${DOT}`);
  const m = prot.match(/^.*?[.](?=\s|$)/);
  return (m ? m[0] : prot).split(DOT).join(".").trim();
}

const clean = (s) => (s ? s.replace(/\s+/g, " ").trim() : undefined);
const eventName = (n) => n.split("#").pop(); // "puredashboard-x#change" → "change"

const rows = [];
for (const mod of cem.modules || []) {
  const example = exampleFor(join(srcDir, "..", mod.path)); // mod.path is "src/x.js"
  for (const decl of mod.declarations || []) {
    if (!decl.customElement || !decl.tagName) continue;

    const props = (decl.members || [])
      .filter((m) => m.kind === "field" && !/^[_#]/.test(m.name) && m.name !== "properties")
      .map((m) => {
        const p = { name: m.name };
        if (m.type?.text) p.type = m.type.text;
        if (m.default !== undefined) p.default = m.default;
        if (m.description) p.desc = clean(m.description);
        return p;
      });

    const events = (decl.events || [])
      .filter((e) => e.description) // drops spurious dynamically dispatched events
      .map((e) => ({ name: eventName(e.name), desc: clean(e.description) }));

    const attrs = (decl.attributes || []).map((a) => a.name);
    const slots = (decl.slots || []).map((s) => ({ name: s.name || "(default)", desc: clean(s.description) }));
    const cssProps = (decl.cssProperties || []).map((c) => ({ name: c.name, desc: clean(c.description) }));

    const row = {
      tag: decl.tagName,
      extends: decl.superclass?.name,
      summary: firstSentence(decl.description),
      props,
      events,
    };
    if (attrs.length) row.attrs = attrs;
    if (slots.length) row.slots = slots;
    if (cssProps.length) row.cssProps = cssProps;
    if (example) row.example = example;
    row.file = mod.path;
    rows.push(row);
  }
}

// ---- imperative functions: parse their JSDoc straight from the source ----------------
// A block's text up to the first @tag is the description; @param {type} name - desc,
// @returns {type} desc, and @example (to the next @tag / end of block) are read as-is.
function parseFunctionBlocks(file, text) {
  const out = [];
  for (const m of text.matchAll(/\/\*\*([\s\S]*?)\*\//g)) {
    const lines = m[1].split("\n").map((l) => l.replace(/^\s*\* ?/, ""));
    const body = lines.join("\n");
    const fn = body.match(/@function\s+([\w$]+)/);
    if (!fn) continue;
    const tagAt = body.search(/^@\w+/m);
    const desc = clean(tagAt < 0 ? body : body.slice(0, tagAt));
    // split into @tag chunks
    const chunks = body.slice(tagAt < 0 ? body.length : tagAt).split(/^(?=@\w+)/m);
    const params = [];
    let returns, example;
    for (const c of chunks) {
      const pm = c.match(/^@param\s+\{([^}]*)\}\s+(\[?[\w$.]+\]?)\s*-?\s*([\s\S]*)$/);
      if (pm) { params.push({ name: pm[2].replace(/[[\]]/g, ""), type: pm[1], optional: pm[2].startsWith("[") || undefined, desc: clean(pm[3]) }); continue; }
      const rm = c.match(/^@returns?\s+\{([^}]*)\}\s*([\s\S]*)$/);
      if (rm) { returns = { type: rm[1], desc: clean(rm[2]) }; continue; }
      if (/^@example/.test(c)) example = c.replace(/^@example[^\n]*\n?/, "").replace(/\s+$/, "");
    }
    const row = { function: fn[1], summary: firstSentence(desc), desc, params };
    if (returns) row.returns = returns;
    if (example) row.example = example;
    row.file = file;
    out.push(row);
  }
  return out;
}
for (const f of readdirSync(srcDir).filter((n) => n.endsWith(".js")).sort()) {
  rows.push(...parseFunctionBlocks("src/" + f, readFileSync(join(srcDir, f), "utf8")));
}

const keyOf = (r) => r.tag || r.function;
rows.sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
process.stdout.write(rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
