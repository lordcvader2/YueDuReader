/**
 * bookService.ts - 书籍管理服务（主进程）
 * 
 * 核心职责：
 * 1. 导入 TXT 文件：编码检测 → 内容解码 → 章节解析 → 元数据提取
 * 2. 书籍存储：内容按 UTF-8 存储，备份原始内容用于恢复
 * 3. 章节懒加载：导入时只存位置索引，阅读时按需读取内容
 * 4. 书籍索引：使用 books-index.json 管理所有书籍元数据
 * 
 * 数据存储结构：
 * books/
 * ├── books-index.json        # 书籍索引（Map<bookId, Book> 的 JSON 序列化）
 * ├── {bookId}.txt            # 书籍内容（UTF-8 编码）
 * └── {bookId}.bak            # 原文备份（用于"恢复原文"功能）
 * 
 * 性能优化策略：
 * - 所有文件 I/O 使用异步 API（fs.promises），避免阻塞主进程
 * - 章节解析时只存储 startIndex/endIndex，不存储 content 副本
 * - getBook 支持只加载指定章节内容（避免全量读取大文件）
 * - 字数统计单次遍历，同时处理中文字符和英文单词
 * - 索引保存使用防抖机制，高频更新时合并写入
 * - updateBook 不再每次都写索引文件（由 flush 机制统一处理）
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as iconv from 'iconv-lite';
import * as chardet from 'chardet';
import type { Book, Chapter } from '../../shared/types';

const fsPromises = fs.promises;

/**
 * 书籍管理服务类
 * 在 Electron 主进程中实例化，通过 IPC 对外暴露方法
 */
export class BookService {
  /** 书籍数据存储目录 */
  private booksDir: string;
  
  /** 内存中的书籍索引（bookId -> Book） */
  private books: Map<string, Book> = new Map();

  /** 索引保存防抖定时器 */
  private saveIndexTimer: ReturnType<typeof setTimeout> | null = null;

  /** 索引是否有未保存的变更 */
  private indexDirty: boolean = false;

  constructor() {
    // 书籍存储目录：位于用户数据目录下的 YueDuReader/books
    this.booksDir = path.join(
      process.env.APPDATA || process.env.HOME || '', 
      'YueDuReader', 
      'books'
    );
    this.ensureDirSync(this.booksDir);
    this.loadBooksIndex();
  }

  /** 同步确保目录存在（仅构造函数使用） */
  private ensureDirSync(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 从 books-index.json 加载书籍索引到内存
   * 应用启动时调用一次
   */
  private loadBooksIndex() {
    const indexPath = path.join(this.booksDir, 'index.json');
    try {
      if (!fs.existsSync(indexPath)) return;
      const data = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      this.books = new Map(Object.entries(data));
    } catch (e) {
      console.error('加载书籍索引失败:', e);
      // 索引损坏时尝试从备份恢复或重建
      try {
        const backupPath = indexPath + '.bak';
        if (fs.existsSync(backupPath)) {
          const data = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
          this.books = new Map(Object.entries(data));
          console.log('从备份恢复书籍索引成功');
        }
      } catch {
        console.error('索引备份恢复也失败，将从空索引启动');
      }
    }
  }

  /**
   * 防抖保存书籍索引
   * 高频调用时合并写入，减少磁盘 I/O
   */
  private debouncedSaveIndex() {
    this.indexDirty = true;
    if (this.saveIndexTimer) return;
    this.saveIndexTimer = setTimeout(() => {
      this.saveIndexTimer = null;
      this.saveBooksIndex();
    }, 1000); // 1秒防抖
  }

  /**
   * 保存内存中的书籍索引到 books-index.json
   * 每次保存前先写临时文件再重命名，防止写入中断导致数据损坏
   */
  private saveBooksIndex() {
    if (!this.indexDirty) return;
    const indexPath = path.join(this.booksDir, 'index.json');
    const tmpPath = indexPath + '.tmp';
    const data = Object.fromEntries(this.books);
    const jsonStr = JSON.stringify(data);
    try {
      fs.writeFileSync(tmpPath, jsonStr, 'utf-8');
      // 先写备份
      if (fs.existsSync(indexPath)) {
        fs.copyFileSync(indexPath, indexPath + '.bak');
      }
      // 原子重命名
      fs.renameSync(tmpPath, indexPath);
      this.indexDirty = false;
    } catch (e) {
      console.error('保存书籍索引失败:', e);
    }
  }

  /**
   * 强制立即保存索引（应用退出前调用）
   */
  flushIndex() {
    if (this.saveIndexTimer) {
      clearTimeout(this.saveIndexTimer);
      this.saveIndexTimer = null;
    }
    this.saveBooksIndex();
  }

  /**
   * 导入书籍
   * 
   * 完整流程：
   * 1. 检查文件是否存在、是否已导入（去重）
   * 2. 检测文件编码（chardet）→ 解码为 UTF-8
   * 3. 提取书名、作者
   * 4. 解析章节位置（不存储内容，降低内存占用）
   * 5. 保存内容文件 + 原文备份
   * 6. 更新索引
   * 
   * @param filePath TXT 文件路径
   * @returns 导入的书籍对象
   */
  async importBook(filePath: string): Promise<Book> {
    // 参数校验
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('无效的文件路径');
    }

    // 异步检查文件是否存在
    let stat: fs.Stats;
    try {
      stat = await fsPromises.stat(filePath);
    } catch {
      throw new Error('文件不存在');
    }
    if (!stat.isFile()) {
      throw new Error('路径不是文件');
    }

    // 检查是否已导入（根据原文件路径去重）
    const existingBook = Array.from(this.books.values()).find(b => b.filePath === filePath);
    if (existingBook) {
      return existingBook;
    }

    // 异步读取文件并检测编码
    const buffer = await fsPromises.readFile(filePath);
    const detectedEncoding = chardet.detect(buffer) || 'utf-8';
    const encoding = this.normalizeEncoding(detectedEncoding);

    // 解码内容（iconv-lite 支持几乎所有中文编码）
    const content = iconv.decode(buffer, encoding);

    // 生成书籍ID（用于文件命名，全局唯一）
    const bookId = crypto.randomBytes(16).toString('hex');

    // 提取书名和作者
    const title = this.extractTitle(filePath, content);
    const author = this.extractAuthor(content);

    // 一次性统计总字数（单次遍历优化）
    const wordCount = this.countWords(content);

    // 解析章节（只存 position 不存 content 副本）
    const chapters = this.parseChapters(content);

    // 更新章节标题中的数字为阿拉伯数字
    // 例：「第十三章 惊变」→「第13章 惊变」
    for (const ch of chapters) {
      const digitMatch = ch.title.match(/^第([零一二三四五六七八九十百千万]+)[章节回部]/);
      if (digitMatch) {
        ch.title = ch.title.replace(digitMatch[1], this.cnDigitToArabic(digitMatch[1]));
      }
    }

    // 构建书籍对象
    const book: Book = {
      id: bookId,
      title,
      author,
      filePath,
      fileSize: buffer.length,
      wordCount,
      encoding,
      chapters,
      createdAt: new Date(),
      updatedAt: new Date(),
      readProgress: 0,
      lastReadChapterIndex: 0,
      lastReadScrollPercent: 0,
      purified: false,
    };

    // 异步保存书籍内容（统一转为 UTF-8 存储）
    const bookContentPath = path.join(this.booksDir, `${bookId}.txt`);
    await fsPromises.writeFile(bookContentPath, content, 'utf-8');

    // 异步保存原始内容备份（用于"恢复原文"功能）
    const backupPath = path.join(this.booksDir, `${bookId}.bak`);
    await fsPromises.writeFile(backupPath, content, 'utf-8');

    // 更新索引
    this.books.set(bookId, book);
    this.saveBooksIndex(); // 导入是低频操作，直接保存

    return book;
  }

  /**
   * 规范化编码名称
   * 将 chardet 检测结果统一为我们支持的编码类型
   */
  private normalizeEncoding(detected: string): 'utf-8' | 'gbk' | 'gb18030' {
    const lower = detected.toLowerCase();
    if (lower.includes('utf') || lower.includes('ascii')) {
      return 'utf-8';
    }
    if (lower.includes('gb18030')) {
      return 'gb18030';
    }
    return 'gbk';
  }

  /**
   * 章节解析（优化版）
   * 
   * 性能优化：
   * - 单次遍历收集章节位置，不存储 content 副本
   * - 大幅降低内存占用和 CPU 开销
   * - 使用 Set 去重代替数组遍历
   * 
   * 支持的章节格式：
   * - 中文章节：第X章/第X节/第X回/第X部/第X集
   * - 英文章节：Chapter X
   * - 纯数字：1章、2节、3回
   */
  private parseChapters(content: string): Chapter[] {
    const matches: { title: string; index: number }[] = [];
    const len = content.length;
    const seenPositions = new Set<number>();

    // 定义章节匹配模式（优先匹配常见中文模式）
    const patternDefs = [
      // 中文章节：第X章/第X节/第X回/第X部
      /第[零一二三四五六七八九十百千万\d]+[章节回部集][^\n]*/g,
      // 英文 Chapter 模式
      /Chapter\s+\d+[^\n]*/gi,
      // 纯阿拉伯数字章节
      /^\d+[章节回部集][^\n]*/gm,
    ];

    // 单次遍历内容 + 依次匹配
    for (const patternDef of patternDefs) {
      const regex = new RegExp(patternDef.source, patternDef.flags);
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        const title = match[0].trim();
        // 过滤过短或过长的标题
        if (title.length >= 2 && title.length <= 60 && !seenPositions.has(match.index)) {
          matches.push({ title, index: match.index });
          seenPositions.add(match.index);
        }
        // 防止正则贪婪导致死循环
        if (match.index === regex.lastIndex) {
          regex.lastIndex++;
        }
      }
      // 找到足够多的章节后不再匹配后续模式
      if (matches.length >= 5) break;
    }

    // 按位置排序
    matches.sort((a, b) => a.index - b.index);

    // 生成章节列表（只存位置索引）
    const chapters: Chapter[] = [];
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const nextIdx = matches[i + 1]?.index || len;
      chapters.push({
        id: crypto.randomBytes(8).toString('hex'),
        title: m.title,
        content: '', // 懒加载，阅读时填充
        wordCount: 0, // 懒加载
        startIndex: m.index,
        endIndex: nextIdx,
      });
    }

    // 如果没有找到章节，生成单章
    if (chapters.length === 0) {
      chapters.push({
        id: crypto.randomBytes(8).toString('hex'),
        title: '正文',
        content: '',
        wordCount: 0,
        startIndex: 0,
        endIndex: len,
      });
    }

    return chapters;
  }

  /**
   * 字数统计（优化版）
   * 
   * 单次遍历同时计数：
   * - 中文字符：每个字符计 1 字
   * - 英文单词：连续字母计 1 词
   * 
   * 例如：「Hello世界」= 1（英文单词）+ 2（中文）= 3
   */
  private countWords(text: string): number {
    let count = 0;
    let i = 0;
    const len = text.length;
    
    while (i < len) {
      const code = text.charCodeAt(i);
      if (code >= 0x4e00 && code <= 0x9fa5) {
        // 中文字符（Unicode CJK 统一汉字区间）
        count++;
        i++;
      } else if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) {
        // 英文字母（连续字母计为一个单词）
        while (i < len) {
          const c = text.charCodeAt(i);
          if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) {
            count++;
            i++;
          } else {
            break;
          }
        }
      } else {
        i++;
      }
    }
    return count;
  }

  /**
   * 中文数字转阿拉伯数字
   * 
   * 支持的单位：个、十、百、千、万
   * 示例：
   * - 十三 → 13
   * - 三千一百二十三 → 3123
   * - 一万 → 10000
   */
  private cnDigitToArabic(cn: string): string {
    const map: Record<string, number> = {
      '零': 0, '一': 1, '二': 2, '三': 3, '四': 4,
      '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
    };
    const units: Record<string, number> = {
      '十': 10, '百': 100, '千': 1000, '万': 10000,
    };
    
    // 非中文数字直接返回
    if (!/^[零一二三四五六七八九十百千万]+$/.test(cn)) return cn;

    let result = 0;
    let cur = 0;
    let lastUnit = 1;

    for (const ch of cn) {
      if (ch in map) {
        cur = map[ch];
      } else if (ch in units) {
        const unit = units[ch];
        if (unit > lastUnit) {
          // 万/千/百：先累积 cur，再乘以 unit
          result += cur === 0 ? unit : cur * unit;
          cur = 0;
          lastUnit = unit;
        } else {
          // 十（比上一个单位小）：cur 已有值则乘，0 则直接加
          result += cur === 0 ? 10 : cur * 10;
          cur = 0;
          lastUnit = 10;
        }
      }
    }
    return String(result + cur);
  }

  /**
   * 从文件路径和内容中提取书名
   * 
   * 优先级：
   * 1. 清理后的文件名
   * 2. 内容中第一行的书名（如果文件名较短）
   */
  private extractTitle(filePath: string, content: string): string {
    // 优先使用文件名作为书名
    let title = path.basename(filePath, '.txt');
    
    // 清理文件名中的常见前缀（如 Txtnovel_、小说名_等）
    title = title.replace(/^[【\[【\[][^\]】\]]{0,30}[\]】\]]/, '').trim();
    title = title.replace(/^[【\[【\[][^\]】\]]{0,30}[_－-]/, '').trim();
    title = title.replace(/^txtnovel[_-]*/i, '').trim();

    // 如果清理后为空，使用带扩展名的文件名
    if (!title) {
      title = path.basename(filePath);
    }

    // 尝试从内容中提取书名（仅当文件名较短时优先内容标题）
    const titleMatch = content.match(/^[《「『]?([^》」』\n]{2,30})[》」』]?\s*$/m);
    if (titleMatch && titleMatch[1]) {
      const contentTitle = titleMatch[1].trim();
      // 只有当文件名很短（<4字符）或者内容标题更合理时才用内容标题
      if (title.length < 4 || (contentTitle.length > title.length && contentTitle.length > 4)) {
        title = contentTitle;
      }
    }

    return title || path.basename(filePath);
  }

  /**
   * 从内容中提取作者名
   * 
   * 匹配模式：
   * - 作者：XXX
   * - 著者：XXX
   * - 文：XXX
   */
  private extractAuthor(content: string): string | undefined {
    const patterns = [
      /作者[：:]\s*(.{2,10})/,
      /著[者者][：:]\s*(.{2,10})/,
      /[文文][：:]\s*(.{2,10})/,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * 获取所有书籍列表
   * 返回内存中的书籍索引（不含章节内容）
   */
  getBooks(): Book[] {
    return Array.from(this.books.values());
  }

  /**
   * 恢复原文（异步版本）
   * 
   * 从 {bookId}.bak 备份文件恢复原始内容
   * 用于"恢复原文"功能
   * 
   * @param bookId 书籍 ID
   * @returns 操作结果
   */
  async restoreOriginal(bookId: string): Promise<{ success: boolean; message: string }> {
    // 参数校验
    if (!bookId || typeof bookId !== 'string') {
      return { success: false, message: '无效的书籍 ID' };
    }

    const backupPath = path.join(this.booksDir, `${bookId}.bak`);
    
    try {
      await fsPromises.access(backupPath);
    } catch {
      return { success: false, message: '没有找到原始文件备份' };
    }

    try {
      const book = this.books.get(bookId);
      if (!book) return { success: false, message: '书籍不存在' };

      const originalContent = await fsPromises.readFile(backupPath, 'utf-8');
      
      // 恢复每个章节的内容
      book.chapters = book.chapters.map(ch => ({
        ...ch,
        content: originalContent.slice(ch.startIndex, ch.endIndex),
        wordCount: this.countWords(originalContent.slice(ch.startIndex, ch.endIndex)),
      }));
      
      // 更新章节内容文件
      const bookContentPath = path.join(this.booksDir, `${bookId}.txt`);
      await fsPromises.writeFile(bookContentPath, originalContent, 'utf-8');
      
      book.purified = false;
      book.updatedAt = new Date();
      this.books.set(bookId, book);
      this.saveBooksIndex();
      
      return { success: true, message: '已恢复原文' };
    } catch (e) {
      return { success: false, message: '恢复失败: ' + String(e) };
    }
  }

  /**
   * 获取书籍详情
   * 
   * @param bookId 书籍 ID
   * @param loadContent 是否加载章节内容（从文件读取）
   * @param chapterIndex 只加载指定章节内容（性能优化，避免全量读取大文件）
   * @returns 书籍对象
   */
  async getBook(
    bookId: string, 
    loadContent: boolean = false, 
    chapterIndex?: number
  ): Promise<Book | undefined> {
    const book = this.books.get(bookId);
    if (!book) return undefined;
    if (!loadContent) return book;

    // 读取文件内容
    const content = await this.getBookContent(bookId);
    if (!content) return book;

    if (chapterIndex !== undefined && chapterIndex >= 0 && chapterIndex < book.chapters.length) {
      // 只加载指定章节的内容（性能优化：大文件不需要全量加载）
      const ch = book.chapters[chapterIndex];
      const updatedChapters = book.chapters.map((c, idx) => {
        if (idx === chapterIndex) {
          return {
            ...c,
            content: content.slice(c.startIndex, c.endIndex),
            wordCount: this.countWords(content.slice(c.startIndex, c.endIndex)),
          };
        }
        return { ...c, content: '', wordCount: 0 }; // 其他章节清空内容
      });
      return { ...book, chapters: updatedChapters };
    } else {
      // 加载所有章节内容
      const updatedChapters = book.chapters.map(ch => ({
        ...ch,
        content: content.slice(ch.startIndex, ch.endIndex),
        wordCount: this.countWords(content.slice(ch.startIndex, ch.endIndex)),
      }));
      return { ...book, chapters: updatedChapters };
    }
  }

  /**
   * 获取单个章节内容（轻量级，不需要加载整本书）
   * 
   * @param bookId 书籍 ID
   * @param chapterIndex 章节索引
   * @returns 章节文本内容
   */
  async getChapterContent(bookId: string, chapterIndex: number): Promise<string | null> {
    const book = this.books.get(bookId);
    if (!book || chapterIndex < 0 || chapterIndex >= book.chapters.length) {
      return null;
    }
    
    const ch = book.chapters[chapterIndex];
    const content = await this.getBookContent(bookId);
    if (!content) return null;
    
    return content.slice(ch.startIndex, ch.endIndex);
  }

  /**
   * 更新书籍信息
   * 
   * 用于保存阅读进度、最后阅读位置等
   * 使用防抖保存，高频调用不会频繁写磁盘
   */
  updateBook(book: Book): void {
    // 参数校验
    if (!book || !book.id) return;
    
    book.updatedAt = new Date();
    this.books.set(book.id, book);
    this.debouncedSaveIndex();
  }

  /**
   * 删除书籍（异步版本）
   * 
   * @param bookId 书籍 ID
   * @param keepFile 是否保留本地文件（true=只从书架移除，false=彻底删除）
   */
  async deleteBook(bookId: string, keepFile: boolean = false): Promise<void> {
    if (!keepFile) {
      // 并行删除书籍内容文件和备份文件
      const contentPath = path.join(this.booksDir, `${bookId}.txt`);
      const backupPath = path.join(this.booksDir, `${bookId}.bak`);
      await Promise.allSettled([
        fsPromises.unlink(contentPath).catch(() => {}),
        fsPromises.unlink(backupPath).catch(() => {}),
      ]);
    }
    // 从索引中移除
    this.books.delete(bookId);
    this.saveBooksIndex();
  }

  /**
   * 获取书籍内容（异步版本）
   * 
   * @param bookId 书籍 ID
   * @returns UTF-8 编码的书籍内容，文件不存在返回 null
   */
  async getBookContent(bookId: string): Promise<string | null> {
    const contentPath = path.join(this.booksDir, `${bookId}.txt`);
    try {
      return await fsPromises.readFile(contentPath, 'utf-8');
    } catch {
      return null;
    }
  }
}
