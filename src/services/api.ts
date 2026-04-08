import axios from "axios"

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

export interface FinMindResponse<T> {
  msg: string
  status: number
  data: T[]
}

// 獲取最近 10 天的歷史數據
export const getStockRecentPrice = async (stockId: string): Promise<StockPrice[]> => {
  const today = new Date();
  const tenDaysAgo = new Date(today);
  tenDaysAgo.setDate(today.getDate() - 10);
  
  const startDate = tenDaysAgo.toISOString().split('T')[0];

  try {
    const response = await axios.get<FinMindResponse<StockPrice>>(FINMIND_API_URL, {
      params: {
        dataset: "TaiwanStockPrice",
        data_id: stockId,
        start_date: startDate,
      },
    })
    
    // 進行欄位轉化與校正，確保 volume 始終可用
    return response.data.data.map(item => ({
      ...item,
      volume: item.Trading_Volume // 將 Trading_Volume 映射到通用 volume
    }))
  } catch (error) {
    console.error(`Failed to fetch stock data for ${stockId}:`, error)
    return []
  }
}

export const getMarketData = async (): Promise<any[]> => {
  // 對於加權指數等大盤數據，FinMind 有專門的 dataset: TaiwanStockPrice (大盤代號通常是 TAIEX)
  return getStockRecentPrice("TAIEX");
}
