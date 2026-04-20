// AI 净化服务 - QCLAW 集成
import type { SettingsService } from './settingsService';
import type { PurificationReport } from '../../shared/types';

interface PurifyResult {
  originalText: string;
  purifiedText: string;
  corrections: Correction[];
  removedAds: string[];
  removedGarbage: string[];
}

interface Correction {
  position: number;
  original: string;
  corrected: string;
  type: 'typo' | 'garbage' | 'ad';
}

export class PurifyService {
  private settingsService: SettingsService;

  constructor(settingsService: SettingsService) {
    this.settingsService = settingsService;
  }

  async purifyChapter(text: string): Promise<PurifyResult> {
    const settings = this.settingsService.getSettings();
    const endpoint = settings.purification.qclawEndpoint;

    let purifiedText = text;
    const corrections: Correction[] = [];
    const removedAds: string[] = [];
    const removedGarbage: string[] = [];

    try {
      // 尝试调用 QCLAW 服务
      const response = await fetch(`${endpoint}/purify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          options: {
            fixTypos: settings.purification.fixTypos,
            removeAds: settings.purification.removeAds,
            removeGarbage: settings.purification.removeGarbage,
          },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        return result;
      }
    } catch (error) {
      console.warn('QCLAW 服务不可用，使用本地净化规则:', error);
    }

    // 本地净化规则（离线模式）
    purifiedText = this.localPurify(text, settings.purification, corrections, removedAds, removedGarbage);

    return {
      originalText: text,
      purifiedText,
      corrections,
      removedAds,
      removedGarbage,
    };
  }

  private localPurify(
    text: string,
    options: { fixTypos: boolean; removeAds: boolean; removeGarbage: boolean },
    corrections: Correction[],
    removedAds: string[],
    removedGarbage: string[]
  ): string {
    let result = text;

    // 删除乱码字符
    if (options.removeGarbage) {
      const garbagePatterns = [
        /锟斤拷+/g,
        /烫烫烫+/g,
        /屯屯屯+/g,
        /�+/g,
        /□+/g,
        /◆◆◆+/g,
        /\?\?\?+/g,
      ];

      for (const pattern of garbagePatterns) {
        result = result.replace(pattern, (match) => {
          removedGarbage.push(match);
          return '';
        });
      }
    }

    // 删除广告内容
    if (options.removeAds) {
      const adPatterns = [
        // 网址广告
        /(?:https?:\/\/)?www\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*/gi,
        // 微信/公众号推广
        /关注[公微][众信][号]?[：:]\s*[a-zA-Z0-9-]+/g,
        /微信公众号[：:]\s*[a-zA-Z0-9-]+/g,
        // QQ群推广
        /QQ群[：:]\s*\d+/g,
        /加群[：:]\s*\d+/g,
        // 小说网站推广
        /本书首发于[^\n]+/g,
        /最新章节请到[^\n]+/g,
        /请记住本站域名[^\n]+/g,
        // APP推广
        /下载[^\n]*APP[^\n]*/gi,
        /扫码阅读[^\n]*/g,
        /扫描二维码[^\n]*/g,
        // 求票求赞（可选删除）
        /求[月票推荐票打赏收藏点赞关注]+[！!。…]+/g,
        /跪求[月票推荐票打赏收藏点赞关注]+/g,
        // 章节内重复标题
        /^第[零一二三四五六七八九十百千万]+[章节回][^\n]+\n第[零一二三四五六七八九十百千万]+[章节回]/gm,
      ];

      for (const pattern of adPatterns) {
        result = result.replace(pattern, (match) => {
          removedAds.push(match.trim());
          return '';
        });
      }
    }

    // 修正常见错别字
    if (options.fixTypos) {
      const typoMap: Record<string, string> = {
        '己经': '已经',
        '末来': '未来',
        '然後': '然后',
        '佈局': '布局',
        '計画': '计划',
        '紀录': '记录',
        '裏面': '里面',
        '这裏': '这里',
        '甚麽': '什么',
        '莪': '我',
        '洅': '在',
        '芣': '不',
        '迩': '你',
        '悳': '的',
      };

      for (const [wrong, correct] of Object.entries(typoMap)) {
        if (typeof correct === 'string' && wrong !== correct) {
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

    // 清理多余空行
    result = result.replace(/\n{3,}/g, '\n\n');

    return result;
  }

  async purifyBook(bookId: string, onProgress?: (progress: number) => void): Promise<PurificationReport> {
    // 这里需要从书籍服务获取章节，简化实现
    const report: PurificationReport = {
      typosFixed: 0,
      adsRemoved: 0,
      garbageRemoved: 0,
      processedAt: new Date(),
    };

    // 实际实现中，这里应该：
    // 1. 获取书籍的所有章节
    // 2. 逐章净化
    // 3. 汇总报告
    // 4. 更新书籍内容

    return report;
  }

  // 检查 QCLAW 服务状态
  async checkServiceStatus(): Promise<{ available: boolean; message: string }> {
    const settings = this.settingsService.getSettings();
    const endpoint = settings.purification.qclawEndpoint;

    try {
      const response = await fetch(`${endpoint}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        return { available: true, message: 'QCLAW 服务可用' };
      }
      return { available: false, message: `服务响应异常: ${response.status}` };
    } catch (error) {
      return { 
        available: false, 
        message: `无法连接到 QCLAW 服务 (${endpoint})，将使用本地净化规则` 
      };
    }
  }
}
