import { calculateSMA } from '../utils/indicators';

/**
 * 策略層：生成完整的訊號陣列 (供回測引擎使用)
 */
export const generateMACrossoverSignals = (closes: number[], shortPeriod = 20, longPeriod = 60): ('BUY' | 'SELL' | 'HOLD')[] => {
  const shortMA = calculateSMA(closes, shortPeriod);
  const longMA = calculateSMA(closes, longPeriod);
  const signals: ('BUY' | 'SELL' | 'HOLD')[] = new Array(closes.length).fill('HOLD');

  for (let i = 1; i < closes.length; i++) {
    // 檢查指標是否已就緒
    if (isNaN(shortMA[i]) || isNaN(longMA[i]) || isNaN(shortMA[i-1]) || isNaN(longMA[i-1])) {
      continue;
    }

    const isGoldenCross = shortMA[i - 1] <= longMA[i - 1] && shortMA[i] > longMA[i];
    const isDeathCross = shortMA[i - 1] >= longMA[i - 1] && shortMA[i] < longMA[i];
    
    if (isGoldenCross) signals[i] = 'BUY';
    else if (isDeathCross) signals[i] = 'SELL';
  }
  
  return signals;
};
