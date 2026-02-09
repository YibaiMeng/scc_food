.PHONY: lint check setup

check:
	pre-commit run --all-files

lint: check

setup:
	pip install pre-commit
	pre-commit install
