import { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, BarChart3, Search, Bell, Settings, User, Loader2, Star, Trash2, Download, FileJson, FileSpreadsheet } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { getStockRecentPrice, type StockPrice } from "./services/api"
import { getWatchlist, addToWatchlist, removeFromWatchlist, type WatchlistEntry } from "./services/db"
import { exportToExcel, exportToPDF, type ExportData } from "./services/export"
import StockChart from "./components/StockChart"

// 定義 UI 使用的股票型別
interface UIStock {
  id: string
  name: string
  price: string
  change: string
  percent: string
  volume: string
  trend: 'up' | 'down'
  rawHistory: StockPrice[]
}

const STOCK_NAMES: Record<string, string> = {
  "2330": "台積電",
  "2317": "鴻海",
  "2454": "聯發科",
  "2382": "廣達",
  "TAIEX": "加權指數"
}

export default function App() {
  const [loading, setLoading] = useState(true)
  const [stocks, setStocks] = useState<UIStock[]>([])
  const [marketIndices, setMarketIndices] = useState<any[]>([])
  const [selectedStockId, setSelectedStockId] = useState<string>("2330")
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([])

  useEffect(() => {
    // 初始化載入追蹤清單
    setWatchlist(getWatchlist())
    
    const fetchAllData = async () => {
      setLoading(true)
      try {
        const stockIds = ["2330", "2317", "2454", "2382"]
        const results = await Promise.all(stockIds.map(id => getStockRecentPrice(id)))
        
        const formattedStocks = results.map((history, index) => {
          if (!history || history.length < 2) return null;
          const latest = history[history.length - 1];
          const prev = history[history.length - 2];
          const diff = latest.close - prev.close;
          const pct = (diff / prev.close) * 100;
          const vol = typeof latest.volume === 'number' ? Math.floor(latest.volume / 1000) : 0;
          
          return {
            id: stockIds[index],
            name: STOCK_NAMES[stockIds[index]] || "未知股票",
            price: latest.close.toLocaleString(),
            change: (diff >= 0 ? "+" : "") + diff.toFixed(2),
            percent: (diff >= 0 ? "+" : "") + pct.toFixed(2) + "%",
            volume: vol.toLocaleString(),
            trend: diff >= 0 ? 'up' : 'down',
            rawHistory: history
          } as UIStock
        }).filter((s): s is UIStock => s !== null)

        setStocks(formattedStocks)

        const taiexHistory = await getStockRecentPrice("TAIEX")
        if (taiexHistory && taiexHistory.length >= 2) {
          const latest = taiexHistory[taiexHistory.length - 1]
          const prev = taiexHistory[taiexHistory.length - 2]
          const diff = latest.close - prev.close
          const pct = (diff / prev.close) * 100
          
          setMarketIndices([
            { name: "加權指數", price: latest.close.toLocaleString(), change: (diff >= 0 ? "+" : "") + diff.toFixed(2), percent: (diff >= 0 ? "+" : "") + pct.toFixed(2) + "%", trend: diff >= 0 ? 'up' : 'down', rawHistory: taiexHistory },
            { name: "昨收參考", price: prev.close.toLocaleString(), change: "", percent: "", trend: 'up' },
            { name: "更新日期", price: latest.date, change: "", percent: "", trend: 'up' }
          ])
        }
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchAllData()
  }, [])

  const handleToggleWatchlist = (id: string, name: string) => {
    const isPresent = watchlist.some(item => item.id === id)
    if (isPresent) {
      removeFromWatchlist(id)
    } else {
      addToWatchlist({ id, name })
    }
    setWatchlist(getWatchlist())
  }

  const handleExport = (type: 'pdf' | 'excel') => {
    // 取得追蹤清單中個股的最新即時數據
    const exportData: ExportData[] = watchlist.map(item => {
      const liveData = stocks.find(s => s.id === item.id)
      return {
        id: item.id,
        name: item.name,
        price: liveData?.price || 'N/A',
        change: liveData?.change || '0.00',
        percent: liveData?.percent || '0.00%',
        volume: liveData?.volume || '0'
      }
    })

    if (exportData.length === 0) {
      alert("追蹤清單為空，請先加入感興趣的股票。")
      return
    }

    if (type === 'pdf') {
      exportToPDF(exportData)
    } else {
      exportToExcel(exportData)
    }
  }

  const getSelectedData = () => {
    if (selectedStockId === "TAIEX") {
      const taiex = marketIndices.find(m => m.name === "加權指數")
      return taiex ? { name: "加權指數", rawHistory: taiex.rawHistory } : null
    }
    const stock = stocks.find(s => s.id === selectedStockId)
    return stock ? { name: stock.name, rawHistory: stock.rawHistory } : null
  }

  const selectedData = getSelectedData()

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-primary w-8 h-8" />
            <span className="text-xl font-bold tracking-tight text-primary">Taiwan Stock Screener</span>
          </div>
          <div className="flex-1 max-w-md mx-8 hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="搜尋股號或名稱..." className="pl-10 bg-muted/50 border-none focus-visible:ring-1" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon">
              <Bell className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <Settings className="w-5 h-5" />
            </Button>
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
              <User className="w-5 h-5 text-primary" />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary opacity-50" />
            <p className="text-muted-foreground font-medium">報表匯出引擎建置中...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {marketIndices.map((item) => (
                <Card 
                  key={item.name} 
                  className={`overflow-hidden border-none shadow-sm transition-all duration-300 cursor-pointer ${selectedStockId === "TAIEX" && item.name === "加權指數" ? "ring-2 ring-primary bg-primary/5" : "bg-muted/30 hover:bg-muted/50"}`}
                  onClick={() => item.name === "加權指數" && setSelectedStockId("TAIEX")}
                >
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{item.name}</p>
                        <h3 className="text-2xl font-bold mt-1 tracking-tight">{item.price}</h3>
                      </div>
                      {item.percent && (
                        <Badge variant={item.trend === 'up' ? 'default' : 'destructive'} className="rounded-md font-mono">
                          {item.trend === 'up' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                          {item.percent}
                        </Badge>
                      )}
                    </div>
                    <div className={`text-sm mt-2 font-medium ${item.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                      {item.change}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2 border-none shadow-sm min-h-[400px]">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            分析趨勢圖
                            <Badge variant="outline" className="text-[10px] uppercase">D3 Visualization</Badge>
                        </CardTitle>
                        <CardDescription>
                          {selectedData?.name || "選定標的"} 價格走勢圖
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {selectedData ? (
                          <StockChart data={selectedData.rawHistory} stockName={selectedData.name} />
                        ) : (
                          <div className="h-[300px] flex items-center justify-center text-muted-foreground">查無趨勢資料</div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm h-fit">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2 text-primary">
                            <Star className="w-5 h-5 fill-primary text-primary" />
                            我的追蹤清單
                          </CardTitle>
                          <CardDescription>持久化儲存紀錄</CardDescription>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-9 w-9 bg-primary/5 border-primary/20">
                              <Download className="w-4 h-4 text-primary" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => handleExport('excel')} className="cursor-pointer">
                              <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
                              匯出為 Excel (.xlsx)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport('pdf')} className="cursor-pointer">
                              <FileJson className="w-4 h-4 mr-2 text-red-600" />
                              匯出為 PDF (.pdf)
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-4">
                        {watchlist.length > 0 ? watchlist.map(item => (
                          <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 group hover:bg-muted/50 transition-colors border border-transparent hover:border-primary/20">
                            <div className="flex flex-col cursor-pointer flex-1" onClick={() => setSelectedStockId(item.id)}>
                              <span className="text-xs font-mono text-muted-foreground">{item.id}</span>
                              <span className="font-bold text-sm tracking-tight">{item.name}</span>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => { removeFromWatchlist(item.id); setWatchlist(getWatchlist()); }}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )) : (
                          <div className="py-8 text-center text-xs text-muted-foreground border-2 border-dashed rounded-lg bg-muted/10">
                            尚未有追蹤對象，點擊下方表格收藏。
                          </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight text-primary">市場即時掃描</h2>
                <p className="text-sm text-muted-foreground">精準獲取 FinMind 公有數據庫資料並自動同步追蹤狀態</p>
              </div>
            </div>

            <Card className="border-none shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-muted/10">
                      <TableHead className="w-[80px] pl-6 text-center">收藏</TableHead>
                      <TableHead className="w-[100px]">股號</TableHead>
                      <TableHead>名稱</TableHead>
                      <TableHead className="text-right">收盤價</TableHead>
                      <TableHead className="text-right">漲跌</TableHead>
                      <TableHead className="text-right">幅度</TableHead>
                      <TableHead className="text-right pr-6">成交值 (千元)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stocks.length > 0 ? stocks.map((stock) => (
                      <TableRow 
                        key={stock.id} 
                        className={`cursor-pointer transition-colors ${selectedStockId === stock.id ? 'bg-primary/5 active:scale-[0.99]' : 'hover:bg-muted/50'}`}
                      >
                        <TableCell className="pl-6 text-center">
                           <Button 
                             variant="ghost" 
                             size="icon" 
                             className="h-8 w-8"
                             onClick={(e) => { e.stopPropagation(); handleToggleWatchlist(stock.id, stock.name); }}
                           >
                             <Star className={`w-5 h-5 ${watchlist.some(w => w.id === stock.id) ? 'fill-primary text-primary active:scale-125' : 'text-muted-foreground opacity-30 hover:opacity-100'} transition-all`} />
                           </Button>
                        </TableCell>
                        <TableCell className="font-mono font-bold" onClick={() => setSelectedStockId(stock.id)}>{stock.id}</TableCell>
                        <TableCell className="font-semibold" onClick={() => setSelectedStockId(stock.id)}>{stock.name}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-lg" onClick={() => setSelectedStockId(stock.id)}>{stock.price}</TableCell>
                        <TableCell className={`text-right font-mono font-medium ${stock.trend === 'up' ? 'text-green-500' : 'text-red-500'}`} onClick={() => setSelectedStockId(stock.id)}>
                          {stock.change}
                        </TableCell>
                        <TableCell className={`text-right font-mono font-bold ${stock.trend === 'up' ? 'text-green-500' : 'text-red-500'}`} onClick={() => setSelectedStockId(stock.id)}>
                          {stock.percent}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground pr-6" onClick={() => setSelectedStockId(stock.id)}>
                          {stock.volume}
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-24 text-muted-foreground">
                          <div className="flex items-center justify-center gap-3">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            正在從台灣證券交易所同步資料...
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <footer className="mt-24 py-12 border-t bg-muted/10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="text-primary w-6 h-6" />
              <span className="font-bold tracking-tight">Taiwan Stock Screener</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Built with precision using React, D3.js, and FinMind API
            </div>
            <div className="text-xs text-muted-foreground opacity-50">
              © 2026 Dashboard v1.2 | Data latency ~15min
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
