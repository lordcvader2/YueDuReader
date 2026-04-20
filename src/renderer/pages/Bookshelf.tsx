import React, { useState } from 'react';
import { useBookStore } from '../stores/bookStore';
import type { Book } from '../../shared/types';

interface BookshelfProps {
  onReadBook: () => void;
}

// ---- SVG 图标组件 ----
const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconDelete = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const IconBook = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
);
const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IconGrid = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);
const IconList = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);

const Bookshelf: React.FC<BookshelfProps> = ({ onReadBook }) => {
  const { books, importBook, selectBook, deleteBook, isLoading } = useBookStore();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchText, setSearchText] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ visible: boolean; book: Book | null }>({ visible: false, book: null });

  const filteredBooks = books.filter(book =>
    book.title.toLowerCase().includes(searchText.toLowerCase()) ||
    book.author?.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleImport = async () => {
    const book = await importBook();
    if (book) {
      const el = document.createElement('div');
      el.textContent = `《${book.title}》导入成功！`;
      el.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg text-sm z-[9999]';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3000);
    }
  };

  const handleRead = (book: Book) => {
    selectBook(book);
    onReadBook();
  };

  const handleDelete = async () => {
    if (deleteModal.book) {
      await deleteBook(deleteModal.book.id);
      const el = document.createElement('div');
      el.textContent = '书籍已删除';
      el.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded shadow-lg text-sm z-[9999]';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3000);
      setDeleteModal({ visible: false, book: null });
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatWordCount = (count: number) => {
    if (count < 10000) return count + ' 字';
    return (count / 10000).toFixed(1) + ' 万字';
  };

  const formatLastRead = (date?: Date) => {
    if (!date) return null;
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 30) return `${days}天前`;
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      {/* 工具栏 */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* 搜索框 */}
        <div className="relative flex-shrink-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <IconSearch />
          </span>
          <input
            type="text"
            placeholder="搜素书籍..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-48 pl-9 pr-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* 网格视图 */}
          <button
            className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            onClick={() => setViewMode('grid')}
            title="网格视图"
          >
            <IconGrid />
          </button>
          {/* 列表视图 */}
          <button
            className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            onClick={() => setViewMode('list')}
            title="列表视图"
          >
            <IconList />
          </button>
          {/* 导入按钮 */}
          <button
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
            onClick={handleImport}
            disabled={isLoading}
          >
            <IconPlus />
            {isLoading ? <span className="text-xs">加载中...</span> : <span>导入书籍</span>}
          </button>
        </div>
      </div>

      {/* 书籍列表 */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-16 text-gray-400">
            <IconBook />
            <p className="mt-4 text-sm">{searchText ? '没有找到匹配的书籍' : '还没有书籍，点击“导入书籍”添加'}</p>
            {!searchText && (
              <button className="flex items-center gap-1 px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors mt-4"
                onClick={handleImport}>
                <IconPlus /> 导入 TXT 文件
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredBooks.map((book) => (
              <div
                key={book.id}
                className="rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all bg-white"
                onClick={() => handleRead(book)}
              >
                {/* 封面区域 */}
                <div className="h-32 bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center relative">
                  <div className="text-white/80"><IconBook /></div>
                  {book.purified && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 bg-green-500 text-white text-xs rounded">
                      已净化
                    </span>
                  )}
                  {book.readProgress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/30">
                      <div className="h-1 bg-blue-400 transition-all" style={{ width: `${book.readProgress}%` }} />
                    </div>
                  )}
                </div>
                {/* 信息区域 */}
                <div className="p-3">
                  <div className="text-sm font-medium truncate">{book.title}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    <div>{book.author || '未知作者'}</div>
                    <div className="flex justify-between mt-1">
                      <span>{formatWordCount(book.wordCount)}</span>
                      <span>{book.chapters?.length || 0} 章</span>
                    </div>
                    {book.lastReadAt && (
                      <div className="mt-1 text-xs text-blue-500 truncate">
                        {book.chapters?.[book.lastReadChapterIndex]?.title
                          ? `上次：${book.chapters[book.lastReadChapterIndex].title}`
                          : formatLastRead(book.lastReadAt)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredBooks.map((book) => (
              <div
                key={book.id}
                className="flex items-center p-4 bg-white rounded-lg border border-gray-100 hover:border-blue-200 hover:shadow cursor-pointer transition-all"
                onClick={() => handleRead(book)}
              >
                <div className="w-12 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded flex items-center justify-center mr-4 flex-shrink-0">
                  <div className="text-white/80"><IconBook /></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{book.title}</div>
                  <div className="text-sm text-gray-500">
                    {book.author || '未知作者'} · {formatWordCount(book.wordCount)} · {book.chapters?.length || 0} 章
                  </div>
                  {book.readProgress > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1 bg-gray-200 rounded">
                        <div className="h-full bg-blue-400 rounded transition-all" style={{ width: `${book.readProgress}%` }} />
                      </div>
                      <span className="text-xs text-gray-400">{book.readProgress}%</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {book.purified && (
                    <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded">已净化</span>
                  )}
                  <button
                    className="w-8 h-8 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    onClick={(e) => { e.stopPropagation(); setDeleteModal({ visible: true, book }); }}
                  >
                    <IconDelete />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 删除确认对话框 */}
      {deleteModal.visible && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-80">
            <h3 className="font-bold text-lg mb-2">删除书籍</h3>
            <p className="text-gray-600 text-sm mb-4">
              确定要删除《{deleteModal.book?.title}》吗？
              <br /><span className="text-gray-400">此操作将删除本地文件，不可恢复</span>
            </p>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
                onClick={() => setDeleteModal({ visible: false, book: null })}>取消</button>
              <button className="px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                onClick={handleDelete}>删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bookshelf;
