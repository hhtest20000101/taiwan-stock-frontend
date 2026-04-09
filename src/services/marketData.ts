import axios from 'axios';

// --- Interfaces for Official APIs ---

export interface TWSEStockQuote {
  Code: string;
  Name: string;
  TradeVolume: string;
  TradeValue: string;
  OpeningPrice: string;
  HighestPrice: string;
  LowestPrice: string;
  ClosingPrice: string;
  Change: string;
  Transaction: string;
}

export interface TPExStockQuote {
  Date: string;
  SecuritiesCompanyCode: string;
  CompanyName: string;
  Close: string;
  Change: string;
  Open: string;
  High: string;
  Low: string;
  TradingShares: string;
  TransactionAmount: string;
  TransactionNumber: string;
}

export interface TAIFEXQuote {
  Date: string;
  ProductCode: string;
  ContractMonth: string;
  Open: string;
  High: string;
  Low: string;
  Close: string;
  PriceChange: string;
  PriceChangePercent: string;
  Volume: string;
  SettlementPrice: string;
  OpenInterest: string;
}

// --- Common Unified Interface ---

export interface UnifiedStockData {
  stock_id: string;
  stock_name: string;
  open: number;
  max: number;
  min: number;
  close: number;
  change: number;
  volume: number; // In shares
  turnover: number; // In TWD
  market: 'TWSE' | 'TPEx';
  date: string;
}

// --- API Service ---

const getTodayString = () => new Date().toISOString().split('T')[0].replace(/-/g, '');

const TWSE_URL = '/api/twse/v1/exchangeReport/STOCK_DAY_ALL';
const TPEX_URL = '/api/tpex/openapi/v1/tpex_mainboard_quotes';
const TAIFEX_URL = '/api/taifex/v1/DailyQuote';

export const fetchAllStocks = async (): Promise<UnifiedStockData[]> => {
  try {
    const todayStr = getTodayString();
    const [twseRes, tpexRes] = await Promise.allSettled([
      axios.get<TWSEStockQuote[]>(TWSE_URL, { params: { date: todayStr } }),
      axios.get<TPExStockQuote[]>(TPEX_URL, { params: { date: todayStr } })
    ]);

    const unifiedData: UnifiedStockData[] = [];
    const today = new Date().toISOString().split('T')[0];

    if (twseRes.status === 'fulfilled') {
      twseRes.value.data.forEach(s => {
        unifiedData.push({
          stock_id: s.Code,
          stock_name: s.Name,
          open: parseFloat(s.OpeningPrice) || 0,
          max: parseFloat(s.HighestPrice) || 0,
          min: parseFloat(s.LowestPrice) || 0,
          close: parseFloat(s.ClosingPrice) || 0,
          change: parseFloat(s.Change) || 0,
          volume: parseInt(s.TradeVolume.replace(/,/g, '')) || 0,
          turnover: parseInt(s.TradeValue.replace(/,/g, '')) || 0,
          market: 'TWSE',
          date: today
        });
      });
    }

    if (tpexRes.status === 'fulfilled') {
      tpexRes.value.data.forEach(s => {
        unifiedData.push({
          stock_id: s.SecuritiesCompanyCode,
          stock_name: s.CompanyName,
          open: parseFloat(s.Open) || 0,
          max: parseFloat(s.High) || 0,
          min: parseFloat(s.Low) || 0,
          close: parseFloat(s.Close) || 0,
          change: parseFloat(s.Change) || 0,
          volume: parseInt(s.TradingShares.replace(/,/g, '')) || 0,
          turnover: parseInt(s.TransactionAmount.replace(/,/g, '')) || 0,
          market: 'TPEx',
          date: s.Date || today
        });
      });
    }

    return unifiedData;
  } catch (error) {
    console.error('Error fetching official market data:', error);
    return [];
  }
};

export const fetchFuturesData = async (): Promise<TAIFEXQuote[]> => {
  try {
    const res = await axios.get<TAIFEXQuote[]>(TAIFEX_URL);
    // Filter for core products like TX (TAIEX Futures)
    return res.data.filter(q => q.ProductCode === 'TX' || q.ProductCode === 'MTX');
  } catch (error) {
    console.error('Error fetching TAIFEX data:', error);
    return [];
  }
};
