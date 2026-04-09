import { BaseSkill } from "./types"
import type { ExpertReport } from "./types"
import type { USStockPrice } from "../services/api"

/**
 * 宏觀連動專家 (Macro Linkage Expert)
 * 負責分析台股與美股 ADR 及其主要板塊的相關性
 */
export class MacroLinkage extends BaseSkill {
  constructor(id: string, name: string) {
    super();
    this.id = id;
    this.name = name;
  }

  private adrMapping: Record<string, { usId: string; ratio: number; proxyId?: string }> = {
    "2330": { usId: "TSM", ratio: 5 },   // 1 TSM = 5 2330
    "2303": { usId: "UMC", ratio: 5 },   // 1 UMC = 5 2303
    "3711": { usId: "ASX", ratio: 2 },   // 1 ASX = 2 3711
    "2412": { usId: "CHT", ratio: 10 },  // 1 CHT = 10 2412
    "8150": { usId: "IMOS", ratio: 1 },  // 1 IMOS = 1 8150
    "2317": { usId: "HNHPF", ratio: 2, proxyId: "AAPL" }, // 鴻海 -> Apple
    "2409": { usId: "AUOTY", ratio: 1, proxyId: "LEDS" }, // 友達 -> Panel Sector 
    "2882": { usId: "CHYYY", ratio: 10, proxyId: "XLF" }, // 國泰金 -> Financial Sector
    "2881": { usId: "FUISY", ratio: 10, proxyId: "XLF" }, // 富邦金 -> Financial Sector
    "2337": { usId: "MXICY", ratio: 10, proxyId: "MU" },  // 旺宏 -> Micron
  };

  private exchangeRate: number = 32.2; // 預設匯率 (可擴充為動態抓取)

  async analyze(data: { stockId: string, usHistory: USStockPrice[], twPrice: number }): Promise<ExpertReport> {
    const { stockId, usHistory, twPrice } = data;
    const mapping = this.adrMapping[stockId];
    const timestamp = new Date().toISOString();
    
    if (!mapping || !usHistory || usHistory.length < 1) {
      // 處理非直接 ADR 標度或 OTC 數據缺失 (板塊分析)
      // 如果本股有 proxyId 或者是已知的權值股
      const proxyMap: Record<string, { name: string, id: string }> = {
        "2454": { name: "輝達 (NVDA)", id: "NVDA" },
        "2317": { name: "蘋果 (AAPL)", id: "AAPL" },
        "2882": { name: "金融板塊 (XLF)", id: "XLF" },
        "2881": { name: "金融板塊 (XLF)", id: "XLF" },
        "2337": { name: "美光 (MU)", id: "MU" },
        "2409": { name: "面板板塊 (LEDS/AUO)", id: "LEDS" }
      };

      const proxyInfo = proxyMap[stockId];
      if (proxyInfo) {
         const benchmark = usHistory[usHistory.length - 1];
         if (!benchmark) {
            return {
              stockId,
              expertName: this.name,
              sentiment: "neutral",
              confidenceScore: 50,
              summary: `目前無法取得連動標的 ${proxyInfo.name} 之即時美股數據。`,
              fullReport: `### 🌐 跨市場追蹤提示\n\n* 數據供應商目前未提供此標的之即時數據。\n* 建議手動關注美股 ${proxyInfo.id} 表現。`,
              timestamp
            };
         }

         const priceChange = ((benchmark.Close - usHistory[usHistory.length - 2]?.Close) / usHistory[usHistory.length - 2]?.Close) * 100;
         const sentiment = priceChange > 0 ? "bullish" : "bearish";
         
         const summary = priceChange > 0 
           ? `【板塊強勁】${proxyInfo.name} 上漲 ${priceChange.toFixed(2)}%，對台股相關個股具正向激勵。`
           : `【板塊修正】${proxyInfo.name} 回檔 ${priceChange.toFixed(2)}%，今日盤面或受壓力。`;

         return {
           stockId,
           expertName: this.name,
           sentiment,
           confidenceScore: 75,
           summary,
           fullReport: `### 🌐 宏觀板塊連動分析\n\n${summary}\n\n* 本股雖無直接高流動性 ADR，但與美股 ${proxyInfo.name} 具備高度正相關。\n* 盤前觀察：美股相關板塊目前情緒為 **${sentiment === 'bullish' ? '樂觀' : '保守'}**。\n\n> [!TIP]\n> 金融股通常連動 XLF 或美債殖利率，電子代工則與 Apple 此類大客戶同步。`,
           timestamp
         };
      }

      return {
        stockId,
        expertName: this.name,
        sentiment: "neutral",
        confidenceScore: 50,
        summary: "此標的無直接美股 ADR 連動數據。",
        fullReport: "目前僅提供台積電 (2330)、聯電 (2303)、日月光 (3711) 之直接 ADR 溢價分析。",
        timestamp
      };
    }

    const lastUs = usHistory[usHistory.length - 1];
    const prevUs = usHistory[usHistory.length - 2] || lastUs;
    
    // 計算換算後的台股對等價： (ADR 價格 * 匯率) / 比例
    const adrEquivalent = (lastUs.Close * this.exchangeRate) / mapping.ratio;
    // 溢價率 = (對等價 - 台股價) / 台股價 * 100
    const premium = ((adrEquivalent - twPrice) / twPrice) * 100;
    
    const usChange = ((lastUs.Close - prevUs.Close) / prevUs.Close) * 100;

    const sentiment = premium > 0.5 ? "bullish" : (premium < -0.5 ? "bearish" : "neutral");
    
    let summary = "";
    if (premium > 1) {
      summary = `【ADR 大幅溢價】美股 ${mapping.usId} 溢價高達 ${premium.toFixed(2)}%，預期台股今日將有強勁跳空波段。`;
    } else if (premium < -1) {
      summary = `【ADR 顯著折價】美股 ${mapping.usId} 折價 ${Math.abs(premium).toFixed(2)}%，開盤需慎防賣壓湧現。`;
    } else {
      summary = `【台美價差平穩】目前溢價僅 ${premium.toFixed(2)}%，美股昨夜漲跌幅為 ${usChange.toFixed(2)}%，預期開盤波動不大。`;
    }

    return {
      stockId,
      expertName: this.name,
      sentiment,
      confidenceScore: 90,
      summary,
      fullReport: `### 🌐 跨市場 ADR 溢價分析\n\n* **美股收盤價**：$${lastUs.Close} (${usChange >= 0 ? '+' : ''}${usChange.toFixed(2)}%)\n* **台美溢價率**：${premium.toFixed(2)}%\n* **匯率基準**：$1 USD = $${this.exchangeRate} TWD\n\n#### 專家診斷：\n${summary}\n\n> [!TIP]\n> 溢價率 (Premium) 是台股權值股開盤的重要風向球。當溢價率超過 1% 時，通常代表國際資金對該產業極度看好。`,
      timestamp
    };
  }
}

export const macroLinkage = new MacroLinkage("macro-linkage-agent", "Macro Linkage Expert");
