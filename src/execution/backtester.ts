import type { StockPrice } from "../services/api";

export interface BacktestTrade {
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  qty: number; // 單位：張
  profit: number; // 淨利 (已扣除成本)
  profitPercent: number;
}

const FEE_RATE = 0.001425;
const TAX_RATE = 0.003;

/**
 * 系統層：精準台股交易成本計算 (嚴格套用 Math.floor)
 */
const calculateTradeCost = (price: number, qtyShares: number, isSell: boolean) => {
  const turnover = price * qtyShares;
  const fee = Math.floor(turnover * FEE_RATE);
  const tax = isSell ? Math.floor(turnover * TAX_RATE) : 0;
  
  return {
    turnover,
    fee,
    tax,
    totalCost: turnover + fee,           // 買入時付出的總現金
    netRevenue: turnover - fee - tax      // 賣出時收回的淨現金
  };
};

/**
 * 執行層：純粹的清算引擎 (注入已計算好的訊號，解決耦合與未來資料偏誤)
 * @param data OHLCV 陣列
 * @param signals 預先計算好的訊號陣列，長度需與 data 相同
 * @param initialCapital 初始資金 (預設 100 萬)
 */
export const runBacktest = (
  data: StockPrice[],
  signals: ('BUY' | 'SELL' | 'HOLD')[],
  initialCapital = 1000000
) => {
  let capital = initialCapital;
  let position = 0; // 單位：張
  let entryPrice = 0;
  let entryDate = "";
  const trades: BacktestTrade[] = [];
  const equityCurve: { date: string, value: number }[] = [];

  let maxEquity = initialCapital;
  let minDrawdown = 0;

  // 從 1 開始，確保 T-1 訊號有資料可讀 (消除未來資料偏誤)
  for (let i = 1; i < data.length; i++) {
    const currentPrice = data[i].close;
    // 【關鍵】使用 i-1 的訊號在第 i 天執行交易！
    const action = signals[i - 1]; 

    // 買入邏輯
    if (position === 0 && action === 'BUY') {
      const tempCost = calculateTradeCost(currentPrice, 1000, false);
      // 計算當下資金能買幾張 (無條件捨去)
      position = Math.floor(capital / tempCost.totalCost); 
      
      if (position > 0) {
        const actualTrade = calculateTradeCost(currentPrice, position * 1000, false);
        capital -= actualTrade.totalCost;
        entryPrice = currentPrice;
        entryDate = data[i].date;
      }
    } 
    // 賣出邏輯
    else if (position > 0 && action === 'SELL') {
      const exitTrade = calculateTradeCost(currentPrice, position * 1000, true);
      const entryTrade = calculateTradeCost(entryPrice, position * 1000, false);
      
      capital += exitTrade.netRevenue;
      const profit = exitTrade.netRevenue - entryTrade.totalCost;
      
      trades.push({
        entryDate,
        exitDate: data[i].date,
        entryPrice,
        exitPrice: currentPrice,
        qty: position,
        profit,
        profitPercent: (profit / entryTrade.totalCost) * 100
      });
      position = 0;
    }

    // 每日清算淨值與 MDD
    const currentEquity = capital + (position > 0 ? (position * 1000 * currentPrice) : 0);
    equityCurve.push({ date: data[i].date, value: currentEquity });
    
    if (currentEquity > maxEquity) maxEquity = currentEquity;
    const drawdown = (maxEquity - currentEquity) / maxEquity;
    if (drawdown > minDrawdown) minDrawdown = drawdown;
  }

  return { 
    trades, 
    equityCurve, 
    maxDrawdown: minDrawdown * 100, 
    initialCapital,
    finalCapital: capital 
  };
};
