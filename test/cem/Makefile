# Regenerate the agent API reference (src/_components.jsonl). Dev-only; needs Docker.
#
#   make -C test/cem        # → writes src/_components.jsonl
#
# Run this after adding or changing a component's JSDoc so the reference stays in
# sync. It's one JSON line per component, consumed by AI agents (which read it by
# path). This is NOT wired for editor auto-discovery — that would need a
# package.json "customElements" field + the standard custom-elements.json name,
# neither of which this repo has (the `_` prefix is deliberate, to keep the file
# out of the go:embed binary). See to-jsonl.mjs for the flatten step.

IMAGE = puredashboard-cem
ROOT  = $(shell cd ../.. && pwd)

manifest:
	docker build -q -t $(IMAGE) .
	docker run --rm -v "$(ROOT):/work/web:ro" -v "$(ROOT)/src:/out" $(IMAGE)

.PHONY: manifest
