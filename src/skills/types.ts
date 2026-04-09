export interface ExpertReport {
  stockId: string;
  expertName: string;
  summary: string;     // 用於滑鼠橫停 (Hover) 的短摘要
  fullReport: string;  // 用於側邊欄 (Sidebar) 的詳細分析
  confidenceScore: number; // 0-100
  sentiment: 'bullish' | 'bearish' | 'neutral';
  timestamp: string;
}

export class BaseSkill {
  name: string = "Base Skill";
  id: string = "base-skill";
  description: string = "Base skill description";
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async analyze(_data: unknown): Promise<ExpertReport> {
    throw new Error("Analyze method must be implemented by subclasses");
  }
}
