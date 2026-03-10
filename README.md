# OpenSoul

OpenSoul is a local desktop control panel for OpenClaw.

It is designed for everyday users who do not want to manage everything by editing files manually.

With OpenSoul, you can use a visual interface to handle the common things people actually need after OpenClaw is installed:

- switch persona
- manage skills
- view memory
- create backups
- restore safely
- edit basic config

## One-line Definition

**OpenSoul is a simple local control panel for OpenClaw, built to help normal users use, switch, back up, and maintain their AI more safely.**

## Why It Exists

OpenClaw is powerful, but many users are not comfortable managing files like:

- `SOUL.md`
- `MEMORY.md`
- `skills/`
- `personas/`
- `openclaw.json`

For experienced users, that may be fine.
For beginners, it is easy to get confused or break something accidentally.

OpenSoul exists to make that workflow easier, safer, and more visual.

## Who It Is For

OpenSoul is mainly for:

- beginners using OpenClaw for the first time
- people who want a clear visual panel instead of raw file editing
- users who need simple backup and restore safety
- people you help install OpenClaw for, who need an easy follow-up tool

## Core Value

The value of OpenSoul is not complexity.
The value is:

- easier to understand
- easier to operate
- harder to break
- easier to recover

It should feel like a companion app or maintenance panel for OpenClaw, not a heavy professional control system.

## Product Principles

- **Local-first** — user data stays on the local machine
- **Open-source** — transparent and easy to adopt
- **OpenClaw-compatible** — can read existing `.openclaw` data
- **Desktop-focused** — built for desktop use, with macOS now and Windows in scope
- **Beginner-friendly** — simple operations first, advanced complexity later

## What It Does Today

### Persona
- manage local personas
- save the current state as a persona
- switch personas safely
- download community personas
- browse and restore persona snapshots

### Skills
- view installed skills
- connect to official ClawHub
- search and install skills
- update installed skills

### Memory
- browse daily memory files
- read long-term memory

### Backup
- manage snapshot backups across personas
- restore a selected backup
- export and import archive backups

### Config
- edit `openclaw.json` from a structured UI

## Current Data Model

OpenSoul works with local OpenClaw data and stays compatible with `.openclaw`:

```text
~/.openclaw/
├── workspace/
├── agents/
├── personas/
└── openclaw.json
```

The long-term direction is still local-first desktop usage, without forcing users to live only inside a hidden folder forever.

## What OpenSoul Is Not

OpenSoul is not trying to be a complex enterprise-style AI management platform.

It is a practical desktop utility for helping users run OpenClaw with less confusion and more safety.

## Tech Stack

- Frontend: React 19, TypeScript, Vite
- Desktop shell: Tauri 2
- Backend: Rust
- i18n: i18next

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

## License

MIT
