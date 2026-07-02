# Regenerate the Custom Elements Manifest. Dev-only; needs Docker.
#
#   make -C test/cem        # → writes src/_custom-elements.json
#
# Run this after adding or changing a component's JSDoc so the machine-readable
# API manifest (used by editors + AI agents) stays in sync.

IMAGE = puredashboard-cem
ROOT  = $(shell cd ../.. && pwd)

manifest:
	docker build -q -t $(IMAGE) .
	docker run --rm -v "$(ROOT):/work/web:ro" -v "$(ROOT)/src:/out" $(IMAGE)

.PHONY: manifest
