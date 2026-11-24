PREFIX ?= $(HOME)/.local
BINDIR = $(PREFIX)/bin
CLI_ENTRY = $(CURDIR)/packages/cli/src/index.ts

.PHONY: install uninstall

install:
	mkdir -p $(BINDIR)
	ln -sf $(CLI_ENTRY) $(BINDIR)/machines
	chmod +x $(CLI_ENTRY)

uninstall:
	rm -f $(BINDIR)/machines