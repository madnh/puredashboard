# Isolated web test runner for the vendored reactive.js engine.
#
# jsdom lives ONLY inside the Docker image built here — it never touches the host
# or the repo (no node_modules, no global install). The web runtime stays strictly
# zero-dependency; this is throwaway test tooling.
#
# Usage (from anywhere):
#   make -C path/to/puredashboard/test
# or:
#   cd test && make

HERE := $(dir $(realpath $(lastword $(MAKEFILE_LIST))))
WEB  := $(realpath $(HERE)..)

.PHONY: test
test: ## Build the test image and run reactive.js tests against a real (jsdom) DOM
	docker build -q -t puredashboard-web-test "$(HERE)"
	docker run --rm -v "$(WEB):/work/web:ro" puredashboard-web-test
