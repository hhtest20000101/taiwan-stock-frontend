import axios from 'axios';

const FINMIND_API_URL = "https://api.finmindtrade.com/api/v4/data";

export interface InstitutionalData {
  date: string;
  stock_id: string;
  Buy: number;
  Sell: number;
  name: string;
}

export interface InstitutionalSummary {
    foreignNet: number;
    trustNet: number;
    propNet: number;
    totalNet: number;
    date: string;
}

/**
 * 獲取三大法人買賣超數據 (FinMind)
 */
export const getInstitutionalData = async (stockId: string): Promise<InstitutionalSummary | null> => {
    const today = new Date();
    const fiveDaysAgo = new Date(today);
    fiveDaysAgo.setDate(today.getDate() - 5);
    const startDate = fiveDaysAgo.toISOString().split('T')[0];

    try {
        const response = await axios.get(FINMIND_API_URL, {
            params: {
                dataset: "TaiwanStockInstitutionalInvestorsBuySell",
                data_id: stockId,
                start_date: startDate,
            },
        });

        const data = response.data.data;
        if (!data || data.length === 0) return null;

        // 取得最新一天的法人數據
        const latestDate = data[data.length - 1].date;
        const dailyRecords = (data as InstitutionalData[]).filter((d: InstitutionalData) => d.date === latestDate);

        let foreignNet = 0;
        let trustNet = 0;
        let propNet = 0;

        dailyRecords.forEach((r: InstitutionalData) => {
            const net = r.Buy - r.Sell;
            if (r.name === 'Foreign_Investor' || r.name === '外資及陸資') foreignNet += net;
            if (r.name === 'Investment_Trust' || r.name === '投信') trustNet += net;
            if (r.name === 'Dealer' || r.name === '自營商') propNet += net;
        });

        return {
            foreignNet: Math.floor(foreignNet / 1000), // 換算為張數 (假設原始數據為股數)
            trustNet: Math.floor(trustNet / 1000),
            propNet: Math.floor(propNet / 1000),
            totalNet: Math.floor((foreignNet + trustNet + propNet) / 1000),
            date: latestDate
        };
    } catch (error) {
        console.error(`Failed to fetch institutional data for ${stockId}:`, error);
        return null;
    }
};
