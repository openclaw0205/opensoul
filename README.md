# 🦞 OpenSoul

**OpenClaw Persona Manager** — A desktop app to manage your AI's personality, skills, memories, and backups.

![Tauri](https://img.shields.io/badge/Tauri-2.0-blue) ![React](https://img.shields.io/badge/React-19-61dafb) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6) ![License](https://img.shields.io/badge/License-MIT-green)

## Features

- 🧠 **Persona Editor** — Edit SOUL.md, IDENTITY.md, USER.md, AGENTS.md with live preview
- ⚡ **Skills Manager** — Browse and uninstall installed skills
- 📚 **Memory Browser** — View daily memories and long-term memory (MEMORY.md)
- 💾 **Backup & Restore** — One-click persona backup
- 🔄 **Multi-Agent** — Switch between multiple OpenClaw agents

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) 1.70+
- [OpenClaw](https://openclaw.ai/) installed (`~/.openclaw/` directory)

## Getting Started

```bash
# Clone
git clone https://github.com/openclaw0205/opensoul.git
cd opensoul

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## How It Works

OpenSoul directly reads and writes to your `~/.openclaw/` directory:

```
~/.openclaw/
├── workspace/          # Persona files live here
│   ├── SOUL.md         # AI personality
│   ├── IDENTITY.md     # AI identity
│   ├── USER.md         # User info
│   ├── AGENTS.md       # Agent behavior rules
│   ├── MEMORY.md       # Long-term memory
│   ├── memory/         # Daily memory files
│   └── skills/         # Installed skills
└── agents/             # Multiple agents
```

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** Tauri 2 (Rust)
- **Styling:** Custom CSS (dark theme)

## License

MIT © [openclaw0205](https://github.com/openclaw0205)
