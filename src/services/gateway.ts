import express from 'express';
import type { Request, Response } from 'express';

const app = express();
app.use(express.json());

const PORT = 8080;
const DELAY_MS = 4500;

interface QueueItem { req: Request; res: Response; }
const requestQueue: QueueItem[] = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing || requestQueue.length === 0) return;
  isProcessing = true;

  const { req, res } = requestQueue.shift()!;
  
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("Missing GOOGLE_API_KEY in environment");

    const modelId = req.headers['x-model-id'] || 'gemma-4-26b-a4b-it';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

    console.log(`[Gateway] 🚀 轉發請求至 ${modelId}... (佇列剩餘: ${requestQueue.length})`);

    const googleRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    const data = await googleRes.json();
    res.status(googleRes.status).json(data);

  } catch (error: any) {
    console.error(`[Gateway] ❌ 轉發失敗:`, error.message);
    res.status(500).json({ error: 'Gateway forwarding failed', details: error.message });
  }

  // 強制間隔 4.5 秒以符合 15 RPM (60s / 15 = 4s, 4.5s 為保險值)
  setTimeout(() => {
    isProcessing = false;
    processQueue();
  }, DELAY_MS);
}

app.post('/v1/generate', (req: Request, res: Response) => {
  requestQueue.push({ req, res });
  console.log(`[Gateway] 📥 收到新請求，目前排隊總數: ${requestQueue.length}`);
  processQueue();
});

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🛡️  Antigravity Secret Gateway 啟動完成`);
  console.log(`⚙️  監聽埠口: ${PORT} | 限流設定: 15 RPM`);
  console.log(`=========================================`);
});
