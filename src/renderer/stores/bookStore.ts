import { create } from 'zustand';
import type { Book, Chapter } from '../../shared/types';

interface BookState {
  books: Book[];
  currentBook: Book | null;
  currentChapter: Chapter | null;
  currentChapterIndex: number;
  isLoading: boolean;
  purifyProgress: number;
  
  // Actions
  loadBooks: () => Promise<void>;
  importBook: (filePath?: string) => Promise<Book | null>;
  selectBook: (book: Book) => void;
  selectChapter: (index: number) => void;
  nextChapter: () => void;
  prevChapter: () => void;
  deleteBook: (bookId: string) => Promise<void>;
  updateProgress: (progress: number) => void;
  // 阅读位置持久化
  saveReadPosition: (chapterIndex: number, scrollPercent: number) => void;
  // 批量保存阅读进度到主进程
  flushReadPosition: () => void;
  purifyBook: (bookId: string) => Promise<void>;
  // 自动恢复上次阅读
  restoreLastRead: () => Promise<void>;
}

export const useBookStore = create<BookState>((set, get) => ({
  books: [],
  currentBook: null,
  currentChapter: null,
  currentChapterIndex: 0,
  isLoading: false,
  purifyProgress: 0,

  loadBooks: async () => {
    set({ isLoading: true });
    try {
      const books: Book[] = await window.electronAPI?.getBooks() || [];
      set({ books, isLoading: false });
    } catch (error) {
      console.error('加载书籍失败:', error);
      set({ isLoading: false });
    }
  },

  importBook: async (filePath) => {
    set({ isLoading: true });
    try {
      // 如果没有传入文件路径，打开文件对话框
      if (!filePath) {
        const selected = await window.electronAPI?.openFileDialog();
        if (!selected) {
          set({ isLoading: false });
          return null;
        }
        filePath = selected;
      }

      const book = await window.electronAPI?.importBook(filePath);
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

  selectBook: async (book) => {
    if (!book) { set({ currentBook: null, currentChapter: null, currentChapterIndex: 0 }); return; }
    // 加载书籍并填充章节内容（从文件按需读取）
    const fullBook = await window.electronAPI?.getBook(book.id, true);
    const chapters = fullBook?.chapters || book?.chapters || [];
    // 恢复到上次阅读的章节
    const savedChapterIndex = book.lastReadChapterIndex || 0;
    const safeChapterIndex = Math.min(savedChapterIndex, Math.max(0, chapters.length - 1));
    set({
      currentBook: fullBook || book,
      currentChapter: chapters[safeChapterIndex] || null,
      currentChapterIndex: safeChapterIndex,
    });
  },

  selectChapter: (index) => {
    const { currentBook } = get();
    if (currentBook?.chapters?.[index]) {
      set({
        currentChapter: currentBook.chapters[index],
        currentChapterIndex: index,
      });
      // 保存章节切换（scrollPercent 重置为0）
      get().saveReadPosition(index, 0);
    }
  },

  nextChapter: () => {
    const { currentBook, currentChapterIndex } = get();
    if (currentBook?.chapters && currentChapterIndex < currentBook.chapters.length - 1) {
      const newIndex = currentChapterIndex + 1;
      set({
        currentChapter: currentBook.chapters[newIndex],
        currentChapterIndex: newIndex,
      });
      get().saveReadPosition(newIndex, 0);
    }
  },

  prevChapter: () => {
    const { currentBook, currentChapterIndex } = get();
    if (currentBook?.chapters && currentChapterIndex > 0) {
      const newIndex = currentChapterIndex - 1;
      set({
        currentChapter: currentBook.chapters[newIndex],
        currentChapterIndex: newIndex,
      });
      get().saveReadPosition(newIndex, 0);
    }
  },

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

  updateProgress: (progress) => {
    const { currentBook, books } = get();
    if (currentBook) {
      const updatedBook = { ...currentBook, readProgress: progress };
      const updatedBooks = books.map(b => b.id === currentBook.id ? updatedBook : b);
      set({ currentBook: updatedBook, books: updatedBooks });
      window.electronAPI?.updateBook(updatedBook);
    }
  },

  saveReadPosition: (chapterIndex, scrollPercent) => {
    const { currentBook, books } = get();
    if (!currentBook) return;
    // 内存中更新，不立即写盘
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

  flushReadPosition: () => {
    const { currentBook } = get();
    if (currentBook) {
      window.electronAPI?.updateBook(currentBook);
    }
  },

  purifyBook: async (bookId) => {
    set({ purifyProgress: 0 });
    try {
      const result = await window.electronAPI?.purifyBook(bookId);
      set({ purifyProgress: 100 });
      // 重新加载书籍
      await get().loadBooks();
    } catch (error) {
      console.error('净化书籍失败:', error);
      set({ purifyProgress: 0 });
    }
  },

  restoreLastRead: async () => {
    const { books } = get();
    if (books.length === 0) return;
    // 找到最后阅读过的书籍
    const lastRead = books
      .filter(b => b.lastReadAt)
      .sort((a, b) => new Date(b.lastReadAt!).getTime() - new Date(a.lastReadAt!).getTime())[0];
    if (lastRead) {
      await get().selectBook(lastRead);
    }
  },
}));
