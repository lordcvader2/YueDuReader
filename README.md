# 悦读 - 小说阅读器

> 一款简洁高效的桌面小说阅读器，支持老板键、迷你窗口、AI 文本净化。

[![Electron](https://img.shields.io/badge/Electron-28.2.0-478061?logo=electron)](https://electronjs.org)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

## 功能特性

### 📚 书架管理
- 一键导入本地 TXT 文件
- 网格 / 列表双视图切换
- 书籍搜索过滤
- 阅读进度实时显示（蓝色进度条）

### 📖 沉浸式阅读
- 全屏沉浸阅读模式（鼠标悬停显示控制栏）
- 字体大小 / 行间距实时调节
- 三种阅读主题：明亮 / 深色 / 护眼（羊皮纸）
- 多种字体可选：思源宋体、思源黑体、宋体、楷体
- 章节快速跳转（侧边抽屉）
- 上次阅读位置自动恢复

### ⌨️ 老板键
- `Alt + Q` 一键隐藏 / 恢复
- 支持最小化 / 伪装窗口 / 切换应用三种模式

### 🪟 迷你窗口
- 桌面置顶透明小窗口
- 自动切换阈值可配置
- 不打断当前工作流

### 🤖 AI 净化（QCLAW 集成）
- 自动去除广告内容
- 修正错别字
- 清理乱码字符
- 净化前自动备份原文

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Electron 28 + React 18 |
| 语言 | TypeScript 5.3 |
| 构建 | Vite 5 + electron-builder 24 |
| 样式 | Tailwind CSS 3.4 |
| 状态 | Zustand 4.5 |

## 项目结构

```
YueDuReader/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 入口 + IPC handlers
│   │   ├── preload.ts           # contextBridge 暴露 API
│   │   └── services/            # 核心服务
│   │       ├── bookService.ts   # 书籍解析（编码检测 / 章节提取）
│   │       ├── bossKeyManager.ts# 老板键注册与管理
│   │       ├── purifyService.ts  # AI 净化（QCLAW API）
│   │       └── settingsService.ts# 设置持久化
│   ├── renderer/                 # React 渲染进程
│   │   ├── App.tsx              # 根组件 + 页面路由
│   │   ├── components/
│   │   │   ├── TitleBar.tsx     # 自定义标题栏
│   │   │   └── MiniReader/      # 迷你阅读器窗口
│   │   ├── pages/
│   │   │   ├── Bookshelf.tsx    # 书架页面
│   │   │   ├── Reader.tsx       # 阅读器页面（核心）
│   │   │   └── Settings.tsx     # 设置页面
│   │   └── stores/              # Zustand 状态管理
│   └── shared/                  # 主/渲染进程共享类型
├── package.json
├── vite.config.ts
└── electron-builder.json
```

## 开发

```bash
# 安装依赖
npm install

# 开发模式（Vite + Electron 并行热重载）
npm run dev

# 生产构建
npm run build

# 打包桌面应用（输出到 release-v2/）
npm run build
```

## 构建 / 发布

1. 运行 `npm run build`（Vite 编译 + electron-builder 打包）
2. 打包产物位于 `release-v2/win-unpacked/`
3. 压缩整个 `win-unpacked` 文件夹即为绿色版安装包
4. 推荐使用 [release-it](https://github.com/release-it/release-it) 管理 GitHub Releases

## 下载

前往 [Releases](https://github.com/lordcvader2/YueDuReader/releases) 下载最新版本。

## License

MIT
