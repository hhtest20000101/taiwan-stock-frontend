

interface ErrorFallbackProps {
  error: Error
  resetErrorBoundary: () => void
}

export function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <div style={{ padding: '20px', color: 'red', fontFamily: 'sans-serif' }}>
      <h1>出錯了 (Application Error)</h1>
      <p>抱歉，我們遇到了一個未預期的錯誤，這可能導致了「死機」。由於發生了未預期的崩潰，應用程式無法繼續呈現。</p>
      <pre style={{ background: '#fee', padding: '10px', overflowX: 'auto' }}>{error.message}</pre>
      <button onClick={resetErrorBoundary} style={{ padding: '10px 20px', marginTop: '10px', cursor: 'pointer' }}>
        重新嘗試加載 (Try Again)
      </button>
    </div>
  )
}
