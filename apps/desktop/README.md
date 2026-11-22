# Machines

Native desktop app (Tauri 2 + React + SQLite) to manage your machines.
MVP: machine CRUD with fields mirroring Ubuntu Settings > About.
Auto-collect via SSH (or `local`).

## Run (dev)

```bash
cd ~/dev/machines
bun install
bun run tauri dev
```

## Build

```bash
bun run tauri build
```

## System deps (Ubuntu)

Tauri needs WebKitGTK dev headers. If missing, install:

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev libsoup-3.0-dev libsysprof-4-dev libnghttp2-dev
```

## Data

SQLite DB stored in app data dir (`~/.local/share/com.faris.machines/machines.db`).

## Auto-collect

Enter an SSH host alias (from `~/.ssh/config`) or `local`, then click
"Auto-collect via SSH". The app runs a small probe over SSH and fills the form.
