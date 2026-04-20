// Electron 主进程入口
import { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage, shell } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { IPC_CHANNELS, APP_NAME } from '../shared/constants';
import { BossKeyManager } from './services/bossKeyManager';
import { BookService } from './services/bookService';
import { SettingsService } from './services/settingsService';
import { PurifyService } from './services/purifyService';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 全局异常捕获 - 记录所有未处理错误到日志文件
process.on('uncaughtException', (error) => {
  console.error('[MAIN] Uncaught Exception:', error.message, error.stack);
  const fs = require('fs');
  const logPath = path.join(app.getPath('userData'), 'crash.log');
  const log = `[${new Date().toISOString()}] Uncaught Exception: ${error.message}\n${error.stack}\n\n`;
  try { fs.appendFileSync(logPath, log); } catch {}
});

process.on('unhandledRejection', (reason) => {
  console.error('[MAIN] Unhandled Rejection:', reason);
  const fs = require('fs');
  const logPath = path.join(app.getPath('userData'), 'crash.log');
  const log = `[${new Date().toISOString()}] Unhandled Rejection: ${reason}\n\n`;
  try { fs.appendFileSync(logPath, log); } catch {}
});

let mainWindow: BrowserWindow | null = null;
let miniWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let bossKeyManager: BossKeyManager;
let bookService: BookService;
let settingsService: SettingsService;
let purifyService: PurifyService;
let isQuitting = false;

// 开发模式检测
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createMainWindow() {
  const settings = settingsService?.getSettings();
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 300,
    title: APP_NAME,
    icon: path.join(__dirname, '../../resources/icons/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    frame: false, // 无边框窗口，支持自定义标题栏
    backgroundColor: '#ffffff',
    show: false,
  });

  // 加载应用
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // DevTools can be opened manually with F12
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  // 窗口准备就绪后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // 监听窗口大小变化，检测迷你模式
  mainWindow.on('resize', () => {
    if (mainWindow) {
      const [width, height] = mainWindow.getSize();
      mainWindow.webContents.send('window:resize', { width, height });
    }
  });

  // 关闭窗口时最小化到托盘
  mainWindow.on('close', (event) => {
    if (!isQuitting && settings?.general?.closeToTray) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 创建托盘图标
  createTray();
}

function createTray() {
  const iconPath = path.join(__dirname, '../../resources/icons/tray.png');
  const icon = nativeImage.createFromPath(iconPath);
  
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => mainWindow?.show() },
    { label: '迷你阅读', click: () => createMiniWindow() },
    { type: 'separator' },
    { label: '设置', click: () => mainWindow?.webContents.send('navigate:settings') },
    { type: 'separator' },
    { label: '退出', click: () => {
      isQuitting = true;
      app.quit();
    }},
  ]);
  
  tray.setToolTip(APP_NAME);
  tray.setContextMenu(contextMenu);
  
  tray.on('double-click', () => {
    mainWindow?.show();
  });
}

function createMiniWindow() {
  if (miniWindow) {
    miniWindow.show();
    return;
  }

  const settings = settingsService?.getSettings();
  
  miniWindow = new BrowserWindow({
    width: 320,
    height: 480,
    minWidth: 200,
    minHeight: 300,
    title: '迷你阅读 - ' + APP_NAME,
    icon: path.join(__dirname, '../../resources/icons/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    frame: false,
    alwaysOnTop: settings?.miniMode?.alwaysOnTop ?? true,
    opacity: (settings?.miniMode?.opacity ?? 90) / 100,
    backgroundColor: '#ffffff',
    resizable: true,
  });

  if (isDev) {
    miniWindow.loadURL('http://localhost:5173?mini=true');
  } else {
    miniWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'), {
      query: { mini: 'true' }
    });
  }

  miniWindow.on('closed', () => {
    miniWindow = null;
  });
}

// 注册 IPC 处理器
function registerIpcHandlers() {
  // 书籍管理
  ipcMain.handle(IPC_CHANNELS.BOOK_IMPORT, async (_, filePath: string) => {
    return bookService.importBook(filePath);
  });

  ipcMain.handle(IPC_CHANNELS.BOOK_LIST, async () => {
    return bookService.getBooks();
  });

  ipcMain.handle(IPC_CHANNELS.BOOK_DELETE, async (_, bookId: string) => {
    return bookService.deleteBook(bookId);
  });

  ipcMain.handle(IPC_CHANNELS.BOOK_UPDATE, async (_, book: any) => {
    return bookService.updateBook(book);
  });

  // 获取书籍（含章节内容，按需从文件读取）
  ipcMain.handle('book:get', async (_, bookId: string, loadContent: boolean) => {
    return bookService.getBook(bookId, loadContent);
  });

  // 设置
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    return settingsService.getSettings();
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_, settings: any) => {
    settingsService.setSettings(settings);
    // 更新老板键
    if (settings.bossKey) {
      bossKeyManager.register(settings.bossKey.key);
    }
    return true;
  });

  // 老板键
  ipcMain.handle(IPC_CHANNELS.BOSS_KEY_REGISTER, async (_, key: string) => {
    return bossKeyManager.register(key);
  });

  ipcMain.handle(IPC_CHANNELS.BOSS_KEY_TOGGLE, async () => {
    return bossKeyManager.toggle();
  });

  // 净化
  ipcMain.handle(IPC_CHANNELS.PURIFY_CHAPTER, async (_, text: string) => {
    return purifyService.purifyChapter(text);
  });

  ipcMain.handle(IPC_CHANNELS.PURIFY_BOOK, async (_, bookId: string) => {
    return purifyService.purifyBook(bookId);
  });

  // 文件对话框
  ipcMain.handle(IPC_CHANNELS.FILE_DIALOG, async () => {
    const { dialog } = await import('electron');
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [
        { name: '文本文件', extensions: ['txt'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    return result.filePaths[0] || null;
  });

  // 窗口控制
  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, async () => {
    mainWindow?.minimize();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, async () => {
    mainWindow?.close();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_SET_ALWAYS_ON_TOP, async (_, flag: boolean) => {
    miniWindow?.setAlwaysOnTop(flag);
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_SET_OPACITY, async (_, opacity: number) => {
    miniWindow?.setOpacity(opacity);
  });
}

// 应用初始化
async function initialize() {
  // 初始化服务
  settingsService = new SettingsService();
  bookService = new BookService();
  purifyService = new PurifyService(settingsService);
  bossKeyManager = new BossKeyManager(settingsService);

  // 注册 IPC 处理器
  registerIpcHandlers();

  // 注意：老板键注册在 createMainWindow 之后进行，确保 app 已完全 ready
  console.log('初始化完成，等待窗口创建后注册老板键');
}

// 应用启动
app.whenReady().then(async () => {
  await initialize();
  createMainWindow();

  // 窗口创建完成后注册老板键（确保 app 完全 ready）
  bossKeyManager.register();
  console.log('老板键注册完成');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// 所有窗口关闭时退出应用（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用退出前清理
app.on('before-quit', () => {
  isQuitting = true;
  // 只有在 app ready 后才能操作 globalShortcut
  if (app.isReady()) {
    globalShortcut.unregisterAll();
  }
});

// 单实例锁定
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}
