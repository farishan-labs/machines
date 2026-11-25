PREFIX ?= $(HOME)/.local
BINDIR = $(PREFIX)/bin

.PHONY: install uninstall release release-upload

install:
	mkdir -p $(BINDIR)
	sed 's#@ROOT@#$(CURDIR)#g' $(CURDIR)/bin/machines.in > $(BINDIR)/machines
	chmod +x $(BINDIR)/machines

uninstall:
	rm -f $(BINDIR)/machines

VERSION ?= 0.1.0
DIST ?= dist
TARGETS := bun-linux-x64 bun-linux-arm64 bun-darwin-x64 bun-darwin-arm64

release:
	rm -rf $(DIST)
	mkdir -p $(DIST)
	for t in $(TARGETS); do \
		name=$${t#bun-}; \
		bun build --compile --target=$$t packages/cli/src/index.ts --outfile $(DIST)/machines-$$name; \
	done
	cd $(DIST) && sha256sum machines-* > SHA256SUMS
	@echo "Built $(DIST)/ (no GitHub Actions used)"

release-upload: release
	gh release create v$(VERSION) $(DIST)/* --title "machines v$(VERSION)" --notes "Standalone binaries (no runtime deps). Install: download, chmod +x, set MACHINES_FILE."