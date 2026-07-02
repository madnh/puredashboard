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
CMD ["sh", "-c", "cd /work/web && /work/node_modules/.bin/cem analyze --globs 'src/*.js' --outdir /tmp/cem && node tools/api-reference/to-jsonl.mjs /tmp/cem/custom-elements.json src > /out/_components.jsonl && echo 'wrote /out/_components.jsonl'"]
