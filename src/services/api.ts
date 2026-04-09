import axios from "axios"
import axiosRetry from "axios-retry"

// 實作自動重試機制 (Retry Logic)，處理 503 等暫時性伺服器錯誤或網路異常
axiosRetry(axios, {
  retries: 3, // 最多重試 3 次
  retryDelay: (retryCount) => {
    console.log(`[API Retry] Attempt ${retryCount}... Waiting before retrying.`);
    return axiosRetry.exponentialDelay(retryCount); // 使用指數退避延遲
  },
  retryCondition: (error) => {
    // 當發生網路錯誤、超時，或 HTTP 狀態碼為 5xx (如 503 MODEL_CAPACITY_EXHAUSTED) / 429 (Rate Limit) 時重試
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
           (error.response?.status !== undefined && (error.response.status >= 500 || error.response.status === 429));
  }
});

const FINMIND_API_URL = "https://api.finmindtrade.com/api/v4/data"

export interface StockPrice {
  date: string
  stock_id: string
  open: number
  max: number
  min: number
  close: number
  spread: number
  Trading_Volume: number // API v4 實際欄位名
  Trading_money: number  // API v4 成交值欄位
  Trading_turnover: number // 成交筆數
  volume?: number // 保持相容性
}

export interface USStockPrice {
  date: string
  stock_id: string
  Adj_Close: number
  Close: number
  High: number
  Low: number
  Open: number
  Volume: number
}

export interface FinMindResponse<T> {
  msg: string
  status: number
  data: T[]
}

export interface StockInfo {
  stock_id: string
  stock_name: string
  industry_category: string
  type: string
}

// 獲取所有台股基本資訊 (含上市、上櫃)
export const getStockInfo = async (): Promise<StockInfo[]> => {
  try {
    const response = await axios.get<FinMindResponse<StockInfo>>(FINMIND_API_URL, {
      params: {
        dataset: "TaiwanStockInfo",
      },
    })
    return response.data.data
  } catch (error) {
    console.error("Failed to fetch stock info:", error)
    return []
  }
}

// 獲取歷史數據 (動態天數，支援最長 3 年)
export const getStockHistoricalPrice = async (stockId: string, days: number = 10): Promise<StockPrice[]> => {
  const today = new Date();
  const pastDate = new Date(today);
  pastDate.setDate(today.getDate() - days);
  
  const startDate = pastDate.toISOString().split('T')[0];

  try {
    const response = await axios.get<FinMindResponse<StockPrice>>(FINMIND_API_URL, {
      params: {
        dataset: "TaiwanStockPrice",
        data_id: stockId,
        start_date: startDate,
      },
    })
    
    // 欄位標準化適配器 (DataAdapter) - 確保不同數據源「絲滑切換」
    return response.data.data.map(item => normalizeMarketData(item));
  } catch (error) {
    console.error(`Failed to fetch historical stock data for ${stockId}:`, error)
    return []
  }
}

// 數據標準化函數 (DataAdapter)
export const normalizeMarketData = (item: Record<string, unknown>): StockPrice => {
    return {
        date: String(item.date || item.Date || ""),
        stock_id: String(item.stock_id || item.StockId || ""),
        open: Number(item.open || item.Open || 0),
        max: Number(item.max || item.High || item.max || 0),
        min: Number(item.min || item.Low || item.min || 0),
        close: Number(item.close || item.Close || 0),
        spread: Number(item.spread || 0),
        Trading_Volume: Number(item.Trading_Volume || item.Volume || 0),
        Trading_money: Number(item.Trading_money || item.TradeValue || 0),
        Trading_turnover: Number(item.Trading_turnover || item.Transaction || 0),
        volume: Number(item.Trading_Volume || item.Volume || 0)
    };
};

// 保持舊接口相容性 (預設 10 天)
export const getStockRecentPrice = async (stockId: string): Promise<StockPrice[]> => {
  return getStockHistoricalPrice(stockId, 10);
}

export const getMarketData = async (): Promise<StockPrice[]> => {
  // 對於加權指數等大盤數據，FinMind 有專門的 dataset: TaiwanStockPrice (大盤代號通常是 TAIEX)
  return getStockRecentPrice("TAIEX");
}

// 獲取美股歷史數據 (ADR 追蹤)
export const getUSStockPrice = async (stockId: string): Promise<USStockPrice[]> => {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  
  const startDate = thirtyDaysAgo.toISOString().split('T')[0];

  try {
    const response = await axios.get<FinMindResponse<USStockPrice>>(FINMIND_API_URL, {
      params: {
        dataset: "USStockPrice",
        data_id: stockId,
        start_date: startDate,
      },
    })
    return response.data.data
  } catch (error) {
    console.error(`Failed to fetch US stock data for ${stockId}:`, error)
    return []
  }
}
