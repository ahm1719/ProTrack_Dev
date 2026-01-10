import { GoogleGenAI } from "@google/genai";
import { Task, DailyLog } from "../types";

const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  return new Date(d.setDate(diff));
};

const getApiKey = () => {
  // 1. Check Local Storage (Production/Deployed App) - This is the primary way for users
  const localKey = localStorage.getItem('protrack_gemini_key');
  if (localKey) return localKey;

  // 2. Safe check for environment variables (Local Dev)
  // We avoid declaring 'process' globally to prevent build errors
  try {
    const env = (window as any).process?.env || (import.meta as any).env;
    if (env && env.API_KEY) {
      return env.API_KEY;
    }
  } catch (e) {
    // Ignore error if env is not accessible
  }

  return '';
};

export const generateWeeklySummary = async (tasks: Task[], logs: DailyLog[]): Promise<string> => {
  try {
    const apiKey = getApiKey();
    
    if (!apiKey) {
      throw new Error("API Key is missing. Please go to Settings and enter your Gemini API Key.");
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

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    // Propagate a clean error message
    if (error.message.includes("API Key is missing")) {
      throw error;
    }
    throw new Error("AI Service Error: " + (error.message || "Unknown error"));
  }
};