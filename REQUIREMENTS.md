# X-Terminal 需求规格说明书（详细版）

> **版本**: v2.0  
> **最后更新**: 2026-06-19  
> **文档状态**: 草稿

---

## 目录

1. [项目概述](#1-项目概述)
2. [用户角色与场景](#2-用户角色与场景)
3. [功能需求详述](#3-功能需求详述)
4. [UI/UX 设计规范](#4-uiux-设计规范)
5. [Tauri 命令 API 规范](#5-tauri-命令-api-规范)
6. [事件系统规范](#6-事件系统规范)
7. [数据模型详述](#7-数据模型详述)
8. [安全设计](#8-安全设计)
9. [非功能需求](#9-非功能需求)
10. [系统架构详述](#10-系统架构详述)
11. [前端组件树与状态管理](#11-前端组件树与状态管理)
12. [错误处理策略](#12-错误处理策略)
13. [测试策略](#13-测试策略)
14. [开发排期详述](#14-开发排期详述)
15. [验收标准](#15-验收标准)
16. [附录](#16-附录)

---

## 1. 项目概述

### 1.1 项目名称

**X-Terminal** — 基于 Tauri 的跨平台远程服务器管理控制台

### 1.2 项目目标

开发一款轻量级、高性能的桌面控制台应用，提供 SSH 远程连接和 FTP/SFTP 文件传输的一站式解决方案。目标用户是开发者和运维人员，替代 Xshell、SecureCRT、FileZilla 等组合工具，在单一应用中完成远程终端操作和文件管理。

### 1.3 核心价值主张

| 痛点 | X-Terminal 解决方案 |
|------|-------------------|
| 多工具切换（终端 + FTP 客户端） | 单一应用内无缝切换终端和文件管理 |
| 商业授权昂贵 | 完全开源，MIT 许可证 |
| 跨平台体验不一致 | Tauri 原生体验，Windows/macOS/Linux 一致 |
| 密码明文存储风险 | 系统密钥链加密存储，零明文落盘 |
| 内存占用高（Electron） | Tauri 内存基线 < 50MB |

### 1.4 技术选型与理由

| 层 | 技术 | 选型理由 |
|---|------|---------|
| 桌面框架 | **Tauri 2.x** | 原生性能，安装包 < 10MB，Rust 后端安全 |
| 后端语言 | **Rust** | 内存安全，异步运行时（tokio），零成本抽象 |
| 前端框架 | **React 18 + TypeScript** | 生态丰富，类型安全，xterm.js 集成成熟 |
| 终端模拟 | **xterm.js 5.x + WebGL addon** | 性能最好的 Web 终端模拟器，GPU 加速渲染 |
| SSH 协议 | **russh 0.44+** | 纯 Rust 实现，异步原生，无 C 依赖交叉编译友好 |
| FTP 协议 | **suppaftp 5.x** | 纯 Rust，支持 FTPS/被动模式/主动模式 |
| SFTP | **russh 内置 SFTP 子系统** | 复用 SSH 连接，无需额外依赖 |
| 数据库 | **rusqlite 0.31+** (SQLite) | 嵌入式零配置，加密扩展支持 |
| 密钥存储 | **keyring 2.x** | 跨平台系统密钥链原生绑定 |
| 状态管理 | **zustand 4.x** | 轻量、TypeScript 友好、无模板代码 |
| 打包格式 | Tauri bundler (.msi/.dmg/.AppImage/.deb) | 原生安装体验 |

### 1.5 运行平台

| 平台 | 最低版本 | 架构 |
|------|---------|------|
| Windows | 10 / 11 | x86_64 |
| macOS | 12 Monterey | x86_64, aarch64 |
| Linux | Kernel 5.x+ | x86_64 (Wayland + X11) |

---

## 2. 用户角色与场景

### 2.1 用户角色

| 角色 | 描述 | 典型用例 |
|------|------|---------|
| **后端开发者** | 日常 SSH 到开发/测试服务器 | 查看日志、部署代码、调试服务 |
| **运维工程师** | 管理数十台生产服务器 | 批量操作、文件分发、监控巡检 |
| **DevOps/SRE** | 混合云环境管理 | 多集群跳板连接、CI/CD 排错 |
| **自由开发者** | 管理个人 VPS/云服务器 | 网站部署、数据库管理 |

### 2.2 典型使用场景

#### 场景 1：开发者日常调试
```
小李是后端开发者，日常需要：
1. 打开 X-Terminal，点击"开发服务器"连接配置
2. SSH 密码认证登录 → 自动打开终端标签页
3. tail -f /var/log/app.log 查看实时日志
4. Ctrl+Shift+T 新建标签，登录同一服务器
5. 在第二个标签页 vim 编辑配置文件
6. 点击侧栏"文件浏览器" → 拖拽上传新版本 JAR 包
7. 完成部署，关闭标签页，退出应用
```

#### 场景 2：运维批量巡检
```
老王是运维工程师，管理 20+ 台服务器：
1. 打开 X-Terminal，左侧服务器列表按"生产环境"分组展开
2. 逐个双击连接，查看磁盘使用率、服务状态
3. 发现某服务器磁盘告警，右键打开 SFTP 文件浏览器
4. 清理日志文件，下载关键日志到本地分析
5. 配置私钥认证，所有连接免密登录
6. 心跳保活确保长连接不超时断开
```

#### 场景 3：文件分发
```
小张需要将更新的配置分发到 3 台服务器：
1. 同时打开 3 台服务器的 SFTP 文件浏览器标签页
2. 从本地拖拽 nginx.conf 到第一个标签页 → 上传
3. 切换到第二个标签页，再次拖拽上传
4. 传输进度条实时显示速度、剩余时间
5. 传输队列面板查看所有任务状态
```

---

## 3. 功能需求详述

### 3.1 连接配置管理

#### F-01：创建连接配置

| 属性 | 描述 |
|------|------|
| **优先级** | P0 |
| **触发** | 用户点击 "+" 按钮或菜单 "新建连接" |
| **前置条件** | 应用已启动 |

**详细流程：**
```
用户操作 → 弹出连接配置对话框
├── 基本设置
│   ├── 连接名称（必填，建议自动生成："user@host"）
│   ├── 主机地址（必填，支持 IP 和域名）
│   ├── 端口号（默认 22，范围 1-65535）
│   └── 分组（可选，下拉选择或新建分组）
├── 认证设置
│   ├── 认证方式（单选：密码 / 私钥文件 / 密钥链私钥）
│   ├── 用户名（必填）
│   ├── 密码（密码方式时显示，带显示/隐藏切换）
│   ├── 私钥路径（私钥方式时，文件选择器）
│   └── 私钥密码（可选，用于加密私钥文件）
├── 高级设置
│   ├── 终端编码（默认 UTF-8）
│   ├── 连接超时（默认 30 秒，范围 5-120）
│   ├── 心跳间隔（默认 0 = 关闭，开启时推荐 60 秒）
│   ├── 登录后执行命令（可选，如 "sudo su -"）
│   └── 环境变量（可选，键值对列表）
└── 按钮
    ├── [测试连接] → 验证主机可达性和认证
    ├── [保存]
    └── [取消]
```

**业务规则：**
- 名称不可为空，不可与同分组内已有名称重复
- 密码不持久化到 SQLite，通过 keyring 存储
- 私钥文件路径若为相对路径，基于应用数据目录解析
- "测试连接" 执行 10 秒超时的 TCP + SSH 握手探测

**验收标准：**
- [ ] 密码方式创建连接，保存后可在列表中看到
- [ ] 私钥方式创建连接，选择 id_rsa 文件后可保存
- [ ] 测试连接功能返回成功/失败及详细错误信息
- [ ] 空名称保存时显示错误提示
- [ ] 端口越界时显示校验错误

---

#### F-02：编辑/删除连接配置

| 属性 | 描述 |
|------|------|
| **优先级** | P0 |
| **触发** | 右键连接 → 编辑/删除，或选中后按 Delete |

**编辑流程：** 复用 F-01 对话框，预填现有数据，密码字段显示 "●●●●●●" 占位提示已存储。

**删除流程：**
```
删除确认对话框
├── 提示："确定删除连接 '[名称]'？此操作不可撤销。"
├── 选项：☐ 同时删除已存储的密码
└── 按钮：[确定] [取消]
```

**业务规则：**
- 编辑保存时，若密码字段未修改（仍为占位符），不更新密钥链
- 删除连接时，若该连接存在活跃会话，提示用户先断开
- 删除不删除历史主机指纹（known_hosts 记录保留）

---

#### F-03：连接配置分组管理（P1）

| 属性 | 描述 |
|------|------|
| **优先级** | P1 |
| **触发** | 右键侧栏空白区域 → 新建分组 |

**功能：**
- 创建分组（名称 + 展开/折叠）
- 拖拽连接配置到分组
- 分组右键菜单：重命名、删除（删除分组但保留连接回未分组）、全部连接
- 连接排序：分组内拖拽排序

---

#### F-04：连接配置导入/导出（P1）

| 属性 | 描述 |
|------|------|
| **优先级** | P1 |

**导出格式：**
```json
{
  "version": "1.0",
  "exported_at": "2026-06-19T10:00:00Z",
  "profiles": [
    {
      "name": "Production DB",
      "host": "10.0.1.100",
      "port": 22,
      "username": "admin",
      "auth_type": "key",
      "private_key_path": "~/.ssh/id_rsa",
      "encoding": "UTF-8",
      "keep_alive_interval": 60,
      "connection_timeout": 30,
      "login_commands": ["sudo su -"],
      "env_vars": {}
    }
  ]
}
```

**规则：** 密码不导出。导入时若名称冲突，提供 "覆盖/跳过/重命名" 选项。

---

### 3.2 SSH 连接与终端

#### F-05：SSH 连接建立

| 属性 | 描述 |
|------|------|
| **优先级** | P0 |

**连接状态机：**
```
IDLE ──[用户点击连接]──▶ CONNECTING
                            │
                    ┌───────┼───────┐
                    ▼       ▼       ▼
              CONNECTED  ERROR   TIMEOUT
                    │       │       │
                    │       └───────┼──▶ IDLE（显示错误信息）
                    │               │
                    └──[断开/网络断]──▶ DISCONNECTED ──▶ IDLE
```

**TCP 连接阶段：**
1. 解析主机名（DNS 查询，超时 5 秒）
2. TCP connect()，超时同 connection_timeout
3. 若配置跳板机，通过跳板机建立 TCP 隧道

**SSH 握手阶段：**
1. 协议版本交换
2. 密钥交换（KEX）：curve25519-sha256 / ecdh-sha2-nistp256
3. 主机密钥验证 → **F-08 流程**
4. 用户认证（密码 / 公钥）
5. 打开 session channel
6. 请求 PTY（TERM=xterm-256color，尺寸 = 当前终端窗口行列）
7. 启动 shell（或执行 login_commands）

**超时处理：**
- DNS 解析超时 5 秒 → 错误："无法解析主机名"
- TCP 连接超时 → 错误："连接超时 (30s)"
- SSH 握手超时 → 错误："SSH 握手超时"
- 认证超时 30 秒 → 错误："认证超时"

**并发限制：** 最大同时连接数 20，超出时提示 "已达到最大连接数限制(20)"

---

#### F-06：终端模拟（详细）

| 属性 | 描述 |
|------|------|
| **优先级** | P0 |

**xterm.js 配置：**
```typescript
const terminalOptions: ITerminalOptions = {
  allowProposedApi: true,
  allowTransparency: false,
  cols: 80,
  rows: 24,
  cursorBlink: true,
  cursorStyle: 'bar',
  fontSize: 14,
  fontFamily: 'Cascadia Code, Fira Code, JetBrains Mono, Consolas, monospace',
  fontWeight: 'normal',
  lineHeight: 1.2,
  letterSpacing: 0,
  theme: {
    background: '#1e1e2e',
    foreground: '#cdd6f4',
    cursor: '#f5e0dc',
    selectionBackground: '#585b70',
    black: '#45475a',
    red: '#f38ba8',
    green: '#a6e3a1',
    yellow: '#f9e2af',
    blue: '#89b4fa',
    magenta: '#f5c2e7',
    cyan: '#94e2d5',
    white: '#bac2de',
    brightBlack: '#585b70',
    brightRed: '#f38ba8',
    brightGreen: '#a6e3a1',
    brightYellow: '#f9e2af',
    brightBlue: '#89b4fa',
    brightMagenta: '#f5c2e7',
    brightCyan: '#94e2d5',
    brightWhite: '#a6adc8',
  },
  scrollback: 10000,
  tabStopWidth: 4,
  windowsMode: false,
};
```

**Addons：**
- `FitAddon`：窗口 resize 时自适应行列
- `WebglAddon`：GPU 加速渲染（fallback Canvas）
- `SerializeAddon`：终端状态序列化（用于会话恢复，P2）
- `Unicode11Addon`：Unicode 11 宽度支持

**终端 resize 流程：**
```
用户拖拽窗口 / 分屏拖拽 / 切换主题字体
    │
    ▼
ResizeObserver 检测容器尺寸变化
    │
    ├── FitAddon.fit() 计算新 cols/rows
    │
    ├── 通过 Tauri invoke("ssh_resize", { sessionId, cols, rows })
    │
    └── Rust: session.channel.resize(cols, rows) → SSH window-change 消息
```

**文本选择与复制：**
- 鼠标左键拖拽选择文本 → 自动复制到系统剪贴板（可配置关闭）
- 双击选择单词（分隔符：空格、标点、括号）
- 三击选择整行
- Ctrl+Shift+C 复制选中文本
- Ctrl+Shift+V 粘贴剪贴板内容
- 右键菜单：复制、粘贴、清屏、水平滚动切换

**回滚缓冲区：**
- 大小：10000 行（可在设置中调整 1000-50000）
- 滚轮 / PageUp/PageDown 浏览历史
- 新输出时自动滚动到底部（若当前在底部）
- 搜索功能：Ctrl+Shift+F 在缓冲区搜索（P2）

---

#### F-07：多标签页管理

| 属性 | 描述 |
|------|------|
| **优先级** | P0 |

**标签页数据结构：**
```typescript
interface Tab {
  id: string;           // UUID
  type: 'ssh' | 'ftp' | 'sftp';
  title: string;        // user@host
  icon?: string;        // 连接状态图标
  connectionId?: string; // 关联的连接配置 ID
  sessionId?: string;   // 后端会话 ID
  state: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
  errorMessage?: string;
  lastActivity?: Date;
}
```

**标签页操作：**
| 操作 | 触发方式 | 行为 |
|------|---------|------|
| 新建 SSH | Ctrl+Shift+T / 双击连接 | 打开该连接的终端标签页 |
| 新建 FTP | 右键连接 → "FTP 连接" | 打开该连接的 FTP 文件浏览器 |
| 新建 SFTP | 右键连接 → "SFTP 文件浏览器" | 打开 SFTP 文件浏览器标签页 |
| 关闭 | Ctrl+Shift+W / 中键点击 / × 按钮 | 断开连接 → 关闭标签页 |
| 切换 | Ctrl+Tab / Ctrl+Shift+Tab | 循环切换标签页 |
| 跳转 | Ctrl+数字键 (1-9) | 跳转到第 N 个标签页 |
| 拖拽排序 | 鼠标拖拽标签页 | 调整标签页顺序 |
| 右键菜单 | 右键标签页 | 关闭 / 关闭其他 / 关闭右侧 / 复制会话 / 重命名 |

**标签页状态视觉：**
- **idle**：灰色圆点，未连接
- **connecting**：黄色脉冲圆点，连接中
- **connected**：绿色圆点，已连接
- **disconnected**：灰色圆点，已断开
- **error**：红色圆点 + 错误摘要 tooltip

---

#### F-08：主机密钥验证

| 属性 | 描述 |
|------|------|
| **优先级** | P0 |

**流程图：**
```
SSH 握手收到主机密钥
    │
    ├── 在本地 known_hosts 文件中查找 host:port
    │   ├── 找到且匹配 → 继续连接
    │   ├── 找到但不匹配 → ⚠️ 安全警告对话框
    │   └── 未找到 → 首次连接确认对话框
    │
    └── 用户确认后写入 known_hosts
```

**首次连接对话框：**
```
┌──────────────────────────────────────────┐
│   ⚠️  首次连接到该服务器                 │
│                                          │
│  主机：192.168.1.100:22                  │
│                                          │
│  主机密钥指纹 (SHA256)：                  │
│  ┌────────────────────────────────────┐  │
│  │ SHA256:8k3jf9D...aB2xP=           │  │
│  └────────────────────────────────────┘  │
│                                          │
│  请确认此指纹与服务器管理员提供的匹配。    │
│                                          │
│  ☐ 始终信任此主机                        │
│                                          │
│        [ 拒绝 ]      [ 接受并保存 ]      │
└──────────────────────────────────────────┘
```

**密钥变更警告对话框：**
```
┌──────────────────────────────────────────┐
│   🚨 安全警告：主机密钥已变更！           │
│                                          │
│  这可能是中间人攻击，或服务器已重装系统。  │
│                                          │
│  旧指纹：SHA256:8k3jf9D...              │
│  新指纹：SHA256:7xP2qR...               │
│                                          │
│         [ 断开连接 ]  [ 接受新密钥 ]      │
└──────────────────────────────────────────┘
```

**known_hosts 存储：**
- 路径：`{app_data_dir}/known_hosts`
- 格式：标准 OpenSSH known_hosts 格式（兼容）
- 每条记录：`host:port algorithm base64-key`

---

#### F-09：SSH 跳板机（P2）

```
本地 → [SSH] → 跳板机 (bastion) → [TCP 隧道] → 目标服务器
```

**配置项（每个连接配置可选启用）：**
- 跳板机连接配置引用（下拉选择已有配置）
- 跳板机用户名（可覆盖连接配置中的）
- TCP 转发类型：Direct TCP/IP 或 StreamLocal

---

### 3.3 SFTP 文件管理

#### F-10：SFTP 连接与文件浏览器

| 属性 | 描述 |
|------|------|
| **优先级** | P0 |

**触发方式：**
- 右键已有 SSH 连接 → "打开 SFTP 文件浏览器"
- 通过 SSH 会话复用的方式打开 SFTP 通道（不重复认证）

**文件浏览器布局：**
```
┌──────────────────────────────────────────────┐
│  工具栏                                      │
│  ┌─────┬─────────────────────────────────┐   │
│  │ ← → │ /var/log/application/           │   │
│  │ ↑   │                                 │   │
│  │ 🔄  │                                 │   │
│  └─────┴─────────────────────────────────┘   │
├────────────┬─────────────────────────────────┤
│            │  名称           大小   修改时间  │
│  远程文件   │  ├── 📁 nginx/                 │
│  树 (可选)  │  ├── 📁 app/                   │
│            │  ├── 📄 access.log  12MB  ...  │
│            │  ├── 📄 error.log   3MB   ...  │
│            │  └── 📄 config.json 2KB  ... │
├────────────┴─────────────────────────────────┤
│  状态栏：[10 个项目] | [已用 15GB / 100GB]   │
└──────────────────────────────────────────────┘
```

**文件操作：**

| 操作 | 触发 | 行为 |
|------|------|------|
| 导航进入 | 双击文件夹 | cd 到目录并刷新列表 |
| 返回上级 | 工具栏 ← / Backspace | cd .. |
| 刷新 | 工具栏 🔄 / F5 | 重新列出当前目录 |
| 新建文件夹 | 右键 → 新建文件夹 | 输入名称 → mkdir |
| 重命名 | 右键 → 重命名 / F2 | 原地编辑名称 → rename |
| 删除 | 右键 → 删除 / Delete | 确认对话框 → rm -rf |
| 修改权限 | 右键 → 属性 | 显示权限对话框 → chmod |
| 下载 | 右键 → 下载 / 拖拽到本地 | F-13 传输流程 |
| 上传 | 右键 → 上传 / 从本地拖入 | F-13 传输流程 |

**排序与筛选：**
- 点击列标题切换排序（名称/大小/修改时间，升序/降序）
- 支持通配符过滤（*.log, *.conf）

---

#### F-11：本地-远程双面板（P1）

```
┌────────────────────┬──────────────────────┐
│  本地文件系统       │  远程文件系统         │
│  C:\Users\me\work\ │  /var/www/html/      │
├────────────────────┼──────────────────────┤
│  📁 src/           │  📁 css/             │
│  📁 dist/          │  📁 js/              │
│  📄 package.json   │  📄 index.html       │
│  📄 README.md      │  📄 favicon.ico      │
├────────────────────┴──────────────────────┤
│  [← 下载选中]  [上传选中 →]               │
└───────────────────────────────────────────┘
```

---

### 3.4 FTP 独立连接

#### F-12：FTP 连接与文件管理

| 属性 | 描述 |
|------|------|
| **优先级** | P0 |

**FTP 连接配置：**
- 主机、端口（默认 21）、用户名、密码
- 连接模式：主动模式 / 被动模式（默认被动）
- 安全：纯 FTP / FTPS（显式 TLS）/ FTPS（隐式 TLS）
- 编码：UTF-8 / 自动检测

**文件浏览器：** 与 SFTP 共用 UI 组件（F-10），仅后端协议不同。

---

### 3.5 文件传输引擎

#### F-13：传输队列与进度

| 属性 | 描述 |
|------|------|
| **优先级** | P0 |

**传输任务模型：**
```typescript
interface TransferTask {
  id: string;
  type: 'upload' | 'download';
  protocol: 'sftp' | 'ftp';
  connectionId: string;
  localPath: string;
  remotePath: string;
  fileName: string;
  fileSize: number;
  transferred: number;
  speed: number;           // bytes/s
  eta: number;             // estimated seconds remaining
  state: 'queued' | 'transferring' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}
```

**传输队列面板：**
```
┌─────────────────────────────────────────────┐
│  传输队列                          [-][×]   │
├─────────────────────────────────────────────┤
│  ⬆ app.log → /var/log/app.log              │
│  ████████████░░░░░░ 75%  (1.2MB / 1.6MB)   │
│  速度: 2.4 MB/s  剩余: 2 秒                 │
│  [≡] [×]                                   │
├─────────────────────────────────────────────┤
│  ⬇ database.sql ← /backup/db.sql           │
│  ██░░░░░░░░░░░░░░░ 12%  (15MB / 120MB)     │
│  速度: 5.1 MB/s  剩余: 21 秒                │
│  [≡] [×]                                   │
├─────────────────────────────────────────────┤
│  ⬆ config.yaml → /etc/config.yaml          │
│  ⏳ 排队中...                               │
│  [≡] [×]                                   │
├─────────────────────────────────────────────┤
│  总计: 2 活跃 | 1 排队 | 1 已完成           │
│  [全部暂停] [全部取消] [清除已完成]          │
└─────────────────────────────────────────────┘
```

**传输控制：**
- 单个任务：暂停/继续、取消
- 全局：全部暂停、全部取消、清除已完成
- 最大并发传输数：2（可配置 1-5）
- 同名文件处理：询问覆盖 / 自动重命名 / 跳过

**进度上报频率：** 每 250ms 上报一次（防抖）

---

#### F-14：拖拽上传/下载

| 优先级 | P0 |

- 从系统文件管理器拖拽文件/文件夹到远程文件浏览器 → 上传
- 从远程文件浏览器拖拽文件/文件夹到系统文件管理器 → 下载
- 拖拽时显示器上显示拖拽图标和文件数量
- 支持多文件同时拖拽

---

### 3.6 应用设置

#### F-15：外观设置

| 设置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| 主题 | 枚举 | dark | dark / light / 跟随系统 |
| 终端字体 | 枚举 | Cascadia Code | 从系统已安装等宽字体中选择 |
| 字号 | 数值 | 14 | 范围 10-32 |
| 行间距 | 数值 | 1.2 | 范围 1.0-2.0 |
| 光标样式 | 枚举 | bar | block / underline / bar |
| 光标闪烁 | 布尔 | true | |
| 配色方案 | 枚举 | Catppuccin Mocha | 预设 10+ 配色方案 |

#### F-16：快捷键设置（P1）

允许用户自定义以下快捷键：
- 新建标签页
- 关闭标签页
- 切换标签页
- 复制 / 粘贴
- 清屏
- 打开设置

#### F-17：传输设置

| 设置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| 默认下载路径 | 路径 | 系统下载文件夹 | |
| 最大并发传输 | 数值 | 2 | 范围 1-5 |
| 同名文件策略 | 枚举 | ask | ask / overwrite / rename / skip |
| 传输后校验 | 布尔 | false | 下载后校验 MD5 |

---

## 4. UI/UX 设计规范

### 4.1 主窗口布局

```
┌──────────────────────────────────────────────────────────┐
│  菜单栏 (File / Edit / View / Connection / Help)         │
├───────────┬──────────────────────────────────────────────┤
│  侧栏      │  [标签页栏]                                 │
│  ┌──────┐ │  ┌────────────────────────────────────────┐ │
│  │ 搜索  │ │  │ [×] 标签1 │ [×] 标签2 │ [×] 标签3 │ +  │ │
│  │ Q     │ │  └────────────────────────────────────────┘ │
│  ├──────┤ ├──────────────────────────────────────────────┤
│  │ 连接  │ │                                              │
│  │ 📁生产│ │  终端 / 文件浏览器内容区域                   │
│  │  ├DB1 │ │                                              │
│  │  ├Web1│ │  user@host:~$ _                            │
│  │  └API1│ │                                              │
│  │ 📁测试│ │                                              │
│  │  ├DB2 │ │                                              │
│  │  └Web2│ │                                              │
│  │ 📁FTP │ │                                              │
│  │  └FT1 │ │                                              │
│  └──────┘ │                                              │
│           ├──────────────────────────────────────────────┤
│           │  状态栏 │ SSH ✅ │ 传输: 2 活跃 │ 编码: UTF-8 │
├───────────┴──────────────────────────────────────────────┤
│  [传输队列面板（可折叠）]                                  │
└──────────────────────────────────────────────────────────┘
```

### 4.2 设计系统

**色彩系统（暗色主题 Catppuccin Mocha）：**
```
背景层：
  Base:       #1e1e2e   (主背景)
  Surface0:   #313244   (面板背景)
  Surface1:   #45475a   (悬停态)
  Overlay0:   #6c7086   (边框)

文本层：
  Text:       #cdd6f4   (正文)
  Subtext0:   #a6adc8   (次要文本)
  Subtext1:   #bac2de   (标签页文本)

强调色：
  Blue:       #89b4fa   (主强调色)
  Green:      #a6e3a1   (成功/已连接)
  Yellow:     #f9e2af   (警告/连接中)
  Red:        #f38ba8   (错误/断开)
```

**间距系统：** 4px 基础单位 (4, 8, 12, 16, 20, 24, 32, 48, 64)

**圆角：** 小 4px（按钮），中 8px（卡片/面板），大 12px（对话框）

### 4.3 交互规范

- **连接操作**：双击连接配置 → 直接连接并打开终端
- **右键上下文菜单**：连接、标签页、文件列表均支持
- **拖拽**：文件拖拽上传/下载、连接配置拖拽排序/分组
- **键盘导航**：全键盘可操作（Tab/方向键/Enter/Esc）
- **Toast 通知**：操作结果非阻塞提示（3 秒自动消失）

---

## 5. Tauri 命令 API 规范

### 5.1 连接配置命令

#### `create_connection`
```typescript
// 请求
{
  name: string;
  groupId?: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key' | 'keyring';
  password?: string;        // 仅 authType=password 时
  privateKeyPath?: string;  // 仅 authType=key 时
  passphrase?: string;      // 私钥密码
  encoding?: string;
  keepAliveInterval?: number;
  connectionTimeout?: number;
  loginCommands?: string[];
  envVars?: Record<string, string>;
}

// 响应
{
  id: string;         // UUID
  name: string;
  host: string;
  port: number;
  username: string;
  authType: string;
  // ... 不包含 password
  createdAt: string;
  updatedAt: string;
}
```

#### `update_connection`
```typescript
// 请求：同 create_connection + id 字段，password 可选
// 响应：同 create_connection
```

#### `delete_connection`
```typescript
// 请求：{ id: string; deletePassword?: boolean }
// 响应：void
```

#### `list_connections`
```typescript
// 请求：{ groupId?: string; search?: string }
// 响应：Connection[]
```

#### `test_connection`
```typescript
// 请求：连接配置（无需持久化）
// 响应：{ success: boolean; message: string; fingerprint?: string }
```

#### `import_connections` / `export_connections`
```typescript
// 请求：{ path: string }
// 响应：{ imported: number; skipped: number; errors: string[] }
// 请求：{ path: string; profileIds?: string[] }
// 响应：void
```

---

### 5.2 SSH 会话命令

#### `ssh_connect`
```typescript
// 请求：{ connectionId: string }
// 响应：{ sessionId: string; tabId: string }
//
// 前端收到响应后创建标签页，并通过事件接收终端数据
```

#### `ssh_disconnect`
```typescript
// 请求：{ sessionId: string }
// 响应：void
```

#### `ssh_write`
```typescript
// 请求：{ sessionId: string; data: string }
// 响应：void
//
// 将用户键盘输入写入 SSH channel
```

#### `ssh_resize`
```typescript
// 请求：{ sessionId: string; cols: number; rows: number; width: number; height: number }
// 响应：void
//
// 终端窗口尺寸变化时调用，width/height 为像素值
```

#### `ssh_list_sessions`
```typescript
// 请求：void
// 响应：{ sessionId: string; connectionId: string; state: string; connectedAt: string }[]
```

---

### 5.3 SFTP 命令

#### `sftp_open`
```typescript
// 请求：{ sessionId: string }  // 复用已有 SSH session
// 响应：{ sftpSessionId: string }
```

#### `sftp_list`
```typescript
// 请求：{ sftpSessionId: string; path: string; filter?: string }
// 响应：{
//   path: string;
//   entries: {
//     name: string;
//     type: 'file' | 'dir' | 'symlink';
//     size: number;
//     permissions: string;  // "rwxr-xr-x"
//     owner: string;
//     group: string;
//     modifiedAt: string;
//   }[];
// }
```

#### `sftp_mkdir`
```typescript
// 请求：{ sftpSessionId: string; path: string }
// 响应：void
```

#### `sftp_rename`
```typescript
// 请求：{ sftpSessionId: string; oldPath: string; newPath: string }
// 响应：void
```

#### `sftp_delete`
```typescript
// 请求：{ sftpSessionId: string; path: string; recursive?: boolean }
// 响应：void
```

#### `sftp_chmod`
```typescript
// 请求：{ sftpSessionId: string; path: string; mode: number }
// 响应：void
```

#### `sftp_disk_usage`
```typescript
// 请求：{ sftpSessionId: string; path: string }
// 响应：{ total: number; used: number; free: number }
```

---

### 5.4 FTP 命令

#### `ftp_connect`
```typescript
// 请求：{
//   connectionId: string;
//   host: string;
//   port: number;
//   username: string;
//   password?: string;
//   mode: 'active' | 'passive';
//   security: 'plain' | 'ftps_explicit' | 'ftps_implicit';
//   encoding?: string;
// }
// 响应：{ sessionId: string }
```

#### `ftp_disconnect`
```typescript
// 请求：{ sessionId: string }
// 响应：void
```

#### `ftp_list`
```typescript
// 请求：{ sessionId: string; path: string }
// 响应：同 sftp_list
```

#### `ftp_mkdir` / `ftp_rename` / `ftp_delete`
```typescript
// 同 SFTP 对应命令，sessionId 为 FTP session
```

### 5.5 传输命令

#### `transfer_upload`
```typescript
// 请求：{
//   protocol: 'sftp' | 'ftp';
//   sessionId: string;
//   localPath: string;
//   remotePath: string;
//   overwrite?: boolean;
// }
// 响应：{ taskId: string }
```

#### `transfer_download`
```typescript
// 请求：{
//   protocol: 'sftp' | 'ftp';
//   sessionId: string;
//   remotePath: string;
//   localPath: string;
//   overwrite?: boolean;
// }
// 响应：{ taskId: string }
```

#### `transfer_pause` / `transfer_resume` / `transfer_cancel`
```typescript
// 请求：{ taskId: string }
// 响应：void
```

#### `transfer_list`
```typescript
// 请求：void
// 响应：TransferTask[]
```

---

### 5.6 配置命令

#### `get_settings` / `update_settings`
```typescript
// 请求：void
// 响应：AppSettings
// 请求：Partial<AppSettings>
// 响应：AppSettings
```

#### `get_fonts`
```typescript
// 请求：void
// 响应：{ family: string; monospace: boolean }[]
// 列出系统已安装字体
```

---

## 6. 事件系统规范

Tauri 后端通过 Event 向前端推送实时数据。

### 6.1 终端数据事件

```
事件名: ssh:data
负载: { sessionId: string; data: string }
方向: Backend → Frontend
频率: SSH 通道有数据时实时推送
```

### 6.2 连接状态变更事件

```
事件名: ssh:state-change
负载: {
  sessionId: string;
  state: 'connecting' | 'connected' | 'disconnected' | 'error';
  error?: string;
  timestamp: string;
}
方向: Backend → Frontend
```

### 6.3 传输进度事件

```
事件名: transfer:progress
负载: {
  taskId: string;
  state: 'transferring' | 'completed' | 'failed' | 'cancelled';
  transferred: number;
  total: number;
  speed: number;
  eta: number;
  error?: string;
}
方向: Backend → Frontend
频率: 每 250ms（传输中）或状态变更时
```

### 6.4 心跳事件

```
事件名: ssh:heartbeat
负载: { sessionId: string; timestamp: string }
方向: Backend → Frontend
频率: 每 keep_alive_interval 秒
```

---

## 7. 数据模型详述

### 7.1 Rust 侧数据模型

```rust
// models/connection.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionProfile {
    pub id: String,                 // UUID v4
    pub name: String,
    pub group_id: Option<String>,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_type: AuthType,
    pub private_key_path: Option<String>,
    pub passphrase_keyring_id: Option<String>,
    pub encoding: String,
    pub keep_alive_interval: u32,
    pub connection_timeout: u32,
    pub login_commands: Vec<String>,
    pub env_vars: HashMap<String, String>,
    pub sort_order: u32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthType {
    Password,
    Key,
    Keyring,
}

// models/transfer.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferTask {
    pub id: String,
    pub task_type: TransferType,
    pub protocol: TransferProtocol,
    pub session_id: String,
    pub local_path: PathBuf,
    pub remote_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub transferred: u64,
    pub speed: f64,
    pub eta: u64,
    pub state: TransferState,
    pub error: Option<String>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TransferType { Upload, Download }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TransferProtocol { Sftp, Ftp }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TransferState {
    Queued,
    Transferring,
    Completed,
    Failed,
    Cancelled,
}

// models/config.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub theme: Theme,
    pub terminal_font_family: String,
    pub terminal_font_size: u8,
    pub terminal_line_height: f32,
    pub terminal_cursor_style: CursorStyle,
    pub terminal_cursor_blink: bool,
    pub terminal_color_scheme: String,
    pub terminal_scrollback: u32,
    pub default_download_path: String,
    pub max_concurrent_transfers: u8,
    pub duplicate_file_policy: DuplicateFilePolicy,
    pub verify_after_transfer: bool,
    pub keybindings: HashMap<String, String>,
    pub log_level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Theme { Dark, Light, System }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CursorStyle { Block, Underline, Bar }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DuplicateFilePolicy { Ask, Overwrite, Rename, Skip }
```

### 7.2 SQLite 数据库设计

#### 数据库路径
`{app_data_dir}/x-terminal.db`

#### 表结构

**connections**
```sql
CREATE TABLE connections (
    id              TEXT PRIMARY KEY NOT NULL,
    name            TEXT NOT NULL,
    group_id        TEXT,
    host            TEXT NOT NULL,
    port            INTEGER NOT NULL DEFAULT 22,
    username        TEXT NOT NULL,
    auth_type       TEXT NOT NULL CHECK(auth_type IN ('password', 'key', 'keyring')),
    private_key_path TEXT,
    passphrase_keyring_id TEXT,
    encoding        TEXT NOT NULL DEFAULT 'UTF-8',
    keep_alive_interval INTEGER NOT NULL DEFAULT 0,
    connection_timeout  INTEGER NOT NULL DEFAULT 30,
    login_commands  TEXT DEFAULT '[]',    -- JSON array
    env_vars        TEXT DEFAULT '{}',    -- JSON object
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_connections_group ON connections(group_id);
CREATE INDEX idx_connections_sort ON connections(sort_order);
```

**connection_groups**
```sql
CREATE TABLE connection_groups (
    id          TEXT PRIMARY KEY NOT NULL,
    name        TEXT NOT NULL,
    parent_id   TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_groups_parent ON connection_groups(parent_id);
```

**settings**
```sql
CREATE TABLE settings (
    key     TEXT PRIMARY KEY NOT NULL,
    value   TEXT NOT NULL     -- JSON value
);
```

**favorite_paths**
```sql
CREATE TABLE favorite_paths (
    id              TEXT PRIMARY KEY NOT NULL,
    connection_id   TEXT NOT NULL,
    path            TEXT NOT NULL,
    label           TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
);
```

**transfer_history** (P2)
```sql
CREATE TABLE transfer_history (
    id              TEXT PRIMARY KEY NOT NULL,
    connection_id   TEXT NOT NULL,
    file_name       TEXT NOT NULL,
    file_size       INTEGER NOT NULL,
    transfer_type   TEXT NOT NULL CHECK(transfer_type IN ('upload', 'download')),
    protocol        TEXT NOT NULL CHECK(protocol IN ('sftp', 'ftp')),
    local_path      TEXT NOT NULL,
    remote_path     TEXT NOT NULL,
    status          TEXT NOT NULL CHECK(status IN ('completed', 'failed', 'cancelled')),
    error           TEXT,
    speed           REAL,
    started_at      TEXT,
    completed_at    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 8. 安全设计

### 8.1 威胁模型

| 威胁 | 风险等级 | 缓解措施 |
|------|---------|---------|
| 密码明文存储 | 高 | 仅存系统密钥链，内存中最小化保留 |
| 私钥泄露 | 高 | 私钥文件权限检查，不复制不缓存 |
| 中间人攻击 | 高 | 主机密钥指纹验证，变更告警 |
| SQLite 数据泄露 | 中 | 可选 SQLCipher 加密 |
| 内存 dump 获取凭证 | 中 | 使用后清零敏感字段 |
| 日志泄露凭证 | 中 | 日志过滤敏感信息 |
| 剪贴板残留 | 低 | 不自动复制密码 |

### 8.2 凭证存储架构

```
┌─────────────────────────────────────────────────────┐
│                   X-Terminal                         │
│                                                      │
│  ┌─────────────┐    ┌──────────────────────────┐    │
│  │ 连接配置     │    │  系统密钥链               │    │
│  │ (SQLite)    │    │  ┌──────────────────────┐ │    │
│  │             │    │  │ Service: x-terminal   │ │    │
│  │ id: "abc"   │───▶│  │ Account: "abc"       │ │    │
│  │ username    │    │  │ Password: "***"       │ │    │
│  │ pass_ref:   │    │  │ PrivateKeyPass: "***" │ │    │
│  │   "abc"     │    │  └──────────────────────┘ │    │
│  │             │    │  ┌──────────────────────┐ │    │
│  │ id: "xyz"   │───▶│  │ Account: "xyz"       │ │    │
│  │ username    │    │  │ Password: "***"       │ │    │
│  │ pass_ref:   │    │  └──────────────────────┘ │    │
│  │   "xyz"     │    │                            │    │
│  └─────────────┘    │  Windows: Credential Manager│    │
│                      │  macOS:   Keychain        │    │
│                      │  Linux:   Secret Service   │    │
│                      └──────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### 8.3 内存安全

```rust
// 敏感数据使用后清零
pub struct SecureString(String);

impl Drop for SecureString {
    fn drop(&mut self) {
        unsafe {
            for byte in self.0.as_bytes_mut() {
                *byte = 0;
            }
        }
    }
}
```

### 8.4 主机密钥管理

```
存储路径：{app_data_dir}/known_hosts
文件格式（每行）：
  host:port algorithm base64-encoded-public-key

例如：
  192.168.1.100:22 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI...
  example.com:2222 ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItb...
```

---

## 9. 非功能需求

### 9.1 性能指标

| 指标 | 目标值 | 测量方式 |
|------|--------|---------|
| 应用冷启动时间 | < 2 秒 | Tauri 进程启动到窗口可见 |
| 内存基线占用 | < 50MB | 应用启动后无连接时 |
| SSH 连接建立 | < 3 秒（LAN） | TCP + 握手 + 认证 |
| 终端输出延迟 | < 50ms | 键盘输入到屏幕回显 |
| SFTP 传输速度 | ≥ 80% 网络带宽 | 大文件传输测试 |
| 多会话内存增长 | < 20MB/会话 | 3 会话 vs 1 会话对比 |
| 标签页切换 | < 100ms | 无明显闪烁/延迟 |
| 安装包大小 | < 15MB (Windows) | 最终打包产物 |

### 9.2 可靠性

- 单个 SSH 会话崩溃不应影响其他会话
- 后端 panic 捕获并通过事件通知前端，不应导致整个应用退出
- 传输失败应可重试（断点续传 P2）
- 应用异常退出时，未保存的配置变更不丢失（自动保存机制）

### 9.3 兼容性

- 与 OpenSSH 服务器 7.x+ 完全兼容
- 与 vsftpd / ProFTPD / Pure-FTPd 兼容
- 与常见云服务商 SSH 配置兼容（AWS EC2 / GCP / Azure）
- 与 Git Bash / WSL2 SSH 密钥兼容

### 9.4 国际化（P2）

- 界面语言：简体中文、English
- 字符编码：UTF-8, GBK, GB2312, Shift-JIS, EUC-KR
- 终端内 CJK 字符显示宽度正确

---

## 10. 系统架构详述

### 10.1 分层架构图

```
┌─────────────────────────────────────────────────────┐
│                   FRONTEND (React + TS)              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Terminal │ │  File    │ │Connection│ │Settings│ │
│  │  View    │ │ Explorer │ │  Panel   │ │  Page  │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬────┘ │
│       └─────────────┴────────────┴───────────┘      │
│                        │                             │
│              ┌─────────┴──────────┐                  │
│              │   Zustand Store     │                  │
│              └─────────┬──────────┘                  │
│                        │                             │
├────────────────────────┼────────────────────────────┤
│                  Tauri Bridge                         │
│          invoke() / listen() / emit()                │
├────────────────────────┼────────────────────────────┤
│                        │                             │
│  ┌─────────────────────┴──────────────────────────┐ │
│  │              RUST BACKEND                       │ │
│  │                                                 │ │
│  │  ┌──────────────┐  ┌──────────────────────┐    │ │
│  │  │  Commands    │  │   Event Emitters      │    │ │
│  │  │  (IPC入口)   │  │   (ssh:data, etc.)    │    │ │
│  │  └──────┬───────┘  └──────────────────────┘    │ │
│  │         │                                       │ │
│  │  ┌──────┴──────────────────────────────┐       │ │
│  │  │         Services Layer               │       │ │
│  │  │  ┌──────────┐ ┌─────────┐ ┌───────┐ │       │ │
│  │  │  │SSHService│ │FTPServ. │ │SFTP   │ │       │ │
│  │  │  │          │ │         │ │Service │ │       │ │
│  │  │  │- sessions│ │- clients│ │- list  │ │       │ │
│  │  │  │- channels│ │- list   │ │- trans │ │       │ │
│  │  │  └────┬─────┘ └────┬────┘ └───┬───┘ │       │ │
│  │  │       └─────────────┴──────────┘     │       │ │
│  │  └──────────────────────────────────────┘       │ │
│  │         │                                       │ │
│  │  ┌──────┴──────────────────────────────┐       │ │
│  │  │          Store Layer                 │       │ │
│  │  │  ┌─────────┐ ┌──────────┐           │       │ │
│  │  │  │Database │ │ Keyring  │           │       │ │
│  │  │  │(SQLite) │ │ Service  │           │       │ │
│  │  │  └─────────┘ └──────────┘           │       │ │
│  │  └──────────────────────────────────────┘       │ │
│  └─────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│              RUNTIME (tokio async)                    │
├──────────────────────────────────────────────────────┤
│              OS (Windows / macOS / Linux)             │
└──────────────────────────────────────────────────────┘
```

### 10.2 Rust 项目结构

```
src-tauri/
├── Cargo.toml
├── tauri.conf.json
├── capabilities/
│   └── default.json
├── icons/
├── src/
│   ├── main.rs              # Tauri 入口，注册命令和插件
│   ├── lib.rs               # 库根，模块声明
│   ├── commands/            # Tauri 命令层（IPC 入口）
│   │   ├── mod.rs
│   │   ├── connection.rs    # 连接配置 CRUD
│   │   ├── ssh.rs           # SSH 会话管理
│   │   ├── sftp.rs          # SFTP 操作
│   │   ├── ftp.rs           # FTP 操作
│   │   ├── transfer.rs      # 传输队列
│   │   ├── settings.rs      # 应用设置
│   │   └── util.rs          # 工具命令（字体列表等）
│   ├── services/            # 业务服务层
│   │   ├── mod.rs
│   │   ├── ssh_service.rs   # russh 客户端封装，会话池
│   │   ├── ftp_service.rs   # suppaftp 客户端封装
│   │   ├── sftp_service.rs  # SFTP 子系统封装
│   │   └── transfer_queue.rs# 传输并发控制队列
│   ├── models/              # 数据模型
│   │   ├── mod.rs
│   │   ├── connection.rs
│   │   ├── transfer.rs
│   │   └── config.rs
│   ├── store/               # 持久化层
│   │   ├── mod.rs
│   │   ├── database.rs      # rusqlite 连接池和操作
│   │   └── migrations.rs    # schema 版本迁移
│   ├── security/            # 安全模块
│   │   ├── mod.rs
│   │   ├── keyring.rs       # 系统密钥链封装
│   │   ├── known_hosts.rs   # known_hosts 管理
│   │   └── crypto.rs        # 加密工具
│   └── error.rs             # 统一错误类型
```

### 10.3 前端项目结构

```
src/
├── main.tsx                 # React 入口
├── App.tsx                  # 根组件
├── layouts/
│   ├── MainLayout.tsx       # 主窗口布局
│   └── TitleBar.tsx        # 自定义标题栏（P2）
├── components/
│   ├── terminal/
│   │   ├── TerminalView.tsx     # 终端视图容器
│   │   ├── TerminalTabBar.tsx   # 标签页栏
│   │   ├── TerminalTab.tsx      # 单个标签页
│   │   ├── XTermTerminal.tsx    # xterm.js 封装
│   │   └── TerminalContextMenu.tsx
│   ├── connection/
│   │   ├── ConnectionPanel.tsx  # 侧栏连接列表面板
│   │   ├── ConnectionItem.tsx   # 单个连接项
│   │   ├── ConnectionForm.tsx   # 连接配置表单对话框
│   │   ├── GroupItem.tsx        # 分组项
│   │   └── HostKeyDialog.tsx    # 主机密钥对话框
│   ├── file/
│   │   ├── FileExplorer.tsx     # 文件浏览器容器
│   │   ├── FileList.tsx         # 文件列表
│   │   ├── FileRow.tsx          # 单个文件行
│   │   ├── FileToolbar.tsx      # 工具栏
│   │   ├── DualPanel.tsx        # 双面板布局（P1）
│   │   └── FileContextMenu.tsx
│   ├── transfer/
│   │   ├── TransferPanel.tsx    # 传输队列面板
│   │   ├── TransferItem.tsx     # 单个传输任务
│   │   └── TransferStats.tsx    # 统计信息
│   ├── settings/
│   │   ├── SettingsPage.tsx
│   │   ├── AppearanceSettings.tsx
│   │   ├── TerminalSettings.tsx
│   │   ├── KeybindSettings.tsx
│   │   └── TransferSettings.tsx
│   └── common/
│       ├── StatusBar.tsx
│       ├── Toast.tsx
│       ├── Modal.tsx
│       ├── ContextMenu.tsx
│       └── Icon.tsx
├── stores/                  # Zustand stores
│   ├── connectionStore.ts   # 连接配置和管理
│   ├── tabStore.ts          # 标签页管理
│   ├── terminalStore.ts     # 终端会话数据缓冲
│   ├── fileStore.ts         # 文件浏览器状态
│   ├── transferStore.ts     # 传输队列
│   └── settingsStore.ts     # 应用设置
├── hooks/                   # 自定义 hooks
│   ├── useTerminal.ts       # 终端实例管理
│   ├── useSSHConnection.ts  # SSH 连接生命周期
│   ├── useFileOperations.ts # 文件操作
│   ├── useTransfer.ts       # 传输任务管理
│   ├── useKeyboard.ts       # 快捷键注册
│   └── useTheme.ts          # 主题管理
├── lib/
│   ├── tauri.ts             # Tauri API 封装层
│   ├── constants.ts         # 常量
│   ├── types.ts             # TypeScript 类型定义
│   └── utils.ts             # 工具函数
├── styles/
│   ├── global.css
│   ├── themes/
│   │   ├── dark.css
│   │   └── light.css
│   └── components/          # 组件级样式
└── assets/
    └── icons/
```

---

## 11. 前端组件树与状态管理

### 11.1 组件树

```
<App>
  ├── <ThemeProvider>
  ├── <MainLayout>
  │   ├── <TitleBar />                    （P2 自定义标题栏）
  │   ├── <Sidebar>
  │   │   ├── <SearchBar />
  │   │   ├── <ConnectionPanel>
  │   │   │   ├── <ConnectionGroup>       （列表/分组递归）
  │   │   │   │   └── <ConnectionItem />  （可拖拽）
  │   │   │   └── <AddConnectionButton />
  │   │   └── <SidebarToggle />
  │   ├── <MainContent>
  │   │   ├── <TerminalTabBar>
  │   │   │   └── <TerminalTab /> × N    （可拖拽排序）
  │   │   └── <TabContent>
  │   │       ├── <TerminalView>           （当 tab.type === 'ssh'）
  │   │       │   ├── <XTermTerminal />    （xterm.js 实例）
  │   │       │   └── <TerminalContextMenu />
  │   │       ├── <FileExplorer>           （当 tab.type === 'sftp' | 'ftp'）
  │   │       │   ├── <FileToolbar />
  │   │       │   ├── <FileList>
  │   │       │   │   └── <FileRow /> × N
  │   │       │   ├── <DualPanel />        （P1）
  │   │       │   └── <FileContextMenu />
  │   │       └── <WelcomePage />          （无标签时）
  │   ├── <StatusBar />
  │   └── <TransferPanel>                  （底部可折叠）
  │       └── <TransferItem /> × N
  ├── <ConnectionForm />                   （模态对话框）
  ├── <HostKeyDialog />                    （模态对话框）
  ├── <SettingsPage />                     （模态页面）
  └── <ToastContainer />
```

### 11.2 Zustand 状态管理

#### connectionStore
```typescript
interface ConnectionStore {
  // 数据
  profiles: ConnectionProfile[];
  groups: ConnectionGroup[];
  isLoading: boolean;

  // 操作
  loadProfiles: () => Promise<void>;
  createProfile: (data: CreateConnectionDto) => Promise<ConnectionProfile>;
  updateProfile: (id: string, data: UpdateConnectionDto) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  testConnection: (data: TestConnectionDto) => Promise<TestResult>;
  importProfiles: (path: string) => Promise<void>;
  exportProfiles: (path: string, ids?: string[]) => Promise<void>;
}
```

#### tabStore
```typescript
interface TabStore {
  tabs: Tab[];
  activeTabId: string | null;

  openTab: (tab: Omit<Tab, 'id'>) => string;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeTabsToRight: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  updateTab: (tabId: string, updates: Partial<Tab>) => void;
}
```

#### terminalStore
```typescript
interface TerminalStore {
  // key: sessionId
  terminals: Map<string, {
    xterm: Terminal;
    fitAddon: FitAddon;
    sessionId: string;
    connected: boolean;
  }>;

  registerTerminal: (sessionId: string, terminal: Terminal, fitAddon: FitAddon) => void;
  unregisterTerminal: (sessionId: string) => void;
  getTerminal: (sessionId: string) => { terminal: Terminal; fitAddon: FitAddon } | undefined;
}
```

#### transferStore
```typescript
interface TransferStore {
  tasks: TransferTask[];
  isPanelOpen: boolean;

  addTask: (task: TransferTask) => void;
  updateTask: (taskId: string, updates: Partial<TransferTask>) => void;
  removeTask: (taskId: string) => void;
  pauseTask: (taskId: string) => void;
  resumeTask: (taskId: string) => void;
  cancelTask: (taskId: string) => void;
  pauseAll: () => void;
  cancelAll: () => void;
  clearCompleted: () => void;
  togglePanel: () => void;
}
```

---

## 12. 错误处理策略

### 12.1 错误分类

```rust
// error.rs
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("连接失败: {0}")]
    ConnectionFailed(String),

    #[error("SSH 认证失败: {0}")]
    AuthFailed(String),

    #[error("主机密钥验证失败: {0}")]
    HostKeyVerificationFailed(String),

    #[error("网络超时: {0}")]
    Timeout(String),

    #[error("文件操作失败: {0}")]
    FileOperationFailed(String),

    #[error("传输失败: {0}")]
    TransferFailed(String),

    #[error("配置错误: {0}")]
    ConfigError(String),

    #[error("数据库错误: {0}")]
    DatabaseError(#[from] rusqlite::Error),

    #[error("IO 错误: {0}")]
    IoError(#[from] std::io::Error),

    #[error("序列化错误: {0}")]
    SerializationError(#[from] serde_json::Error),

    #[error("内部错误: {0}")]
    InternalError(String),
}

// 实现 Into<tauri::InvokeError> 或使用 Tauri 的 serde 序列化
impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
```

### 12.2 前端错误处理

```typescript
// lib/tauri.ts
async function invokeWithError<T>(cmd: string, args?: any): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (error) {
    // 解析 Rust 返回的错误字符串
    const message = typeof error === 'string' ? error : String(error);
    console.error(`[${cmd}]`, message);
    throw new AppError(message);
  }
}

class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }

  getUserMessage(): string {
    // 映射技术错误到用户友好消息
    if (this.message.includes('Connection refused')) {
      return '无法连接到服务器，请检查主机地址和端口是否正确';
    }
    if (this.message.includes('Authentication failed')) {
      return '认证失败，请检查用户名和密码/私钥';
    }
    if (this.message.includes('timeout')) {
      return '连接超时，请检查网络或增加超时时间';
    }
    return this.message;
  }
}
```

### 12.3 错误展示策略

| 错误类型 | 展示方式 | 持续时间 |
|---------|---------|---------|
| 连接错误 | 标签页内显示错误信息 + Toast | Toast 5 秒 |
| 认证失败 | 错误对话框（含重试按钮） | 用户关闭 |
| 主机密钥变更 | 安全警告对话框（阻塞） | 用户选择 |
| 传输失败 | 传输队列项显示错误 + Toast | Toast 5 秒 |
| 文件操作错 | Toast | 3 秒 |
| 配置保存失败 | Toast（含错误详情） | 5 秒 |
| 内部错误 | 错误对话框 + 日志记录 | 用户关闭 |

---

## 13. 测试策略

### 13.1 测试层次

| 层次 | 框架 | 覆盖目标 |
|------|------|---------|
| 单元测试 (Rust) | `cargo test` | 模型、服务逻辑、工具函数 |
| 集成测试 (Rust) | `cargo test --test *` | 命令调用链、数据库操作 |
| 单元测试 (前端) | Vitest + React Testing Library | 组件、hooks、stores |
| E2E 测试 | Playwright (P2) | 关键用户流程 |
| 安全测试 | cargo-audit + 手动审查 | 依赖漏洞、密钥处理 |

### 13.2 关键测试用例

**Rust 单元测试：**
- `test_connection_profile_serialization`：序列化/反序列化
- `test_auth_type_parsing`：认证类型解析
- `test_known_hosts_parse`：known_hosts 文件解析
- `test_transfer_queue_ordering`：传输队列 FIFO
- `test_settings_crud`：设置读写
- `test_password_keyring_roundtrip`：密码存储和读取
- `test_secure_string_zeroize`：敏感数据清零

**前端测试：**
- `ConnectionForm`：表单验证、提交
- `TerminalTabBar`：标签页 CRUD、切换、拖拽
- `FileExplorer`：文件列表渲染、排序
- `useSSHConnection`：连接生命周期状态转换
- `transferStore`：传输任务状态管理

**集成测试：**
- 创建连接 → 持久化 → 列表读取 → 编辑 → 删除
- SSH 连接 → 写数据 → 读回显 → resize → 断开
- SFTP 列表 → 创建目录 → 上传文件 → 下载文件 → 删除

---

## 14. 开发排期详述

### Phase 0：项目脚手架（2 天）

**任务清单：**
- [x] 创建 Tauri 项目：`npm create tauri-app@latest`
- [ ] 配置 Tauri 2.x + React + TypeScript 模板
- [ ] 集成 xterm.js：安装 `@xterm/xterm` `@xterm/addon-fit` `@xterm/addon-webgl`
- [ ] 集成 zustand 状态管理
- [ ] 配置 Rust 依赖（Cargo.toml）：russh、suppaftp、rusqlite、keyring、tokio、serde
- [ ] 搭建 Rust 项目结构（lib.rs / commands / services / models / store / security）
- [ ] 搭建前端目录结构
- [ ] 实现基础主窗口布局（侧栏 + 内容区 + 状态栏）
- [ ] 配置暗色主题 CSS 变量
- [ ] **交付物：可启动的应用骨架，显示空白主窗口**

### Phase 1：SSH 终端核心（5 天）

**任务清单：**
- [ ] 实现 `security/known_hosts`：解析、查询、保存 known_hosts
- [ ] 实现 `services/ssh_service`：
  - russh 客户端初始化
  - 密码认证连接
  - 私钥认证连接
  - PTY 分配
  - 数据读写
  - 窗口 resize
  - 心跳保活
  - 会话池管理
- [ ] 实现 `commands/ssh`：`ssh_connect`, `ssh_disconnect`, `ssh_write`, `ssh_resize`
- [ ] 实现 SSH 事件推送：`ssh:data`, `ssh:state-change`
- [ ] 前端 `XTermTerminal` 组件：
  - xterm.js 初始化
  - 键盘输入绑定
  - 事件监听（数据写入 xterm）
  - FitAddon 自适应
  - WebglAddon 加速
- [ ] 前端 `useSSHConnection` hook
- [ ] **交付物：可通过硬编码连接信息 SSH 到远程服务器并执行命令**

### Phase 2：多标签页 + 连接管理 UI（3 天）

- [ ] 实现 `TerminalTabBar` / `TerminalTab` 组件
- [ ] 实现 `tabStore`
- [ ] 实现 `ConnectionPanel` / `ConnectionItem`（侧栏）
- [ ] 实现 `ConnectionForm`（创建/编辑对话框）
- [ ] 实现 `HostKeyDialog`
- [ ] 实现 `TestConnection` 功能
- [ ] **交付物：完整的连接配置管理和多标签页终端**

### Phase 3：连接配置持久化 + 密钥链（3 天）

- [ ] 实现 `store/database`：SQLite 初始化 + 迁移
- [ ] 实现 `store/migrations`：初始 schema
- [ ] 实现 `commands/connection`：CRUD
- [ ] 实现 `security/keyring`：密码/私钥密码存储
- [ ] 实现 `commands/settings`：应用设置读写
- [ ] 前端 `connectionStore`
- [ ] **交付物：连接配置持久化，重启应用后可用**

### Phase 4：SFTP 文件浏览器（5 天）

- [ ] 实现 `services/sftp_service`：SFTP 通道建立、list/mkdir/rename/delete/chmod
- [ ] 实现 `commands/sftp`：所有 SFTP 操作命令
- [ ] 前端 `FileExplorer` / `FileList` / `FileRow` 组件
- [ ] 前端 `FileToolbar`（导航、刷新、新建文件夹）
- [ ] 前端 `FileContextMenu`（右键菜单）
- [ ] 文件排序（名称/大小/时间）
- [ ] 权限显示和修改
- [ ] 传输队列面板 `TransferPanel` / `TransferItem`
- [ ] **交付物：可通过 SFTP 浏览远程文件、上传下载**

### Phase 5：FTP 独立连接 + 传输队列（4 天）

- [ ] 实现 `services/ftp_service`：suppaftp 封装（connect/list/upload/download/delete/mkdir）
- [ ] 实现 `commands/ftp`：FTP 命令
- [ ] 支持 FTPS（显式/隐式 TLS）
- [ ] 支持主动/被动模式
- [ ] 实现 `services/transfer_queue`：并发控制、进度追踪、暂停/继续
- [ ] 前端拖拽上传/下载
- [ ] **交付物：FTP 完整功能，传输引擎就绪**

### Phase 6：主题、偏好设置、快捷键（3 天）

- [ ] 前端 `SettingsPage` 及其子组件
- [ ] 亮色主题
- [ ] 字体选择（读取系统字体列表）
- [ ] 终端配色方案预设
- [ ] 快捷键配置界面
- [ ] `useKeyboard` hook
- [ ] **交付物：可自定义的外观和行为设置**

### Phase 7：测试、优化、打包（3 天）

- [ ] Rust 单元测试（覆盖率 > 60% 核心代码）
- [ ] 前端组件测试
- [ ] 错误处理审查（所有 unwrap/expect 替换为 proper error handling）
- [ ] 性能测试（内存、启动时间）
- [ ] Tauri 打包配置（图标、签名、更新器）
- [ ] 三个平台构建验证
- [ ] **交付物：可发布版本**

---

## 15. 验收标准

### 15.1 功能验收

1. ✅ 可通过 SSH 密码认证连接远程 Linux 服务器并执行命令
2. ✅ 可通过 SSH 私钥认证（含加密私钥 + passphrase）连接远程服务器
3. ✅ 可同时打开 3 个以上 SSH 会话标签页，独立运行互不干扰
4. ✅ 通过 SFTP 上传/下载文件，进度显示准确（误差 < 5%）
5. ✅ 通过 FTP 独立连接上传/下载文件
6. ✅ 连接配置可保存、编辑、删除，重启应用后保持不变
7. ✅ 密码/私钥密码不存储在明文文件或 SQLite 中
8. ✅ 首次连接显示主机指纹确认对话框
9. ✅ 主机密钥变更时显示安全警告
10. ✅ 终端支持 ANSI 颜色、Unicode、窗口自适应调整
11. ✅ 支持终端复制/粘贴（系统剪贴板）
12. ✅ 传输支持并发队列、暂停/继续/取消
13. ✅ 应用设置可保存和恢复
14. ✅ 暗色主题完整覆盖所有界面

### 15.2 平台验收

15. ✅ Windows 10/11 x64 构建并运行正常
16. ✅ macOS 12+ 构建并运行正常
17. ✅ Linux x64 构建并运行正常

### 15.3 性能验收

18. ✅ 应用冷启动 < 3 秒
19. ✅ 无连接时内存 < 80MB
20. ✅ 3 个 SSH 会话时内存 < 150MB
21. ✅ 终端键盘输入到屏幕回显延迟 < 100ms

### 15.4 安全验收

22. ✅ `cargo audit` 无已知高危漏洞
23. ✅ SQLite 不包含密码字段
24. ✅ known_hosts 验证机制正常工作
25. ✅ 敏感内存使用后清零

---

## 16. 附录

### 16.1 关键依赖库详情（Rust）

| 库名 | 版本 | 用途 | 许可证 |
|------|------|------|--------|
| tauri | 2.x | 桌面应用框架 | MIT / Apache 2.0 |
| tauri-plugin-dialog | 2.x | 文件对话框 | MIT / Apache 2.0 |
| tauri-plugin-shell | 2.x | Shell 命令 | MIT / Apache 2.0 |
| russh | 0.44+ | SSH 客户端 | MIT / Apache 2.0 |
| russh-sftp | 2.x | SFTP 子系统 | MIT / Apache 2.0 |
| suppaftp | 5.x | FTP 客户端 | MIT / Apache 2.0 |
| rusqlite | 0.31+ | SQLite 数据库 | MIT |
| keyring | 2.x | 系统密钥链 | MIT / Apache 2.0 |
| serde | 1.x | 序列化框架 | MIT / Apache 2.0 |
| serde_json | 1.x | JSON 序列化 | MIT / Apache 2.0 |
| tokio | 1.x | 异步运行时 | MIT |
| uuid | 1.x | UUID 生成 | MIT / Apache 2.0 |
| chrono | 0.4+ | 时间处理 | MIT / Apache 2.0 |
| thiserror | 1.x | 错误类型派生 | MIT / Apache 2.0 |
| zeroize | 1.x | 内存安全清零 | MIT / Apache 2.0 |

### 16.2 关键依赖库详情（前端）

| 库名 | 版本 | 用途 | 许可证 |
|------|------|------|--------|
| react | 18.x | UI 框架 | MIT |
| react-dom | 18.x | React DOM 渲染 | MIT |
| @tauri-apps/api | 2.x | Tauri 前端 API | MIT / Apache 2.0 |
| @xterm/xterm | 5.x | 终端模拟器 | MIT |
| @xterm/addon-fit | 5.x | 终端自适应插件 | MIT |
| @xterm/addon-webgl | 5.x | WebGL 渲染加速 | MIT |
| @xterm/addon-unicode11 | 5.x | Unicode 11 支持 | MIT |
| zustand | 4.x | 轻量状态管理 | MIT |
| @tauri-apps/plugin-dialog | 2.x | 文件对话框 | MIT / Apache 2.0 |

### 16.3 术语表

| 术语 | 说明 |
|------|------|
| PTY | Pseudo-Terminal，伪终端 |
| KEX | Key Exchange，密钥交换 |
| known_hosts | SSH 主机公钥信任列表 |
| FTPS | FTP over TLS/SSL |
| SFTP | SSH File Transfer Protocol（不同于 FTP over SSH） |
| POSIX | Portable Operating System Interface，文件权限模型 |
| ANSI escape codes | 终端控制序列（颜色、光标移动等） |

### 16.4 参考资料

- [Tauri 2.x 官方文档](https://v2.tauri.app/)
- [russh 文档](https://docs.rs/russh/)
- [suppaftp 文档](https://docs.rs/suppaftp/)
- [xterm.js 文档](https://xtermjs.org/docs/)
- [SSH 协议 RFC 4250-4254](https://www.rfc-editor.org/rfc/rfc4250)
- [FTP 协议 RFC 959](https://www.rfc-editor.org/rfc/rfc959)
- [SFTP 协议草案](https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-13)
