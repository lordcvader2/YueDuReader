import { create } from 'zustand';
import type { AppSettings, ReaderTheme } from '../../shared/types';

interface SettingsState {
  settings: AppSettings | null;
  isLoading: boolean;
  
  // Actions
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  updateReaderTheme: (theme: ReaderTheme) => void;
  updateReaderFont: (fontSize: number, lineHeight?: number) => void;
  updateBossKey: (key: string, mode: AppSettings['bossKey']['mode']) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const settings = await window.electronAPI?.getSettings();
      set({ settings, isLoading: false });
      
      // 应用主题
      applyTheme(settings?.reader?.theme || 'light');
    } catch (error) {
      console.error('加载设置失败:', error);
      set({ isLoading: false });
    }
  },

  updateSettings: async (newSettings) => {
    const { settings } = get();
    const updated: AppSettings = { ...(settings || getDefaultSettings()), ...newSettings };
    
    try {
      await window.electronAPI?.setSettings(updated);
      set({ settings: updated });
      
      // 如果主题更新，应用主题
      if (newSettings.reader?.theme) {
        applyTheme(newSettings.reader.theme);
      }
    } catch (error) {
      console.error('保存设置失败:', error);
    }
  },

  updateReaderTheme: (theme) => {
    const { settings } = get();
    if (settings) {
      const newSettings = {
        ...settings,
        reader: { ...settings.reader, theme },
      };
      get().updateSettings(newSettings);
    }
  },

  updateReaderFont: (fontSize, lineHeight) => {
    const { settings } = get();
    if (settings) {
      const newSettings = {
        ...settings,
        reader: { 
          ...settings.reader, 
          fontSize,
          ...(lineHeight ? { lineHeight } : {}),
        },
      };
      get().updateSettings(newSettings);
    }
  },

  updateBossKey: (key, mode) => {
    const { settings } = get();
    if (settings) {
      const newSettings = {
        ...settings,
        bossKey: { ...settings.bossKey, key, mode },
      };
      get().updateSettings(newSettings);
    }
  },
}));

// 获取默认设置
function getDefaultSettings(): AppSettings {
  return {
    bossKey: { enabled: true, key: 'Alt+Q', mode: 'minimize', playSound: false },
    miniMode: { autoSwitch: true, thresholdWidth: 400, thresholdHeight: 300, alwaysOnTop: true, opacity: 100 },
    purification: { autoPurify: false, fixTypos: true, removeAds: true, removeGarbage: true, keepBackup: true, qclawEndpoint: 'http://localhost:8080' },
    reader: { fontSize: 18, lineHeight: 1.8, fontFamily: 'Noto Serif SC, SimSun, serif', theme: 'light', pageAnimation: 'fade' },
    general: { language: 'zh-CN', startupMinimized: false, closeToTray: true },
  };
}

// 应用主题到 DOM
function applyTheme(theme: ReaderTheme) {
  const root = document.documentElement;
  root.classList.remove('theme-light', 'theme-dark', 'theme-sepia');
  root.classList.add(`theme-${theme}`);
  
  // 同时更新 Ant Design 的暗色模式
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}
