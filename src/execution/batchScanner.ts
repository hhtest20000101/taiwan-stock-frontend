// src/execution/batchScanner.ts
import { executeEngine } from './runner';
import { fetchAllStocks } from '../services/marketData';
import { getStockHistoricalPrice } from '../services/api';
import { StorageAdapter } from '../utils/storageAdapter';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface ScanResult {
  symbol: string;
  name: string;
  totalReturnPc: number;
  maxDrawdown: number;
  signal: 'BUY' | 'SELL' | 'HOLD';
  score: number;
}

const CACHE_KEY = 'antigravity_scanner_cache';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 小時

interface ScannerCache {
  timestamp: number;
  completedResults: ScanResult[];
  processedSymbols: string[];
}

/**
 * 執行層：全市場批次掃描引擎 (具備中斷續傳與 12 小時快取)
 * 核心邏輯對齊首席架構師規範
 */
export async function runFullMarketScan(
  onProgress: (progress: number, latestResult?: ScanResult, currentLeaderboard?: ScanResult[]) => void
): Promise<ScanResult[]> {
  const stockRes = await fetchAllStocks();
  if (stockRes.status === 'ERROR' || !stockRes.payload) {
    throw new Error("無法取得市場股票清單，掃描終止。");
  }

  const targetStocks = stockRes.payload.slice(0, 100); // 鎖定 Top 100 流動性標的
  
  let results: ScanResult[] = [];
  let processedSymbols = new Set<string>();

  // 1. 讀取與驗證快取
  const cachedDataStr = StorageAdapter.getItem(CACHE_KEY);
  if (cachedDataStr) {
    try {
      const cache: ScannerCache = JSON.parse(cachedDataStr);
      const isExpired = (Date.now() - cache.timestamp) > CACHE_TTL_MS;
      
      if (!isExpired) {
        results = cache.completedResults;
        processedSymbols = new Set(cache.processedSymbols);
        console.log(`[Scanner] 讀取快取成功，已完成 ${processedSymbols.size} 筆，剩餘 ${targetStocks.length - processedSymbols.size} 筆`);
        
        // 如果全部掃描完畢，直接回傳
        if (processedSymbols.size >= targetStocks.length) {
          onProgress(100, undefined, results);
          return results;
        }
      } else {
        console.log('[Scanner] 快取已過期 (超過 12 小時)，重新掃描...');
        StorageAdapter.removeItem(CACHE_KEY);
      }
    } catch (e) {
      console.warn('[Scanner] 快取解析失敗，將重新掃描');
      StorageAdapter.removeItem(CACHE_KEY);
    }
  }

  // 2. 過濾已處理的標的，實作中斷續傳
  const pendingStocks = targetStocks.filter(s => !processedSymbols.has(s.stock_id));
  
  const CHUNK_SIZE = 2; 
  const DELAY_BETWEEN_CHUNKS = 5000; // 5 秒延遲，嚴守 API Rate Limit

  // 3. 分片執行掃描邏輯
  for (let i = 0; i < pendingStocks.length; i += CHUNK_SIZE) {
    const chunk = pendingStocks.slice(i, i + CHUNK_SIZE);
    
    // 使用 Promise.all 同步發送分片請求
    const chunkPromises = chunk.map(async (stock) => {
      try {
        const history = await getStockHistoricalPrice(stock.stock_id, "2025-01-01");
        if (!history || history.length < 60) {
            console.warn(`[Scanner] ${stock.stock_id} 數據樣本不足 (${history?.length || 0})`);
            return null;
        }

        // executeEngine 為同步函數
        const report = executeEngine(history, 'golden_cross');
        
        return {
          symbol: stock.stock_id,
          name: stock.stock_name,
          totalReturnPc: report.totalReturnPc,
          maxDrawdown: report.maxDrawdown,
          signal: report.trades.length > 0 ? (report.totalReturnPc > 5 ? 'BUY' : 'HOLD') : 'HOLD',
          score: report.winRate
        } as ScanResult;
      } catch (error) {
        console.error(`[Scanner] 掃描失敗 [${stock.stock_id}]:`, error);
        return null; // 錯誤處理：單一標的失敗不影響全局
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    const validResults = chunkResults.filter((r): r is ScanResult => r !== null);
    
    results.push(...validResults);
    chunk.forEach(s => processedSymbols.add(s.stock_id));
    
    // 即時排序生成 Leaderboard
    const sortedLeaderboard = [...results].sort((a, b) => b.totalReturnPc - a.totalReturnPc);

    // 4. 寫入斷點續傳 Checkpoint
    StorageAdapter.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      completedResults: results,
      processedSymbols: Array.from(processedSymbols)
    }));

    // 回報進度與最新排行榜
    const currentTotalProcessed = processedSymbols.size;
    const progressPercent = Math.min(100, Math.round((currentTotalProcessed / targetStocks.length) * 100));
    onProgress(progressPercent, validResults[0] || undefined, sortedLeaderboard);

    // 避開最後一次延遲以提升效率
    if (i + CHUNK_SIZE < pendingStocks.length) {
      console.log(`[Scanner] Chunk 完成，等待 ${DELAY_BETWEEN_CHUNKS/1000} 秒避開 API 速率限制...`);
      await sleep(DELAY_BETWEEN_CHUNKS);
    }
  }

  // 最終結果按報酬率降序排列
  return results.sort((a, b) => b.totalReturnPc - a.totalReturnPc);
}
