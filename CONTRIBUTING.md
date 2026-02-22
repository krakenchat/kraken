# Contributing to Kraken

Thanks for your interest in contributing!

## Getting Started

Full development setup, testing, and code pattern guides are on the docs site:

- [Development Setup](https://docs.krakenchat.app/contributing/development-setup/)
- [Testing Guide](https://docs.krakenchat.app/contributing/testing/)
- [Code Patterns](https://docs.krakenchat.app/contributing/code-patterns/)

## Quick Reference

```bash
# Clone and start
git clone https://github.com/<your-username>/kraken.git
cd kraken
cp backend/env.sample backend/.env
docker-compose up
```

All development is done inside Docker containers — never run `pnpm`/`npm`/`node` directly on the host.

## Branch Naming

- `feat/short-description` — new features
- `fix/short-description` — bug fixes
- `docs/short-description` — documentation
- `refactor/short-description` — refactoring
- `test/short-description` — tests

## Pull Request Process

1. Branch from `main`
2. Ensure linting and tests pass
3. Open a PR with a clear description of what changed and why
4. PRs require at least one approving review

## Legal

_By contributing to Kraken Chat, you agree that your contribution may be included in both open-source (AGPLv3) and commercial distributions of Kraken Chat._
