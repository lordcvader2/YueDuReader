// 共享常量定义

export const APP_NAME = '悦读';
export const APP_VERSION = '1.0.0';

// 老板键默认设置
export const DEFAULT_BOSS_KEY = 'Alt+Q';

// 迷你窗口阈值
export const MINI_MODE_THRESHOLD = {
  width: 400,
  height: 300,
};

// QCLAW 默认端点
export const DEFAULT_QCLAW_ENDPOINT = '';

// 阅读器默认设置
export const DEFAULT_READER_SETTINGS = {
  fontSize: 18,
  lineHeight: 1.8,
  fontFamily: 'Noto Serif SC, SimSun, serif',
  theme: 'light' as const,
  pageAnimation: 'slide' as const,
};

// 支持的编码
export const SUPPORTED_ENCODINGS = ['utf-8', 'gbk', 'gb18030'] as const;

// 主题颜色
export const THEME_COLORS = {
  light: {
    background: '#ffffff',
    backgroundAlt: '#f5f5f5',
    text: '#1a1a1a',
    textSecondary: '#666666',
    border: '#e8e8e8',
  },
  dark: {
    background: '#1e1e1e',
    backgroundAlt: '#2d2d2d',
    text: '#e0e0e0',
    textSecondary: '#a0a0a0',
    border: '#3a3a3a',
  },
  sepia: {
    background: '#f5f0e1',
    backgroundAlt: '#ebe5d5',
    text: '#5c5c5c',
    textSecondary: '#7a7a7a',
    border: '#d9d3c3',
  },
};

// IPC 通道名称
export const IPC_CHANNELS = {
  // 书籍管理
  BOOK_IMPORT: 'book:import',
  BOOK_LIST: 'book:list',
  BOOK_DELETE: 'book:delete',
  BOOK_UPDATE: 'book:update',
  
  // 设置
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  
  // 老板键
  BOSS_KEY_REGISTER: 'bossKey:register',
  BOSS_KEY_TOGGLE: 'bossKey:toggle',
  
  // 净化
  PURIFY_CHAPTER: 'purify:chapter',
  PURIFY_BOOK: 'purify:book',
  
  // 文件
  FILE_READ: 'file:read',
  FILE_DIALOG: 'file:dialog',
  
  // 窗口
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_SET_ALWAYS_ON_TOP: 'window:setAlwaysOnTop',
  WINDOW_SET_OPACITY: 'window:setOpacity',

  // 书籍操作
  BOOK_RESTORE: 'book:restore',
  BOOK_DELETE_WITH_OPTION: 'book:deleteWithOption',
} as const;
