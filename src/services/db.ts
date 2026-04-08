// 數據持久化服務 (Database Service Layer)
// 目前先以 localStorage 實作 Mock，未來可在此擴充 Postgre SQL 異步通訊

export interface WatchlistEntry {
    id: string
    name: string
    addedAt: string
}

const STORAGE_KEY = "taiwan_stock_watchlist"

export const getWatchlist = (): WatchlistEntry[] => {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
}

export const addToWatchlist = (stock: { id: string; name: string }): void => {
    const current = getWatchlist()
    if (current.some(item => item.id === stock.id)) return

    const updated = [
        ...current,
        {
            id: stock.id,
            name: stock.name,
            addedAt: new Date().toISOString()
        }
    ]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

export const removeFromWatchlist = (stockId: string): void => {
    const current = getWatchlist()
    const updated = current.filter(item => item.id !== stockId)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

export const isInWatchlist = (stockId: string): boolean => {
    const current = getWatchlist()
    return current.some(item => item.id === stockId)
}
