/**
 * 指標層：計算簡單移動平均線 (採用 O(N) 滑動窗口演算法，避免阻塞 Event Loop)
 */
export const calculateSMA = (data: number[], period: number): number[] => {
  const sma: number[] = new Array(data.length).fill(NaN);
  let sum = 0;
  
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= period) {
      sum -= data[i - period]; // 減去滑出窗口的舊值
    }
    if (i >= period - 1) {
      sma[i] = sum / period;
    }
  }
  return sma;
};

/**
 * 計算相對強弱指標 (RSI) 
 * (保留原有邏輯，但為了架構一致性移至此處)
 */
export const calculateRSI = (data: number[], period: number = 14): number[] => {
  const rsi: number[] = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;

    if (i < period) {
      rsi.push(NaN);
      continue;
    }

    const rs = (gains / period) / ((losses / period) || 1);
    rsi.push(100 - (100 / (1 + rs)));
  }
  return rsi;
};
