import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useBookStore } from '../stores/bookStore';
import { useSettingsStore } from '../stores/settingsStore';
import type { ReaderTheme } from '../../shared/types';

const Reader: React.FC = () => {
  const {
    currentBook,
    currentChapter,
    currentChapterIndex,
    selectChapter,
    nextChapter,
    prevChapter,
    updateProgress,
    saveReadPosition,
    purifyBook,
    purifyProgress,
    restoreOriginal,
  } = useBookStore();
  const { settings, updateReaderTheme, updateReaderFont, updateSettings } = useSettingsStore();

  const contentRef = useRef<HTMLDivElement>(null);
  const [showControls, setShowControls] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'toc' | 'settings'>('toc');
  const [fontSize, setFontSize] = useState(settings?.reader?.fontSize || 18);
  const [lineHeight, setLineHeight] = useState(settings?.reader?.lineHeight || 1.8);
  const [fontFamily, setFontFamily] = useState(
    settings?.reader?.fontFamily || 'Noto Serif SC, SimSun, serif'
  );
  const [isPurifying, setIsPurifying] = useState(false);
  const [pageKey, setPageKey] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'warning' } | null>(null);
  const [showPurified, setShowPurified] = useState(false);

  const theme = settings?.reader?.theme || 'light';
  const chapters = currentBook?.chapters || [];

  const scrollSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScroll = useCallback(() => {
    if (!contentRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    const totalHeight = scrollHeight - clientHeight;
    if (totalHeight <= 0) return;
    const scrollPercent = Math.round((scrollTop / totalHeight) * 100) || 0;
    const totalChapters = chapters.length;
    const overallProgress = Math.round(
      ((currentChapterIndex + scrollPercent / 100) / totalChapters) * 100
    );
    updateProgress(overallProgress);
    if (scrollSaveTimer.current) clearTimeout(scrollSaveTimer.current);
    scrollSaveTimer.current = setTimeout(() => {
      saveReadPosition(currentChapterIndex, scrollPercent);
    }, 500);
  }, [chapters.length, currentChapterIndex, saveReadPosition, updateProgress]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (sidebarOpen && e.key === 'Escape') { setSidebarOpen(false); return; }
      switch (e.key) {
        case 'ArrowLeft': case 'a': case 'PageUp': goPrev(); break;
        case 'ArrowRight': case 'd': case 'PageDown': case ' ': goNext(); break;
        case 'Escape': setSidebarOpen(false); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen, currentChapterIndex, chapters.length]);

  const scrollToLastPosition = () => {
    if (!contentRef.current) return;
    const scrollPercent = currentBook?.lastReadScrollPercent || 0;
    if (scrollPercent > 0) {
      const totalHeight = contentRef.current.scrollHeight - contentRef.current.clientHeight;
      contentRef.current.scrollTo({ top: (totalHeight * scrollPercent) / 100, behavior: 'instant' });
    } else {
      contentRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  // When book opens, auto-purify first chapter and show toast
  useEffect(() => {
    if (currentBook && !currentBook.purified) {
      (async () => {
        try {
          const chapter = currentBook.chapters[0];
          if (chapter) {
            const result = await window.electronAPI?.purifyChapter(chapter.content) as { corrections?: unknown[]; removedAds?: unknown[]; removedGarbage?: unknown[] } | null;
            if (result) {
              const total = (result.corrections?.length || 0) + (result.removedAds?.length || 0) + (result.removedGarbage?.length || 0);
              if (total > 0) {
                setToast({
                  message: `\u672c\u5730\u51c0\u5316\u5b8c\u6210\uff1a\u4fee\u6b63 ${result.corrections?.length || 0} \u5904\uff0c\u79fb\u9664\u5e7f\u544a ${result.removedAds?.length || 0} \u5904\uff0c\u6e05\u7406\u4e71\u7801 ${result.removedGarbage?.length || 0} \u5904`,
                  type: 'success',
                });
              } else {
                setToast({ message: '\u672c\u5730\u51c0\u5316\u68c0\u67e5\u5b8c\u6210\uff0c\u672c\u7ae0\u5185\u5bb9\u5f88\u5e72\u51c0 \u2728', type: 'info' });
              }
            }
          }
        } catch {
          // silently skip
        }
      })();
    } else if (currentBook) {
      // Show a simple welcome toast
      const chapCount = currentBook.chapters?.length || 0;
      const wordStr = currentBook.wordCount > 10000
        ? (currentBook.wordCount / 10000).toFixed(1) + ' \u4e07\u5b57'
        : currentBook.wordCount + ' \u5b57';
      setToast({ message: `\u300a${currentBook.title}\u300b ${chapCount} \u7ae0 / ${wordStr}`, type: 'info' });
    }
  }, [currentBook?.id]);

  // Scroll to last position when chapter changes
  useEffect(() => {
    scrollToLastPosition();
    setPageKey(k => k + 1);
  }, [currentChapterIndex]);

  const goNext = () => {
    if (currentChapterIndex >= chapters.length - 1) return;
    setAnimating(true);
    setTimeout(() => { nextChapter(); setAnimating(false); }, 150);
  };

  const goPrev = () => {
    if (currentChapterIndex <= 0) return;
    setAnimating(true);
    setTimeout(() => { prevChapter(); setAnimating(false); }, 150);
  };

  const handlePurify = async () => {
    if (!currentBook) return;
    setIsPurifying(true);
    await purifyBook(currentBook.id);
    setIsPurifying(false);
  };

  const handleRestore = async () => {
    if (!currentBook) return;
    const result = await restoreOriginal(currentBook.id);
    if (result.success) {
      setToast({ message: '\u5df2\u6062\u590d\u539f\u6587', type: 'success' });
      // 刷新当前书籍
      await useBookStore.getState().loadBooks();
    } else {
      setToast({ message: result.message || '\u6062\u590d\u5931\u8d25', type: 'warning' });
    }
  };

  const themeConfig: Record<string, { bg: string; bgAlt: string; text: string; textSec: string; border: string }> = {
    light:  { bg: '#ffffff', bgAlt: '#f5f5f5', text: '#1a1a1a', textSec: '#666666', border: '#e8e8e8' },
    dark:   { bg: '#1e1e1e', bgAlt: '#2d2d2d', text: '#e0e0e0', textSec: '#a0a0a0', border: '#3a3a3a' },
    sepia:  { bg: '#f5f0e1', bgAlt: '#ebe5d5', text: '#5c5c5c', textSec: '#7a7a7a', border: '#d9d3c3' },
    custom: { bg: '#ffffff', bgAlt: '#f5f5f5', text: '#1a1a1a', textSec: '#666666', border: '#e8e8e8' },
  };

  const tc = themeConfig[theme] || themeConfig.light;
  const overallProgress = chapters.length > 0
    ? Math.round(((currentChapterIndex + 1) / chapters.length) * 100)
    : 0;

  if (!currentBook) {
    return (
      <div className="h-full flex items-center justify-center" style={{ backgroundColor: tc.bg, color: tc.text }}>
        <div className="text-center" style={{ color: tc.textSec }}>
          <p className="text-lg">请从书架选择一本书开始阅读</p>
        </div>
      </div>
    );
  }

  const ac = theme === 'dark' ? '#40a9ff' : '#1890ff';

  return (
    <div className="h-full flex flex-col relative" style={{ backgroundColor: tc.bg, color: tc.text }}>
      {/* Toast notification */}
      {toast && (
        <div
          onClick={() => setToast(null)}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-lg shadow-lg text-sm cursor-pointer transition-all hover:shadow-xl max-w-md text-center"
          style={{
            backgroundColor: toast.type === 'success' ? '#f0fdf4' : toast.type === 'warning' ? '#fffbeb' : '#eff6ff',
            color: toast.type === 'success' ? '#166534' : toast.type === 'warning' ? '#92400e' : '#1e40af',
            border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : toast.type === 'warning' ? '#fde68a' : '#bfdbfe'}`,
          }}
        >
          {toast.message}
          <span className="ml-2 opacity-50 text-xs">点击关闭</span>
        </div>
      )}

      {/* 底部滑动进度条 */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none flex items-end" style={{ paddingBottom: 6 }}>
        <div className="h-0.5 rounded-full transition-all duration-300"
          style={{ width: `${overallProgress}%`, backgroundColor: ac }} />
      </div>

      {/* 顶部工具栏 - 鼠标移入显示，移出隐藏 */}
      <div
        className="absolute top-0 left-0 right-0 z-20 px-4 py-3 flex items-center justify-between"
        style={{
          background: `linear-gradient(to bottom, ${tc.bg}ee, ${tc.bg}00)`,
          opacity: showControls ? 1 : 0,
          pointerEvents: showControls ? 'auto' : 'none', // 隐藏时禁用点击，避免误触
          transition: 'opacity 300ms',
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => { setSidebarOpen(true); setSidebarTab('toc'); }}
            className="p-1.5 rounded hover:bg-black/10 transition-colors flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <span className="text-sm font-medium truncate">{currentBook.title}</span>
          {currentChapter && (
            <span className="text-sm truncate hidden sm:inline" style={{ color: tc.textSec }}>
              — {currentChapter.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => { setSidebarOpen(true); setSidebarTab('settings'); }}
            className="p-1.5 rounded hover:bg-black/10 transition-colors" title="阅读设置">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          <button onClick={handlePurify} disabled={isPurifying}
            className="p-1.5 rounded hover:bg-black/10 transition-colors disabled:opacity-40" title="净化">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={isPurifying ? { animation: 'spin 1s linear infinite' } : {}}>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </button>
          {currentBook?.purified && (
            <button onClick={handleRestore}
              className="p-1.5 rounded hover:bg-black/10 transition-colors" title="恢复原文">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.12"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 阅读区域 */}
      <div className="flex-1 overflow-hidden relative"
        onMouseMove={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}>

        {/* 左侧翻页热区 */}
        <button onClick={goPrev} disabled={currentChapterIndex === 0}
          className="absolute left-0 top-12 bottom-0 w-[18%] z-10 flex items-center justify-start pl-3 opacity-0 hover:opacity-100 transition-opacity disabled:opacity-0 cursor-pointer"
          style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.07), transparent)' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={tc.text} strokeWidth="2" opacity="0.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        {/* 右侧翻页热区 */}
        <button onClick={goNext} disabled={currentChapterIndex >= chapters.length - 1}
          className="absolute right-0 top-12 bottom-0 w-[18%] z-10 flex items-center justify-end pr-3 opacity-0 hover:opacity-100 transition-opacity disabled:opacity-0 cursor-pointer"
          style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.07), transparent)' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={tc.text} strokeWidth="2" opacity="0.5">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        {/* 阅读内容 */}
        <div
          key={pageKey}
          ref={contentRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto reader-content px-6 md:px-16 lg:px-32"
          style={{ paddingTop: 52, paddingBottom: 56 }}
        >
          {currentChapter && (
            <article
              className="max-w-2xl mx-auto"
              style={{ fontSize: `${fontSize}px`, lineHeight, fontFamily }}
            >
              <h1 className="font-bold mb-6 text-center" style={{ fontSize: `${fontSize + 4}px`, color: tc.text }}>
                {currentChapter.title}
              </h1>
              <div className="whitespace-pre-wrap" style={{ color: tc.text }}>
                {currentChapter.content}
              </div>
            </article>
          )}
        </div>

        {/* 底部进度条 - 鼠标移入显示，移出隐藏 */}
        <div
          className="absolute bottom-0 left-0 right-0 px-4 py-3 flex items-center gap-3"
          style={{
            background: `linear-gradient(to top, ${tc.bg}ee, ${tc.bg}00)`,
            opacity: showControls ? 1 : 0,
            pointerEvents: showControls ? 'auto' : 'none', // 隐藏时禁用点击
            transition: 'opacity 300ms',
          }}
        >
          <button onClick={goPrev} disabled={currentChapterIndex === 0}
            className="p-1 rounded hover:bg-black/10 disabled:opacity-30 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tc.text} strokeWidth="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: tc.border }}>
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${overallProgress}%`, backgroundColor: ac }} />
          </div>
          <span className="text-xs tabular-nums" style={{ color: tc.textSec }}>
            {currentChapterIndex + 1}/{chapters.length}
          </span>
          <button onClick={goNext} disabled={currentChapterIndex >= chapters.length - 1}
            className="p-1 rounded hover:bg-black/10 disabled:opacity-30 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tc.text} strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>

        {/* 净化进度条 */}
        {isPurifying && (
          <div className="absolute bottom-14 left-4 right-4 z-30">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: tc.border }}>
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${purifyProgress}%`, backgroundColor: '#52c41a' }} />
              </div>
              <span className="text-xs" style={{ color: tc.textSec }}>{purifyProgress}%</span>
            </div>
          </div>
        )}
      </div>

      {/* 自定义侧边面板 */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex shadow-2xl"
        style={{
          width: 320,
          backgroundColor: tc.bg,
          borderLeft: `1px solid ${tc.border}`,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 280ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {sidebarOpen && (
          <div className="fixed inset-0 -z-10" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
            onClick={() => setSidebarOpen(false)} />
        )}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 页头 tab 切换 */}
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: tc.border }}>
            <div className="flex gap-4">
              <button onClick={() => setSidebarTab('toc')}
                className="text-sm font-medium pb-1 border-b-2 transition-colors"
                style={{
                  borderColor: sidebarTab === 'toc' ? ac : 'transparent',
                  color: sidebarTab === 'toc' ? tc.text : tc.textSec,
                }}>
                章节目录
              </button>
              <button onClick={() => setSidebarTab('settings')}
                className="text-sm font-medium pb-1 border-b-2 transition-colors"
                style={{
                  borderColor: sidebarTab === 'settings' ? ac : 'transparent',
                  color: sidebarTab === 'settings' ? tc.text : tc.textSec,
                }}>
                阅读设置
              </button>
            </div>
            <button onClick={() => setSidebarOpen(false)}
              className="p-1 rounded hover:bg-black/10 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tc.text} strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* 章节列表 */}
          {sidebarTab === 'toc' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
              {chapters.map((chapter, index) => (
                <button key={chapter.id}
                  onClick={() => { selectChapter(index); setSidebarOpen(false); }}
                  className="w-full text-left px-3 py-2.5 rounded text-sm transition-colors truncate"
                  style={{
                    backgroundColor: index === currentChapterIndex ? (theme === 'dark' ? '#40a9ff22' : '#1890ff15') : 'transparent',
                    color: index === currentChapterIndex ? ac : tc.text,
                    fontWeight: index === currentChapterIndex ? 600 : 400,
                  }}>
                  <span style={{ color: tc.textSec, marginRight: 8 }}>{index + 1}</span>
                  {chapter.title}
                </button>
              ))}
            </div>
          )}

          {/* 阅读设置 */}
          {sidebarTab === 'settings' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* 字体大小 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: tc.text }}>字体大小</span>
                  <span className="text-xs" style={{ color: tc.textSec }}>{fontSize}px</span>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => { const v = Math.max(12, fontSize - 2); setFontSize(v); updateReaderFont(v, lineHeight); }}
                    className="px-3 py-1 rounded border text-sm font-bold hover:bg-black/10 transition-colors"
                    style={{ borderColor: tc.border, color: tc.text }}>A-</button>
                  <input type="range" min="12" max="32" step="1" value={fontSize}
                    onChange={(e) => { const v = Number(e.target.value); setFontSize(v); updateReaderFont(v, lineHeight); }}
                    className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
                    style={{ backgroundColor: tc.border, accentColor: ac }} />
                  <button onClick={() => { const v = Math.min(32, fontSize + 2); setFontSize(v); updateReaderFont(v, lineHeight); }}
                    className="px-3 py-1 rounded border text-sm font-bold hover:bg-black/10 transition-colors"
                    style={{ borderColor: tc.border, color: tc.text }}>A+</button>
                </div>
              </div>

              {/* 行间距 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: tc.text }}>行间距</span>
                  <span className="text-xs" style={{ color: tc.textSec }}>{lineHeight}x</span>
                </div>
                <input type="range" min="1.2" max="2.5" step="0.1" value={lineHeight}
                  onChange={(e) => { const v = Number(e.target.value); setLineHeight(v); updateReaderFont(fontSize, v); }}
                  className="w-full h-1 rounded-full appearance-none cursor-pointer"
                  style={{ backgroundColor: tc.border, accentColor: ac }} />
                <div className="flex justify-between mt-1">
                  <span className="text-xs" style={{ color: tc.textSec }}>紧凑</span>
                  <span className="text-xs" style={{ color: tc.textSec }}>适中</span>
                  <span className="text-xs" style={{ color: tc.textSec }}>宽松</span>
                </div>
              </div>

              {/* 字体 */}
              <div>
                <span className="text-sm font-medium block mb-2" style={{ color: tc.text }}>阅读字体</span>
                <select value={fontFamily}
                  onChange={(e) => {
                    setFontFamily(e.target.value);
                    if (settings) updateSettings({ reader: { ...settings.reader, fontFamily: e.target.value } });
                  }}
                  className="w-full px-3 py-2 rounded border text-sm appearance-none"
                  style={{ backgroundColor: tc.bgAlt, color: tc.text, borderColor: tc.border }}>
                  <option value="Noto Serif SC, Source Han Serif SC, SimSun, serif">思源宋体（推荐）</option>
                  <option value="Noto Sans SC, Source Han Sans SC, Microsoft YaHei, sans-serif">思源黑体</option>
                  <option value="SimSun, serif">宋体（经典）</option>
                  <option value="KaiTi, STFangsong, serif">楷体/仿宋</option>
                  <option value="Courier New, monospace">等宽字体</option>
                </select>
              </div>

              {/* 主题 */}
              <div>
                <span className="text-sm font-medium block mb-3" style={{ color: tc.text }}>主题</span>
                <div className="flex gap-3">
                  {([
                    { key: 'light', label: '明亮',   bg: '#ffffff', text: '#1a1a1a' },
                    { key: 'dark',  label: '深色',   bg: '#1e1e1e', text: '#e0e0e0' },
                    { key: 'sepia', label: '护眼',   bg: '#f5f0e1', text: '#5c5c5c' },
                  ] as const).map((t) => (
                    <button key={t.key}
                      onClick={() => updateReaderTheme(t.key as ReaderTheme)}
                      className="flex-1 h-14 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all hover:scale-105"
                      style={{
                        backgroundColor: t.bg,
                        borderColor: theme === t.key ? ac : tc.border,
                      }}>
                      <span style={{ color: t.text, fontSize: 11, fontWeight: 600 }}>文</span>
                      <span className="text-xs" style={{ color: t.text }}>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reader;
