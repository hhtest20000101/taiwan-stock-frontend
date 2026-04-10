// src/services/api.ts
import axios from 'axios';
import { getEnv, getBaseUrl } from '../utils/envHelper';

export interface StockPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  Trading_Volume: number; // 為相容舊有組件與分析器
  Trading_money: number;
  stock_id?: string;
  min?: number; // 用於 StockChart
  max?: number; // 用於 StockChart
}

export interface USStockPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adj_close: number;
}

export async function getStockHistoricalPrice(stockId: string, startDate: string): Promise<StockPrice[]> {
    try {
        const token = getEnv('VITE_FINMIND_API_TOKEN');
        const tokenQuery = token ? `&token=${token}` : '';
        const baseUrl = getBaseUrl('finmind');
        
        const endpoint = `${baseUrl}/api/v4/data?dataset=TaiwanStockPrice&data_id=${stockId}&start_date=${startDate}${tokenQuery}`;
        
        const response = await axios.get(endpoint);
        
        if (response.data && response.data.data) {
             return response.data.data.map((d: any) => ({
               ...d,
               min: d.low,
               max: d.high
             }));
        }
        return []; 
    } catch (error) {
        console.error(`Failed to fetch historical stock data for ${stockId}:`, error);
        return []; 
    }
}

export async function getStockRecentPrice(stockId: string): Promise<StockPrice[]> {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];
    return getStockHistoricalPrice(stockId, startDate);
}

export async function getUSStockPrice(stockId: string): Promise<USStockPrice[]> {
    try {
        const token = getEnv('VITE_FINMIND_API_TOKEN');
        const tokenQuery = token ? `&token=${token}` : '';
        const baseUrl = getBaseUrl('finmind');
        const endpoint = `${baseUrl}/api/v4/data?dataset=USStockPrice&data_id=${stockId}${tokenQuery}`;
        const response = await axios.get(endpoint);
        return response.data?.data || [];
    } catch (error) {
        console.error(`Failed to fetch US stock data for ${stockId}:`, error);
        return [];
    }
}
