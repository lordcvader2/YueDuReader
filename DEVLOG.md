# 悦读阅读器开发日志

> 最后更新：2026-04-21 by 皮卡丘 AI

## 项目概述

**项目名称**：悦读阅读器（YueDuReader）
**技术栈**：Electron + React + TypeScript + Tailwind CSS + Zustand
**目标**：现代化的 TXT 小说阅读器，支持 AI 净化、老板键、迷你窗口模式

---

## 开发进度

### v1.0.0-alpha (2026-04-21)

#### 已完成功能

1. **基础架构**
   - [x] Electron 主进程 + 渲染进程分离
   - [x] React 18 + TypeScript 项目结构
   - [x] Tailwind CSS 样式系统
   - [x] Zustand 状态管理（bookStore, settingsStore）
   - [x] IPC 通信层（preload.ts + constants）

2. **书架功能** (`Bookshelf.tsx`)
   - [x] 导入 TXT 文件
   - [x] 书籍列表展示（网格/列表视图）
   - [x] 搜索书籍
   - [x] 双击书名改名
   - [x] 删除书籍（可选保留本地文件）
   - [x] 阅读进度显示

3. **阅读器功能** (`Reader.tsx`)
   - [x] 章节目录导航
   - [x] 键盘翻页（方向键/AD/空格）
   - [x] 阅读设置（字号/行高/字体/主题）
   - [x] 三种主题（明亮/深色/护眼）
   - [x] 阅读进度自动保存
   - [x] 打开书籍自动净化

4. **AI 净化功能** (`purifyService.ts`)
   - [x] 本地净化规则（错别字修正、广告移除、乱码清理）
   - [x] QCLAW 远程净化支持（可选）
   - [x] 净化进度显示
   - [x] 恢复原文功能

5. **老板键功能** (`bossKeyManager.ts`)
   - [x] 全局快捷键注册
   - [x] 最小化/伪装两种模式
   - [x] 默认快捷键：Alt+Q

6. **迷你窗口模式** (`MiniReader.tsx`)
   - [x] 小窗口阅读
   - [x] 置顶/透明度调节

---

## 文件结构

```
YueDuReader/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 主进程入口，窗口创建、IPC 注册
│   │   ├── preload.ts           # 预加载脚本，暴露 electronAPI
│   │   └── services/
│   │       ├── bookService.ts   # 书籍管理（导入/删除/章节解析）
│   │       ├── purifyService.ts # 文本净化（本地规则 + QCLAW）
│   │       ├── settingsService.ts # 设置持久化
│   │       └── bossKeyManager.ts # 老板键全局快捷键
│   │
│   ├── renderer/                # React 渲染进程
│   │   ├── App.tsx              # 根组件，路由管理
│   │   ├── pages/
│   │   │   ├── Bookshelf.tsx    # 书架页面
│   │   │   ├── Reader.tsx       # 阅读器页面
│   │   │   ├── MiniReader.tsx   # 迷你窗口阅读器
│   │   │   └── Settings.tsx     # 设置页面
│   │   └── stores/
│   │       ├── bookStore.ts     # 书籍状态管理
│   │       └── settingsStore.ts # 设置状态管理
│   │
│   ├── shared/                  # 主进程/渲染进程共享
│   │   ├── constants/index.ts   # IPC 通道名称常量
│   │   └── types/index.ts       # 共享类型定义（Book, Chapter, Settings）
│   │
│   └── vite-env.d.ts            # TypeScript 类型声明
│
├── books/                       # 书籍数据目录（运行时生成）
│   ├── books-index.json         # 书籍索引
│   ├── {bookId}.txt             # 书籍内容
│   └── {bookId}.bak             # 原文备份（用于恢复）
│
├── release-v3/                  # 打包输出目录
│
├── package.json
├── vite.config.ts
├── electron-builder.yml
└── DEVLOG.md                    # 本文件
```

---

## IPC 通道列表

| 通道名称 | 用途 | 参数 |
|---------|------|------|
| `book:import` | 导入书籍 | filePath: string |
| `book:list` | 获取书籍列表 | - |
| `book:get` | 获取单本书籍 | bookId, loadContent? |
| `book:delete` | 删除书籍 | bookId |
| `book:update` | 更新书籍信息 | book: Book |
| `book:restore` | 恢复原文 | bookId |
| `book:deleteWithOption` | 删除书籍（可选保留文件） | bookId, keepFile |
| `purify:chapter` | 净化单章 | text: string |
| `purify:book` | 净化整书 | bookId |
| `settings:get` | 获取设置 | - |
| `settings:set` | 保存设置 | settings: AppSettings |
| `bossKey:register` | 注册老板键 | key: string |
| `bossKey:toggle` | 触发老板键 | - |
| `file:dialog` | 打开文件对话框 | - |
| `window:minimize` | 最小化窗口 | - |
| `window:close` | 关闭窗口 | - |
| `window:setAlwaysOnTop` | 设置置顶 | flag: boolean |
| `window:setOpacity` | 设置透明度 | opacity: number |

---

## 关键技术决策

### 1. 为什么移除 Ant Design？

Ant Design 5.x 使用 CSS-in-JS (`@ant-design/cssinjs`)，在 Electron + Vite 环境下样式注入不稳定，导致按钮不显示。解决方案：全部替换为原生 HTML + Tailwind CSS。

### 2. 为什么使用 `utf-8-sig` 编码？

Windows 记事本保存 UTF-8 文件时会添加 BOM（Byte Order Mark），`utf-8-sig` 自动处理 BOM，兼容性最好。

### 3. 章节内容懒加载策略

导入书籍时只存储章节位置（startIndex, endIndex），阅读时按需从文件读取内容，减少内存占用。

### 4. 净化流程

1. 打开书籍 → 自动净化第一章（本地规则）
2. 用户手动点击"净化" → 净化全书
3. 点击"恢复原文" → 从 .bak 文件恢复

---

## 已知问题

1. **electron-builder winCodeSign 失败** - Windows 上处理 macOS 符号链接权限问题，不影响功能
2. **双击改名冲突** - 已通过 `isRenaming` 状态标志修复
3. **工具栏隐藏后仍可点击** - 需要添加 `pointer-events: none`

---

## 待开发功能

- [ ] 书籍分类/标签
- [ ] 阅读统计（时长/字数）
- [ ] 书签功能
- [ ] 全文搜索
- [ ] TTS 朗读
- [ ] 云同步

---

## 给下一个 AI 的提示

1. **修改前端代码后需要重新构建**：`npm run build:win`
2. **TypeScript 类型定义在 `vite-env.d.ts`**，新增 API 需要同时修改 `preload.ts` 和 `vite-env.d.ts`
3. **IPC 通道名在 `shared/constants/index.ts`**，新增通道需要同步更新
4. **本地净化规则在 `purifyService.ts`**，可以扩展错别字词典
5. **书籍数据存储在 `books/` 目录**，不在用户数据目录（便于调试）

---

## 联系方式

项目仓库：https://github.com/lordcvader2/YueDuReader
