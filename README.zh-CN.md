# OpenSoul

OpenSoul 是一个面向 OpenClaw 的桌面人格管理器。

它为 `~/.openclaw` 里的核心内容提供图形界面，包括人格、技能、记忆、备份、多 Agent 工作区，以及 `openclaw.json` 配置。

## 功能概览

- 管理各个 Agent 下的本地人格
- 切换人格时，先自动保存当前人格，再加载目标人格
- 下载社区人格；若覆盖本地同名人格，会先自动创建备份快照
- 浏览人格快照，并恢复到历史状态
- 查看已安装技能，并卸载技能目录
- 查看每日记忆文件和长期记忆
- 备份当前工作区，并从备份包恢复
- 通过结构化界面编辑 `openclaw.json`
- 在 `main` 与其他 OpenClaw Agent 之间切换

## 产品模型

OpenSoul 将人格视为“持续进化的工作区”，而不是静态模板。

- 从人格 `A` 切换到人格 `B` 时，会先保存 `A`，再加载 `B`
- 用社区人格覆盖本地人格前，会先创建备份快照
- 恢复快照时，会更新人格当前状态；如果该人格正处于激活状态，也会同步更新当前工作区

这就是 OpenSoul 的核心行为模型。

## 数据结构

OpenSoul 会直接读写本地 OpenClaw 数据目录。

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

## 页面说明

### Persona

- 查看本地人格列表
- 创建新人格
- 将当前工作区另存为人格
- 切换人格
- 删除未激活人格
- 浏览和恢复快照
- 下载社区人格

### Skills

- 查看当前 Agent 工作区下已安装的技能
- 卸载技能目录

### Memory

- 浏览每日记忆文件
- 查看 `MEMORY.md`

### Backup

- 对当前工作区创建压缩备份
- 从备份压缩包恢复工作区

### Config

- 读取 `openclaw.json`
- 通过结构化表单编辑支持的配置项
- 将校验通过的 JSON 保存回本地

## 技术栈

- 前端：React 19、TypeScript、Vite
- 桌面壳：Tauri 2
- 后端：Rust
- 国际化：i18next

## 环境要求

- Node.js 18+
- Rust toolchain
- 本地已安装 OpenClaw
- 存在有效的 `~/.openclaw` 目录

## 开发方式

安装依赖：

```bash
npm install
```

只启动前端：

```bash
npm run dev
```

启动 Tauri 桌面应用：

```bash
npm run tauri dev
```

构建前端：

```bash
npm run build
```

构建桌面应用：

```bash
npm run tauri build
```

## 质量检查

前端：

```bash
npm run build
```

Rust：

```bash
cargo clippy --all-targets --all-features -- -D warnings
cargo test
```

运行 Rust 命令时请进入 `src-tauri/` 目录。

## 当前限制

- 还没有覆盖人格切换、备份恢复、快照流转的自动化行为测试
- 配置编辑器目前是字段式编辑，不是完整的原始 JSON 编辑器
- 该应用默认直接访问本地 OpenClaw 文件，不应被视为严格的安全隔离边界

## License

MIT
