/// <reference types="vite/client" />

// Electron API 类型声明
interface ElectronAPI {
  importBook: (filePath: string) => Promise<unknown>;
  getBooks: () => Promise<unknown[]>;
  getBook: (bookId: string, loadContent?: boolean, chapterIndex?: number) => Promise<unknown>;
  getChapter: (bookId: string, chapterIndex: number) => Promise<string | null>;
  deleteBook: (bookId: string) => Promise<void>;
  updateBook: (book: unknown) => Promise<void>;
  getSettings: () => Promise<unknown>;
  setSettings: (settings: unknown) => Promise<void>;
  registerBossKey: (key: string) => Promise<void>;
  toggleBossKey: () => Promise<void>;
  purifyChapter: (text: string) => Promise<unknown>;
  purifyBook: (bookId: string) => Promise<unknown>;
  openFileDialog: () => Promise<string | null>;
  minimizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  setAlwaysOnTop: (flag: boolean) => Promise<void>;
  setOpacity: (opacity: number) => Promise<void>;
  onWindowResize: (callback: (size: { width: number; height: number }) => void) => () => void;
  onNavigate: (callback: (route: string) => void) => () => void;
  restoreOriginal: (bookId: string) => Promise<{ success: boolean; message: string }>;
  deleteBookWithOption: (bookId: string, keepFile: boolean) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
