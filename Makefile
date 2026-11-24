PREFIX ?= $(HOME)/.local
BINDIR = $(PREFIX)/bin

.PHONY: install uninstall

install:
	mkdir -p $(BINDIR)
	sed 's#@ROOT@#$(CURDIR)#g' $(CURDIR)/bin/machines.in > $(BINDIR)/machines
	chmod +x $(BINDIR)/machines

uninstall:
	rm -f $(BINDIR)/machines