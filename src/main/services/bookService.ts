// 书籍管理服务
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as iconv from 'iconv-lite';
import * as chardet from 'chardet';
import type { Book, Chapter } from '../../shared/types';

export class BookService {
  private booksDir: string;
  private books: Map<string, Book> = new Map();

  constructor() {
    // 书籍存储目录
    this.booksDir = path.join(process.env.APPDATA || process.env.HOME || '', 'YueDuReader', 'books');
    this.ensureDir(this.booksDir);
    this.loadBooksIndex();
  }

  private ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadBooksIndex() {
    const indexPath = path.join(this.booksDir, 'index.json');
    if (fs.existsSync(indexPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        this.books = new Map(Object.entries(data));
      } catch (e) {
        console.error('加载书籍索引失败:', e);
      }
    }
  }

  private saveBooksIndex() {
    const indexPath = path.join(this.booksDir, 'index.json');
    const data = Object.fromEntries(this.books);
    fs.writeFileSync(indexPath, JSON.stringify(data, null, 2));
  }

  async importBook(filePath: string): Promise<Book> {
    if (!fs.existsSync(filePath)) {
      throw new Error('文件不存在');
    }

    // 检查是否已导入
    const existingBook = Array.from(this.books.values()).find(b => b.filePath === filePath);
    if (existingBook) {
      return existingBook;
    }

    // 读取文件并检测编码
    const buffer = fs.readFileSync(filePath);
    const detectedEncoding = chardet.detect(buffer) || 'utf-8';
    const encoding = this.normalizeEncoding(detectedEncoding);

    // 解码内容
    const content = iconv.decode(buffer, encoding);

    // 生成书籍ID（提前生成，用于文件命名）
    const bookId = crypto.randomBytes(16).toString('hex');

    // 提取书名和作者
    const title = this.extractTitle(filePath, content);
    const author = this.extractAuthor(content);

    // 一次性统计总字数（单次遍历）
    const wordCount = this.countWords(content);

    // 解析章节（只存 position 不存 content 副本，极大减少内存和 CPU 开销）
    const chapters = this.parseChapters(content);

    // 更新章节标题中的数字为阿拉伯数字（只对正文中的章节做转换）
    for (const ch of chapters) {
      const digitMatch = ch.title.match(/^第([零一二三四五六七八九十百千万]+)[章节回部]/);
      if (digitMatch) {
        ch.title = ch.title.replace(digitMatch[1], this.cnDigitToArabic(digitMatch[1]));
      }
    }

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

    // 保存书籍内容（utf-8）
    const bookContentPath = path.join(this.booksDir, `${bookId}.txt`);
    fs.writeFileSync(bookContentPath, content, 'utf-8');

    // 更新索引
    this.books.set(bookId, book);
    this.saveBooksIndex();

    return book;
  }

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
   * 优化版章节解析：单次遍历收集章节位置，不存储 content 副本
   * 大幅降低内存占用和 CPU 开销
   */
  private parseChapters(content: string): Chapter[] {
    const chapters: Chapter[] = [];
    const matches: { title: string; index: number }[] = [];
    const len = content.length;

    // 定义章节模式（优化顺序：先匹配常见中文模式）
    // 使用静态正则，避免 RegExp 重复构造
    const patternDefs = [
      // 常见中文章节：第X章/第X节/第X回/第X部
      /第[零一二三四五六七八九十百千万\d]+[章节回部集][^\n]*/g,
      // 英文 Chapter 模式
      /Chapter\s+\d+[^\n]*/gi,
      // 纯阿拉伯数字章节
      /^\d+[章节回部集][^\n]*/gm,
    ];

    // 单次遍历内容 + 依次匹配（避免多次 content.matchAll）
    for (const patternDef of patternDefs) {
      const regex = new RegExp(patternDef.source, patternDef.flags);
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        const title = match[0].trim();
        if (title.length >= 2 && title.length <= 60) {
          matches.push({ title, index: match.index });
        }
        // 防止正则贪婪导致死循环
        if (match.index === regex.lastIndex) {
          regex.lastIndex++;
        }
      }
      if (matches.length >= 5) break;
    }

    // 按位置排序
    matches.sort((a, b) => a.index - b.index);

    // 去重（相邻匹配保留第一个）
    const deduped: typeof matches = [];
    for (const m of matches) {
      if (deduped.length === 0 || m.index !== deduped[deduped.length - 1].index) {
        deduped.push(m);
      }
    }

    // 生成章节列表（只存 position，content 按需从文件读取）
    for (let i = 0; i < deduped.length; i++) {
      const m = deduped[i];
      const nextIdx = deduped[i + 1]?.index || len;
      chapters.push({
        id: crypto.randomBytes(8).toString('hex'),
        title: m.title,
        content: '', // lazy loaded
        wordCount: 0, // lazy loaded
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
   * 优化版字数统计：单次遍历同时计数中文字符和英文单词
   */
  private countWords(text: string): number {
    let count = 0;
    let i = 0;
    const len = text.length;
    while (i < len) {
      const code = text.charCodeAt(i);
      if (code >= 0x4e00 && code <= 0x9fa5) {
        // 中文字符
        count++;
        i++;
      } else if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) {
        // 英文字母（单词计数）
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
   * 中文数字转阿拉伯数字（支持 个/十/百/千/万 位）
   * 例: 十三 -> 13, 三千一百二十三 -> 3123, 一万 -> 10000
   */
  private cnDigitToArabic(cn: string): string {
    const map: Record<string, number> = {
      '零': 0, '一': 1, '二': 2, '三': 3, '四': 4,
      '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
    };
    const units: Record<string, number> = {
      '十': 10, '百': 100, '千': 1000, '万': 10000,
    };
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
      // 内容中的书名通常更准确，但文件名优先
      // 只有当文件名很短（<4字符）或者内容标题更合理时才用内容标题
      if (title.length < 4 || (contentTitle.length > title.length && contentTitle.length > 4)) {
        title = contentTitle;
      }
    }

    return title || path.basename(filePath);
  }

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

  getBooks(): Book[] {
    return Array.from(this.books.values());
  }

  /**
   * 获取书籍（可选填充章节内容，按需从文件读取）
   */
  getBook(bookId: string, loadContent: boolean = false): Book | undefined {
    const book = this.books.get(bookId);
    if (!book) return undefined;
    if (!loadContent) return book;

    // 读取文件内容，按 position 切片填充章节
    const content = this.getBookContent(bookId);
    if (content) {
      book.chapters = book.chapters.map(ch => ({
        ...ch,
        content: content.slice(ch.startIndex, ch.endIndex),
        wordCount: this.countWords(content.slice(ch.startIndex, ch.endIndex)),
      }));
    }
    return book;
  }

  updateBook(book: Book): void {
    book.updatedAt = new Date();
    this.books.set(book.id, book);
    this.saveBooksIndex();
  }

  deleteBook(bookId: string): void {
    // 删除书籍内容文件
    const contentPath = path.join(this.booksDir, `${bookId}.txt`);
    if (fs.existsSync(contentPath)) {
      fs.unlinkSync(contentPath);
    }

    // 从索引中移除
    this.books.delete(bookId);
    this.saveBooksIndex();
  }

  getBookContent(bookId: string): string | null {
    const contentPath = path.join(this.booksDir, `${bookId}.txt`);
    if (fs.existsSync(contentPath)) {
      return fs.readFileSync(contentPath, 'utf-8');
    }
    return null;
  }
}
