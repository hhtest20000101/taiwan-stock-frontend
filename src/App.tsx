import { TrendingUp, TrendingDown, BarChart3, Search, Bell, Settings, User } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const marketData = [
  { name: '加權指數', price: '20,126.43', change: '+143.21', percent: '+0.72%', trend: 'up' },
  { name: '櫃買指數', price: '252.14', change: '-1.05', percent: '-0.41%', trend: 'down' },
  { name: '台指期', price: '20,158', change: '+156', percent: '+0.78%', trend: 'up' },
]

const topStocks = [
  { id: '2330', name: '台積電', price: '780.00', change: '+10.00', percent: '+1.30%', volume: '32,451' },
  { id: '2317', name: '鴻海', price: '145.50', change: '-2.00', percent: '-1.36%', volume: '85,120' },
  { id: '2454', name: '聯發科', price: '1,120.00', change: '+15.00', percent: '+1.36%', volume: '5,214' },
  { id: '2382', name: '廣達', price: '258.00', change: '+8.50', percent: '+3.41%', volume: '45,002' },
]

export default function App() {
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {marketData.map((item) => (
            <Card key={item.name} className="overflow-hidden border-none shadow-sm bg-muted/30 hover:bg-muted/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{item.name}</p>
                    <h3 className="text-2xl font-bold mt-1 tracking-tight">{item.price}</h3>
                  </div>
                  <Badge variant={item.trend === 'up' ? 'default' : 'destructive'} className="rounded-md font-mono">
                    {item.trend === 'up' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                    {item.percent}
                  </Badge>
                </div>
                <div className={`text-sm mt-2 font-medium ${item.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                  {item.change}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">熱門追蹤股票</h2>
            <p className="text-sm text-muted-foreground">基於今日交易量與漲幅最高的台股列表</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button variant="outline" className="flex-1 md:flex-none">進階篩選</Button>
            <Button className="flex-1 md:flex-none">匯出報表</Button>
          </div>
        </div>
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>每日行情摘要</CardTitle>
            <CardDescription>更新時間：2026-04-06 13:30:00</CardDescription>
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
                {topStocks.map((stock) => (
                  <TableRow key={stock.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <TableCell className="font-mono font-medium">{stock.id}</TableCell>
                    <TableCell className="font-medium">{stock.name}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{stock.price}</TableCell>
                    <TableCell className={`text-right font-mono ${stock.change.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                      {stock.change}
                    </TableCell>
                    <TableCell className={`text-right font-mono font-medium ${stock.percent.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                      {stock.percent}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {stock.volume}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
      <footer className="mt-auto py-8 border-t bg-muted/20">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © 2026 Taiwan Stock Screener. Powered by FinMind API & D3.js
        </div>
      </footer>
    </div>
  )
}
