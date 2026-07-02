# Regenerate the Custom Elements Manifest. Dev-only; needs Docker.
#
#   make -C test/cem        # → writes src/_custom-elements.json
#
# Run this after adding or changing a component's JSDoc so the machine-readable
# API manifest stays in sync. Its consumer HERE is AI agents (which read it by
# path) — editor auto-discovery does NOT apply: that needs a package.json
# "customElements" field + the standard filename, neither of which this repo has
# (the `_` prefix is deliberate, to keep the file out of the go:embed binary).
# Output is pretty-printed so agents can grep a tag and read just its slice.

IMAGE = puredashboard-cem
ROOT  = $(shell cd ../.. && pwd)

manifest:
	docker build -q -t $(IMAGE) .
	docker run --rm -v "$(ROOT):/work/web:ro" -v "$(ROOT)/src:/out" $(IMAGE)

.PHONY: manifest
