import React, { useEffect, useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import type { AppSettings, ReaderTheme } from '../../shared/types';

interface SettingsProps {
  onClose: () => void;
}

// ---- SVG 图标 ----
const IconKey = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>;
const IconMini = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>;
const IconAI = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
const IconBook2 = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>;
const IconInfo = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const IconSave = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
const IconReset = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>;
const IconCheck = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IconX = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

// 开关组件
const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${checked ? 'bg-blue-500' : 'bg-gray-300'}`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
  </button>
);

// 设置卡片
const SectionCard: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
    <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
      <span className="text-blue-500">{icon}</span>
      <span className="font-medium text-sm">{title}</span>
    </div>
    <div className="p-4 space-y-4">{children}</div>
  </div>
);

// 表单项
const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div className="flex items-start justify-between gap-4">
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium text-gray-700">{label}</div>
      {hint && <div className="text-xs text-gray-400 mt-0.5">{hint}</div>}
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);

const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const { settings, loadSettings, updateSettings } = useSettingsStore();
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [serviceStatus, setServiceStatus] = useState<{ available: boolean; message: string } | null>(null);
  const [local, setLocal] = useState<AppSettings | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (settings) setLocal(JSON.parse(JSON.stringify(settings)));
  }, [settings]);

  const checkService = async () => {
    setServiceStatus({ available: false, message: '检测中...' });
    try {
      const r = await fetch(`${local?.purification?.qclawEndpoint || 'http://localhost:8080'}/health`, { signal: AbortSignal.timeout(3000) });
      setServiceStatus({ available: r.ok, message: r.ok ? 'QCLAW 服务在线' : `服务响应: ${r.status}` });
    } catch {
      setServiceStatus({ available: false, message: '无法连接到 QCLAW 服务' });
    }
  };

  const handleSave = async () => {
    if (!local) return;
    setSaving(true);
    await updateSettings(local);
    setSaving(false);
    setSaveMsg('设置已保存');
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const handleReset = () => {
    setLocal({
      bossKey: { enabled: true, key: 'Alt+Q', mode: 'minimize', playSound: false },
      miniMode: { autoSwitch: true, thresholdWidth: 400, thresholdHeight: 300, alwaysOnTop: true, opacity: 100 },
      purification: { autoPurify: false, fixTypos: true, removeAds: true, removeGarbage: true, keepBackup: true, qclawEndpoint: 'http://localhost:8080' },
      reader: { fontSize: 18, lineHeight: 1.8, fontFamily: 'Noto Serif SC, SimSun, serif', theme: 'light', pageAnimation: 'fade' },
      general: { language: 'zh-CN', startupMinimized: false, closeToTray: true },
    });
    setSaveMsg('已重置为默认值');
    setTimeout(() => setSaveMsg(''), 3000);
  };

  if (!local) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const upd = (path: string, val: unknown) => {
    const next = JSON.parse(JSON.stringify(local)) as AppSettings;
    const parts = path.split('.');
    let obj: Record<string, unknown> = next as unknown as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]] as Record<string, unknown>;
    obj[parts[parts.length - 1]] = val;
    setLocal(next);
  };

  return (
    <div className="h-full overflow-y-auto p-6 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        {/* 页面标题 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">设置</h1>
          <div className="flex items-center gap-2">
            {saveMsg && (
              <span className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">{saveMsg}</span>
            )}
            <button onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors">
              <IconReset /> 重置
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm text-white bg-blue-500 rounded hover:bg-blue-600 disabled:opacity-50 transition-colors">
              <IconSave /> {saving ? '保存中...' : '保存设置'}
            </button>
          </div>
        </div>

        {/* 老板键 */}
        <SectionCard icon={<IconKey />} title="老板键设置">
          <Field label="启用老板键" hint="让用合快捷键即刻隐藏应用">
            <Toggle checked={local.bossKey.enabled} onChange={(v) => upd('bossKey.enabled', v)} />
          </Field>
          <Field label="快捷键">
            <input
              type="text"
              value={local.bossKey.key}
              onChange={(e) => upd('bossKey.key', e.target.value)}
              className="w-32 px-3 py-1 border border-gray-200 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Field>
          <Field label="隐藏模式">
            <select value={local.bossKey.mode}
              onChange={(e) => upd('bossKey.mode', e.target.value as 'minimize' | 'disguise' | 'switch')}
              className="px-3 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="minimize">最小化到托盘</option>
              <option value="disguise">显示伪装窗口</option>
              <option value="switch">最小化并切换应用</option>
            </select>
          </Field>
          <Field label="提示音">
            <Toggle checked={local.bossKey.playSound} onChange={(v) => upd('bossKey.playSound', v)} />
          </Field>
          <div className="bg-blue-50 rounded p-3 text-xs text-blue-700">
            <strong>快捷键说明：</strong>·使用系统级快捷键，应用隐藏后仍然有效·再次按下同一快捷键可恢复窗口
          </div>
        </SectionCard>

        {/* 迷你窗口 */}
        <SectionCard icon={<IconMini />} title="迷你窗口设置">
          <Field label="窗口过小自动切换">
            <Toggle checked={local.miniMode.autoSwitch} onChange={(v) => upd('miniMode.autoSwitch', v)} />
          </Field>
          <Field label="窗口宽度阈值">
            <div className="flex items-center gap-1">
              <input type="number" value={local.miniMode.thresholdWidth} min={200} max={800}
                onChange={(e) => upd('miniMode.thresholdWidth', Number(e.target.value))}
                className="w-20 px-2 py-1 border border-gray-200 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-sm text-gray-400">px</span>
            </div>
          </Field>
          <Field label="始终置顶">
            <Toggle checked={local.miniMode.alwaysOnTop} onChange={(v) => upd('miniMode.alwaysOnTop', v)} />
          </Field>
          <Field label="窗口透明度">
            <div className="flex items-center gap-2">
              <input type="range" min={30} max={100} value={local.miniMode.opacity}
                onChange={(e) => upd('miniMode.opacity', Number(e.target.value))}
                className="w-24 h-1 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: '#1890ff', background: `linear-gradient(to right, #1890ff ${(local.miniMode.opacity - 30) / 0.7}%, #e8e8e8 ${(local.miniMode.opacity - 30) / 0.7}%)` }} />
              <span className="text-xs text-gray-500 w-8">{local.miniMode.opacity}%</span>
            </div>
          </Field>
        </SectionCard>

        {/* AI 净化 */}
        <SectionCard icon={<IconAI />} title="AI 净化设置">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '导入时自动净化', key: 'autoPurify' },
              { label: '修正错别字', key: 'fixTypos' },
              { label: '移除广告内容', key: 'removeAds' },
              { label: '清理乱码字符', key: 'removeGarbage' },
              { label: '净化前备份原文', key: 'keepBackup' },
            ].map((item) => (
              <Field key={item.key} label={item.label}>
                <Toggle checked={(local.purification as unknown as Record<string, boolean>)[item.key]}
                  onChange={(v) => upd(`purification.${item.key}`, v)} />
              </Field>
            ))}
          </div>
          <Field label="QCLAW API 地址" hint="配置 AI 净化服务地址">
            <input type="text" value={local.purification.qclawEndpoint}
              onChange={(e) => upd('purification.qclawEndpoint', e.target.value)}
              className="w-48 px-3 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </Field>
          <div className="flex items-center gap-2">
            <button onClick={checkService}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50 transition-colors">
              <IconReset /> 检测服务
            </button>
            {serviceStatus && (
              <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${serviceStatus.available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                {serviceStatus.available ? <IconCheck /> : <IconX />}
                {serviceStatus.message}
              </span>
            )}
          </div>
          <div className="bg-yellow-50 rounded p-3 text-xs text-yellow-700">
            如果 QCLAW 服务不可用，将使用本地规则进行基础净化（移除乱码、常见广告模式）
          </div>
        </SectionCard>

        {/* 阅读器 */}
        <SectionCard icon={<IconBook2 />} title="阅读器设置">
          <Field label="字体大小">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">12</span>
              <input type="range" min={12} max={32} value={local.reader.fontSize}
                onChange={(e) => upd('reader.fontSize', Number(e.target.value))}
                className="w-32 h-1 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: '#1890ff', background: `linear-gradient(to right, #1890ff ${(local.reader.fontSize - 12) / 20 * 100}%, #e8e8e8 ${(local.reader.fontSize - 12) / 20 * 100}%)` }} />
              <span className="text-xs text-gray-400">32</span>
              <span className="text-xs text-blue-500 w-10 text-right">{local.reader.fontSize}px</span>
            </div>
          </Field>
          <Field label="行间距">
            <div className="flex items-center gap-2">
              <input type="range" min={1.2} max={2.5} step={0.1} value={local.reader.lineHeight}
                onChange={(e) => upd('reader.lineHeight', Number(e.target.value))}
                className="w-32 h-1 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: '#1890ff', background: `linear-gradient(to right, #1890ff ${(local.reader.lineHeight - 1.2) / 1.3 * 100}%, #e8e8e8 ${(local.reader.lineHeight - 1.2) / 1.3 * 100}%)` }} />
              <span className="text-xs text-blue-500 w-10 text-right">{local.reader.lineHeight}x</span>
            </div>
          </Field>
          <Field label="阅读字体">
            <select value={local.reader.fontFamily}
              onChange={(e) => upd('reader.fontFamily', e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="Noto Serif SC, Source Han Serif SC, SimSun, serif">思源宋体（推荐）</option>
              <option value="Noto Sans SC, Source Han Sans SC, Microsoft YaHei, sans-serif">思源黑体</option>
              <option value="SimSun, serif">宋体（经典）</option>
              <option value="KaiTi, STFangsong, serif">楷体/仿宋</option>
            </select>
          </Field>
          <Field label="黑暗模式">
            <Toggle checked={local.reader.theme === 'dark'}
              onChange={(v) => upd('reader.theme', v ? 'dark' : 'light')} />
          </Field>
          <Field label="翻页动画">
            <select value={local.reader.pageAnimation}
              onChange={(e) => upd('reader.pageAnimation', e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="none">无</option>
              <option value="slide">滑动</option>
              <option value="fade">淡入淡出</option>
            </select>
          </Field>
        </SectionCard>

        {/* 通用 */}
        <SectionCard icon={<IconInfo />} title="通用设置">
          <Field label="界面语言">
            <select value={local.general.language}
              onChange={(e) => upd('general.language', e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="zh-CN">简体中文</option>
              <option value="en-US">English</option>
            </select>
          </Field>
          <Field label="启动时最小化">
            <Toggle checked={local.general.startupMinimized} onChange={(v) => upd('general.startupMinimized', v)} />
          </Field>
          <Field label="关闭到托盘" hint="点击关闭按钮时最小化到系统托盘，而不完全退出">
            <Toggle checked={local.general.closeToTray} onChange={(v) => upd('general.closeToTray', v)} />
          </Field>
        </SectionCard>

        {/* 关于 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center text-3xl">
              &#128218;
            </div>
            <div>
              <h3 className="font-bold text-lg">悦读 - 小说阅读器</h3>
              <p className="text-gray-500 text-sm">版本 1.0.0</p>
              <p className="text-gray-400 text-xs mt-1">基于 Electron + React + QCLAW AI 净化</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
