// 共享类型定义

export interface Book {
  id: string;
  title: string;
  author?: string;
  filePath: string;
  fileSize: number;
  wordCount: number;
  encoding: 'utf-8' | 'gbk' | 'gb18030';
  chapters: Chapter[];
  coverImage?: string;
  categoryId?: string;
  createdAt: Date;
  updatedAt: Date;
  readProgress: number;
  lastReadAt?: Date;
  lastReadChapterIndex: number; // 最后阅读的章节索引（持久化）
  lastReadScrollPercent: number; // 最后阅读位置在本章的滚动百分比（0-100）
  purified: boolean;
  purificationReport?: PurificationReport;
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  wordCount: number;
  startIndex: number;
  endIndex: number;
}

export interface PurificationReport {
  typosFixed: number;
  adsRemoved: number;
  garbageRemoved: number;
  processedAt: Date;
}

export interface AppSettings {
  bossKey: BossKeySettings;
  miniMode: MiniModeSettings;
  purification: PurificationSettings;
  reader: ReaderSettings;
  general: GeneralSettings;
}

export interface BossKeySettings {
  enabled: boolean;
  key: string;
  mode: 'minimize' | 'disguise' | 'switch';
  disguiseImage?: string;
  playSound: boolean;
}

export interface MiniModeSettings {
  autoSwitch: boolean;
  thresholdWidth: number;
  thresholdHeight: number;
  alwaysOnTop: boolean;
  opacity: number;
}

export interface PurificationSettings {
  autoPurify: boolean;
  fixTypos: boolean;
  removeAds: boolean;
  removeGarbage: boolean;
  keepBackup: boolean;
  qclawEndpoint: string;
}

export interface ReaderSettings {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  theme: ReaderTheme;
  pageAnimation: 'none' | 'slide' | 'fade' | 'flip';
  // 阅读进度持久化
  lastReadBookId?: string;
  lastReadChapterIndex?: number;
}

export interface GeneralSettings {
  language: 'zh-CN' | 'en-US';
  startupMinimized: boolean;
  closeToTray: boolean;
}

export type ReaderTheme = 'light' | 'dark' | 'sepia' | 'custom';

export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
  createdAt: Date;
}
