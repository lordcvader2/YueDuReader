// 预加载脚本 - 安全桥接主进程和渲染进程
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/constants';

// 暴露给渲染进程的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 书籍管理
  importBook: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.BOOK_IMPORT, filePath),
  getBooks: () => ipcRenderer.invoke(IPC_CHANNELS.BOOK_LIST),
  getBook: (bookId: string, loadContent?: boolean, chapterIndex?: number) =>
    ipcRenderer.invoke('book:get', bookId, loadContent, chapterIndex),
  getChapter: (bookId: string, chapterIndex: number) =>
    ipcRenderer.invoke('book:getChapter', bookId, chapterIndex),
  deleteBook: (bookId: string) => ipcRenderer.invoke(IPC_CHANNELS.BOOK_DELETE, bookId),
  updateBook: (book: unknown) => ipcRenderer.invoke(IPC_CHANNELS.BOOK_UPDATE, book),
  deleteBookWithOption: (bookId: string, keepFile: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.BOOK_DELETE_WITH_OPTION, bookId, keepFile),

  // 设置
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  setSettings: (settings: unknown) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings),

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

  // 恢复原文
  restoreOriginal: (bookId: string) => ipcRenderer.invoke(IPC_CHANNELS.BOOK_RESTORE, bookId),

  // 事件监听（返回清理函数，避免内存泄漏）
  onWindowResize: (callback: (size: { width: number; height: number }) => void) => {
    const handler = (_: unknown, size: { width: number; height: number }) => callback(size);
    ipcRenderer.on('window:resize', handler);
    // 返回清理函数
    return () => ipcRenderer.removeListener('window:resize', handler);
  },
  onNavigate: (callback: (route: string) => void) => {
    const handler = () => callback('/settings');
    ipcRenderer.on('navigate:settings', handler);
    // 返回清理函数
    return () => ipcRenderer.removeListener('navigate:settings', handler);
  },
});
