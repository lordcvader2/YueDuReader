# 悦读小说阅读器

![Electron](https://img.shields.io/badge/Electron-478061?style=flat&logo=electron)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css)
![License](https://img.shields.io/badge/License-MIT-green)

一个简洁现代的小说阅读器桌面应用，支持自定义老板键、迷你窗口模式、AI 文本净化功能。

## 功能特性

### 📚 书架管理
- 导入本地 TXT 文件
- 网格/列表视图切换
- 书籍搜索过滤
- 已读书籍进度显示

### 📖 阅读体验
- 沉浸式阅读模式
- 字体大小调节（Ctrl+/Ctrl-）
- 多种阅读主题（明亮/深色/护眼）
- 行间距调节
- 章节快速跳转

### ⌨️ 老板键
- 一键隐藏应用（Alt+Q）
- 自定义快捷键

### 🪟 迷你窗口
- 桌面置顶
- 透明背景
- 迷你模式阅读

### 🤖 AI 净化（QCLAW 集成）
- 自动去除广告/乱码
- 智能分段
- 繁体转简体

## 技术栈

- **框架**: Electron + React + TypeScript
- **UI**: Tailwind CSS + Zustand
- **构建**: Vite + electron-builder

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build

# 打包桌面应用
npm run pack
```

## 下载

前往 [Releases](https://github.com/yourusername/YueDuReader/releases) 下载最新版本。

## 项目结构

```
YueDuReader/
├── src/
│   ├── main/           # Electron 主进程
│   ├── preload/        # 预加载脚本
│   └── renderer/       # React 渲染进程
│       ├── components/ # UI 组件
│       ├── pages/      # 页面组件
│       ├── stores/    # Zustand 状态管理
│       └── utils/      # 工具函数
├── dist/               # Vite 构建产物
├── dist-electron/      # Electron 构建产物
├── release-v2/         # 打包输出
└── package.json
```

## License

MIT
