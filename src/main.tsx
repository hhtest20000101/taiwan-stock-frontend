import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'

// 系統層：配置全域 QueryClient
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // 行情資料的快取生命週期 (Stale Time)
            // 台灣期貨與股票盤中建議設為 30~60 秒，盤後可設更長。這裡預設 60 秒。
            staleTime: 60 * 1000, 
            // 失敗重試已在底層 fetchWithCacheFallback 處理，此處設 0 避免衝突
            retry: 0,
            // 切換視窗時自動背景更新資料
            refetchOnWindowFocus: true, 
        },
    },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
