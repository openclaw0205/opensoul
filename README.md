# OpenSoul

OpenSoul is a local-first desktop app for managing AI persona assets.

It helps you own, organize, switch, and protect the parts that make an AI feel continuous:

- persona
- skills
- memory
- backups

Instead of treating AI as a temporary chat window, OpenSoul treats it as a system you can operate locally.

## One-line Definition

**OpenSoul helps you manage AI persona assets locally — who the AI is, what it can do, what it remembers, and how to restore it safely.**

## Who It Is For

OpenSoul is built for people who use OpenClaw seriously and want more than raw file editing:

- people running multiple personas
- people treating AI as a long-term companion or working partner
- developers experimenting with persona + skills + memory workflows
- OpenClaw users who want a safer, more visual local control panel

## What Problem It Solves

OpenClaw is powerful, but once you start using multiple personas, skills, memories, and backups, the file-based workflow becomes hard to manage.

The real problem is not "how to chat with AI".
The real problem is:

- how to manage who the AI is
- how to manage what skills are attached to it
- how to keep memory continuous
- how to switch or recover safely without breaking things

OpenSoul exists to reduce that operational complexity.

## Core Product Idea

OpenSoul is not just a GUI for markdown files.

It is an **AI identity and continuity manager**.

That means it focuses on four core layers:

1. **Persona** — who the AI is
2. **Skills** — what the AI can do
3. **Memory** — what the AI remembers
4. **Backup** — how the AI can be protected and restored

## Product Principles

- **Local-first** — user data lives on the local machine
- **Open-source** — the project must stay transparent and usable
- **OpenClaw-compatible** — it can read and manage existing `.openclaw` data
- **Cross-platform** — designed for desktop, with macOS now and Windows support in scope

OpenSoul currently works directly with local OpenClaw data, while also moving toward a cleaner local storage model for the future.

## What It Does Today

### Persona
- manage local personas
- switch personas safely
- save the current state as a persona
- download community personas
- browse and restore persona snapshots

### Skills
- inspect installed skills
- connect to official ClawHub
- search and install skills
- update installed skills

### Memory
- browse daily memory files
- read long-term memory

### Backup
- manage snapshot backups across all personas
- restore a selected backup
- export and import archive backups

### Config
- edit `openclaw.json` from a structured UI

## Current Data Model

Today, OpenSoul remains compatible with OpenClaw's local structure:

```text
~/.openclaw/
├── workspace/
├── agents/
├── personas/
└── openclaw.json
```

But the product direction is broader than that:

- OpenSoul data should remain local
- `.openclaw` is an important compatibility source
- local storage should not be mentally limited to a single hidden directory forever

## Why This Project Matters

Most AI products treat identity as temporary.

OpenSoul takes the opposite approach:

> your AI should be something you can configure, switch, preserve, and recover — not just a disposable session.

That is the real value of the project.

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
