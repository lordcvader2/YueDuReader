// 设置管理服务
import Store from 'electron-store';
import type { AppSettings } from '../../shared/types';
import { DEFAULT_BOSS_KEY, DEFAULT_QCLAW_ENDPOINT, DEFAULT_READER_SETTINGS } from '../../shared/constants';

export class SettingsService {
  private store: Store;

  private defaultSettings: AppSettings = {
    bossKey: {
      enabled: true,
      key: DEFAULT_BOSS_KEY,
      mode: 'minimize',
      playSound: false,
    },
    miniMode: {
      autoSwitch: true,
      thresholdWidth: 400,
      thresholdHeight: 300,
      alwaysOnTop: true,
      opacity: 90,
    },
    purification: {
      autoPurify: false,
      fixTypos: true,
      removeAds: true,
      removeGarbage: true,
      keepBackup: true,
      qclawEndpoint: DEFAULT_QCLAW_ENDPOINT,
    },
    reader: {
      ...DEFAULT_READER_SETTINGS,
    },
    general: {
      language: 'zh-CN',
      startupMinimized: false,
      closeToTray: true,
    },
  };

  constructor() {
    this.store = new Store({
      name: 'settings',
      defaults: this.defaultSettings as any,
    });
  }

  getSettings(): AppSettings {
    const settings = this.store.store as unknown as AppSettings;
    return {
      ...this.defaultSettings,
      ...settings,
    };
  }

  setSettings(settings: Partial<AppSettings>): void {
    const currentSettings = this.getSettings();
    const newSettings = this.deepMerge(currentSettings, settings);
    this.store.store = newSettings as any;
  }

  private deepMerge<T>(target: T, source: Partial<T>): T {
    const result = { ...target };
    for (const key in source) {
      if (source[key] !== undefined) {
        if (
          typeof source[key] === 'object' &&
          source[key] !== null &&
          !Array.isArray(source[key])
        ) {
          result[key] = this.deepMerge(
            result[key],
            source[key] as any
          ) as any;
        } else {
          result[key] = source[key] as any;
        }
      }
    }
    return result;
  }

  resetSettings(): void {
    this.store.clear();
  }

  // 获取单个设置项
  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.getSettings()[key];
  }

  // 设置单个设置项
  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    const settings = this.getSettings();
    settings[key] = value;
    this.setSettings(settings);
  }
}
