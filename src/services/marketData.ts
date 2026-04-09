import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import type { StockPrice } from './api';

/**
 * 系統層：定義標準的交易訊號輸出格式 (供後續策略層使用)
 */
export interface TradingSignal {
    action: 'BUY' | 'SELL' | 'HOLD';
    score: number;
    reason: string;
}

/**
 * 系統層：資料回應封裝格式 (支援維護模式偵測)
 */
export interface DataResponse<T> {
  status: 'SUCCESS' | 'MAINTENANCE' | 'ERROR';
  data: T | null;
  message?: string;
}

export interface UnifiedStockData {
  stock_id: string;
  stock_name: string;
  symbol: string; // 標準格式 [Code].TW or [Code].TWO
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  change_percent: number;
  market: 'TWSE' | 'OTC';
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
  PriceChange: string;
  PriceChangePercent: string;
  Trading_Volume: number;
  Volume: number; 
  Settlement_Price?: number;
}

/**
 * 系統層：具備重試機制的高階非同步 API 請求函式
 * @param {string} url - API 路徑
 * @param {AxiosRequestConfig} config - 請求配置
 * @param {number} retries - 最大重試次數 (預設 3)
 */
async function fetchWithRetry<T>(url: string, config: AxiosRequestConfig = {}, retries: number = 3): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios(url, config);
            return response.data;
        } catch (error: unknown) {
            const isLastAttempt = attempt === retries;
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`[Network] API 請求失敗 (${attempt}/${retries}): ${url}`, message);
            
            if (isLastAttempt) {
                throw new Error(`連線失敗已達上限: ${url}. 錯誤: ${message}`);
            }
            // 指數退避: 1s, 2s, 4s...
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
        }
    }
    throw new Error('Unreachable code');
}

/**
 * 資料層：取得全市場股票資料 (含邊界過濾與標準化)
 */
export const fetchAllStocks = async (): Promise<UnifiedStockData[]> => {
  try {
    const twseEndpoint = import.meta.env.VITE_TWSE_API_URL || '/api/twse/v1/exchangeReport/STOCK_DAY_ALL?response=open_data';
    const tpexEndpoint = import.meta.env.VITE_TPEX_API_URL || '/api/tpex/openapi/v1/tpex_mainboard_quotes';

    const [twseRaw, tpexRaw] = await Promise.all([
      fetchWithRetry<Record<string, string>[]>(twseEndpoint),
      fetchWithRetry<Record<string, string>[]>(tpexEndpoint)
    ]);

    const twseData: UnifiedStockData[] = (twseRaw || [])
      .map((item) => ({
        stock_id: String(item.Code || ""),
        stock_name: String(item.Name || ""),
        symbol: `${item.Code}.TW`,
        open: parseFloat(item.OpeningPrice || "0"),
        high: parseFloat(item.HighestPrice || "0"),
        low: parseFloat(item.LowestPrice || "0"),
        close: parseFloat(item.ClosingPrice || "0"),
        volume: parseInt(item.TradeVolume || "0"),
        change: parseFloat(item.Change || "0"),
        change_percent: 0,
        market: 'TWSE' as const
      }))
      // 邊界檢查：過濾無效價格 (NaN 或 null) 與暫停交易標的
      .filter(item => !isNaN(item.close) && item.close !== 0);

    const tpexData: UnifiedStockData[] = (tpexRaw || [])
      .map((item) => ({
        stock_id: String(item.SecId || ""),
        stock_name: String(item.Name || ""),
        symbol: `${item.SecId}.TWO`,
        open: parseFloat(item.Open || "0"),
        high: parseFloat(item.High || "0"),
        low: parseFloat(item.Low || "0"),
        close: parseFloat(item.Close || "0"),
        volume: parseInt(item.Volume || "0"),
        change: parseFloat(item.Chg || "0"),
        change_percent: parseFloat(item.ChgPct || "0"),
        market: 'OTC' as const
      }))
      .filter(item => !isNaN(item.close) && item.close !== 0);

    return [...twseData, ...tpexData];
  } catch (err) {
    console.error("[Data Layer] fetchAllStocks 失敗:", err);
    return [];
  }
};

export const fetchStockHistory = async (stockId: string): Promise<StockPrice[]> => {
  console.log(`正在請求 ${stockId} 的歷史資料...`);
  return [];
};

/**
 * 資料層：取得期貨行情 (含維護狀態攔截與 JSON 解析防護)
 */
export const fetchFuturesData = async (): Promise<DataResponse<TAIFEXQuote[]>> => {
  try {
    const endpoint = import.meta.env.VITE_TAIFEX_API_URL || '/api/taifex/v1/DailyMarketReportFut';
    
    // 強制以 text 解析以檢查是否為 HTML (維護頁面)
    const rawContent = await fetchWithRetry<string>(endpoint, {
        headers: { 'Accept': 'application/json' },
        responseType: 'text'
    });

    // 邊界檢查：攔截 HTML 維護頁面
    if (typeof rawContent === 'string' && rawContent.toLowerCase().includes('<!doctype html>')) {
        throw new Error('MAINTENANCE_MODE: 期交所服務維護中');
    }

    // 安全轉換為 JSON
    const rawData = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
    
    // 相容性處理：解構 Data 屬性
    let dataArray: Record<string, unknown>[] | null = null;
    if (Array.isArray(rawData)) {
      dataArray = rawData as Record<string, unknown>[];
    } else if (rawData && typeof rawData === 'object') {
      const obj = rawData as Record<string, unknown>;
      if (Array.isArray(obj.Data)) {
        dataArray = obj.Data as Record<string, unknown>[];
      } else if (Array.isArray(obj.data)) {
        dataArray = obj.data as Record<string, unknown>[];
      }
    }
    
    if (!dataArray) {
      throw new Error("無效的資料格式 - 找不到資料陣列");
    }

    const priorityProducts = ['TX', 'MTX', 'TE', 'TF'];
    const parseNum = (v: unknown) => {
      const n = parseFloat(String(v || "0").replace(/,/g, ''));
      return isNaN(n) ? 0 : n;
    };

    const mappedData = dataArray.map((q) => ({
      Date: String(q.Date || q.date || ""),
      ProductCode: String(q.Contract || q.ProductCode || q.product_id || "").trim(),
      ContractMonth: String(q['ContractMonth(Week)'] || q.ContractMonth || q.delivery_month || "").trim(),
      Open: parseNum(q.Open || q.open),
      High: parseNum(q.High || q.high),
      Low: parseNum(q.Low || q.low),
      Close: parseNum(q.Last || q.Close || q.close),
      PriceChange: String(q.Change || "0"),
      PriceChangePercent: String(q['%'] || "0"),
      Trading_Volume: parseNum(q.Volume || q.Trading_Volume),
      Volume: parseNum(q.Volume || q.Trading_Volume),
      Settlement_Price: q.SettlementPrice ? parseNum(q.SettlementPrice || "0") : undefined
    }));

    // 過濾熱門商品與短天期合約
    const uniqueMap = new Map<string, TAIFEXQuote>();
    mappedData
      .filter((item) => priorityProducts.includes(item.ProductCode) && item.ContractMonth.length <= 6)
      .forEach((item) => {
        const key = `${item.ProductCode}-${item.ContractMonth}`;
        if (!uniqueMap.has(key)) uniqueMap.set(key, item);
      });

    return {
      status: 'SUCCESS',
      data: Array.from(uniqueMap.values()).sort((a, b) => {
        if (a.ProductCode !== b.ProductCode) {
          return priorityProducts.indexOf(a.ProductCode) - priorityProducts.indexOf(b.ProductCode);
        }
        return a.ContractMonth.localeCompare(b.ContractMonth);
      })
    };

  } catch (err: unknown) {
    const error = err as Error;
    if (error.message.includes('MAINTENANCE_MODE')) {
        console.warn('[Data Layer] 期交所目前暫停服務 (維護中)');
        return { status: 'MAINTENANCE', data: null, message: error.message }; 
    }
    console.error("[Data Layer] fetchFuturesData 失敗:", err);
    return { status: 'ERROR', data: null, message: error.message };
  }
};
