// 老板键管理服务
import { BrowserWindow, globalShortcut, app } from 'electron';
import { DEFAULT_BOSS_KEY } from '../../shared/constants';
import type { SettingsService } from './settingsService';

export class BossKeyManager {
  private currentKey: string = DEFAULT_BOSS_KEY;
  private settingsService: SettingsService;
  private disguiseWindow: BrowserWindow | null = null;
  private isHidden: boolean = false; // 明确记录隐藏状态，不再依赖 isVisible()

  constructor(settingsService: SettingsService) {
    this.settingsService = settingsService;
    this.loadSettings();
  }

  private loadSettings() {
    const settings = this.settingsService.getSettings();
    if (settings?.bossKey?.key) {
      this.currentKey = settings.bossKey.key;
    }
  }

  register(key?: string): boolean {
    // 注销旧快捷键
    try {
      globalShortcut.unregister(this.currentKey);
    } catch (e) {
      // 忽略未注册的错误
    }

    // 使用新快捷键
    const newKey = key || this.currentKey;
    const registeredKey = this.currentKey;
    
    try {
      const success = globalShortcut.register(newKey, () => {
        console.log(`[BossKey] 触发: ${newKey}, 当前隐藏状态: ${this.isHidden}`);
        this.toggle();
      });

      if (success) {
        this.currentKey = newKey;
        console.log(`[BossKey] 注册成功: ${newKey}`);
        return true;
      } else {
        console.error(`[BossKey] 注册失败（已被占用或无效）: ${newKey}`);
        return false;
      }
    } catch (error) {
      console.error(`[BossKey] 注册异常: ${error}`);
      return false;
    }
  }

  /**
   * 获取主窗口（排除伪装窗口）
   */
  private getMainWindow(): BrowserWindow | null {
    const wins = BrowserWindow.getAllWindows();
    // 排除伪装窗口（标题含"Excel"）
    const main = wins.find(w => !w.getTitle().includes('Microsoft Excel') && !w.getTitle().includes('迷你'));
    if (main) {
      console.log(`[BossKey] 找到主窗口: "${main.getTitle()}", visible=${main.isVisible()}, minimized=${main.isMinimized()}`);
      return main;
    }
    console.warn(`[BossKey] 未找到主窗口，当前所有窗口: ${wins.map(w => `"${w.getTitle()}"`).join(', ')}`);
    return main || wins[0] || null;
  }

  toggle(): void {
    const mainWindow = this.getMainWindow();
    if (!mainWindow) {
      console.warn('[BossKey] toggle: 无主窗口，忽略');
      return;
    }

    if (this.isHidden) {
      this.show(mainWindow);
    } else {
      this.hide(mainWindow);
    }
  }

  private hide(mainWindow: BrowserWindow): void {
    const settings = this.settingsService.getSettings();
    const mode = settings?.bossKey?.mode || 'minimize';

    console.log(`[BossKey] hide() 模式=${mode}, 当前visible=${mainWindow.isVisible()}`);

    switch (mode) {
      case 'minimize':
        mainWindow.hide();
        break;
      case 'disguise':
        this.showDisguiseWindow();
        mainWindow.hide();
        break;
      case 'switch':
        mainWindow.minimize();
        break;
    }

    this.isHidden = true;
    console.log(`[BossKey] 已隐藏，isHidden=true`);

    if (settings?.bossKey?.playSound) {
      mainWindow.webContents.executeJavaScript(
        'new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp+ZjXx1cGVqbnl8hIuRl5aHd3JwcXZ6gImQlpWJenZycHR3foOKkJeUiXp2cnF0d36DipCXlIl6dnJxdHd+g4qQl5SJenZycXR3foOKkJeUiXp2cnF0d36DipCXlIl6dnJxdHd+g4qQl5SJenZycXR3foOKkJeUiQ==").play().catch(()=>{})'
      );
    }
  }

  private show(mainWindow: BrowserWindow): void {
    console.log(`[BossKey] show(), 当前visible=${mainWindow.isVisible()}, minimized=${mainWindow.isMinimized()}`);
    
    // 如果是最小化状态，先恢复
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
    this.isHidden = false;
    console.log(`[BossKey] 已显示，isHidden=false`);

    if (this.disguiseWindow) {
      this.disguiseWindow.close();
      this.disguiseWindow = null;
    }
  }

  private showDisguiseWindow(): void {
    if (this.disguiseWindow) {
      this.disguiseWindow.show();
      return;
    }

    this.disguiseWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      title: 'Microsoft Excel - 工作表1',
      show: false,
      autoHideMenuBar: true,
      frame: true,
    });

    this.disguiseWindow.loadURL('data:text/html,' + encodeURIComponent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Microsoft Excel - 工作表1</title>
        <style>
          body { margin: 0; font-family: 'Segoe UI', sans-serif; background: #fff; }
          .toolbar { background: #217346; color: white; padding: 8px 16px; font-size: 14px; }
          .toolbar span { margin-left: 20px; cursor: pointer; }
          .content { display: grid; grid-template-columns: 50px repeat(10, 1fr); }
          .cell { border: 1px solid #d4d4d4; height: 24px; font-size: 12px; display: flex; align-items: center; padding: 0 4px; }
          .header { background: #f0f0f0; font-weight: bold; justify-content: center; }
        </style>
      </head>
      <body>
        <div class="toolbar"><strong>Excel</strong>
          <span>文件</span><span>开始</span><span>插入</span><span>页面布局</span>
          <span>公式</span><span>数据</span><span>审阅</span><span>视图</span>
        </div>
        <div class="content">
          ${Array.from({length: 22}, (_, i) => 
            i === 0 
              ? '<div class="cell header"></div>' + Array.from({length: 10}, (_, j) => `<div class="cell header">${String.fromCharCode(65+j)}</div>`).join('')
              : `<div class="cell header">${i}</div>` + Array.from({length: 10}, () => '<div class="cell"></div>').join('')
          ).join('')}
        </div>
      </body>
      </html>
    `));

    this.disguiseWindow.once('ready-to-show', () => {
      this.disguiseWindow?.show();
    });

    this.disguiseWindow.on('closed', () => {
      this.disguiseWindow = null;
    });
  }

  unregister(): void {
    globalShortcut.unregister(this.currentKey);
    console.log(`[BossKey] 已注销: ${this.currentKey}`);
  }
}
