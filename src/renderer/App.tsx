import React, { useEffect, useState } from 'react';
import { useSettingsStore } from './stores/settingsStore';
import { useBookStore } from './stores/bookStore';
import Bookshelf from './pages/Bookshelf';
import Reader from './pages/Reader';
import Settings from './pages/Settings';
import TitleBar from './components/TitleBar';
import MiniReader from './components/MiniReader/MiniReader';

type Page = 'bookshelf' | 'reader' | 'settings';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('bookshelf');
  const [isMiniMode, setIsMiniMode] = useState(false);
  const { loadSettings, settings } = useSettingsStore();
  const { loadBooks, currentBook, restoreLastRead } = useBookStore();

  // 加载初始化数据
  useEffect(() => {
    loadSettings();

    // 检查是否为迷你模式
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mini') === 'true') {
      setIsMiniMode(true);
    }

    // 监听导航事件
    window.electronAPI?.onNavigate?.((route) => {
      if (route === '/settings') {
        setCurrentPage('settings');
      }
    });

    // 应用退出/关闭前保存阅读进度
    window.addEventListener('beforeunload', () => {
      // 同步写盘
      const state = useBookStore.getState();
      if (state.currentBook) {
        state.flushReadPosition();
      }
    });
  }, []);

  // 加载书籍后再恢复上次阅读位置
  useEffect(() => {
    loadBooks().then(() => {
      // 书架加载完成后自动恢复上次阅读
      restoreLastRead();
    });
  }, [loadBooks, restoreLastRead]);

  // 渲染迷你模式
  if (isMiniMode) {
    return <MiniReader />;
  }

  // 根据当前书籍状态自动切换页面
  useEffect(() => {
    if (currentBook && currentPage === 'bookshelf') {
      // 书籍已选中，留在书架让用户点击阅读
    } else if (!currentBook && currentPage === 'reader') {
      setCurrentPage('bookshelf');
    }
  }, [currentBook, currentPage]);

  // 渲染内容
  const renderContent = () => {
    switch (currentPage) {
      case 'bookshelf':
        return <Bookshelf onReadBook={() => setCurrentPage('reader')} />;
      case 'reader':
        return <Reader />;
      case 'settings':
        return <Settings onClose={() => setCurrentPage('bookshelf')} />;
      default:
        return <Bookshelf onReadBook={() => setCurrentPage('reader')} />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--reader-bg)]">
      {/* 标题栏 */}
      <TitleBar 
        currentPage={currentPage} 
        onNavigate={setCurrentPage}
      />
      
      {/* 主内容区 */}
      <main className="flex-1 overflow-hidden">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
