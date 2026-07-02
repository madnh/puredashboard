# Regenerates the Custom Elements Manifest (src/_custom-elements.json) from the
# JSDoc in src/*.js, using @custom-elements-manifest/analyzer — inside a throwaway
# image so the host installs nothing (mirrors ../Dockerfile's jsdom approach).
# The manifest is DOC DATA, not shipped code: the src/*.js/*.css files still ship
# as-is, and the _-prefixed manifest is skipped by the go:embed walker.
FROM node:22-alpine
WORKDIR /work
RUN npm init -y >/dev/null 2>&1 && npm pkg set type=module \
    && npm install --no-audit --no-fund @custom-elements-manifest/analyzer@0.10.4
# Analyze the mounted src, then write a PRETTY-PRINTED manifest to the /out mount.
# Pretty (2-space) — NOT minified — so agents/editors can grep a `"tagName"` line
# and read just that component's slice (~2k tokens) instead of loading the whole
# ~65k-token file. It's dev-only doc data (the _-prefixed file is skipped by
# go:embed), so the extra newlines never ship.
CMD ["sh", "-c", "cd /work/web && /work/node_modules/.bin/cem analyze --globs 'src/*.js' --outdir /tmp/cem && node -e 'const fs=require(\"fs\");fs.writeFileSync(\"/out/_custom-elements.json\",JSON.stringify(require(\"/tmp/cem/custom-elements.json\"),null,2)+\"\\n\")' && echo 'wrote /out/_custom-elements.json'"]
