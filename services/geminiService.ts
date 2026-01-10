import { GoogleGenAI } from "@google/genai";
import { Task, DailyLog } from "../types";

const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  return new Date(d.setDate(diff));
};

export const generateWeeklySummary = async (tasks: Task[], logs: DailyLog[]): Promise<string> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API Key is missing.");
    }

    const ai = new GoogleGenAI({ apiKey });

    // 1. Filter data for the current week
    const today = new Date();
    const startOfWeek = getStartOfWeek(today);
    const startOfWeekStr = startOfWeek.toISOString().split('T')[0];

    const activeTasks = tasks.filter(t => t.status !== 'Completed' || t.updates.some(u => u.timestamp >= startOfWeekStr));
    
    // Format data for the prompt
    const tasksContext = activeTasks.map(t => `
      Task ID: ${t.displayId} (${t.source})
      Description: ${t.description}
      Status: ${t.status}
      Due Date: ${t.dueDate}
      Recent Updates:
      ${t.updates.filter(u => u.timestamp >= startOfWeekStr).map(u => `- [${u.timestamp.split('T')[0]}] ${u.content}`).join('\n')}
    `).join('\n---\n');

    const logsContext = logs
      .filter(l => l.date >= startOfWeekStr)
      .map(l => {
        const task = tasks.find(t => t.id === l.taskId);
        return `- [${l.date}] On task ${task?.displayId || 'Unknown'}: ${l.content}`;
      }).join('\n');

    const prompt = `
      You are an executive assistant. I need a weekly progress summary based on my task tracking data.
      
      Current Date: ${today.toDateString()}
      Start of Week: ${startOfWeek.toDateString()}

      Here are the specific Daily Logs from this week:
      ${logsContext}

      Here is the status of ongoing tasks:
      ${tasksContext}

      Please generate a professional, concise Weekly Summary Report formatted in Markdown.
      Structure it as follows:
      1. **Executive Summary**: A 2-3 sentence overview of the week's performance.
      2. **Key Achievements**: Bullet points of completed work or major progress.
      3. **Ongoing Actions**: Updates on items still in progress (cite Task IDs).
      4. **Upcoming Deadlines**: Items due soon.
      5. **Blockers/Issues**: If any negative sentiment or stalled items are detected.

      Keep the tone professional yet direct.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 } // Speed over deep reasoning for simple summarization
      }
    });

    return response.text || "Could not generate summary.";

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};