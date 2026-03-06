# OpenSoul

OpenSoul is a desktop persona manager for OpenClaw.

It gives you a GUI for the parts of OpenClaw that usually live in `~/.openclaw`: personas, skills, memory, backups, multi-agent workspaces, and `openclaw.json`.

## What It Does

- Manage local personas for each agent
- Switch personas while automatically saving the current one first
- Download community personas and overwrite local ones with a backup snapshot
- Browse persona snapshots and restore older states
- View installed skills and uninstall them
- Read daily memory files and long-term memory
- Back up and restore the current workspace
- Edit `openclaw.json` from a structured settings screen
- Switch between `main` and other OpenClaw agents

## Product Model

OpenSoul treats a persona as an evolving workspace, not a static template.

- Switching from persona `A` to persona `B` saves `A` before loading `B`
- Downloading a community persona over an existing local persona creates a backup snapshot first
- Restoring a snapshot updates the persona state and, if that persona is currently active, also updates the live workspace

This is the core behavior behind the app.

## Data Layout

OpenSoul reads and writes directly to your local OpenClaw files.

```text
~/.openclaw/
├── workspace/
│   ├── SOUL.md
│   ├── IDENTITY.md
│   ├── USER.md
│   ├── AGENTS.md
│   ├── MEMORY.md
│   ├── memory/
│   ├── skills/
│   └── .active-persona
├── agents/
│   └── <agent>/workspace/
├── personas/
│   └── <persona-id>/
│       ├── current/
│       ├── base/
│       ├── snapshots/
│       └── meta.json
└── openclaw.json
```

## Screens

### Persona

- List local personas
- Create a new persona
- Save the current workspace as a persona
- Switch personas
- Delete inactive personas
- Browse and restore snapshots
- Download community personas

### Skills

- List installed skills from the current agent workspace
- Uninstall a skill directory

### Memory

- Browse daily memory files
- Read `MEMORY.md`

### Backup

- Create a compressed backup of the current workspace
- Restore a workspace backup archive

### Config

- Read `openclaw.json`
- Edit supported sections in a structured form
- Save validated JSON back to disk

## Tech Stack

- Frontend: React 19, TypeScript, Vite
- Desktop shell: Tauri 2
- Backend: Rust
- i18n: i18next

## Prerequisites

- Node.js 18+
- Rust toolchain
- OpenClaw installed locally
- A valid `~/.openclaw` directory

## Development

Install dependencies:

```bash
npm install
```

Run the frontend only:

```bash
npm run dev
```

Run the Tauri app:

```bash
npm run tauri dev
```

Build the frontend:

```bash
npm run build
```

Build the desktop app:

```bash
npm run tauri build
```

## Quality Checks

Frontend:

```bash
npm run build
```

Rust:

```bash
cargo clippy --all-targets --all-features -- -D warnings
cargo test
```

Run Rust commands inside `src-tauri/`.

## Current Limits

- There are still no automated behavior tests for persona switching, backup restore, or snapshot flows
- Config editing is field-based and not a full raw JSON editor
- The app assumes direct local file access to OpenClaw data and is not designed as a hardened security boundary

## License

MIT
