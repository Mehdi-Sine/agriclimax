PYTHON ?= python
PNPM ?= pnpm
.PHONY: check test test-python check-contracts

check: check-contracts test-python
	$(PNPM) lint
	$(PNPM) typecheck
	$(PNPM) test
	$(PNPM) build

test: test-python
	$(PNPM) test

test-python:
	$(PYTHON) -m pytest engine/tests

check-contracts:
	$(PYTHON) scripts/check_contracts.py
