import type { StockPrice } from "./api";

export interface BacktestTrade {
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  qty: number;
  profit: number;
  profitPercent: number;
}

export interface BacktestResult {
  totalReturnPc: number;
  totalProfit: number;
  winRate: number;
  maxDrawdown: number;
  trades: BacktestTrade[];
  equityCurve: { date: string, value: number }[];
  initialCapital: number;
  finalCapital: number;
}

const INITIAL_CAPITAL = 1000000; // 100 萬台幣
const FEE_RATE = 0.001425;      // 手續費 0.1425%
const TAX_RATE = 0.003;         // 證交稅 0.3%

/**
 * 計算移動平均線 (SMA)
 */
const calculateSMA = (data: number[], period: number): number[] => {
  const sma: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
      continue;
    }
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    sma.push(sum / period);
  }
  return sma;
};

/**
 * 計算 RSI
 */
const calculateRSI = (data: number[], period: number = 14): number[] => {
    const rsi: number[] = [];
    let gains = 0;
    let losses = 0;

    for (let i = 1; i < data.length; i++) {
        const diff = data[i] - data[i - 1];
        if (diff >= 0) gains += diff;
        else losses -= diff;

        if (i < period) {
            rsi.push(NaN);
            continue;
        }

        if (i === period) {
            const avgGain = gains / period;
            const avgLoss = losses / period;
            const rs = avgGain / (avgLoss || 1);
            rsi.push(100 - (100 / (1 + rs)));
        } else {
            // Wilder's Smoothing logic could be added here if needed,
            // but currently using a simple average for RSI calculation.
            const avgGain = (gains / period);
            const avgLoss = (losses / period);
            const rs = avgGain / (avgLoss || 1);
            rsi.push(100 - (100 / (1 + rs)));
        }
    }
    return rsi;
};

/**
 * 策略回測核心引擎
 */
export const runBacktest = (
  data: StockPrice[],
  strategyType: 'golden_cross' | 'rsi',
  params: Record<string, number> = {}
): BacktestResult => {
  const closes = data.map(d => d.close);
  const sma20 = calculateSMA(closes, params.shortTerm || 20);
  const sma60 = calculateSMA(closes, params.longTerm || 60);
  const rsi = calculateRSI(closes, 14);

  let capital = INITIAL_CAPITAL;
  let position = 0; // 持股張數 (1 張 = 1000 股)
  let entryPrice = 0;
  let entryDate = "";
  const trades: BacktestTrade[] = [];
  const equityCurve: { date: string, value: number }[] = [];

  let maxEquity = INITIAL_CAPITAL;
  let minDrawdown = 0;

  for (let i = 1; i < data.length; i++) {
    const currentPrice = data[i].close;
    
    // 買入訊號
    const buySignal = strategyType === 'golden_cross' 
      ? (sma20[i-1] <= sma60[i-1] && sma20[i] > sma60[i]) // 黃金交叉
      : (rsi[i] < 30); // RSI 超賣

    // 賣出訊號
    const sellSignal = strategyType === 'golden_cross'
      ? (sma20[i-1] >= sma60[i-1] && sma20[i] < sma60[i]) // 死亡交叉
      : (rsi[i] > 70); // RSI 超買

    if (position === 0 && buySignal) {
      // 買入: 全部資金買入 (簡單化處理)
      const sharePrice = currentPrice;
      const totalCostPerShare = sharePrice * (1 + FEE_RATE);
      position = Math.floor(capital / (totalCostPerShare * 1000));
      if (position > 0) {
        const totalCost = position * 1000 * totalCostPerShare;
        capital -= totalCost;
        entryPrice = sharePrice;
        entryDate = data[i].date;
      }
    } else if (position > 0 && sellSignal) {
      // 賣出
      const sharePrice = currentPrice;
      const totalRevenuePerShare = sharePrice * (1 - FEE_RATE - TAX_RATE);
      const revenue = position * 1000 * totalRevenuePerShare;
      capital += revenue;
      
      const profit = (sharePrice - entryPrice) * position * 1000 - (entryPrice * position * 1000 * FEE_RATE) - (sharePrice * position * 1000 * (FEE_RATE + TAX_RATE));
      
      trades.push({
        entryDate,
        exitDate: data[i].date,
        entryPrice,
        exitPrice: sharePrice,
        qty: position,
        profit,
        profitPercent: (profit / (entryPrice * position * 1000)) * 100
      });

      position = 0;
    }

    // 計算當前淨值
    const currentEquity = capital + (position * 1000 * currentPrice);
    equityCurve.push({ date: data[i].date, value: currentEquity });

    // 計算 MDD
    if (currentEquity > maxEquity) maxEquity = currentEquity;
    const drawdown = (maxEquity - currentEquity) / maxEquity;
    if (drawdown > minDrawdown) minDrawdown = drawdown;
  }

  const finalCapital = capital + (position * 1000 * closes[closes.length - 1]);
  const totalReturnPc = ((finalCapital / INITIAL_CAPITAL) - 1) * 100;
  const wins = trades.filter(t => t.profit > 0).length;

  return {
    totalReturnPc,
    totalProfit: finalCapital - INITIAL_CAPITAL,
    winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
    maxDrawdown: minDrawdown * 100,
    trades,
    equityCurve,
    initialCapital: INITIAL_CAPITAL,
    finalCapital
  };
};
