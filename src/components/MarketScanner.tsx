import React, { useReducer, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, TrendingUp, ShieldAlert, CheckCircle2, Loader2 } from 'lucide-react';
import { runFullMarketScan, type ScanResult } from '../execution/batchScanner';
import { Progress } from './ui/progress';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';

// --- State Management ---

interface ScannerState {
  status: 'idle' | 'scanning' | 'paused' | 'completed' | 'error';
  progress: number;
  currentResult?: ScanResult;
  leaderboard: ScanResult[];
  error: string | null;
}

type ScannerAction =
  | { type: 'START_SCAN' }
  | { type: 'UPDATE_PROGRESS'; progress: number; latest?: ScanResult; leaderboard: ScanResult[] }
  | { type: 'FINISH_SCAN'; leaderboard: ScanResult[] }
  | { type: 'ERROR'; message: string }
  | { type: 'RESET' };

const initialState: ScannerState = {
  status: 'idle',
  progress: 0,
  leaderboard: [],
  error: null
};

function scannerReducer(state: ScannerState, action: ScannerAction): ScannerState {
  switch (action.type) {
    case 'START_SCAN':
      return { ...state, status: 'scanning', error: null };
    case 'UPDATE_PROGRESS':
      return {
        ...state,
        progress: action.progress,
        currentResult: action.latest || state.currentResult,
        leaderboard: action.leaderboard
      };
    case 'FINISH_SCAN':
      return { ...state, status: 'completed', progress: 100, leaderboard: action.leaderboard };
    case 'ERROR':
      return { ...state, status: 'error', error: action.message };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// --- Component ---

export const MarketScanner: React.FC = () => {
  const [state, dispatch] = useReducer(scannerReducer, initialState);

  // 12小時快取與斷點續傳：組件掛載時讀取快取狀態
  useEffect(() => {
    const CACHE_KEY = 'antigravity_scanner_cache';
    const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
    
    // 我們直接透過一個「模擬讀取」來同步 UI 狀態，或者直接從 Adapter 讀取
    const cachedDataStr = localStorage.getItem(CACHE_KEY); // 此處直接用 localStorage 是因為組件只在 Browser 跑
    if (cachedDataStr) {
      try {
        const cache = JSON.parse(cachedDataStr);
        const isExpired = (Date.now() - cache.timestamp) > CACHE_TTL_MS;
        
        if (!isExpired && cache.processedSymbols.length > 0) {
          const progress = Math.min(100, Math.round((cache.processedSymbols.length / 100) * 100));
          dispatch({ 
            type: 'UPDATE_PROGRESS', 
            progress, 
            latest: cache.completedResults[cache.completedResults.length - 1],
            leaderboard: cache.completedResults 
          });
          
          if (progress >= 100) {
            dispatch({ type: 'FINISH_SCAN', leaderboard: cache.completedResults });
          }
        }
      } catch (e) {
        console.warn('[Scanner UI] 初始化快取載入失敗');
      }
    }
  }, []);

  const startScan = useCallback(async () => {
    dispatch({ type: 'START_SCAN' });
    try {
      const results = await runFullMarketScan((progress, latest, leaderboard) => {
        dispatch({ 
          type: 'UPDATE_PROGRESS', 
          progress, 
          latest, 
          leaderboard: leaderboard || [] 
        });
      });
      dispatch({ type: 'FINISH_SCAN', leaderboard: results });
    } catch (err: any) {
      dispatch({ type: 'ERROR', message: err.message || '掃描過程發生未知錯誤' });
    }
  }, []);

  const resetScan = () => {
    // 這裡可以選擇是否要清除 StorageAdapter 中的快取
    dispatch({ type: 'RESET' });
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-6 animate-in fade-in duration-500">
      {/* 頂部狀態卡片 */}
      <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-md overflow-hidden">
        <div className={cn(
          "h-1 bg-gradient-to-r transition-all duration-1000",
          state.status === 'scanning' ? "from-blue-500 via-purple-500 to-pink-500" : "from-slate-700 to-slate-700"
        )} style={{ width: `${state.progress}%` }} />
        
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Antigravity V2 全市場掃描器
            </CardTitle>
            <CardDescription className="text-slate-400">
              篩選台股 Top 100 高流動性標的，執行黃金交叉策略回測
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {state.status === 'idle' || state.status === 'completed' || state.status === 'error' ? (
              <Button onClick={startScan} disabled={state.status === 'scanning'} className="bg-blue-600 hover:bg-blue-500 transition-all font-semibold">
                <Play className="mr-2 h-4 w-4" /> 啟動全市場掃描
              </Button>
            ) : (
              <Button disabled className="bg-slate-800 text-slate-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 掃描進行中...
              </Button>
            )}
            <Button variant="outline" size="icon" onClick={resetScan} className="border-slate-800 hover:bg-slate-800">
              <RotateCcw className="h-4 w-4 text-slate-400" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 進度資訊 */}
            <div className="space-y-4">
              <div className="flex justify-between text-sm items-end">
                <span className="text-slate-400 font-medium">掃描進度</span>
                <span className="text-blue-400 font-bold text-lg">{state.progress}%</span>
              </div>
              <Progress value={state.progress} className="h-2 bg-slate-800" />
              
              <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 space-y-2">
                <div className="text-xs text-slate-500 uppercase tracking-wider">最新完成標的</div>
                {state.currentResult ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white">{state.currentResult.name}</div>
                      <div className="text-xs text-slate-400">{state.currentResult.symbol}</div>
                    </div>
                    <Badge variant={state.currentResult.totalReturnPc > 0 ? "default" : "destructive"} className="font-mono">
                      {state.currentResult.totalReturnPc > 0 ? '+' : ''}{state.currentResult.totalReturnPc.toFixed(2)}%
                    </Badge>
                  </div>
                ) : (
                  <div className="text-slate-600 text-sm italic">等待數據中...</div>
                )}
              </div>
            </div>

            {/* 系統日誌 / 狀態 */}
            <div className="col-span-2 rounded-xl border border-slate-800 bg-black/20 p-4 font-mono text-sm overflow-hidden">
               <div className="flex items-center gap-2 mb-2 text-slate-500">
                 <div className={cn("w-2 h-2 rounded-full", state.status === 'scanning' ? "bg-green-500 animate-pulse" : "bg-slate-700")} />
                 <span>引擎狀態日誌</span>
               </div>
               <div className="space-y-1 h-[100px] overflow-y-auto scrollbar-hide">
                 {state.status === 'idle' && <div className="text-slate-600 font-light">&gt; 系統待命，請點擊啟動</div>}
                 {state.status === 'scanning' && <div className="text-blue-400/80">&gt; 正在執行 Rate-Limited 批次請求 (Chunk Size: 2, Delay: 5s)...</div>}
                 {state.leaderboard.length > 0 && <div className="text-green-400/80">&gt; 已成功掃描出 {state.leaderboard.length} 組有效樣本</div>}
                 {state.error && <div className="text-red-400">&gt; ERROR: {state.error}</div>}
                 {state.status === 'completed' && <div className="text-yellow-400">&gt; 掃描完成。已將結果快取至 LocalStorage (12h 有效)。</div>}
               </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 排行榜表格 */}
      <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="text-blue-400 h-5 w-5" />
            <CardTitle>回測績效排行榜</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader className="bg-slate-800/50">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="w-[100px] text-slate-400">排名</TableHead>
                <TableHead className="text-slate-400">標的代號</TableHead>
                <TableHead className="text-slate-400">名稱</TableHead>
                <TableHead className="text-right text-slate-400">總報酬 (%)</TableHead>
                <TableHead className="text-right text-slate-400">最大回撤</TableHead>
                <TableHead className="text-center text-slate-400">訊號建議</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.leaderboard.length > 0 ? (
                state.leaderboard.slice(0, 10).map((res, index) => (
                  <TableRow key={res.symbol} className="border-slate-800 hover:bg-slate-800/40 transition-colors">
                    <TableCell className="font-bold text-slate-500">#{index + 1}</TableCell>
                    <TableCell className="font-medium text-white">{res.symbol}</TableCell>
                    <TableCell className="text-slate-300">{res.name}</TableCell>
                    <TableCell className={cn(
                      "text-right font-mono font-bold",
                      res.totalReturnPc > 0 ? "text-emerald-400" : "text-rose-400"
                    )}>
                      {res.totalReturnPc > 0 ? '+' : ''}{res.totalReturnPc.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right text-slate-400 font-mono">
                      {res.maxDrawdown.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn(
                        "rounded-full px-3",
                        res.signal === 'BUY' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : 
                        res.signal === 'SELL' ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : 
                        "bg-slate-500/10 text-slate-400 border-slate-500/20"
                      )} variant="outline">
                        {res.signal}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-slate-600">
                    目前尚無掃描結果，請執行啟動以獲取數據
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="justify-center border-t border-slate-800 pt-4">
           {state.status === 'completed' && (
             <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
               <CheckCircle2 className="h-4 w-4" />
               掃描完成！Top 10 績效標的已列出。
             </div>
           )}
           {state.status === 'error' && (
             <div className="flex items-center gap-2 text-rose-400 text-sm font-semibold">
               <ShieldAlert className="h-4 w-4" />
               掃描失敗，請檢查 API Token 或網路連線。
             </div>
           )}
        </CardFooter>
      </Card>
    </div>
  );
};
