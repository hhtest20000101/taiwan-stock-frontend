// 數據持久化服務 (Database Service Layer)
// 支援 PostgreSQL 遠端代理與 localStorage 本地備援

export interface WatchlistEntry {
    id: string
    name: string
    addedAt: string
}

const STORAGE_KEY = "taiwan_stock_watchlist"
const DB_API_ENDPOINT = "/api/db/watchlist"

/**
 * 遠端 PostgreSQL 代理類別
 */
class PostgreSQLProxy {
    static async fetchAll(): Promise<WatchlistEntry[] | null> {
        try {
            const resp = await fetch(DB_API_ENDPOINT)
            if (!resp.ok) return null
            return await resp.json()
        } catch {
            return null
        }
    }

    static async save(entry: WatchlistEntry): Promise<boolean> {
        try {
            const resp = await fetch(DB_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(entry)
            })
            return resp.ok
        } catch {
            return false
        }
    }

    static async remove(stockId: string): Promise<boolean> {
        try {
            const resp = await fetch(`${DB_API_ENDPOINT}/${stockId}`, { method: 'DELETE' })
            return resp.ok
        } catch {
            return false
        }
    }
}

// --- 公開 API ---

export const getWatchlist = async (): Promise<WatchlistEntry[]> => {
    // 優先嘗試從遠端資料庫獲取
    const remoteData = await PostgreSQLProxy.fetchAll()
    if (remoteData) return remoteData

    // 備援：從 localStorage 獲取
    const localData = localStorage.getItem(STORAGE_KEY)
    return localData ? JSON.parse(localData) : []
}

export const addToWatchlist = async (stock: { id: string; name: string }): Promise<void> => {
    const current = await getWatchlist()
    if (current.some(item => item.id === stock.id)) return

    const newEntry: WatchlistEntry = {
        id: stock.id,
        name: stock.name,
        addedAt: new Date().toISOString()
    }

    // 同步至遠端
    await PostgreSQLProxy.save(newEntry)

    // 同步至本地
    const updated = [...current, newEntry]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

export const removeFromWatchlist = async (stockId: string): Promise<void> => {
    // 同步移除遠端
    await PostgreSQLProxy.remove(stockId)

    // 移除本地
    const current = await getWatchlist()
    const updated = current.filter(item => item.id !== stockId)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

export const isInWatchlist = async (stockId: string): Promise<boolean> => {
    const current = await getWatchlist()
    return current.some(item => item.id === stockId)
}
