import { GoogleGenAI } from "@google/genai";
import { Task, DailyLog, ChatMessage, Observation, AppConfig } from "../types";

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
  try {
    // @ts-ignore
    const env = window.process?.env || (import.meta as any).env;
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

    // Filter active tasks: either NOT Done OR updated recently
    const activeTasks = tasks.filter(t => t.status !== 'Done' || t.updates.some(u => u.timestamp >= startOfWeekStr));
    
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

    // Logic for Custom Instruction
    const customInstruction = localStorage.getItem('protrack_report_instruction');
    const defaultInstruction = `
      Please generate a professional, concise Weekly Summary Report formatted in Markdown.
      Structure it as follows:
      1. **Executive Summary**: A 2-3 sentence overview of the week's performance.
      2. **Key Achievements**: Bullet points of completed work or major progress.
      3. **Ongoing Actions**: Updates on items still in progress (cite Task IDs).
      4. **Upcoming Deadlines**: Items due soon.
      5. **Blockers/Issues**: If any negative sentiment or stalled items are detected.

      Keep the tone professional yet direct.
    `;
    
    const finalInstruction = customInstruction && customInstruction.trim() !== '' ? customInstruction : defaultInstruction;

    const prompt = `
      You are an executive assistant. I need a weekly progress summary based on my task tracking data.
      
      Current Date: ${today.toDateString()}
      Start of Week: ${startOfWeek.toDateString()}

      Here are the specific Daily Logs from this week:
      ${logsContext}

      Here is the status of ongoing tasks:
      ${tasksContext}

      ${finalInstruction}
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

export const chatWithAI = async (
  history: ChatMessage[], 
  newMessage: string, 
  tasks: Task[], 
  logs: DailyLog[],
  observations: Observation[],
  appConfig: AppConfig,
  image?: string // Base64 data URL of the image
): Promise<string> => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error("API Key is missing. Please go to Settings.");
    }

    const ai = new GoogleGenAI({ apiKey });

    // Build a comprehensive context of the current state
    const taskContext = tasks.map(t => 
      `[${t.displayId}] ${t.description} (Status: ${t.status}, Due: ${t.dueDate}, Priority: ${t.priority}, Updates: ${t.updates.length})`
    ).join('\n');

    const logContext = logs.slice(0, 50).map(l => { // Limit to last 50 logs to save context
       const t = tasks.find(task => task.id === l.taskId);
       return `[${l.date}] on ${t?.displayId || 'Unknown'}: ${l.content}`;
    }).join('\n');

    const observationContext = observations.map(o => 
       `[Observation] ${o.content} (Status: ${o.status}, Date: ${new Date(o.timestamp).toLocaleDateString()})`
    ).join('\n');

    const settingsContext = `
      Task Statuses: ${appConfig.taskStatuses.join(', ')}
      Task Priorities: ${appConfig.taskPriorities.join(', ')}
      Observation Groups: ${appConfig.observationStatuses.join(', ')}
    `;

    const systemInstruction = `
      You are ProTrack AI, a helpful and intelligent project management assistant.
      You have a holistic view of the entire system, including Tasks, Journal Logs, Observations (Feedback/Notes), and Settings.
      
      CURRENT DATE: ${new Date().toLocaleDateString()}
      
      === SYSTEM SETTINGS ===
      ${settingsContext}

      === ALL TASKS ===
      ${taskContext}

      === RECENT LOGS ===
      ${logContext}

      === OBSERVATIONS (Kanban) ===
      ${observationContext}

      === SYSTEM KNOWLEDGE (User Guide) ===
      - This tool replaces Excel for weekly task tracking.
      - Core Workflow: Define Tasks -> Log Daily -> Track Status -> Generate AI Report.
      - Observations are for ad-hoc notes, feedback, or visual issues.
      - Data is stored locally (Offline-first) with optional Cloud Sync.
      - You can provide summaries or answer questions about any of the data above.

      RULES:
      1. Answer questions based specifically on the data provided above.
      2. If asked about deadlines, check the 'Due' field.
      3. If asked about progress, check the 'Updates' count and Status.
      4. If asked about Observations, notes, or feedback, check the Observations section.
      5. If asked about configuration, check System Settings.
      6. If an image is provided, analyze it in the context of the project.
      7. Be concise and professional.
      8. If you don't know something, say you don't see it in the records.
    `;

    // Convert internal message format to Gemini API format, handling potential images in history
    const contents = history.map(msg => {
      const parts: any[] = [{ text: msg.text }];
      
      if (msg.image) {
        // Strip data:image/png;base64, prefix if present for the API call
        const match = msg.image.match(/^data:(.+);base64,(.+)$/);
        if (match) {
           parts.push({
             inlineData: {
               mimeType: match[1],
               data: match[2]
             }
           });
        }
      }
      
      return {
        role: msg.role,
        parts: parts
      };
    });

    // Add the new user message with potential image
    const currentParts: any[] = [{ text: newMessage }];
    
    if (image) {
      const match = image.match(/^data:(.+);base64,(.+)$/);
      if (match) {
         currentParts.push({
           inlineData: {
             mimeType: match[1],
             data: match[2]
           }
         });
      }
    }

    contents.push({
      role: 'user',
      parts: currentParts
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    return response.text || "I didn't get a response.";

  } catch (error: any) {
    console.error("Chat Error:", error);
    if (error.message.includes("API Key is missing")) throw error;
    throw new Error("Failed to chat: " + (error.message || "Unknown error"));
  }
};