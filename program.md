# Taiwan Stock Screener - Auto-Dev Program

這是模仿 Karpathy `autoresearch` 概念的開發指令檔。當你（Agent）啟動此程序時，請遵循以下邏輯自主進行開發。

## 🎯 開發目標
建立一個功能完整的台灣股票篩選網站，包含資料串接、視覺化圖表與篩選功能。

## 📋 開發規則
1. **自主迭代**：從 `backlog.md` 挑選一項未完成任務。
2. **實作代碼**：在 `src/` 目錄下進行開發。
3. **品質把關**：
   - 執行 `npm run build` 確保編譯成功。
   - 執行 `npx playwright test` 確保功能正確且無 Regression。
4. **決策邏輯**：
   - ✅ **測試通過**：執行 `git commit -m "feat: [功能名稱]"` 並更新 `dev_results.tsv` 為 `keep`。
   - ❌ **測試失敗**：嘗試修復 Bug。若嘗試 3 次仍失敗，執行 `git reset --hard` 並記錄為 `discard`。
5. **永不中斷**：除非任務清單清空或使用者手動中止，否則請持續開發。

## 🚀 執行指令 (Loop)
1. 讀取 `backlog.md`。
2. 修改代碼。
3. 執行測試：`npm run build && npx playwright test`。
4. 記錄結果至 `dev_results.tsv`。
5. 提交(Commit)或重置(Reset)。
