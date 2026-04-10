import { useQuery } from '@tanstack/react-query';
import { fetchFuturesData, fetchAllStocks, type MarketDataResponse, type TAIFEXQuote, type UnifiedStockData } from '../services/marketData';

/**
 * 系統層：訂閱期貨行情 (跨組件狀態同步)
 */
export const useFutures = () => {
    return useQuery<MarketDataResponse<TAIFEXQuote[]>>({
        queryKey: ['market', 'futures'],
        queryFn: fetchFuturesData,
        // 定期背景輪詢：每 1 分鐘自動更新行情
        refetchInterval: 60 * 1000, 
    });
};

/**
 * 系統層：訂閱全市場股票資料
 */
export const useAllStocks = () => {
    return useQuery<MarketDataResponse<UnifiedStockData[]>>({
        queryKey: ['market', 'stocks', 'all'],
        queryFn: fetchAllStocks,
        // 全市場資料較龐大，建議 5 分鐘輪詢一次
        refetchInterval: 5 * 60 * 1000, 
    });
};
