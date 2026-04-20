import React, { useRef } from 'react';
import { useBookStore } from '../../stores/bookStore';
import { useSettingsStore } from '../../stores/settingsStore';

const MiniReader: React.FC = () => {
  const {
    currentBook,
    currentChapter,
    currentChapterIndex,
    nextChapter,
    prevChapter,
  } = useBookStore();
  const { settings } = useSettingsStore();

  const contentRef = useRef<HTMLDivElement>(null);
  const theme = settings?.reader?.theme || 'light';
  const fontSize = settings?.reader?.fontSize || 14;
  const lineHeight = settings?.reader?.lineHeight || 1.6;
  const chapters = currentBook?.chapters || [];

  const tc = theme === 'dark'
    ? { bg: '#1e1e1e', bgAlt: '#2d2d2d', text: '#e0e0e0', textSec: '#a0a0a0', border: '#3a3a3a' }
    : theme === 'sepia'
    ? { bg: '#f5f0e1', bgAlt: '#ebe5d5', text: '#5c5c5c', textSec: '#7a7a7a', border: '#d9d3c3' }
    : { bg: '#ffffff', bgAlt: '#f5f5f5', text: '#1a1a1a', textSec: '#666666', border: '#e8e8e8' };

  const handleClose = () => window.close();

  if (!currentBook) {
    return (
      <div className="h-screen flex flex-col rounded-lg overflow-hidden" style={{ backgroundColor: tc.bg }}>
        <div className="h-8 flex items-center justify-between px-2 border-b" style={{ backgroundColor: tc.bgAlt, borderColor: tc.border }}>
          <span className="text-sm font-medium" style={{ color: tc.text }}>迷你阅读</span>
          <button onClick={handleClose}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500 hover:text-white transition-colors"
            style={{ color: tc.textSec }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm" style={{ color: tc.textSec }}>请先在主窗口选择书籍</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col rounded-lg overflow-hidden" style={{ backgroundColor: tc.bg }}>
      {/* 标题栏 */}
      <div className="h-8 flex items-center justify-between px-2 border-b drag-region" style={{ backgroundColor: tc.bgAlt, borderColor: tc.border }}>
        <span className="text-xs font-medium truncate max-w-[180px]" style={{ color: tc.text }}>
          {currentBook.title}
        </span>
        <button onClick={handleClose}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500 hover:text-white transition-colors no-drag"
          style={{ color: tc.textSec }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* 阅读内容 */}
      <div ref={contentRef} className="flex-1 overflow-y-auto reader-content p-3">
        {currentChapter && (
          <article style={{ fontSize: `${fontSize}px`, lineHeight, color: tc.text,
            fontFamily: settings?.reader?.fontFamily || 'Noto Serif SC, SimSun, serif' }}>
            <div className="whitespace-pre-wrap">
              {currentChapter.content.length > 2000
                ? currentChapter.content.slice(0, 2000) + '...'
                : currentChapter.content}
            </div>
          </article>
        )}
      </div>

      {/* 底部控制栏 */}
      <div className="h-10 flex items-center justify-between px-2 border-t" style={{ backgroundColor: tc.bgAlt, borderColor: tc.border }}>
        <button onClick={prevChapter} disabled={currentChapterIndex === 0}
          className="w-8 h-8 flex items-center justify-center rounded transition-colors"
          style={{ color: currentChapterIndex === 0 ? '#d0d0d0' : tc.textSec }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <div className="flex-1 text-center">
          <span className="text-xs" style={{ color: tc.textSec }}>{currentChapterIndex + 1} / {chapters.length}</span>
          {currentChapter && (
            <div className="text-xs truncate max-w-[200px] mx-auto" style={{ color: tc.textSec }}>
              {currentChapter.title}
            </div>
          )}
        </div>

        <button onClick={nextChapter} disabled={currentChapterIndex >= chapters.length - 1}
          className="w-8 h-8 flex items-center justify-center rounded transition-colors"
          style={{ color: currentChapterIndex >= chapters.length - 1 ? '#d0d0d0' : tc.textSec }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default MiniReader;
