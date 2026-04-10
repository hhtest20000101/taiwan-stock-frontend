// src/execution/runner.ts
import { runBacktest, type BacktestTrade } from './backtester';
import { generateMACrossoverSignals } from '../strategies/maCrossover';
import type { StockPrice } from '../services/api';

export type { BacktestTrade };

/**
 * 回測結果完整介面 (對應前端需求)
 */
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

/**
 * 抗重力 (Antigravity) 核心調度器
 */
export const executeEngine = (
  data: StockPrice[],
  strategyType: 'golden_cross' | 'rsi',
  params: Record<string, number> = {}
): BacktestResult => {
  const closes = data.map(d => d.close);
  let signals: ('BUY' | 'SELL' | 'HOLD')[] = [];

  // 1. 策略訊號注入
  if (strategyType === 'golden_cross') {
    signals = generateMACrossoverSignals(closes, params.shortTerm || 20, params.longTerm || 60);
  } else {
    // RSI 訊號佔位符
    signals = new Array(closes.length).fill('HOLD'); 
  }

  // 2. 清算引擎執行
  const rawResult = runBacktest(data, signals);

  // 3. 指標彙整 (Metrics Aggregation)
  const totalProfit = rawResult.finalCapital - rawResult.initialCapital;
  const totalReturnPc = (totalProfit / rawResult.initialCapital) * 100;
  
  const wins = rawResult.trades.filter(t => t.profit > 0).length;
  const winRate = rawResult.trades.length > 0 ? (wins / rawResult.trades.length) * 100 : 0;

  return {
    ...rawResult,
    totalProfit,
    totalReturnPc,
    winRate
  };
};
