/**
 * bookStore.ts - 书籍状态管理
 * 
 * 使用 Zustand 管理书籍相关的全局状态，包括：
 * - 书籍列表（导入的所有书籍）
 * - 当前阅读的书籍和章节
 * - 阅读进度保存
 * - 书籍净化/恢复原文
 * 
 * 数据流：
 * 1. 用户导入书籍 → importBook() → 主进程 bookService.importBook()
 * 2. 打开书籍 → selectBook() → 主进程 getBook(loadContent=true, chapterIndex) 只加载当前章节
 * 3. 翻页 → selectChapter(index) → 主进程 getChapter(bookId, index) 按需加载
 * 4. 阅读时滚动 → saveReadPosition() 内存更新 → flushReadPosition() 写盘
 */

import { create } from 'zustand';
import type { Book, Chapter } from '../../shared/types';

/**
 * 书籍状态接口定义
 */
interface BookState {
  // ===== 状态数据 =====
  books: Book[];
  currentBook: Book | null;
  currentChapter: Chapter | null;
  currentChapterIndex: number;
  isLoading: boolean;
  purifyProgress: number;

  // ===== 操作方法 =====
  loadBooks: () => Promise<void>;
  importBook: (filePath?: string) => Promise<Book | null>;
  selectBook: (book: Book) => void;
  selectChapter: (index: number) => void;
  nextChapter: () => void;
  prevChapter: () => void;
  deleteBook: (bookId: string) => Promise<void>;
  deleteBookWithOption: (bookId: string, keepFile: boolean) => Promise<void>;
  updateProgress: (progress: number) => void;
  saveReadPosition: (chapterIndex: number, scrollPercent: number) => void;
  flushReadPosition: () => void;
  purifyBook: (bookId: string) => Promise<void>;
  restoreOriginal: (bookId: string) => Promise<{ success: boolean; message: string }>;
  restoreLastRead: () => Promise<void>;
}

export const useBookStore = create<BookState>((set, get) => ({
  books: [],
  currentBook: null,
  currentChapter: null,
  currentChapterIndex: 0,
  isLoading: false,
  purifyProgress: 0,

  /**
   * 加载书籍列表
   */
  loadBooks: async () => {
    set({ isLoading: true });
    try {
      const books = (await window.electronAPI?.getBooks() || []) as Book[];
      set({ books, isLoading: false });
    } catch (error) {
      console.error('加载书籍失败:', error);
      set({ isLoading: false });
    }
  },

  /**
   * 导入新书籍
   */
  importBook: async (filePath) => {
    set({ isLoading: true });
    try {
      if (!filePath) {
        const selected = await window.electronAPI?.openFileDialog();
        if (!selected) {
          set({ isLoading: false });
          return null;
        }
        filePath = selected;
      }

      const book = await window.electronAPI?.importBook(filePath) as Book;
      if (book) {
        const { books } = get();
        set({ books: [...books, book] });
      }
      set({ isLoading: false });
      return book;
    } catch (error) {
      console.error('导入书籍失败:', error);
      set({ isLoading: false });
      return null;
    }
  },

  /**
   * 选择书籍开始阅读
   * 只加载当前章节内容，避免大文件全量读取
   */
  selectBook: async (book) => {
    if (!book) { 
      set({ currentBook: null, currentChapter: null, currentChapterIndex: 0 }); 
      return; 
    }
    
    set({ isLoading: true });
    try {
      const savedChapterIndex = book.lastReadChapterIndex || 0;
      // 只加载当前章节内容，不加载全部章节
      const fullBook = await window.electronAPI?.getBook(book.id, true, savedChapterIndex) as Book;
      const chapters = fullBook?.chapters || book?.chapters || [];
      const safeChapterIndex = Math.min(savedChapterIndex, Math.max(0, chapters.length - 1));
      
      set({
        currentBook: fullBook || book,
        currentChapter: chapters[safeChapterIndex] || null,
        currentChapterIndex: safeChapterIndex,
        isLoading: false,
      });
    } catch (error) {
      console.error('加载书籍失败:', error);
      set({ isLoading: false });
    }
  },

  /**
   * 切换到指定章节 - 只加载该章节内容
   */
  selectChapter: async (index) => {
    const { currentBook } = get();
    if (!currentBook?.id) return;
    
    try {
      // 使用轻量级 getChapter API 只获取该章文本
      const chapterText = await window.electronAPI?.getChapter(currentBook.id, index);
      const chapter = currentBook.chapters[index];
      if (!chapter) return;

      const updatedChapter: Chapter = {
        ...chapter,
        content: chapterText || '',
        wordCount: 0, // 可选：计算字数
      };

      // 更新 currentBook 的 chapters 数组中对应章节
      const updatedChapters = currentBook.chapters.map((ch, idx) =>
        idx === index ? updatedChapter : { ...ch, content: '', wordCount: 0 }
      );

      set({
        currentBook: { ...currentBook, chapters: updatedChapters },
        currentChapter: updatedChapter,
        currentChapterIndex: index,
      });

      get().saveReadPosition(index, 0);
    } catch (error) {
      console.error('加载章节失败:', error);
    }
  },

  /** 切换到下一章 */
  nextChapter: async () => {
    const { currentBook, currentChapterIndex } = get();
    if (currentBook?.chapters && currentChapterIndex < currentBook.chapters.length - 1) {
      const newIndex = currentChapterIndex + 1;
      try {
        const chapterText = await window.electronAPI?.getChapter(currentBook.id, newIndex);
        const chapter = currentBook.chapters[newIndex];
        if (!chapter) return;
        const updatedChapter: Chapter = { ...chapter, content: chapterText || '' };
        const updatedChapters = currentBook.chapters.map((ch, idx) =>
          idx === newIndex ? updatedChapter : { ...ch, content: '', wordCount: 0 }
        );
        set({
          currentBook: { ...currentBook, chapters: updatedChapters },
          currentChapter: updatedChapter,
          currentChapterIndex: newIndex,
        });
        get().saveReadPosition(newIndex, 0);
      } catch (error) {
        console.error('加载下一章失败:', error);
      }
    }
  },

  /** 切换到上一章 */
  prevChapter: async () => {
    const { currentBook, currentChapterIndex } = get();
    if (currentBook?.chapters && currentChapterIndex > 0) {
      const newIndex = currentChapterIndex - 1;
      try {
        const chapterText = await window.electronAPI?.getChapter(currentBook.id, newIndex);
        const chapter = currentBook.chapters[newIndex];
        if (!chapter) return;
        const updatedChapter: Chapter = { ...chapter, content: chapterText || '' };
        const updatedChapters = currentBook.chapters.map((ch, idx) =>
          idx === newIndex ? updatedChapter : { ...ch, content: '', wordCount: 0 }
        );
        set({
          currentBook: { ...currentBook, chapters: updatedChapters },
          currentChapter: updatedChapter,
          currentChapterIndex: newIndex,
        });
        get().saveReadPosition(newIndex, 0);
      } catch (error) {
        console.error('加载上一章失败:', error);
      }
    }
  },

  /** 删除书籍（已废弃，请使用 deleteBookWithOption） */
  deleteBook: async (bookId) => {
    try {
      await window.electronAPI?.deleteBook(bookId);
      const { books, currentBook } = get();
      set({ 
        books: books.filter(b => b.id !== bookId),
        currentBook: currentBook?.id === bookId ? null : currentBook,
      });
    } catch (error) {
      console.error('删除书籍失败:', error);
    }
  },

  /** 删除书籍（可选保留本地文件） */
  deleteBookWithOption: async (bookId, keepFile) => {
    try {
      await window.electronAPI?.deleteBookWithOption(bookId, keepFile);
      const { books, currentBook } = get();
      set({ 
        books: books.filter(b => b.id !== bookId),
        currentBook: currentBook?.id === bookId ? null : currentBook,
      });
    } catch (error) {
      console.error('删除书籍失败:', error);
    }
  },

  /**
   * 更新阅读进度百分比（节流版，避免频繁更新状态）
   * 只在内存中更新，不立即写盘
   */
  updateProgress: (progress) => {
    const { currentBook, books } = get();
    if (!currentBook) return;
    const updatedBook = { ...currentBook, readProgress: progress };
    const updatedBooks = books.map(b => b.id === currentBook.id ? updatedBook : b);
    set({ currentBook: updatedBook, books: updatedBooks });
    // 不再每次 updateProgress 都调用 updateBook，改为由 flush 统一写盘
  },

  /**
   * 保存阅读位置到内存
   */
  saveReadPosition: (chapterIndex, scrollPercent) => {
    const { currentBook, books } = get();
    if (!currentBook) return;
    
    const updatedBook: Book = {
      ...currentBook,
      lastReadChapterIndex: chapterIndex,
      lastReadScrollPercent: scrollPercent,
      readProgress: Math.round(
        ((chapterIndex + scrollPercent / 100) / Math.max(currentBook.chapters.length, 1)) * 100
      ),
      lastReadAt: new Date(),
    };
    const updatedBooks = books.map(b => b.id === currentBook.id ? updatedBook : b);
    set({ currentBook: updatedBook, books: updatedBooks });
  },

  /**
   * 将内存中的阅读位置同步到主进程
   */
  flushReadPosition: () => {
    const { currentBook } = get();
    if (currentBook) {
      window.electronAPI?.updateBook(currentBook);
    }
  },

  /** 净化整本书籍 */
  purifyBook: async (bookId) => {
    set({ purifyProgress: 0 });
    try {
      const result = await window.electronAPI?.purifyBook(bookId);
      set({ purifyProgress: 100 });
      await get().loadBooks();
    } catch (error) {
      console.error('净化书籍失败:', error);
      set({ purifyProgress: 0 });
    }
  },

  /** 自动恢复上次阅读的书籍 */
  restoreLastRead: async () => {
    const { books } = get();
    if (books.length === 0) return;
    
    const lastRead = books
      .filter(b => b.lastReadAt)
      .sort((a, b) => new Date(b.lastReadAt!).getTime() - new Date(a.lastReadAt!).getTime())[0];
    
    if (lastRead) {
      await get().selectBook(lastRead);
    }
  },

  /** 恢复原文 */
  restoreOriginal: async (bookId) => {
    try {
      const result = await window.electronAPI?.restoreOriginal(bookId);
      if (result?.success) {
        await get().loadBooks();
        const { currentBook } = get();
        if (currentBook?.id === bookId) {
          await get().selectBook({ ...currentBook, purified: false });
        }
      }
      return result || { success: false, message: '请求失败' };
    } catch (error) {
      console.error('恢复原文失败:', error);
      return { success: false, message: String(error) };
    }
  },
}));
