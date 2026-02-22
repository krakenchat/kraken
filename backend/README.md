# Kraken Backend

NestJS backend for Kraken — a self-hosted voice and text chat application.

## Development

All development uses Docker. See the root [CLAUDE.md](../CLAUDE.md) for commands.

```bash
# Start all services
docker-compose up

# Run tests
docker compose run --rm backend pnpm run test

# Lint
docker compose run --rm backend pnpm run lint
```

## License

[AGPL-3.0-only](../LICENSE)
