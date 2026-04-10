import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import { getEnv, getBaseUrl } from '../utils/envHelper';

/**
 * 系統層：標準化資料回應格式 (含快取標記)
 */
export interface MarketDataResponse<T> {
  status: 'SUCCESS' | 'MAINTENANCE' | 'ERROR';
  payload: T | null;
  isFallback: boolean;
  lastUpdated?: string;
  message?: string;
}

export interface UnifiedStockData {
  stock_id: string;
  stock_name: string;
  symbol: string;
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

// 快取版本 Key (防止結構變更衝突)
const CACHE_VERSION = 'v1';
const STORAGE_KEYS = {
    FUTURES: `market-cache-futures-${CACHE_VERSION}`,
    STOCKS: `market-cache-stocks-${CACHE_VERSION}`
};

// 系統層：定義期貨行情需要優先過濾顯示的商品代碼
const priorityProducts = ['TX', 'MTX', 'TE', 'TF'];

/**
 * 系統層：具備 LocalStorage 備援機制的非同步請求函式
 */
async function fetchWithCacheFallback<T>(
    url: string, 
    storageKey: string,
    config: AxiosRequestConfig = {}, 
    retries: number = 2
): Promise<MarketDataResponse<T>> {
    const isBrowser = typeof window !== 'undefined';

    const fetchFresh = async () => {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await axios(url, { ...config, timeout: 5000 });
                return response.data;
            } catch (error) {
                if (attempt === retries) throw error;
                await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }
    };

    try {
        const freshData = await fetchFresh();
        
        if (isBrowser) {
            const payload = {
                data: freshData,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem(storageKey, JSON.stringify(payload));
        }

        return {
            status: 'SUCCESS',
            payload: freshData,
            isFallback: false,
            lastUpdated: new Date().toISOString()
        };
    } catch (error: any) {
        console.warn(`[Data Layer] API 請求失敗，嘗試啟動離線備援 (${url}):`, error.message);
        
        if (isBrowser) {
            const cachedStr = localStorage.getItem(storageKey);
            if (cachedStr) {
                try {
                    const cached = JSON.parse(cachedStr);
                    return {
                        status: 'SUCCESS',
                        payload: cached.data,
                        isFallback: true,
                        lastUpdated: cached.timestamp,
                        message: "API 連線失敗，已自動切換至離線快取"
                    };
                } catch (e) {
                    console.error("[Data Layer] 快取解析失敗:", e);
                }
            }
        }

        return {
            status: 'ERROR',
            payload: null,
            isFallback: false,
            message: error.message || "連線與快取皆已失效"
        };
    }
}

/**
 * 資料層：取得全市場股票資料
 * 邏輯修正：確保 Node/Browser 都能取得正確路徑
 */
export const fetchAllStocks = async (): Promise<MarketDataResponse<UnifiedStockData[]>> => {
  const twseBase = getBaseUrl('twse');
  const tpexBase = getBaseUrl('tpex');
  
  // 修正：TWSE 需要 /v1/，TPEX 需要 /openapi/v1/
  const twseEndpoint = `${twseBase}/v1/exchangeReport/STOCK_DAY_ALL?response=open_data`;
  const tpexEndpoint = `${tpexBase}/openapi/v1/tpex_mainboard_quotes`;

  try {
    const twseRes = await fetchWithCacheFallback<any[]>(twseEndpoint, STORAGE_KEYS.STOCKS + '-twse');
    const tpexRes = await fetchWithCacheFallback<any[]>(tpexEndpoint, STORAGE_KEYS.STOCKS + '-tpex');

    const mappedTwse = (twseRes.payload || []).map(item => ({
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
    })).filter(item => !isNaN(item.close) && item.close !== 0);

    const mappedTpex = (tpexRes.payload || []).map(item => ({
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
    })).filter(item => !isNaN(item.close) && item.close !== 0);

    const stocks = [...mappedTwse, ...mappedTpex];
    console.log(`[Data Layer] 取得股票總數: ${stocks.length} (TWSE: ${mappedTwse.length}, OTC: ${mappedTpex.length})`);

    return {
        status: (twseRes.status === 'ERROR' && tpexRes.status === 'ERROR') ? 'ERROR' : 'SUCCESS',
        payload: stocks,
        isFallback: twseRes.isFallback || tpexRes.isFallback,
        lastUpdated: twseRes.lastUpdated || tpexRes.lastUpdated
    };
  } catch (err) {
    return { status: 'ERROR', payload: null, isFallback: false };
  }
};

/**
 * 資料層：取得期貨行情
 */
export const fetchFuturesData = async (): Promise<MarketDataResponse<TAIFEXQuote[]>> => {
  const taifexBase = getBaseUrl('taifex');
  const endpoint = `${taifexBase}/v1/DailyMarketReportFut`;
  
  const response = await fetchWithCacheFallback<any>(endpoint, STORAGE_KEYS.FUTURES, {
      headers: { 'Accept': 'application/json' }
  });

  if (!response.payload) return response;

  try {
      const raw = response.payload;
      if (typeof raw === 'string' && raw.toLowerCase().includes('<!doctype html>')) {
          return { status: 'MAINTENANCE', payload: null, isFallback: false, message: '期交所維護中' };
      }

      let dataArray: any[] = [];
      if (Array.isArray(raw)) {
        dataArray = raw;
      } else if (raw.Data && Array.isArray(raw.Data)) {
        dataArray = raw.Data;
      } else if (raw.data && Array.isArray(raw.data)) {
        dataArray = raw.data;
      }

      const parseNum = (v: any) => {
        const n = parseFloat(String(v || "0").replace(/,/g, ''));
        return isNaN(n) ? 0 : n;
      };

      const mappedData: TAIFEXQuote[] = dataArray.map((q: any) => ({
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

      const uniqueMap = new Map<string, TAIFEXQuote>();
      mappedData
        .filter((item) => priorityProducts.includes(item.ProductCode) && item.ContractMonth.length <= 6)
        .forEach((item) => {
          const key = `${item.ProductCode}-${item.ContractMonth}`;
          if (!uniqueMap.has(key)) uniqueMap.set(key, item);
        });

      return {
        ...response,
        payload: Array.from(uniqueMap.values()).sort((a, b) => {
          if (a.ProductCode !== b.ProductCode) {
            return priorityProducts.indexOf(a.ProductCode) - priorityProducts.indexOf(b.ProductCode);
          }
          return a.ContractMonth.localeCompare(b.ContractMonth);
        })
      };
  } catch (err) {
      return { ...response, status: 'ERROR', message: '解析期貨資料失敗' };
  }
};

export const fetchStockHistory = async (stockId: string): Promise<any[]> => {
    return [];
};
