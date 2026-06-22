# X-Terminal

<p align="center">
  <img src="public/logo.png" alt="X-Terminal Logo" width="128" />
</p>

<p align="center">
  <strong>基于 Tauri 的跨平台远程服务器管理控制台</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue" alt="Platform" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
  <img src="https://img.shields.io/badge/rust-1.77%2B-orange" alt="Rust Version" />
</p>

---

## 简介

X-Terminal 是一款轻量级、高性能的桌面控制台应用，提供 **SSH 远程终端**、**SFTP/FTP 文件传输**、**本地终端** 和 **端口转发** 的一站式解决方案。目标用户是开发者和运维人员，在单一应用中完成远程终端操作与文件管理。

### 为什么选择 X-Terminal？

| 痛点 | X-Terminal 解决方案 |
|------|-------------------|
| 多工具切换（终端 + FTP 客户端） | 单一应用内无缝切换终端和文件管理 |
| 商业授权昂贵 | 完全开源，MIT 许可证 |
| 跨平台体验不一致 | Tauri 原生体验，Windows/macOS/Linux 一致 |
| 密码明文存储风险 | 系统密钥链加密存储，零明文落盘 |
| 内存占用高（Electron） | Tauri 内存基线 < 50MB，安装包 < 10MB |

## 功能特性

- 🔌 **SSH 远程连接** — 支持密码和密钥认证，多标签页终端
- 📁 **文件浏览器** — 远程 SFTP/FTP 文件管理与本地文件双向操作
- 🖥️ **本地终端** — 内置本地 Shell 终端支持
- 🔄 **文件传输** — 支持上传、下载、拖拽传输，进度可视化
- 🔗 **端口转发** — SSH 隧道端口转发管理
- 🔐 **安全存储** — 基于系统密钥链（Keyring）的凭证加密存储
- 🎨 **现代化 UI** — 深色主题，可拖拽标签页，侧边栏导航
- ⚡ **高性能** — Rust 后端 + xterm.js WebGL 渲染，低内存占用

## 技术栈

| 层 | 技术 | 说明 |
|---|------|------|
| 桌面框架 | **Tauri 2.x** | 原生性能，跨平台打包 |
| 后端语言 | **Rust** | 内存安全，异步运行时 (tokio) |
| 前端框架 | **React 18 + TypeScript** | 类型安全，生态丰富 |
| 终端模拟 | **xterm.js 5.x + WebGL** | GPU 加速终端渲染 |
| SSH 协议 | **russh 0.44+** | 纯 Rust 异步 SSH 实现 |
| FTP 协议 | **suppaftp 5.x** | 纯 Rust，支持 FTPS |
| 数据库 | **SQLite (rusqlite)** | 嵌入式零配置 |
| 密钥存储 | **keyring** | 系统密钥链原生绑定 |
| UI 组件 | **Radix UI + Tailwind CSS** | 无障碍、可定制 |
| 状态管理 | **zustand** | 轻量级 React 状态管理 |

## 运行平台

| 平台 | 最低版本 | 架构 |
|------|---------|------|
| Windows | 10 / 11 | x86_64 |
| macOS | 12 Monterey | x86_64, aarch64 |
| Linux | Kernel 5.x+ | x86_64 (Wayland + X11) |

## 开发指南

### 环境要求

- **Rust** >= 1.77.2
- **Node.js** >= 18
- **npm** >= 9

### 快速开始

```bash
# 克隆仓库
git clone https://github.com/your-org/x-terminal.git
cd x-terminal

# 安装前端依赖
npm install

# 启动开发模式
npm run tauri dev

# 构建生产版本
npm run tauri build
```

### 项目结构

```
x-terminal/
├── src/                    # React 前端源码
│   ├── components/         # UI 组件
│   │   ├── ui/             # 基础 UI 组件 (Radix)
│   │   ├── ConnectionDialog.tsx  # 连接配置对话框
│   │   ├── FileBrowser.tsx       # 文件浏览器
│   │   ├── FileExplorer.tsx      # 文件资源管理器
│   │   ├── Sidebar.tsx           # 侧边栏导航
│   │   ├── TabBar.tsx            # 标签页栏
│   │   ├── TerminalPanel.tsx     # 终端面板
│   │   └── TransferPanel.tsx     # 传输进度面板
│   ├── stores/             # Zustand 状态管理
│   ├── hooks/              # 自定义 React Hooks
│   ├── types/              # TypeScript 类型定义
│   └── lib/                # 工具函数
├── src-tauri/              # Rust 后端源码
│   ├── src/
│   │   ├── commands/       # Tauri 命令处理器
│   │   │   ├── ssh.rs      # SSH 连接命令
│   │   │   ├── sftp.rs     # SFTP 文件操作命令
│   │   │   ├── ftp.rs      # FTP 连接与操作命令
│   │   │   ├── connection.rs  # 连接配置 CRUD
│   │   │   ├── local_fs.rs    # 本地文件系统命令
│   │   │   ├── local_shell.rs # 本地终端命令
│   │   │   ├── port_forward.rs # 端口转发命令
│   │   │   └── config.rs   # 应用设置命令
│   │   ├── services/       # 业务逻辑层
│   │   ├── models/         # 数据模型
│   │   ├── store/          # 数据库操作
│   │   └── security/       # 加密与密钥管理
│   └── Cargo.toml          # Rust 依赖配置
├── package.json            # Node.js 依赖
├── vite.config.ts          # Vite 构建配置
├── tailwind.config.js      # Tailwind CSS 配置
└── reasonix.toml           # Reasonix AI 编码助手配置
```

## 许可证

本项目基于 [MIT License](LICENSE) 开源。

---

<p align="center">
  <sub>Built with ❤️ using Tauri, React, and Rust</sub>
</p>
