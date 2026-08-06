# Regenerates the agent API reference (src/_components.jsonl) from the JSDoc in
# src/*.js. Uses @custom-elements-manifest/analyzer to parse the JSDoc, then
# to-jsonl.mjs flattens it to ONE JSON LINE PER COMPONENT — inside a throwaway
# image so the host installs nothing (mirrors test/Dockerfile's jsdom approach).
# It is DOC DATA, not shipped code: the src/*.js/*.css files still ship as-is,
# and the _-prefixed .jsonl is skipped by the go:embed walker.
FROM node:22-alpine
WORKDIR /work
RUN npm init -y >/dev/null 2>&1 && npm pkg set type=module \
    && npm install --no-audit --no-fund @custom-elements-manifest/analyzer@0.10.4
# Analyze the mounted src into a manifest, then flatten it to one-line-per-
# component JSON Lines at /out/_components.jsonl. JSONL — not the raw manifest —
# so an agent can grep the ONE line it needs (~0.3–2k tokens) instead of loading
# the ~65k-token nested manifest, and the JSDoc @example (which the manifest
# drops) is folded back in.
#
# Three things this has to work around, each of which broke the run:
#  - cem resolves --outdir RELATIVE TO CWD, so an absolute /tmp/cem became
#    /work/web/tmp/cem — inside the read-only repo mount, and the analyze died. We cd
#    into a writable dir and keep the outdir relative.
#  - to-jsonl.mjs resolves each @example from join(srcDir, "..", mod.path), and mod.path
#    comes from the glob, so the sources must sit in a directory literally named `src`
#    for the paths to line up. Hence copying to /work/gen/src, not analyzing in place.
#  - `> /out/_components.jsonl` truncates the target BEFORE the pipeline runs, so a
#    failure anywhere left the SHIPPED reference empty (it did). Write to a temp file and
#    mv it, with `set -e` so a failed analyze never reaches the mv.
CMD ["sh", "-c", "set -e; mkdir -p /work/gen; cp -r /work/web/src /work/gen/src; cd /work/gen; /work/node_modules/.bin/cem analyze --globs 'src/*.js' --outdir cem-out; node /work/web/tools/api-reference/to-jsonl.mjs cem-out/custom-elements.json src > /work/out.jsonl; mv /work/out.jsonl /out/_components.jsonl; echo \"wrote /out/_components.jsonl ($(wc -l < /out/_components.jsonl) lines)\""]
