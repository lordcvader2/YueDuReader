/**
 * purifyService.ts - 文本净化服务（主进程）
 * 
 * 核心职责：
 * 1. 净化单章内容（purifyChapter）：修正错别字、移除广告、清理乱码
 * 2. 支持两种模式：
 *    - 本地模式（默认）：使用内置规则，离线可用
 *    - QCLAW 远程模式：调用 QCLAW API 进行智能净化
 * 
 * 净化规则优先级：
 * 1. 清理乱码字符（锟斤拷、烫烫烫等）
 * 2. 移除广告内容（网址、公众号、推广语等）
 * 3. 修正错别字（常见错误映射表）
 * 4. 清理多余空行
 * 
 * 使用方式：
 * - 设置中 qclawEndpoint 为空 → 本地模式（默认）
 * - 设置中填写 qclawEndpoint → 优先调用远程，失败自动回退本地
 */

import type { SettingsService } from './settingsService';
import type { PurificationReport } from '../../shared/types';

/**
 * 净化结果接口
 */
interface PurifyResult {
  /** 原始文本 */
  originalText: string;
  /** 净化后的文本 */
  purifiedText: string;
  /** 修正记录（错别字、广告、乱码） */
  corrections: Correction[];
  /** 移除的广告内容列表 */
  removedAds: string[];
  /** 移除的乱码内容列表 */
  removedGarbage: string[];
}

/**
 * 单次修正记录
 */
interface Correction {
  /** 修正位置（字符索引） */
  position: number;
  /** 原始内容 */
  original: string;
  /** 修正后内容 */
  corrected: string;
  /** 修正类型：typo=错别字, garbage=乱码, ad=广告 */
  type: 'typo' | 'garbage' | 'ad';
}

/**
 * 净化服务类
 * 在 Electron 主进程中实例化，通过 IPC 对外暴露方法
 */
export class PurifyService {
  /** 设置服务实例（用于读取净化配置） */
  private settingsService: SettingsService;

  constructor(settingsService: SettingsService) {
    this.settingsService = settingsService;
  }

  /**
   * 净化单章内容
   * 
   * 流程：
   * 1. 检查是否配置了 QCLAW 端点
   * 2. 如果配置了，尝试调用远程 API
   * 3. 远程失败或未配置，使用本地规则
   * 
   * @param text 章节原始文本
   * @returns 净化结果（包含修正记录和净化后文本）
   */
  async purifyChapter(text: string): Promise<PurifyResult> {
    const settings = this.settingsService.getSettings();
    const corrections: Correction[] = [];
    const removedAds: string[] = [];
    const removedGarbage: string[] = [];

    // 如果启用了 QCLAW 远程净化，尝试调用
    if (settings.purification.qclawEndpoint && settings.purification.qclawEndpoint !== '') {
      try {
        const response = await fetch(`${settings.purification.qclawEndpoint}/purify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            options: {
              fixTypos: settings.purification.fixTypos,
              removeAds: settings.purification.removeAds,
              removeGarbage: settings.purification.removeGarbage,
            },
          }),
          signal: AbortSignal.timeout(5000), // 5秒超时
        });
        if (response.ok) {
          const result = await response.json();
          return result;
        }
      } catch {
        // 远程不可用，静默回退到本地
        console.log('QCLAW 远程净化不可用，使用本地规则');
      }
    }

    // 本地净化规则（默认模式，始终可用）
    const purifiedText = this.localPurify(
      text, 
      settings.purification, 
      corrections, 
      removedAds, 
      removedGarbage
    );

    return {
      originalText: text,
      purifiedText,
      corrections,
      removedAds,
      removedGarbage,
    };
  }

  /**
   * 本地净化规则
   * 
   * 按顺序执行：
   * 1. 移除乱码字符（锟斤拷、烫烫烫、□◆等）
   * 2. 移除广告内容（网址、公众号、推广语等）
   * 3. 修正错别字（常见错误映射表）
   * 4. 清理多余空行
   */
  private localPurify(
    text: string,
    options: { fixTypos: boolean; removeAds: boolean; removeGarbage: boolean },
    corrections: Correction[],
    removedAds: string[],
    removedGarbage: string[]
  ): string {
    let result = text;

    // ===== 1. 删除乱码字符 =====
    if (options.removeGarbage) {
      const garbagePatterns = [
        /\u00ef\u00bf\u00bd+/g,  // U+FFFD replacement character (UTF-8 解码错误)
        /\ufffd+/g,              // U+FFFD replacement character
        /锟斤拷+/g,              // 经典的 GBK→UTF-8 乱码
        /烫烫烫+/g,              // VC++ 未初始化内存
        /屯屯屯+/g,              // VC++ 堆内存
        /□+/g,                   // 缺字符号
        /◆◆◆+/g,                // 某些站点的占位符
        /\?\?\?+/g,              // 问号乱码
        /\s{5,}/g,               // 5个以上连续空格
      ];

      for (const pattern of garbagePatterns) {
        result = result.replace(pattern, (match) => {
          removedGarbage.push(match);
          return '';
        });
      }
    }

    // ===== 2. 删除广告内容 =====
    if (options.removeAds) {
      const adPatterns = [
        // 网址
        /(?:https?:\/\/)?www\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*/gi,
        // 公众号推广
        /关注[公微][众信][号]?[：:]\s*[a-zA-Z0-9-]+/g,
        /微信公众号[：:]\s*[a-zA-Z0-9-]+/g,
        // QQ群
        /QQ群[：:]\s*\d+/g,
        /加群[：:]\s*\d+/g,
        // 小说站点推广
        /本书首发于[^\n]+/g,
        /最新章节请到[^\n]+/g,
        /请记住本站域名[^\n]+/g,
        // APP推广
        /下载[^\n]*APP[^\n]*/gi,
        // 二维码推广
        /扫码阅读[^\n]*/g,
        /扫描二维码[^\n]*/g,
        // 求票求收藏
        /求[月票推荐票打赏收藏点赞关注]+[！!。…]+/g,
        /跪求[月票推荐票打赏收藏点赞关注]+/g,
        // 重复章节标题（某些站点的爬虫错误）
        /^第[零一二三四五六七八九十百千万]+[章节回][^\n]+\n第[零一二三四五六七八九十百千万]+[章节回]/gm,
        // 手机用户提示
        /手机用户请浏览阅读，更优质的阅读体验。/g,
        // 站点口号
        /天才一秒记住.*?地址。/g,
        /请牢记.*?网址。/g,
      ];

      for (const pattern of adPatterns) {
        result = result.replace(pattern, (match) => {
          removedAds.push(match.trim());
          return '';
        });
      }
    }

    // ===== 3. 修正常见错别字 =====
    if (options.fixTypos) {
      // 错别字映射表（可扩展）
      const typoMap: Record<string, string> = {
        // 常见错误
        '己经': '已经',
        '末来': '未来',
        '然後': '然后',
        // 繁简转换残留
        '佈局': '布局',
        '計画': '计划',
        '紀录': '记录',
        '裏面': '里面',
        '这裏': '这里',
        '甚麽': '什么',
        // 火星文/错字
        '莪': '我',
        '洅': '在',
        '芣': '不',
        '迩': '你',
        '悳': '的',
        '囡': '她',
        '糸': '系',
        '嫒': '爱',
        '屮': '山',
        '卟': '不',
        '叆': '爱',
      };

      for (const [wrong, correct] of Object.entries(typoMap)) {
        if (wrong !== correct) {
          const regex = new RegExp(wrong, 'g');
          result = result.replace(regex, (match) => {
            corrections.push({
              position: result.indexOf(match),
              original: match,
              corrected: correct,
              type: 'typo',
            });
            return correct;
          });
        }
      }
    }

    // ===== 4. 清理多余空行 =====
    result = result.replace(/\n{3,}/g, '\n\n');

    return result;
  }

  /**
   * 净化整本书籍
   * 
   * TODO: 当前为占位实现，需要配合 bookService 实现
   * 
   * 实现思路：
   * 1. 从 bookService 获取书籍内容
   * 2. 逐章调用 purifyChapter
   * 3. 通过 onProgress 回调报告进度
   * 4. 更新书籍的 purified 标志
   * 
   * @param bookId 书籍 ID
   * @param onProgress 进度回调 (0-100)
   */
  async purifyBook(bookId: string, onProgress?: (progress: number) => void): Promise<PurificationReport> {
    const report: PurificationReport = {
      typosFixed: 0,
      adsRemoved: 0,
      garbageRemoved: 0,
      processedAt: new Date(),
    };

    // TODO: 实现全书净化逻辑
    // 当前版本：净化功能在渲染进程逐章调用 purifyChapter

    return report;
  }

  /**
   * 检查净化服务状态
   * 
   * @returns 服务状态信息
   * - 本地模式：始终返回 available=true
   * - 远程模式：尝试连接 QCLAW API
   */
  async checkServiceStatus(): Promise<{ available: boolean; message: string }> {
    const settings = this.settingsService.getSettings();
    const endpoint = settings.purification.qclawEndpoint;

    // 空端点表示仅使用本地模式
    if (!endpoint || endpoint.trim() === '') {
      return { available: true, message: '本地净化模式（离线可用）' };
    }

    try {
      const response = await fetch(`${endpoint}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        return { available: true, message: 'QCLAW 远程服务可用' };
      }
      return { available: false, message: '服务响应异常: ' + response.status };
    } catch {
      return { available: false, message: '远程服务不可用，将使用本地净化规则' };
    }
  }
}
