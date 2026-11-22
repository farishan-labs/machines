# machines

Machine management: plan and track how you use your machines (laptops, work Macs, servers).

Agnostic core — machine inventory is supplied via environment (`.env`), not hardcoded.

## Quickstart

```sh
bun install
cp .env.example .env   # then edit
bun run cli             # list configured machines
bun run dev             # web UI at http://127.0.0.1:7778
```

## Structure

- `packages/core` — domain types + env parsing
- `packages/cli` — `machines` CLI
- `apps/web` — web dashboard

## Configuration

See `.env.example`. Personal data lives only in `.env` (gitignored).
