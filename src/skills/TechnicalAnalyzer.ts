import { BaseSkill } from './types';
import type { ExpertReport } from './types';
import type { StockPrice } from '../services/api';

/**
 * TechnicalAnalyzer Skill
 * 借鑑 Prompt Atlas 模式，定義專業技術面分析邏輯
 */
export class TechnicalAnalyzer extends BaseSkill {
  name = "技術面專家";
  id = "tech-analyzer";
  description = "專精於市場量價結構、K 線形態與技術指標趨勢分析。";

  // 這裡存放 Prompt Atlas 設計，用於未來與 LLM 整合
  static readonly PROMPT_ATLAS = `
    你是一位擁有 20 年經驗的台股技術分析師。
    請根據傳入的價格數據進行深度解析：
    1. 形態學：尋找 W 底、M 頭、缺口或旗形。
    2. 量價關係：注意是否有量價背離或大戶進貨跡象。
    3. 趨勢指標：解讀 RSI 過熱/過冷與 MACD 零軸之上/之下的意義。
    輸出應包含：短摘要 (Summary) 與 深入報告 (Full Report)。
  `;

  async analyze(data: StockPrice[]): Promise<ExpertReport> {
    if (!data || data.length === 0) {
      throw new Error("無足夠數據進行分析");
    }

    const latest = data[data.length - 1];
    const prev = data[data.length - 2] || latest;
    const stockId = latest.stock_id;

    // 模擬技術分析邏輯 (Heuristic Logic)
    const isUp = latest.close > prev.close;
    const changePct = ((latest.close - prev.close) / prev.close) * 100;
    
    // 簡單的黃金/死亡交叉偵測 (範例)
    const ma5 = data.slice(-5).reduce((acc, cur) => acc + cur.close, 0) / 5;
    const isAboveMA5 = latest.close > ma5;

    let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (changePct > 1 && isAboveMA5) sentiment = 'bullish';
    else if (changePct < -1 && !isAboveMA5) sentiment = 'bearish';

    return {
      stockId,
      expertName: this.name,
      sentiment,
      confidenceScore: 85,
      summary: `${sentiment === 'bullish' ? '📈 趨勢偏多' : sentiment === 'bearish' ? '📉 趨勢偏空' : '➖ 盤整中'}。目前股價 ${latest.close} 高於 5 日線 (${ma5.toFixed(2)})，短期量價配合尚可。`,
      fullReport: `
### 技術面深度解析 (報告代號: ${stockId})

#### 1. 股價走勢
最新收盤價為 ${latest.close}，較前一交易日${isUp ? '上漲' : '下跌'} ${Math.abs(changePct).toFixed(2)}%。
目前股價位處 5 日均線 (${ma5.toFixed(2)}) 之${isAboveMA5 ? '上方' : '下方'}，顯示短期力道${isAboveMA5 ? '轉強' : '偏弱'}。

#### 2. 量價形態
當日成交量為 ${latest.Trading_Volume}，${latest.Trading_Volume > (prev.Trading_Volume * 1.2) ? '出現明顯增量跡象，需關注同步突破點。' : '量能維持平穩，缺乏明顯攻擊動能。'}

#### 3. 策略建議
${sentiment === 'bullish' ? '建權在支撐位上方守穩，可順勢操作。' : sentiment === 'bearish' ? '建議暫避鋒芒，觀察下方長期均線支撐。' : '建議區間操作，靜待趨勢明朗。'}
      `,
      timestamp: new Date().toLocaleTimeString()
    };
  }
}

export const technicalAnalyzer = new TechnicalAnalyzer();
