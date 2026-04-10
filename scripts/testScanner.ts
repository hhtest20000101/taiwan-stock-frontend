// scripts/testScanner.ts
import { runFullMarketScan } from '../src/execution/batchScanner';

/**
 * 系統層：獨立的終端機測試入口
 * 遵循首席架構師「獨立驗證」規範
 */
async function main() {
  console.log("🚀 啟動 Antigravity V2 全市場批次掃描引擎 (Terminal Mode)...");
  
  try {
    const startTime = Date.now();
    
    // 執行掃描，回報進度與即時排行榜
    const finalLeaderboard = await runFullMarketScan((progress, latest, leaderboard) => {
      // 使用 stdout.write 避免過多換行，保持終端機整潔
      process.stdout.write(`\r⏳ 掃描進度: ${progress}% `);
      if (latest) {
        process.stdout.write(`| 最新完成: ${latest.name}(${latest.symbol}) 報酬: ${latest.totalReturnPc.toFixed(2)}%    `);
      }
    });

    console.log("\n\n✅ 掃描完成！耗時:", ((Date.now() - startTime) / 1000).toFixed(1), "秒");
    console.log("🏆 終極勝率排行榜 (Top 10):");
    console.table(finalLeaderboard.slice(0, 10).map(item => ({
        "代號": item.symbol,
        "名稱": item.name,
        "總報酬": `${item.totalReturnPc.toFixed(2)}%`,
        "最大回撤": `${item.maxDrawdown.toFixed(2)}%`,
        "勝率權重": item.score.toFixed(1)
    })));

  } catch (error) {
    console.error("\n❌ 引擎執行崩潰:", error);
  }
}

main();
