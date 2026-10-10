.PHONY: test test-python

test: test-python
	pnpm test

test-python:
	python -m pytest engine/tests
