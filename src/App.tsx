import { useState, useEffect, useMemo, useCallback } from "react"
import { BarChart3, Search, Bell, User, Loader2, Star, Trash2, FileJson, FileSpreadsheet, Activity, LayoutGrid, List, Globe, RefreshCw } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getStockRecentPrice, getUSStockPrice, getStockHistoricalPrice, type StockPrice, type USStockPrice } from "./services/api"
import { type UnifiedStockData, type TAIFEXQuote } from "./services/marketData"
import { useFutures, useAllStocks } from "./hooks/useMarketData"
import { getWatchlist, addToWatchlist, removeFromWatchlist, type WatchlistEntry } from "./services/db"
import { getInstitutionalData, type InstitutionalSummary } from "./services/institutional"
import { runBacktest, type BacktestResult } from "./services/backtest"
import { exportToExcel, exportToPDF, type ExportData } from "./services/export"
import StockChart from "./components/StockChart"
import { technicalAnalyzer } from "./skills/TechnicalAnalyzer"
import { sentimentScout } from "./skills/SentimentScout"
import { macroLinkage } from "./skills/MacroLinkage"
import type { ExpertReport as BaseReport } from "./skills/types"
import { MarketScanner } from "./components/MarketScanner"

interface CompositeExpertReport {
  tech: BaseReport;
  sentiment: BaseReport;
  macro?: BaseReport;
  institutional?: InstitutionalSummary | null;
}
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"

// --- Types ---
interface MarketIndex {
  name: string
  price: string
  change: string
  percent: string
  trend: 'up' | 'down'
  rawHistory?: StockPrice[]
}

interface UIStock {
  id: string
  name: string
  price: string
  change: string
  percent: string
  volumeLots: string 
  turnoverAmount: string 
  trend: 'up' | 'down'
  rawHistory: StockPrice[]
  marketType?: string // TWSE or OTC
}

const STOCK_NAMES: Record<string, string> = {
  "2330": "台積電",
  "2317": "鴻海",
  "2454": "聯發科",
  "2382": "廣達",
  "TAIEX": "加權指數"
}

const SECTORS = [
  { name: "半導體", icon: "📟", trend: 0.28, up: 10, down: 2 },
  { name: "電腦週邊", icon: "💻", trend: -0.44, up: 3, down: 5 },
  { name: "航運業", icon: "🚢", trend: -1.07, up: 1, down: 5 },
  { name: "金融業", icon: "🏦", trend: 0.10, up: 8, down: 7 },
  { name: "光電業", icon: "🕯️", trend: -0.83, up: 0, down: 5 },
  { name: "電子商務", icon: "🛒", trend: 1.22, up: 5, down: 1 },
  { name: "鋼鐵工業", icon: "🏗️", trend: -0.15, up: 2, down: 4 },
  { name: "生技醫療", icon: "🧬", trend: 0.45, up: 6, down: 2 },
  { name: "觀光事業", icon: "✈️", trend: 0.89, up: 3, down: 1 },
  { name: "汽車工業", icon: "🚗", trend: -0.22, up: 1, down: 3 }
]

export default function App() {
  const { data: futuresRes, isLoading: fLoading, refetch: refetchFutures } = useFutures();
  const { data: stocksRes, isLoading: sLoading, refetch: refetchStocks } = useAllStocks();
  
  const [error, setError] = useState<string | null>(null)
  const [stocks, setStocks] = useState<UIStock[]>([])
  const [marketIndices, setMarketIndices] = useState<MarketIndex[]>([])
  const [selectedStockId, setSelectedStockId] = useState<string>("2330")
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([])
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchTerm, setSearchTerm] = useState('')
  const [expertReports, setExpertReports] = useState<Record<string, CompositeExpertReport>>({})
  const [hoveredStockId, setHoveredStockId] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [allStockDataMap, setAllStockDataMap] = useState<Record<string, UnifiedStockData>>({})
  
  const futures = futuresRes?.payload || [];
  const marketMaintenance = futuresRes?.status === 'MAINTENANCE';
  const isFuturesFallback = futuresRes?.isFallback;
  const loading = fLoading || sLoading;
  
  // Backtest State
  const [sidebarTab, setSidebarTab] = useState<'analysis' | 'backtest'>('analysis')
  const [btDays, setBtDays] = useState(365)
  const [btResult, setBtResult] = useState<BacktestResult | null>(null)
  const [btLoading, setBtLoading] = useState(false)

  useEffect(() => {
    const initWatchlist = async () => {
      const data = await getWatchlist();
      setWatchlist(data);
    };
    initWatchlist();

    const fetchInitialStocks = async () => {
      if (!stocksRes?.payload) return;
      
      const infoMap: Record<string, UnifiedStockData> = {};
      stocksRes.payload.forEach(info => {
        infoMap[info.stock_id] = info;
      });
      setAllStockDataMap(infoMap);

      try {
        const stockIds = ["2330", "2317", "2454", "2382"];
        const results = await Promise.all(stockIds.map(id => getStockRecentPrice(id)));
        
        const formattedStocks = results.map((history, index) => {
          if (!history || history.length < 2) return null;
          const latest = history[history.length - 1];
          const prev = history[history.length - 2];
          const diff = latest.close - prev.close;
          const pct = (diff / prev.close) * 100;
          const id = stockIds[index];
          const official = infoMap[id];
          
          return {
            id: id,
            name: official?.stock_name || STOCK_NAMES[id] || "未知股票",
            price: latest.close.toLocaleString(),
            change: (diff >= 0 ? "+" : "") + diff.toFixed(2),
            percent: (diff >= 0 ? "+" : "") + pct.toFixed(2) + "%",
            volumeLots: Math.floor(latest.Trading_Volume / 1000).toLocaleString(),
            turnoverAmount: (latest.Trading_money / 100000000).toFixed(2),
            trend: diff >= 0 ? 'up' : 'down',
            rawHistory: history,
            marketType: official?.market || "TWSE"
          } as UIStock;
        }).filter((s): s is UIStock => s !== null);

        setStocks(formattedStocks);

        const taiexHistory = await getStockRecentPrice("TAIEX");
        if (taiexHistory && taiexHistory.length >= 2) {
          const latest = taiexHistory[taiexHistory.length - 1];
          const prev = taiexHistory[taiexHistory.length - 2];
          const diff = latest.close - prev.close;
          const pct = (diff / prev.close) * 100;
          
          setMarketIndices([
            { name: "加權指數", price: latest.close.toLocaleString(), change: (diff >= 0 ? "+" : "") + diff.toFixed(2), percent: (diff >= 0 ? "+" : "") + pct.toFixed(2) + "%", trend: diff >= 0 ? 'up' : 'down', rawHistory: taiexHistory },
            { name: "成交金額 (億)", price: (latest.Trading_money / 100000000).toFixed(0), change: "", percent: "", trend: 'up' },
            { name: "更新日期", price: latest.date, change: "", percent: "", trend: 'up' }
          ]);
        }
      } catch (err) {
        console.error("Error fetching detailed market data:", err);
      }
    };

    if (stocksRes?.payload) {
      fetchInitialStocks();
    }
  }, [stocksRes]);

  // 當選擇股票變更或主動點擊分析時執行子代理人分析
  const runExpertAnalysis = useCallback(async (stockId: string) => {
    if (expertReports[stockId]) return; // 避免重複分析
    
    const stock = stocks.find(s => s.id === stockId);
    if (!stock) return;

    setAnalyzing(true);
    try {
      // 判斷是否需要抓取美股數據 (ADR 或板塊連係)
      let usData: USStockPrice[] = [];
      const adrMap: Record<string, string> = { 
        "2330": "TSM", 
        "2303": "UMC", 
        "3711": "ASX", 
        "2412": "CHT",
        "8150": "IMOS",
        "2454": "NVDA",
        "2317": "AAPL",
        "2882": "XLF",
        "2881": "XLF",
        "2337": "MU",
        "2409": "LEDS"
      };
      if (adrMap[stockId]) {
        usData = await getUSStockPrice(adrMap[stockId]);
      }

      const [techReport, sentReport, macroReport, instData] = await Promise.all([
        technicalAnalyzer.analyze(stock.rawHistory),
        sentimentScout.analyze(stockId),
        macroLinkage.analyze({ stockId, usHistory: usData, twPrice: stock.rawHistory[stock.rawHistory.length - 1].close }),
        getInstitutionalData(stockId)
      ]);
      
      setExpertReports(prev => ({
        ...prev,
        [stockId]: { tech: techReport, sentiment: sentReport, macro: macroReport, institutional: instData }
      }));
    } catch (err) {
      console.error("專家分析失敗:", err);
    } finally {
      setAnalyzing(false);
    }
  }, [stocks, expertReports]);

  // 回測執行協調器 (Phase 4)
  const handleRunBacktest = useCallback(async (days: number) => {
    if (!selectedStockId) return;
    setBtLoading(true);
    setBtDays(days);
    setBtResult(null); // 清除舊結果
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split('T')[0];
      const history = await getStockHistoricalPrice(selectedStockId, startDateStr);
      if (history.length > 0) {
        const result = runBacktest(history, 'golden_cross');
        setBtResult(result);
      }
    } catch (err) {
      console.error("回測執行失敗:", err);
    } finally {
      setBtLoading(false);
    }
  }, [selectedStockId]);

  useEffect(() => {
    if (selectedStockId && sidebarTab === 'backtest') {
      handleRunBacktest(btDays);
    }
  }, [selectedStockId, sidebarTab, btDays, handleRunBacktest]);

  useEffect(() => {
    if (selectedStockId && stocks.length > 0) {
      runExpertAnalysis(selectedStockId);
    }
  }, [selectedStockId, stocks, runExpertAnalysis]);

  // 動態搜尋協調器 (Search Coordinator Logic) - 支援 OTC 與名稱搜尋
  useEffect(() => {
    const fetchNewStock = async () => {
      if (!searchTerm) return;
      
      let targetId = '';
      
      // 1. 判斷是否為 4 位數台股代號
      if (/^\d{4}$/.test(searchTerm)) {
        targetId = searchTerm;
      } else {
        // 2. 嘗試從權威資料庫中根據名稱搜尋 ID
        const match = Object.values(allStockDataMap).find((info: UnifiedStockData) => info.stock_name === searchTerm);
        if (match) targetId = match.stock_id;
      }

      if (!targetId) return;

      const isAlreadyLoaded = stocks.some(s => s.id === targetId);
      
      if (!isAlreadyLoaded) {
        try {
          const history = await getStockRecentPrice(targetId);
          if (history && history.length >= 2) {
            const latest = history[history.length - 1];
            const prev = history[history.length - 2];
            const diff = latest.close - prev.close;
            const pct = (diff / prev.close) * 100;
            
            const officialData = allStockDataMap[targetId];
            const newStock: UIStock = {
              id: targetId,
              name: officialData?.stock_name || STOCK_NAMES[targetId] || `個股 ${targetId}`,
              price: latest.close.toLocaleString(),
              change: (diff >= 0 ? "+" : "") + diff.toFixed(2),
              percent: (diff >= 0 ? "+" : "") + pct.toFixed(2) + "%",
              volumeLots: Math.floor(latest.Trading_Volume / 1000).toLocaleString(),
              turnoverAmount: (latest.Trading_money / 100000000).toFixed(2),
              trend: diff >= 0 ? 'up' : 'down',
              rawHistory: history,
              marketType: officialData?.market || "TWSE"
            };

            setStocks(prevStocks => [...prevStocks, newStock]);
          }
        } catch (err) {
          console.error("動態抓取失敗:", err);
        }
      }
    };

    const timer = setTimeout(fetchNewStock, 600);
    return () => clearTimeout(timer);
  }, [searchTerm, stocks, allStockDataMap]);

  const sentiment = useMemo(() => {
    const up = stocks.filter(s => s.trend === 'up').length + 1
    const down = stocks.filter(s => s.trend === 'down').length
    return { up, down, unchanged: 0, total: up + down }
  }, [stocks])

  const handleToggleWatchlist = async (id: string, name: string) => {
    const isPresent = watchlist.some(item => item.id === id)
    if (isPresent) {
      await removeFromWatchlist(id)
    } else {
      await addToWatchlist({ id, name })
    }
    const updated = await getWatchlist()
    setWatchlist(updated)
  }

  const handleExport = (type: 'pdf' | 'excel') => {
    const exportData: ExportData[] = watchlist.map(item => {
      const liveData = stocks.find(s => s.id === item.id)
      return {
        id: item.id,
        name: item.name,
        price: liveData?.price || 'N/A',
        change: liveData?.change || '0.00',
        percent: liveData?.percent || '0.00%',
        volume: liveData?.volumeLots || '0',
        amount: liveData?.turnoverAmount || '0'
      }
    })
    if (exportData.length === 0) return alert("清單為空")
    if (type === 'pdf') {
      exportToPDF(exportData)
    } else {
      exportToExcel(exportData)
    }
  }

  const selectedData = useMemo(() => {
    if (selectedStockId === "TAIEX") {
      const taiex = marketIndices.find(m => m.name === "加權指數")
      return taiex ? { name: "加權指數", rawHistory: taiex.rawHistory } : null
    }
    const stock = stocks.find(s => s.id === selectedStockId)
    return stock ? { name: stock.name, rawHistory: stock.rawHistory } : null
  }, [selectedStockId, stocks, marketIndices])

  const filteredStocks = useMemo(() => {
    if (!searchTerm) return stocks;
    
    const term = searchTerm.toLowerCase();
    
    // 語義化搜尋 (Phase 3): 關鍵字過濾
    if (term.includes("大漲") || term.includes("強勢")) {
      return stocks.filter(s => parseFloat(s.percent) > 3).sort((a,b) => parseFloat(b.percent) - parseFloat(a.percent));
    }
    if (term.includes("爆量") || term.includes("量大")) {
      return stocks.filter(s => parseFloat(s.volumeLots.replace(/,/g, '')) > 5000).sort((a,b) => parseFloat(b.volumeLots.replace(/,/g, '')) - parseFloat(a.volumeLots.replace(/,/g, '')));
    }
    if (term.includes("高價")) {
      return stocks.filter(s => parseFloat(s.price.replace(/,/g, '')) > 500).sort((a,b) => parseFloat(b.price.replace(/,/g, '')) - parseFloat(a.price.replace(/,/g, '')));
    }
    
    return stocks.filter(stock => 
      stock.id.toLowerCase().includes(term) || 
      stock.name.toLowerCase().includes(term)
    )
  }, [stocks, searchTerm])

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-primary/10">
      {/* Header */}
      <header className="border-b sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-xl shadow-md shadow-primary/20">
              <BarChart3 className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-black tracking-tighter text-slate-900 leading-none">TAIWAN STOCK<br/><span className="text-primary text-[10px] tracking-[0.2em] font-bold">SCREENER PRO</span></span>
            
            {/* Market Pulse (Futures) */}
            <div className="hidden lg:flex items-center gap-6 ml-8 pl-8 border-l border-slate-100">
              {isFuturesFallback && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 rounded-lg border border-amber-100 animate-in fade-in slide-in-from-left-4 duration-500">
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-tighter">離線快取模式</span>
                </div>
              )}
              {futures.length > 0 ? futures.slice(0, 2).map((f) => {
                const isPositive = parseFloat(f.PriceChange) >= 0;
                const productName = f.ProductCode === 'TX' ? '台指期' : f.ProductCode === 'MTX' ? '小台指' : f.ProductCode;
                return (
                  <div key={`${f.ProductCode}-${f.ContractMonth}`} className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{productName} {f.ContractMonth.trim()}</span>
                      <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono text-slate-400 border-slate-100">
                        Vol: {f.Volume}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold font-mono tracking-tight">{f.Close}</span>
                      <span className={`text-[10px] font-bold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {isPositive ? '▲' : '▼'}{Math.abs(parseFloat(f.PriceChange))} ({f.PriceChangePercent}%)
                      </span>
                    </div>
                  </div>
                )
              }) : !loading && (
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic opacity-50">行情連線中...</span>
              )}
            </div>
          </div>
          <div className="flex-1 max-w-md mx-8 hidden lg:block">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="搜尋台股代號或名稱..." 
                className="pl-10 pr-10 h-10 bg-slate-100/50 border-transparent focus-visible:ring-primary/30 focus-visible:bg-white transition-all rounded-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
             <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary"><Bell className="w-5 h-5"/></Button>
             <div className="h-6 w-[1.5px] bg-slate-200"></div>
             <div className="flex items-center gap-2 cursor-pointer group">
               <div className="w-9 h-9 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center group-hover:border-primary/20 transition-all">
                 <User className="w-5 h-5 text-slate-600" />
               </div>
               <span className="text-sm font-bold text-slate-700 hidden sm:inline">Guest User</span>
             </div>
          </div>
        </div>
      </header>

      {/* Market Sentiment Bar */}
      <div className="bg-slate-900 text-white py-3 overflow-hidden border-y border-slate-800">
         <div className="max-w-[1600px] mx-auto px-6 flex items-center justify-between whitespace-nowrap overflow-x-auto no-scrollbar">
           <div className="flex items-center gap-8">
             <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-r border-slate-700 pr-8">
               <Activity className="w-4 h-4 text-primary animate-pulse" />
               Live Market
             </div>
             <div className="flex gap-10 text-xs font-black font-mono">
               <span className="flex items-center gap-2.5">
                 <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-soft"></span> 
                 <span className="text-slate-400">UP:</span> 
                 <span className="text-red-400 text-sm tracking-tighter">{sentiment.up}</span>
               </span>
               <span className="flex items-center gap-2.5">
                 <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-soft"></span> 
                 <span className="text-slate-400">DOWN:</span> 
                 <span className="text-emerald-400 text-sm tracking-tighter">{sentiment.down}</span>
               </span>
               <span className="flex items-center gap-2.5 text-slate-400">
                 <span className="w-2 h-2 rounded-full bg-slate-600"></span> 
                 <span>FLAT:</span> 
                 <span className="text-sm tracking-tighter">{sentiment.unchanged}</span>
               </span>
                {marketMaintenance && (
                  <Badge variant="destructive" className="animate-pulse ml-4 border-white/20 bg-rose-500/20 text-rose-400 h-6">
                    期交所維護中 (MAINTENANCE)
                  </Badge>
                )}
             </div>
           </div>
           
           <div className="flex items-center gap-6">
              <div className="h-4 w-[1px] bg-slate-700 hidden sm:block"></div>
              <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-primary rounded-full"></span> ENGINE V4.2</span>
                <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">STABLE CONNECTION</span>
              </div>
           </div>
         </div>
      </div>

      <main className="max-w-[1600px] mx-auto px-6 py-10 space-y-12">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 space-y-8 animate-in fade-in duration-1000">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-primary/10 border-t-primary animate-spin"></div>
              <BarChart3 className="w-10 h-10 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="text-center space-y-2">
               <h2 className="text-2xl font-black tracking-tight text-slate-900">同步全市場交易數據</h2>
               <p className="text-slate-400 font-medium max-w-sm">正在從 FinMind Cloud 獲取最新的台股即時行情與盤後數據...</p>
            </div>
          </div>
        ) : error ? (
           <div className="flex flex-col items-center justify-center py-40 space-y-4 animate-in fade-in duration-500">
             <div className="text-rose-500 bg-rose-50 p-6 rounded-full mb-4 shadow-inner">
               <Globe className="w-12 h-12" />
             </div>
             <h2 className="text-2xl font-black text-slate-900">連線異常 (Connection Error)</h2>
             <p className="text-slate-500 font-medium max-w-md text-center">{error}</p>
             <Button className="mt-8 bg-slate-900 text-white rounded-full px-8 hover:bg-slate-800" onClick={() => window.location.reload()}>重新嘗試加載 (Retry)</Button>
           </div>
        ) : (
          <>
            {/* Top Market Indices */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {marketIndices.map((item) => (
                <Card 
                  key={item.name} 
                  className={`border-none shadow-sm hover:shadow-xl transition-all duration-500 cursor-pointer overflow-hidden group ${selectedStockId === "TAIEX" && item.name === "加權指數" ? "ring-2 ring-primary bg-primary/[0.02]" : "bg-white"}`}
                  onClick={() => item.name === "加權指數" && setSelectedStockId("TAIEX")}
                >
                  <CardContent className="p-8">
                    <div className="flex flex-col gap-6">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{item.name}</p>
                          <h3 className="text-4xl font-black tracking-tighter text-slate-900 group-hover:text-primary transition-colors">{item.price}</h3>
                        </div>
                        {item.percent && (
                          <div className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-black font-mono text-sm shadow-sm ${item.trend === 'up' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                            {item.trend === 'up' ? '▲' : '▼'} {item.percent}
                          </div>
                        )}
                      </div>
                      <div className={`text-base font-bold flex items-center gap-2 ${item.trend === 'up' ? 'text-red-500' : 'text-emerald-500'}`}>
                        {item.change} {item.change && (item.trend === 'up' ? '↗' : '↘')}
                        <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden">
                           <div className={`h-full rounded-full ${item.trend === 'up' ? 'bg-red-500' : 'bg-emerald-500'}`} style={{width: '60%'}}></div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Industry Heatmap Section */}
            <section className="space-y-6">
               <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black flex items-center gap-3 text-slate-900">
                      產業趨勢熱力圖
                      <Badge variant="outline" className="text-slate-400 border-slate-200 font-mono px-2 py-0">37 SECTORS</Badge>
                    </h2>
                    <p className="text-sm text-slate-400 font-bold">當日跌漲幅最強勢板塊概覽</p>
                  </div>
                  <div className="flex bg-white shadow-sm border border-slate-200 rounded-2xl p-1.5 gap-1.5">
                     <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('grid')} className="h-9 px-4 rounded-xl font-bold"><LayoutGrid className="w-4 h-4 mr-2"/>卡片</Button>
                     <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className="h-9 px-4 rounded-xl font-bold"><List className="w-4 h-4 mr-2"/>列表</Button>
                  </div>
               </div>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                  {SECTORS.map((sector) => (
                    <Card key={sector.name} className="border border-slate-100 card-hover bg-white overflow-hidden shadow-sm">
                       <CardContent className="p-6">
                          <div className="flex justify-between items-center mb-6">
                             <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-2xl shadow-inner">{sector.icon}</div>
                             <span className={`text-xl font-black tracking-tight ${sector.trend >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                               {sector.trend >= 0 ? '+' : ''}{sector.trend}%
                             </span>
                          </div>
                          <div className="space-y-3">
                             <h4 className="font-black text-slate-800 text-base">{sector.name}</h4>
                             <div className="flex items-center justify-between text-[11px] font-black">
                                <span className="flex items-center gap-1.5 text-red-500 bg-red-50 px-2 py-0.5 rounded-full">{sector.up} UP</span>
                                <span className="flex items-center gap-1.5 text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">{sector.down} DOWN</span>
                             </div>
                          </div>
                       </CardContent>
                    </Card>
                  ))}
               </div>
            </section>

            {/* Antigravity Ultimate Scanner Section */}
            <section className="space-y-6">
              <MarketScanner />
            </section>

            {/* Analysis & Watchlist Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Chart Area - Span 8 columns */}
                <Card className="lg:col-span-8 border-none shadow-xl bg-white rounded-3xl overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between p-8 border-b border-slate-50">
                        <div className="space-y-1">
                          <CardTitle className="text-2xl font-black text-slate-900">{selectedData?.name || "加權指數"} 分析圖</CardTitle>
                          <CardDescription className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Real-time Interactive D3 Chart</CardDescription>
                        </div>
                        <div className="flex gap-2">
                           <Badge className="bg-slate-900 text-white px-3 py-1 font-mono">1D</Badge>
                           <Badge variant="outline" className="text-slate-400 px-3 py-1 font-mono">5D</Badge>
                           <Badge variant="outline" className="text-slate-400 px-3 py-1 font-mono">1M</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8">
                        {selectedData ? (
                          <div className="p-2 rounded-2xl bg-[#fafafa]">
                            <StockChart data={selectedData.rawHistory} stockName={selectedData.name} />
                          </div>
                        ) : (
                          <div className="h-[400px] flex items-center justify-center text-slate-300 italic font-bold">正在讀取圖表數據...</div>
                        )}
                    </CardContent>
                </Card>

                {/* Watchlist - Span 4 columns */}
                <Card className="lg:col-span-4 border-none shadow-xl bg-white rounded-3xl overflow-hidden h-fit">
                    <CardHeader className="flex flex-row items-center justify-between p-8 border-b border-slate-50">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-3 text-slate-900 font-black">
                            <Star className="w-6 h-6 fill-primary text-primary" />
                            我的收藏
                          </CardTitle>
                          <CardDescription className="font-bold text-slate-400">WATCHLIST</CardDescription>
                        </div>
                        <div className="flex gap-2">
                           <Button variant="ghost" size="icon" className="h-10 w-10 bg-slate-50 hover:bg-red-50 text-red-500 rounded-xl" onClick={() => handleExport('pdf')} title="PDF">
                             <FileJson className="w-5 h-5" />
                           </Button>
                           <Button variant="ghost" size="icon" className="h-10 w-10 bg-slate-50 hover:bg-emerald-50 text-emerald-600 rounded-xl" onClick={() => handleExport('excel')} title="Excel">
                             <FileSpreadsheet className="w-5 h-5" />
                           </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">
                        {watchlist.length > 0 ? watchlist.map(item => (
                          <div key={item.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 group hover:bg-primary/[0.03] transition-all border border-transparent hover:border-primary/10">
                            <div className="flex flex-col cursor-pointer flex-1" onClick={() => setSelectedStockId(item.id)}>
                              <span className="text-[10px] font-black text-slate-400 font-mono tracking-widest uppercase">{item.id}</span>
                              <span className="font-black text-slate-800 text-lg tracking-tight group-hover:text-primary transition-colors">{item.name}</span>
                            </div>
                            <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-200 hover:text-red-500 hover:bg-red-50 transition-colors rounded-xl" onClick={async () => { await removeFromWatchlist(item.id); const updated = await getWatchlist(); setWatchlist(updated); }}>
                              <Trash2 className="w-5 h-5" />
                            </Button>
                          </div>
                        )) : (
                          <div className="py-20 px-8 text-center rounded-3xl border-4 border-dotted border-slate-100 bg-slate-50/50">
                            <Star className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                            <p className="text-sm font-black text-slate-300 uppercase tracking-widest leading-loose">尚未加入收藏標的</p>
                            <p className="text-[10px] text-slate-400 mt-2">點擊下方列表星號開始追蹤</p>
                          </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* List Table Section */}
            <section className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black tracking-tighter text-slate-900 border-l-[6px] border-primary pl-4">即時市況掃描</h2>
                  <p className="text-sm text-slate-400 font-bold ml-5 uppercase tracking-widest">Live Market Scanner</p>
                </div>
              </div>

              <Card className="border border-slate-100 shadow-2xl overflow-hidden rounded-[2.5rem] bg-white">
                <CardContent className="p-0 overflow-x-auto">
                    <Table className="w-full">
                      <TableHeader>
                        <TableRow className="hover:bg-transparent bg-slate-50/50 border-b border-slate-100 h-16">
                          <TableHead className="w-[100px] text-center text-slate-400 uppercase text-[10px] font-black tracking-widest pl-10">追蹤</TableHead>
                          <TableHead className="w-[120px] text-slate-400 uppercase text-[10px] font-black tracking-widest">代號</TableHead>
                          <TableHead className="w-[100px] text-slate-400 uppercase text-[10px] font-black tracking-widest">市場</TableHead>
                          <TableHead className="text-slate-400 uppercase text-[10px] font-black tracking-widest">公司</TableHead>
                          <TableHead className="text-right text-slate-400 uppercase text-[10px] font-black tracking-widest">成交價</TableHead>
                          <TableHead className="text-right text-slate-400 uppercase text-[10px] font-black tracking-widest">漲跌</TableHead>
                          <TableHead className="text-right text-slate-400 uppercase text-[10px] font-black tracking-widest">幅度</TableHead>
                          <TableHead className="text-right text-slate-400 uppercase text-[10px] font-black tracking-widest">成交張數</TableHead>
                          <TableHead className="text-right text-slate-400 uppercase text-[10px] font-black tracking-widest">成交值 (億)</TableHead>
                          <TableHead className="text-right text-slate-400 uppercase text-[10px] font-black tracking-widest pr-10">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStocks.length > 0 ? filteredStocks.map((stock) => (
                          <TableRow 
                            key={stock.id}
                            className={`group transition-all duration-300 border-b border-slate-50 cursor-pointer h-20 ${selectedStockId === stock.id ? 'bg-primary/[0.03]' : 'hover:bg-slate-50/80'}`}
                            onClick={() => {
                              setSelectedStockId(stock.id);
                              setIsSidebarOpen(true);
                            }}
                            onMouseEnter={() => {
                              setHoveredStockId(stock.id);
                              runExpertAnalysis(stock.id);
                            }}
                            onMouseLeave={() => setHoveredStockId(null)}
                          >
                            <TableCell className="text-center pl-10" onClick={(e) => e.stopPropagation()}>
                               <Button 
                                 variant="ghost" 
                                 size="icon" 
                                 className="h-10 w-10 hover:bg-slate-100 rounded-xl transition-all"
                                 onClick={() => handleToggleWatchlist(stock.id, stock.name)}
                               >
                                 <Star className={`w-6 h-6 transition-all ${watchlist.some(w => w.id === stock.id) ? 'fill-primary text-primary scale-125 drop-shadow-sm' : 'text-slate-200'}`} />
                               </Button>
                            </TableCell>
                            <TableCell className="font-mono font-black text-slate-400 text-sm">{stock.id}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`font-black text-[10px] px-2 py-0 h-5 rounded-md border-2 ${stock.marketType === 'OTC' ? 'border-amber-200 text-amber-600 bg-amber-50' : 'border-blue-200 text-blue-600 bg-blue-50'}`}>
                                {stock.marketType === 'OTC' ? '上櫃' : '上市'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-black text-slate-900 text-lg tracking-tight">{stock.name}</TableCell>
                            <TableCell className="text-right font-mono font-black text-2xl text-slate-900 tracking-tighter tabular-nums">{stock.price}</TableCell>
                            <TableCell className={`text-right font-black text-lg ${stock.trend === 'up' ? 'text-red-500' : 'text-emerald-500'}`}>
                              {stock.change}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={`inline-block px-3 py-1 rounded-lg font-black text-sm shadow-sm ${stock.trend === 'up' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                {stock.trend === 'up' ? '+' : ''}{stock.percent}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-slate-600 tabular-nums">
                              {stock.volumeLots}
                            </TableCell>
                            <TableCell className="text-right font-mono font-black text-xl text-slate-900 tabular-nums">
                              <span className="text-[10px] text-slate-400 mr-1">$</span>{stock.turnoverAmount}
                            </TableCell>
                            <TableCell className="text-right pr-10" onClick={(e) => e.stopPropagation()}>
                               <Button 
                                variant="outline" 
                                size="sm" 
                                className="rounded-xl font-bold h-9 hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm" 
                                onClick={() => {
                                  setSelectedStockId(stock.id);
                                  setIsSidebarOpen(true);
                                }}
                               >
                                 專家分析
                               </Button>
                            </TableCell>
                          </TableRow>
                        )) : loading ? (
                          <TableRow>
                            <TableCell colSpan={10} className="text-center py-40">
                              <div className="flex flex-col items-center justify-center space-y-4">
                                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                                <p className="text-sm font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">正在擷取市場即時數據...</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          <TableRow>
                            <TableCell colSpan={10} className="text-center py-32">
                              <div className="max-w-md mx-auto p-10 rounded-[3rem] border-4 border-dotted border-slate-100 bg-slate-50/30 flex flex-col items-center space-y-6">
                                <div className="w-20 h-20 bg-white shadow-xl rounded-3xl flex items-center justify-center text-slate-200">
                                  <Activity className="w-10 h-10" />
                                </div>
                                <div className="space-y-2 text-center">
                                  <h3 className="text-2xl font-black text-slate-900 tracking-tighter">目前無法取得市場資料</h3>
                                  <p className="text-sm font-bold text-slate-400 leading-relaxed uppercase tracking-wide">
                                    {stocksRes?.isFallback 
                                      ? "API 伺服器連線異常，且本機尚未建立離線快取資料。" 
                                      : "所有上游數據源目前皆無法連線，請檢查您的網路狀態。"}
                                  </p>
                                </div>
                                <Button 
                                  onClick={() => { refetchStocks(); refetchFutures(); }}
                                  className="h-14 px-8 rounded-2xl bg-slate-900 hover:bg-primary text-white font-black transition-all shadow-2xl hover:scale-105 active:scale-95 flex gap-3"
                                >
                                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                                  立即重新嘗試連線
                                </Button>
                                <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Attempting direct local recovery via local-cache protocol</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </main>

      <footer className="mt-40 py-24 border-t bg-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/20 to-transparent"></div>
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex flex-col lg:flex-row justify-between items-center gap-16">
            <div className="flex flex-col items-center lg:items-start gap-6">
               <div className="flex items-center gap-3">
                 <div className="bg-slate-900 p-2 rounded-xl"><BarChart3 className="text-white w-5 h-5" /></div>
                 <span className="font-black tracking-tighter text-slate-900 text-xl">Taiwan Stock Screener Pro</span>
               </div>
               <p className="text-sm text-slate-400 max-w-sm text-center lg:text-left font-medium leading-relaxed uppercase tracking-wider">
                 Modern Enterprise-Grade Stock Analysis Dashboard Platform. Empowering retail investors with high-density data visualization.
               </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-16">
               <div className="flex flex-col gap-4">
                  <span className="text-xs font-black uppercase text-slate-900 tracking-[0.2em]">Service</span>
                  <a href="#" className="text-sm text-slate-400 font-bold hover:text-primary transition-colors">Market Map</a>
                  <a href="#" className="text-sm text-slate-400 font-bold hover:text-primary transition-colors">Sector Insight</a>
               </div>
               <div className="flex flex-col gap-4">
                  <span className="text-xs font-black uppercase text-slate-900 tracking-[0.2em]">Data Source</span>
                  <a href="#" className="text-sm text-slate-400 font-bold hover:text-primary transition-colors">FinMind Cloud</a>
                  <a href="#" className="text-sm text-slate-400 font-bold hover:text-primary transition-colors">Open Data TW</a>
               </div>
               <div className="flex flex-col gap-4">
                  <span className="text-xs font-black uppercase text-slate-900 tracking-[0.2em]">Legal</span>
                  <a href="#" className="text-sm text-slate-400 font-bold hover:text-primary transition-colors">Privacy Policy</a>
                  <a href="#" className="text-sm text-slate-400 font-bold hover:text-primary transition-colors">Terms of Use</a>
               </div>
            </div>
          </div>
          <div className="mt-24 pt-10 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-[10px] text-slate-300 font-black uppercase tracking-[0.3em]">
              © 2026 StockScreener Architecture | AGENTIC SYSTEM v1.3.2
            </div>
            <div className="flex gap-4">
               <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
               <div className="w-2 h-2 rounded-full bg-red-500"></div>
               <div className="w-2 h-2 rounded-full bg-primary"></div>
            </div>
          </div>
        </div>
      </footer>

      {/* Right Sidebar - Expert Insights Panel */}
      <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <SheetContent className="sm:max-w-md border-l border-slate-100 bg-white shadow-2xl p-0">
          <SheetHeader className="p-8 border-b border-slate-50 bg-slate-50/50">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex bg-slate-200/50 p-1 rounded-xl">
                 <button 
                  onClick={() => setSidebarTab('analysis')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${sidebarTab === 'analysis' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   專家診斷
                 </button>
                 <button 
                  onClick={() => setSidebarTab('backtest')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${sidebarTab === 'backtest' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   策略回測
                 </button>
              </div>
              <div className="h-4 w-[1px] bg-slate-300"></div>
              {sidebarTab === 'analysis' && (
                <div className="flex items-center gap-2">
                  {expertReports[selectedStockId]?.tech.sentiment === 'bullish' ? (
                    <Badge className="bg-red-500 text-white font-black">多頭走勢</Badge>
                  ) : expertReports[selectedStockId]?.tech.sentiment === 'bearish' ? (
                    <Badge className="bg-emerald-500 text-white font-black">空頭走勢</Badge>
                  ) : (
                    <Badge className="bg-slate-400 text-white font-black">觀望中立</Badge>
                  )}
                </div>
              )}
            </div>
            <SheetTitle className="text-3xl font-black text-slate-900 tracking-tighter">
              {stocks.find(s => s.id === selectedStockId)?.name || allStockDataMap[selectedStockId]?.stock_name || selectedStockId} 
              {sidebarTab === 'analysis' ? " 專家診斷室" : " 策略回測中心"}
            </SheetTitle>
            <SheetDescription className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">
              {sidebarTab === 'analysis' ? "Multi-Expert System Analysis Report" : "Historical Strategy Simulation Engine"}
            </SheetDescription>
          </SheetHeader>
          
          <ScrollArea className="h-[calc(100vh-180px)] p-8">
            {sidebarTab === 'analysis' ? (
              analyzing ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest">專家群正進行深度模擬中...</p>
                </div>
              ) : expertReports[selectedStockId] ? (
                <div className="space-y-10">
                  {/* ... Existing analysis sections ... */}
                {/* Technical Report Section */}
                <section className="space-y-4 animate-in slide-in-from-right duration-500">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-900 rounded-xl"><Activity className="w-5 h-5 text-white" /></div>
                    <h3 className="font-black text-slate-900 text-lg">技術指標分析報告</h3>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 prose prose-slate max-w-none prose-sm leading-relaxed whitespace-pre-wrap text-slate-700">
                    {expertReports[selectedStockId].tech.fullReport}
                  </div>
                </section>

                <div className="h-[1px] bg-gradient-to-r from-transparent via-slate-100 to-transparent"></div>

                {/* Sentiment Report Section */}
                <section className="space-y-4 animate-in slide-in-from-right duration-700">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary rounded-xl"><Bell className="w-5 h-5 text-white" /></div>
                    <h3 className="font-black text-slate-900 text-lg">市場情緒掃描報告</h3>
                  </div>
                  <div className="bg-primary/[0.02] p-6 rounded-3xl border border-primary/10 prose prose-slate max-w-none prose-sm leading-relaxed whitespace-pre-wrap text-slate-700">
                    {expertReports[selectedStockId].sentiment.fullReport}
                  </div>
                </section>

                {/* Institutional Trends Section (Phase 2) */}
                {expertReports[selectedStockId].institutional && (
                  <section className="space-y-4 animate-in slide-in-from-right duration-500">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-600 rounded-xl"><User className="w-5 h-5 text-white" /></div>
                      <h3 className="font-black text-slate-900 text-lg">三大法人資金流向</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                       <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">外資 (Net)</span>
                          <span className={`text-sm font-black mt-1 ${expertReports[selectedStockId].institutional!.foreignNet >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {expertReports[selectedStockId].institutional!.foreignNet.toLocaleString()} 張
                          </span>
                       </div>
                       <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">投信 (Net)</span>
                          <span className={`text-sm font-black mt-1 ${expertReports[selectedStockId].institutional!.trustNet >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {expertReports[selectedStockId].institutional!.trustNet.toLocaleString()} 張
                          </span>
                       </div>
                       <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">自營 (Net)</span>
                          <span className={`text-sm font-black mt-1 ${expertReports[selectedStockId].institutional!.propNet >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {expertReports[selectedStockId].institutional!.propNet.toLocaleString()} 張
                          </span>
                       </div>
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold text-center uppercase tracking-widest">資料日期: {expertReports[selectedStockId].institutional!.date}</p>
                  </section>
                )}

                <div className="h-[1px] bg-gradient-to-r from-transparent via-slate-100 to-transparent"></div>

                {/* Macro Linkage Section in Sidebar */}
                {expertReports[selectedStockId].macro && (
                  <section className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500">
                        <Globe className="w-6 h-6" />
                      </div>
                      <h3 className="font-black text-slate-900 text-lg">跨市場與 ADR 追蹤</h3>
                    </div>
                    <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 prose prose-slate max-w-none prose-sm leading-relaxed whitespace-pre-wrap text-slate-800">
                      {expertReports[selectedStockId].macro.fullReport}
                    </div>
                  </section>
                )}

                <Card className="bg-slate-900 text-white border-none p-6 rounded-3xl">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Confidence Score</p>
                   <div className="flex items-center gap-4">
                      <div className="text-4xl font-black text-primary">{expertReports[selectedStockId].tech.confidenceScore}%</div>
                      <div className="flex-1 space-y-1">
                         <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{width: `${expertReports[selectedStockId].tech.confidenceScore}%`}}></div>
                         </div>
                         <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter text-right">綜合專家信心指數</p>
                      </div>
                   </div>
                </Card>
              </div>
            ) : (
              <div className="text-center py-20 text-slate-300 font-bold italic">請選擇標的以啟動專家分析</div>
            )
          ) : (
            /* Backtest Panel Content */
            <div className="space-y-10">
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-slate-900 text-lg flex items-center gap-3">
                    <div className="p-2 bg-slate-900 rounded-xl"><Activity className="w-5 h-5 text-white" /></div>
                    回測參數設定
                  </h3>
                  <Badge variant="outline" className="text-[10px] font-black uppercase text-slate-400">SMA 20/60 Cross</Badge>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: '3年', days: 1095 }, { label: '2年', days: 730 }, { label: '1年', days: 365 }, { label: '180天', days: 180 },
                    { label: '90天', days: 90 }, { label: '60天', days: 60 }, { label: '30天', days: 30 }, { label: '14天', days: 14 },
                    { label: '7天', days: 7 }, { label: '5天', days: 5 }, { label: '3天', days: 3 }, { label: '1天', days: 1 }
                  ].map((period) => (
                    <Button
                      key={period.days}
                      variant={btDays === period.days ? "default" : "outline"}
                      className={`text-[10px] font-black h-8 rounded-lg ${btDays === period.days ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
                      onClick={() => handleRunBacktest(period.days)}
                      disabled={btLoading}
                    >
                      {period.label}
                    </Button>
                  ))}
                </div>
              </section>

              {btLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <Loader2 className="w-10 h-10 text-slate-900 animate-spin" />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">模擬引擎計算中...</p>
                </div>
              ) : btResult ? (
                <div className="space-y-10 animate-in fade-in duration-500">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-slate-900 text-white p-6 rounded-[2rem] space-y-1">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">總報酬率</p>
                        <p className={`text-4xl font-black ${btResult.totalReturnPc >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {btResult.totalReturnPc >= 0 ? '+' : ''}{btResult.totalReturnPc.toFixed(2)}%
                        </p>
                     </div>
                     <div className="bg-slate-50 border border-slate-100 p-6 rounded-[2rem] space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">最大回撤 (MDD)</p>
                        <p className="text-4xl font-black text-slate-900">-{btResult.maxDrawdown.toFixed(2)}%</p>
                     </div>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-6">
                    <div className="flex items-center justify-between">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">勝率 (Win Rate)</p>
                       <p className="text-sm font-black text-slate-900">{btResult.winRate.toFixed(1)}%</p>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                       <div className="h-full bg-slate-900 transition-all duration-1000" style={{width: `${btResult.winRate}%`}}></div>
                    </div>
                    <div className="flex justify-between text-[10px] font-black text-slate-400">
                       <span>交易次數: {btResult.trades.length}</span>
                       <span>獲利金額: {btResult.totalProfit > 0 ? '+' : ''}{Math.round(btResult.totalProfit).toLocaleString()}</span>
                    </div>
                  </div>

                  <section className="space-y-4">
                     <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" /> 資產曲線 (Equity Curve)
                     </h3>
                     <div className="h-48 w-full bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex items-center justify-center">
                        {/* 這裡未來可以使用 StockChart 組件的變體，暫時以視覺占位 */}
                        <p className="text-[10px] font-black text-slate-300 uppercase italic">Interactive Equity Chart - Beta</p>
                     </div>
                  </section>
                </div>
              ) : (
                <div className="text-center py-20 text-slate-300 font-bold italic">
                  等待計算中...
                </div>
              )}
            </div>
          )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Centered Floating Diagnosis Card (Appears on Hover) */}
      {hoveredStockId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none animate-in fade-in zoom-in-95 duration-200">
          <div className="w-[520px] bg-white/70 backdrop-blur-3xl border border-white/40 rounded-[3rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.25)] p-12 space-y-10 pointer-events-auto relative overflow-hidden group">
            {/* Background Decorative Gradient */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors duration-1000"></div>
            
            {!expertReports[hoveredStockId] ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-6">
                <div className="relative">
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                  <div className="absolute inset-0 bg-primary/20 blur-xl animate-pulse rounded-full"></div>
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm font-black text-slate-800 uppercase tracking-[0.3em]">AI 專家診斷中</p>
                  <p className="text-[10px] text-slate-400 font-bold">正在統合技術指標與市場情緒數據...</p>
                </div>
              </div>
            ) : (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-primary/10 text-primary border-none font-black text-[10px] tracking-widest px-2 py-0.5">SUB-AGENT ANALYSIS</Badge>
                      <Badge variant="outline" className="font-black text-[10px] px-2 py-0 h-5 rounded-md border-slate-300 text-slate-400 bg-white">
                        {(stocks.find(s => s.id === hoveredStockId)?.marketType === 'OTC' || 
                          allStockDataMap[hoveredStockId]?.market === 'OTC') ? '上櫃' : '上市'}
                      </Badge>
                      <span className="text-[10px] font-bold text-slate-300 font-mono">#{hoveredStockId}</span>
                    </div>
                    <h3 className="text-5xl font-black text-slate-900 tracking-tighter leading-tight">
                      {stocks.find(s => s.id === hoveredStockId)?.name || allStockDataMap[hoveredStockId]?.stock_name || hoveredStockId}
                    </h3>
                  </div>
                  {hoveredStockId && expertReports[hoveredStockId] && (
                    <div className={`w-20 h-20 rounded-3xl shadow-2xl flex items-center justify-center transition-transform hover:scale-110 duration-500 ${expertReports[hoveredStockId].tech.sentiment === 'bullish' ? 'bg-red-500 shadow-red-200' : 'bg-emerald-500 shadow-emerald-200'}`}>
                      {expertReports[hoveredStockId].tech.sentiment === 'bullish' ? (
                        <Activity className="w-10 h-10 text-white" />
                      ) : (
                        <Activity className="w-10 h-10 text-white rotate-180" />
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-8">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                      <span className="flex items-center gap-2"><div className="w-1 h-1 bg-primary rounded-full"></div> 系統摘要評語</span>
                      <span className="text-primary font-mono tabular-nums">信心指數: {expertReports[hoveredStockId].tech.confidenceScore}%</span>
                    </div>
                    <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100/50 backdrop-blur-sm">
                      <p className="text-xl font-bold text-slate-800 leading-snug tracking-tight">
                        {expertReports[hoveredStockId].tech.summary}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-6 bg-white/50 rounded-[1.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group/box">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-3 flex items-center gap-2">
                        <BarChart3 className="w-3 h-3 text-slate-300 group-hover/box:text-primary transition-colors" /> 技術面觀點
                      </p>
                      <p className={`text-lg font-black tracking-tight ${expertReports[hoveredStockId].tech.sentiment === 'bullish' ? 'text-red-500' : 'text-emerald-500'}`}>
                        {expertReports[hoveredStockId].tech.sentiment === 'bullish' ? '突破前高 / 多頭' : '空方修正 / 盤整'}
                      </p>
                    </div>
                    <div className="p-6 bg-white/50 rounded-[1.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group/box">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-3 flex items-center gap-2">
                        <Bell className="w-3 h-3 text-slate-300 group-hover/box:text-primary transition-colors" /> 市場情緒
                      </p>
                      <p className={`text-lg font-black tracking-tight ${expertReports[hoveredStockId].sentiment.sentiment === 'bullish' ? 'text-red-500' : 'text-emerald-500'}`}>
                        {expertReports[hoveredStockId].sentiment.sentiment === 'bullish' ? '熱烈追捧 / 樂觀' : '恐慌賣壓 / 謹慎'}
                      </p>
                    </div>
                  </div>

                  {/* Macro Linkage block in Hover Card */}
                  {expertReports[hoveredStockId].macro && (
                    <div className="p-6 bg-indigo-50/50 rounded-[1.5rem] border border-indigo-100 shadow-sm group/box">
                      <p className="text-[10px] font-black text-indigo-400 uppercase mb-3 flex items-center gap-2 tracking-[0.1em]">
                        <Globe className="w-3 h-3 text-indigo-300 group-hover/box:text-indigo-500 transition-colors" /> 🌐 跨市場連動與 ADR 溢價
                      </p>
                      <p className="text-base font-bold text-slate-800 leading-tight">
                        {expertReports[hoveredStockId].macro.summary}
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-4 flex flex-col items-center gap-4">
                  <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                  <p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.4em] animate-pulse">點擊公司行位查看完整深度報告</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
