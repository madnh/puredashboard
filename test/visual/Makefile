# Visual review / regression — screenshot every component from PureBook (light +
# dark) into ./__shots__. Dev-only; needs Docker. The library itself installs
# nothing (see ../../CLAUDE.md).
#
#   make -C test/visual        # build the image + capture all shots
#
# Output lands in test/visual/__shots__/ (gitignored). Review by eye, or wire a
# diff against a committed baseline for visual regression.

IMAGE = puredashboard-visual-test
ROOT  = $(shell cd ../.. && pwd)

shots:
	docker build -q -t $(IMAGE) .
	mkdir -p __shots__
	docker run --rm \
	  -v "$(ROOT):/work/web:ro" \
	  -v "$(ROOT)/test/visual/__shots__:/out" \
	  $(IMAGE)

.PHONY: shots
