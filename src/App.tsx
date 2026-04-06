import { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, BarChart3, Search, Bell, Settings, User, Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getStockRecentPrice, StockPrice } from "./services/api"

// 定義 UI 使用的股票型別
interface UIStock {
  id: string
  name: string
  price: string
  change: string
  percent: string
  volume: string
  trend: 'up' | 'down'
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

  useEffect(() => {
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
          
          return {
            id: stockIds[index],
            name: STOCK_NAMES[stockIds[index]] || "未知股票",
            price: latest.close.toLocaleString(),
            change: (diff >= 0 ? "+" : "") + diff.toFixed(2),
            percent: (diff >= 0 ? "+" : "") + pct.toFixed(2) + "%",
            volume: Math.floor(latest.volume / 1000).toLocaleString(),
            trend: diff >= 0 ? 'up' : 'down'
          } as UIStock
        }).filter(s => s !== null) as UIStock[]

        setStocks(formattedStocks)

        // 獲取大盤加權指數
        const taiexHistory = await getStockRecentPrice("TAIEX")
        if (taiexHistory && taiexHistory.length >= 2) {
          const latest = taiexHistory[taiexHistory.length - 1]
          const prev = taiexHistory[taiexHistory.length - 2]
          const diff = latest.close - prev.close
          const pct = (diff / prev.close) * 100
          
          setMarketIndices([
            { name: "加權指數", price: latest.close.toLocaleString(), change: (diff >= 0 ? "+" : "") + diff.toFixed(2), percent: (diff >= 0 ? "+" : "") + pct.toFixed(2) + "%", trend: diff >= 0 ? 'up' : 'down' },
            { name: "預估量 (張)", price: "依盤中為準", change: "", percent: "", trend: 'up' }, // 範例佔位
            { name: "昨收參考", price: prev.close.toLocaleString(), change: "", percent: "", trend: 'up' }
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
            <p className="text-muted-foreground font-medium">盤後數據載入中 (FinMind API)...</p>
          </div>
        ) : (
          <>
            {/* Market Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {marketIndices.map((item) => (
                <Card key={item.name} className="overflow-hidden border-none shadow-sm bg-muted/30 hover:bg-muted/50 transition-colors">
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

            {/* Action Bar */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight">精選權值股行情</h2>
                <p className="text-sm text-muted-foreground">顯示台股指標性權值個股的即時與昨收數據對比</p>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <Button variant="outline" className="flex-1 md:flex-none">進階篩選</Button>
                <Button className="flex-1 md:flex-none">匯出報表</Button>
              </div>
            </div>

            {/* Stock List */}
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle>每日個股行情摘要</CardTitle>
                <CardDescription>資料來源：FinMind API 公開盤後數據</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">股號</TableHead>
                      <TableHead>名稱</TableHead>
                      <TableHead className="text-right">成交價</TableHead>
                      <TableHead className="text-right">漲跌</TableHead>
                      <TableHead className="text-right">幅度</TableHead>
                      <TableHead className="text-right">成交量 (張)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stocks.length > 0 ? stocks.map((stock) => (
                      <TableRow key={stock.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <TableCell className="font-mono font-medium">{stock.id}</TableCell>
                        <TableCell className="font-medium">{stock.name}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{stock.price}</TableCell>
                        <TableCell className={`text-right font-mono ${stock.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                          {stock.change}
                        </TableCell>
                        <TableCell className={`text-right font-mono font-medium ${stock.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                          {stock.percent}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {stock.volume}
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">呼叫頻率受限或無數據，請稍後再試。</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <footer className="mt-auto py-8 border-t bg-muted/20">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © 2026 Taiwan Stock Screener. Powered by FinMind API & D3.js
        </div>
      </footer>
    </div>
  )
}
