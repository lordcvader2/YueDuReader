// 预加载脚本 - 安全桥接主进程和渲染进程
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/constants';

// 暴露给渲染进程的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 书籍管理
  importBook: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.BOOK_IMPORT, filePath),
  getBooks: () => ipcRenderer.invoke(IPC_CHANNELS.BOOK_LIST),
  getBook: (bookId: string, loadContent?: boolean) => ipcRenderer.invoke('book:get', bookId, loadContent),
  deleteBook: (bookId: string) => ipcRenderer.invoke(IPC_CHANNELS.BOOK_DELETE, bookId),
  updateBook: (book: any) => ipcRenderer.invoke(IPC_CHANNELS.BOOK_UPDATE, book),

  // 设置
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  setSettings: (settings: any) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings),

  // 老板键
  registerBossKey: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.BOSS_KEY_REGISTER, key),
  toggleBossKey: () => ipcRenderer.invoke(IPC_CHANNELS.BOSS_KEY_TOGGLE),

  // 净化
  purifyChapter: (text: string) => ipcRenderer.invoke(IPC_CHANNELS.PURIFY_CHAPTER, text),
  purifyBook: (bookId: string) => ipcRenderer.invoke(IPC_CHANNELS.PURIFY_BOOK, bookId),

  // 文件
  openFileDialog: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_DIALOG),

  // 窗口控制
  minimizeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
  closeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
  setAlwaysOnTop: (flag: boolean) => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_SET_ALWAYS_ON_TOP, flag),
  setOpacity: (opacity: number) => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_SET_OPACITY, opacity),

  // 事件监听
  onWindowResize: (callback: (size: { width: number; height: number }) => void) => {
    ipcRenderer.on('window:resize', (_, size) => callback(size));
  },
  onNavigate: (callback: (route: string) => void) => {
    ipcRenderer.on('navigate:settings', () => callback('/settings'));
  },
});

// TypeScript 类型定义
export interface ElectronAPI {
  importBook: (filePath: string) => Promise<any>;
  getBooks: () => Promise<any[]>;
  getBook: (bookId: string, loadContent?: boolean) => Promise<any>;
  deleteBook: (bookId: string) => Promise<void>;
  updateBook: (book: any) => Promise<void>;
  getSettings: () => Promise<any>;
  setSettings: (settings: any) => Promise<void>;
  registerBossKey: (key: string) => Promise<void>;
  toggleBossKey: () => Promise<void>;
  purifyChapter: (text: string) => Promise<any>;
  purifyBook: (bookId: string) => Promise<any>;
  openFileDialog: () => Promise<string | null>;
  minimizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  setAlwaysOnTop: (flag: boolean) => Promise<void>;
  setOpacity: (opacity: number) => Promise<void>;
  onWindowResize: (callback: (size: { width: number; height: number }) => void) => void;
  onNavigate: (callback: (route: string) => void) => void;
}

// 注意：electronAPI 类型在 vite-env.d.ts 中定义
