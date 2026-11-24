---
name: machines
description: >-
  Show the personal machine inventory by running `machines list --json` and render
  a consistent summary (id, name, os, role, host, preferences). Use when the user
  asks about their machines, "show me my machines", or needs machine paths/org
  preferences. Also supports `machines whoami`.
requires: [shell]
optional: []
min-context: 16k
model-preference: cheap-fast
argument-hint: "[id|--plain|--json]"
---

# Machines (inventory summary)

Run the `machines` CLI and render its output consistently.

## Steps

1. If an id is given, run `machines show <id> --json`; otherwise run
   `machines list --json`.
2. Parse the JSON. For each machine print one line:
   `- <id> — <name> (<os>, <role>) @ <host>`
   then its preferences (key: value) indented.
3. If no machines are configured, say so and point to `MACHINES_FILE`.
4. For "which machine am I on", run `machines whoami`.

Keep output concise and stable across machines.
