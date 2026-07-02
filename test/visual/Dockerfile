# Visual-test image — Playwright + Chromium, baked in so the host installs nothing
# (mirrors ../Dockerfile's jsdom-in-Docker approach). The web tree is mounted
# read-only at /work/web; screenshots are written to the /out volume.
#
# The runtime library stays strictly zero-dependency and CSP-safe; this is
# dev-only tooling that is never shipped.
FROM mcr.microsoft.com/playwright:v1.48.0-jammy
WORKDIR /work
RUN npm init -y >/dev/null 2>&1 && npm pkg set type=module && npm install --no-audit --no-fund playwright@1.48.0
COPY shoot.mjs /work/shoot.mjs
# Serve the mounted tree, screenshot every component (light+dark) to /out.
CMD ["node", "/work/shoot.mjs"]
