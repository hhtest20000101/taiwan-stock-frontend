import { utils, writeFile } from 'xlsx'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

// 為 jspdf-autotable 擴充型別定義 (避免 TS 報錯)
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: unknown) => jsPDF
  }
}

export interface ExportData {
  id: string
  name: string
  price: string
  change: string
  percent: string
  volume: string
  amount: string // Added turnover amount
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
    '成交量(張)': item.volume,
    '成交值(億)': item.amount
  })))
  
  const workbook = utils.book_new()
  utils.book_append_sheet(workbook, worksheet, 'Watchlist')
  
  writeFile(workbook, getFileName('xlsx'))
}

/**
 * 匯出至 PDF
 * 注意：jsPDF 預設字體不支援中文，需額外載入 .ttf
 */
export const exportToPDF = (data: ExportData[]) => {
  const doc = new jsPDF()

  // --- 字體載入建議 ---
  // 若要支援中文，請在此導入 NotoSansTC-Regular.js 並調用 doc.addFont()
  // 目前先優化佈局與英文欄位渲染
  
  // 標題與裝飾
  doc.setFillColor(30, 41, 59) // Slate-900
  doc.rect(0, 0, 210, 40, 'F')
  
  doc.setFontSize(22)
  doc.setTextColor(255, 255, 255)
  doc.text('TAIWAN STOCK REPORT', 14, 25)
  
  doc.setFontSize(10)
  doc.setTextColor(200, 200, 200)
  doc.text(`DATE: ${new Date().toLocaleString()} | PRO SCREENER v1.3`, 14, 32)
  
  // 表格
  doc.autoTable({
    startY: 50,
    head: [['ID', 'NAME', 'PRICE', 'CHG', 'CHG%', 'VOL(K)', 'VALUE(B)']],
    body: data.map(item => [
      item.id,
      item.name, // 若未填加中文字體，此處中文會變成亂碼
      item.price,
      item.change,
      item.percent,
      item.volume,
      item.amount
    ]),
    theme: 'grid',
    headStyles: { 
        fillColor: [59, 130, 246], // Blue-500
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'center'
    },
    columnStyles: {
        0: { halign: 'center', fontStyle: 'bold' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' }
    },
    styles: { 
        fontSize: 9, 
        cellPadding: 4,
        lineColor: [241, 245, 249] // Slate-100
    }
  })
  
  doc.save(getFileName('pdf'))
}
