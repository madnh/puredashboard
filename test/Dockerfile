# Test image for the vendored reactive.js template engine.
#
# jsdom (a headless DOM) lives ONLY inside this image — the host repo and the
# developer's machine never install it. The web runtime itself stays strictly
# zero-dependency and CSP-safe; this is test tooling that is never shipped.
#
# The web tree is mounted read-only at /work/web at run time. Tests import the
# engine via ../src/reactive.js and resolve `jsdom` by walking up to
# /work/node_modules (baked into the image below).
FROM node:22-alpine
WORKDIR /work
RUN npm init -y >/dev/null 2>&1 && npm pkg set type=module && npm install --no-audit --no-fund jsdom@29.1.1
# Run every *.test.mjs as its own process (each sets up its own jsdom); aggregate
# exit codes so any failing suite fails the build.
CMD ["sh", "-c", "ec=0; for f in /work/web/test/*.test.mjs; do echo \"### $f\"; node \"$f\" || ec=1; done; exit $ec"]
