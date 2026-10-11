PYTHON ?= python
PNPM ?= pnpm
.PHONY: check test test-python check-contracts

check: check-quality check-contracts test-python
	$(PNPM) lint
	$(PNPM) typecheck
	$(PNPM) test
	$(PNPM) build
	node scripts/quality/audit-exceptions.mjs --build

test: test-python
	$(PNPM) test

test-python:
	$(PYTHON) -m pytest engine/tests

check-contracts:
	$(PYTHON) scripts/check_contracts.py
	$(PYTHON) scripts/quality/check_automation.py

.PHONY: check-quality
check-quality:
	node scripts/quality/audit-exceptions.mjs
	$(PYTHON) -m unittest discover -s tests/quality -p 'test_*.py' -v
	node --test tests/quality/*.test.mjs
	$(PYTHON) scripts/quality/security.py
	$(PYTHON) scripts/quality/migrations.py
