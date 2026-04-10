import fs from 'fs';
import path from 'path';

/**
 * 系統層：跨環境儲存轉接器
 * 在 Browser 環境使用 localStorage；
 * 在 Node.js 環境使用 .scanner_checkpoint.json 檔案以實作「持久化中斷續傳」
 */

const IS_NODE = typeof window === 'undefined';
const CHECKPOINT_FILE = '.scanner_checkpoint.json';

export const StorageAdapter = {
  getItem: (key: string): string | null => {
    if (!IS_NODE) {
      return localStorage.getItem(key);
    }
    
    // Node.js 環境：讀取本地檔案
    try {
      if (fs.existsSync(CHECKPOINT_FILE)) {
        const data = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
        return data[key] || null;
      }
    } catch (e) {
      console.error('[StorageAdapter] 讀取 Checkpoint 檔案失敗:', e);
    }
    return null;
  },

  setItem: (key: string, value: string): void => {
    if (!IS_NODE) {
      localStorage.setItem(key, value);
      return;
    }

    // Node.js 環境：寫入本地檔案
    try {
      let data: Record<string, string> = {};
      if (fs.existsSync(CHECKPOINT_FILE)) {
        data = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
      }
      data[key] = value;
      fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('[StorageAdapter] 寫入 Checkpoint 檔案失敗:', e);
    }
  },

  removeItem: (key: string): void => {
    if (!IS_NODE) {
      localStorage.removeItem(key);
      return;
    }

    // Node.js 環境：刪除 Checkpoint 檔案內容
    try {
      if (fs.existsSync(CHECKPOINT_FILE)) {
        const data = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
        delete data[key];
        fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
      }
    } catch (e) {
      console.error('[StorageAdapter] 刪除 Checkpoint 失敗:', e);
    }
  }
};
