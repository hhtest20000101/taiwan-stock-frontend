import axios from 'axios';

import type { StockPrice } from './api';

export interface UnifiedStockData {
  stock_id: string;
  stock_name: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  change_percent: number;
  is_futures?: boolean;
}

export interface TAIFEXQuote {
  Date: string;
  ProductCode: string;
  ContractMonth: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Trading_Volume: number;
  Settlement_Price?: number;
}

// 代理服務路徑 (已在 vite.config.ts 設定)
const TWSE_URL = '/api/twse/exchangeReport/STOCK_DAY_ALL?response=open_data';
const TPEX_URL = '/api/tpex/openapi/v1/tpex_mainboard_quotes';
const TAIFEX_URL = '/api/taifex/v1/DailyQuote';

export const fetchAllStocks = async (): Promise<UnifiedStockData[]> => {
  try {
    const [twseRes, tpexRes] = await Promise.all([
      axios.get(TWSE_URL),
      axios.get(TPEX_URL)
    ]);

    const twseData: UnifiedStockData[] = (twseRes.data || []).map((item: Record<string, unknown>) => ({
      stock_id: String(item.Code || ""),
      stock_name: String(item.Name || ""),
      open: parseFloat(item.OpeningPrice || "0"),
      high: parseFloat(item.HighestPrice || "0"),
      low: parseFloat(item.LowestPrice || "0"),
      close: parseFloat(item.ClosingPrice || "0"),
      volume: parseInt(item.TradeVolume || "0"),
      change: parseFloat(item.Change || "0"),
      change_percent: 0 // 需要手動計算或從其他來源取得
    }));

    const tpexData: UnifiedStockData[] = (tpexRes.data || []).map((item: Record<string, unknown>) => ({
      stock_id: String(item.SecId || ""),
      stock_name: String(item.Name || ""),
      open: parseFloat(item.Open || "0"),
      high: parseFloat(item.High || "0"),
      low: parseFloat(item.Low || "0"),
      close: parseFloat(item.Close || "0"),
      volume: parseInt(item.Volume || "0"),
      change: parseFloat(item.Chg || "0"),
      change_percent: parseFloat(item.ChgPct || "0")
    }));

    return [...twseData, ...tpexData];
  } catch (err) {
    console.error("無法取得全市場股票資料:", err);
    return [];
  }
};

export const fetchStockHistory = async (stockId: string): Promise<StockPrice[]> => {
  try {
    // 實際上應根據日期區間請求 API，此處先模擬快取或靜態資料
    // 部分 API 限制僅能取得當日全盤資料，歷史資料通常需要付費或特定路徑
    console.log(`正在請求 ${stockId} 的歷史資料...`);
    return [];
  } catch (err) {
    console.error(`無法取得 ${stockId} 歷史資料:`, err);
    return [];
  }
};

export const fetchFuturesData = async (): Promise<TAIFEXQuote[]> => {
  try {
    const res = await axios.get<unknown>(TAIFEX_URL);
    
    // The API might return an array directly or an object with a data property
    const rawData = res.data as Record<string, unknown>;
    const dataArray = Array.isArray(rawData) ? rawData : (rawData && Array.isArray(rawData.data) ? rawData.data : null);
    
    if (!dataArray) {
      throw new Error("Invalid TAIFEX data format");
    }
 
    // Map common TAIFEX API fields to our interface if they differ (e.g. Contract -> ProductCode)
    return dataArray.map((q: Record<string, unknown>) => ({
      Date: String(q.Date || q.date || ""),
      ProductCode: String(q.ProductCode || q.Contract || q.product_id || ""),
      ContractMonth: String(q.ContractMonth || q['ContractMonth(Week)'] || q.delivery_month || ""),
      Open: parseFloat(q.Open || q.open || "0"),
      High: parseFloat(q.High || q.high || "0"),
      Low: parseFloat(q.Low || q.low || "0"),
      Close: parseFloat(q.Close || q.close || "0"),
      Trading_Volume: parseInt(q.Volume || q.Trading_Volume || "0"),
      Settlement_Price: q.SettlementPrice ? parseFloat(q.SettlementPrice) : undefined
    }));
  } catch (err) {
    console.error("無法取得期貨行情:", err);
    return [];
  }
};
