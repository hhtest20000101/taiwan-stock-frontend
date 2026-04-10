/**
 * Antigravity AI 服務代理
 * 所有 AI 請求均導向本地 Secret Gateway (port 8080) 以進行節流控管
 */
export async function callGemma4API(prompt: string, role: string = 'gemma-4-26b-a4b-it') {
  const endpoint = `http://localhost:8080/v1/generate`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-model-id': role 
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Gateway error');
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("[AI Service] 呼叫本地網關失敗:", error);
    throw error;
  }
}
