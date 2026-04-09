import { BaseSkill } from './types';
import type { ExpertReport } from './types';

/**
 * SentimentScout Skill
 * 專精於解析市場非結構化數據 (新聞、論壇、法說會)
 */
export class SentimentScout extends BaseSkill {
  name = "市場情緒專家";
  id = "sentiment-scout";
  description = "監控法人動向、重大新聞與社群討論，量化群眾與法人情緒。";

  // Prompt Atlas 設計：用於精準捕捉市場風向
  static readonly PROMPT_ATLAS = `
    你是一位資深的財經新聞主編與社群數據專家。
    分析傳入的新聞標題或討論摘要：
    1. 法人動向：外資、投信是否出現連續買超或目標價調升。
    2. 利多利空強度：區分「營收成長」與「毛利下降」的相對強度。
    3. 群眾情緒：PTT/Dcard 的討論度與看好程度。
    輸出應包含：情緒得分 (0-100) 與 多空標籤。
  `;

  async analyze(stockId: string): Promise<ExpertReport> {
    // 模擬新聞抓取與情緒分析 (Mock Logic)
    const mockNewsCount = Math.floor(Math.random() * 5) + 1;
    const scores = Array.from({ length: mockNewsCount }, () => Math.random() * 100);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (avgScore > 65) sentiment = 'bullish';
    else if (avgScore < 35) sentiment = 'bearish';

    const mockKeywords = sentiment === 'bullish' ? ['外資連買', '營收創高', '產能滿載'] : 
                         sentiment === 'bearish' ? ['遭砍目標價', '毛利承壓', '庫存調整'] : 
                         ['持平看待', '盤整震盪', '觀望氣氛'];

    return {
      stockId,
      expertName: this.name,
      sentiment,
      confidenceScore: Math.round(avgScore),
      summary: `📰 市場情緒${sentiment === 'bullish' ? '樂觀' : sentiment === 'bearish' ? '悲觀' : '中性'}。熱門關鍵字：${mockKeywords.join('、')}。`,
      fullReport: `
### 市場情緒調查報告 (報告代號: ${stockId})

#### 1. 輿情與新聞監控
在過去 24 小時內，我們掃描到共計 ${mockNewsCount} 則相關具權威性的報導。
主要偵測到「${mockKeywords[0]}」等相關敘事，對股價形成心理支撐。

#### 2. 法人預估
多數大型券商對該股持有「${sentiment === 'bullish' ? '增持 (Overweight)' : sentiment === 'bearish' ? '減持 (Underweight)' : '中立 (Neutral)'}」評等。
外資動向呈現${sentiment === 'bullish' ? '淨流入' : sentiment === 'bearish' ? '連續賣超' : '小幅調節'}，散戶討論熱度則處於${avgScore > 75 ? '過熱' : '溫和'}區間。

#### 3. 風險提示
${sentiment === 'bearish' ? '注意近期新聞可能引發多殺多，建議謹慎。' : '短期內未見重大負面消息，市場情緒偏向正面循環。'}
      `,
      timestamp: new Date().toLocaleTimeString()
    };
  }
}

export const sentimentScout = new SentimentScout();
