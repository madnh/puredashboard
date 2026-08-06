// A source file that git classifies as BINARY is a source file nobody can review.
//
// git calls a blob binary when it finds a NUL in the first 8000 bytes. It then prints
// `Bin 5815 -> 5815 bytes` instead of a diff, and `git log -p` and `git blame` go blind on
// that file — silently, with the tests passing and the component working, because a NUL used
// as a separator does exactly what it was written to do.
//
// This repo shipped two such files (src/descriptions.js, tools/api-reference/to-jsonl.mjs),
// each a sentinel written as a literal NUL instead of the two-character escape JavaScript
// reads identically. Neither was found by anything here. A consuming app scanning its own
// vendored tree found the first and asked the general question that found the second, and
// then suggested this: keep the check caught rather than remembered.
//
// It punishes through more than git. `grep` classifies by the same rule and then says
// NOTHING — it returned 0 on a file whose contents were plainly visible, which reads as a
// tooling quirk rather than a defect. The reporting app hit a third variant: `grep -c $'\000'`
// in zsh matched every line, because the shell could not pass a NUL through and grep fell back
// to an empty pattern. Three tools, three ways of being unable to say "I cannot answer this".
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };

const root = new URL("../", import.meta.url).pathname;
// Directories whose contents are reviewed as text. docs/images is deliberately absent — PNGs
// are binary and should be.
const ROOTS = ["src", "test", "tools"];
const TEXT = /\.(js|mjs|cjs|css|md|json|jsonl|html|txt|yml|yaml)$/i;

function* walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) yield* walk(p);
    else if (TEXT.test(name)) yield p;
  }
}

const offenders = [];
let scanned = 0;
for (const r of ROOTS) {
  for (const file of walk(join(root, r))) {
    scanned++;
    const buf = readFileSync(file);
    // git's own rule: a NUL anywhere in the first 8000 bytes makes the blob binary.
    const head = buf.subarray(0, 8000);
    const at = head.indexOf(0);
    if (at !== -1) offenders.push(`${file.slice(root.length)} (NUL at byte ${at})`);
  }
}

ok(scanned > 0, `scanned some files at all — got ${scanned}`);
ok(
  offenders.length === 0,
  "no text source contains a NUL, so git can diff it and grep can search it — offenders: " +
    offenders.join(", "),
);

console.log(`\nno-binary-sources.test.mjs: ${pass} passed, ${fail} failed (${scanned} files scanned)`);
process.exit(fail ? 1 : 0);
