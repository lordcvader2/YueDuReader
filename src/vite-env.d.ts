/// <reference types="vite/client" />

// Electron API 类型声明
interface ElectronAPI {
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

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
