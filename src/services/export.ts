import { utils, writeFile } from 'xlsx'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

// 為 jspdf-autotable 擴充型別定義 (避免 TS 報錯)
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF
  }
}

export interface ExportData {
  id: string
  name: string
  price: string
  change: string
  percent: string
  volume: string
}

const getFileName = (ext: string) => {
  const date = new Date().toISOString().split('T')[0]
  return `Taiwan_Stock_Report_${date}.${ext}`
}

/**
 * 匯出至 Excel
 */
export const exportToExcel = (data: ExportData[]) => {
  const worksheet = utils.json_to_sheet(data.map(item => ({
    '股號': item.id,
    '個股名稱': item.name,
    '成交價': item.price,
    '漲跌': item.change,
    '幅度': item.percent,
    '成交量(張)': item.volume
  })))
  
  const workbook = utils.book_new()
  utils.book_append_sheet(workbook, worksheet, 'Watchlist')
  
  writeFile(workbook, getFileName('xlsx'))
}

/**
 * 匯出至 PDF
 */
export const exportToPDF = (data: ExportData[]) => {
  const doc = new jsPDF()
  
  // 標題
  doc.setFontSize(18)
  doc.text('Taiwan Stock Screener - Watchlist Report', 14, 22)
  
  doc.setFontSize(11)
  doc.setTextColor(100)
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30)
  
  // 表格
  doc.autoTable({
    startY: 40,
    head: [['Symbol', 'Name', 'Price', 'Change', 'Change %', 'Volume (K)']],
    body: data.map(item => [
      item.id,
      item.name,
      item.price,
      item.change,
      item.percent,
      item.volume
    ]),
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] }, // Primary BLUE
    styles: { fontSize: 10, cellPadding: 3 }
  })
  
  doc.save(getFileName('pdf'))
}
