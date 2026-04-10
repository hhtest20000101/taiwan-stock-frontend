import type { StockPrice } from "./api";
import { executeEngine } from "../execution/runner";
import type { BacktestResult, BacktestTrade } from "../execution/runner";

export type { BacktestResult, BacktestTrade };

/**
 * 策略回測代理服務 (Strangler Fig Pattern)
 * 維持與 UI (App.tsx) 的舊有接口相容性，內部調用 v2.0 架構引擎
 */
export const runBacktest = (
  data: StockPrice[],
  strategyType: 'golden_cross' | 'rsi',
  params: Record<string, number> = {}
): BacktestResult => {
  // 將呼叫轉發至新的 Antigravity 核心引擎
  return executeEngine(data, strategyType, params);
};
