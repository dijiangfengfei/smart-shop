// ============================================================
// AGI 增强版 AI 能力 — 智能商城后端服务
// 支持工具调用 + 持久化记忆 + 多步推理智能体循环
// ============================================================
import { query, get, run } from "../database/db.js"

// ==================== 工具定义 ====================

async function getDashboardStats() {
  try {
    const total = await get("SELECT COUNT(*) AS cnt FROM users");
    const admins = await get("SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin'");
    const regular = await get("SELECT COUNT(*) AS cnt FROM users WHERE role = 'user'");
    return { total_users: total.cnt, admin_users: admins.cnt, regular_users: regular.cnt };
  } catch (e) {
    return { error: "获取数据概览失败: " + e.message };
  }
}

async function getUsersList(page = 1, size = 10) {
  try {
    const offset = (page - 1) * size;
    const users = await query("SELECT id, username, nickname, role, points, membership, created_at FROM users ORDER BY id ASC LIMIT ? OFFSET ?", [size, offset]);
    const total = await get("SELECT COUNT(*) AS cnt FROM users");
    return { users, total: total.cnt, page, size };
  } catch (e) {
    return { error: "获取用户列表失败: " + e.message };
  }
}

async function searchUserByAccount(account) {
  try {
    const user = await get("SELECT id, username, nickname, role, points, membership, created_at FROM users WHERE username = ?", [account]);
    if (!user) return { error: "未找到用户: " + account };
    return user;
  } catch (e) {
    return { error: "搜索用户失败: " + e.message };
  }
}

function getCurrentTime() {
  return new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
}

async function getProductStats() {
  try {
    const total = await get("SELECT COUNT(*) AS cnt FROM products");
    const onSale = await get("SELECT COUNT(*) AS cnt FROM products WHERE status = 'on'");
    const offShelf = await get("SELECT COUNT(*) AS cnt FROM products WHERE status = 'off'");
    const categories = await query("SELECT category, COUNT(*) AS cnt FROM products GROUP BY category");
    return { total_products: total.cnt, on_sale: onSale.cnt, off_shelf: offShelf.cnt, categories: categories.map(c => ({ name: c.category, count: c.cnt })) };
  } catch (e) {
    return { error: "获取商品统计失败: " + e.message };
  }
}

async function getOrderStats() {
  try {
    const total = await get("SELECT COUNT(*) AS cnt FROM orders");
    const byStatus = await query("SELECT status, COUNT(*) AS cnt FROM orders GROUP BY status");
    const revenue = await get("SELECT COALESCE(SUM(total), 0) AS total FROM orders WHERE status IN ('completed', 'delivered')");
    return { total_orders: total.cnt, by_status: byStatus.map(s => ({ status: s.status, count: s.cnt })), total_revenue: revenue.total };
  } catch (e) {
    return { error: "获取订单统计失败: " + e.message };
  }
}

const TOOL_REGISTRY = {
  getDashboardStats: { fn: getDashboardStats, description: "系统数据概览" },
  getUsersList: { fn: getUsersList, description: "用户列表分页" },
  searchUserByAccount: { fn: searchUserByAccount, description: "按用户名搜索用户" },
  getCurrentTime: { fn: getCurrentTime, description: "当前时间" },
  getProductStats: { fn: getProductStats, description: "商品统计" },
  getOrderStats: { fn: getOrderStats, description: "订单统计" },
};

class ConversationManager {
  static async ensureTable() {
    try {
      await run(`CREATE TABLE IF NOT EXISTS ai_conversation (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        role VARCHAR(10) NOT NULL,
        content TEXT NOT NULL,
        tool_name VARCHAR(50) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    } catch (e) {
      console.error("[ConversationManager] 建表失败:", e.message);
    }
  }
  static async loadHistory(userId) {
    try {
      return await query("SELECT role, content, tool_name FROM ai_conversation WHERE user_id = ? ORDER BY id ASC", [userId]);
    } catch (e) {
      console.error("[ConversationManager] 加载历史失败:", e.message);
      return [];
    }
  }
  static async saveMessage(userId, role, content, toolName = null) {
    try {
      await run("INSERT INTO ai_conversation (user_id, role, content, tool_name) VALUES (?, ?, ?, ?)", [userId, role, content, toolName]);
    } catch (e) {
      console.error("[ConversationManager] 保存消息失败:", e.message);
    }
  }
  static async clearHistory(userId) {
    try {
      await run("DELETE FROM ai_conversation WHERE user_id = ?", [userId]);
    } catch (e) {
      console.error("[ConversationManager] 清空历史失败:", e.message);
    }
  }
}

const AGENT_SYSTEM_PROMPT = `你是一位精通电商管理的智能助手，运行在"智能商城"管理系统中。
回答规则：1)代码含注释 2)直白 3)专业术语带例子。
能力：查询数据概览、用户列表、搜索用户、时间、商品统计、订单统计。
优先调用工具获取实时数据。`;

async function executeToolCall(toolName, toolArgs) {
  const tool = TOOL_REGISTRY[toolName];
  if (!tool) return JSON.stringify({ error: "未知工具: " + toolName });
  try {
    const result = await tool.fn(...Object.values(toolArgs || {}));
    return JSON.stringify(result, null, 2);
  } catch (e) {
    return JSON.stringify({ error: e.message });
  }
}

function buildApiMessages(history, userQuestion, pageContext = '') {
  let systemContent = AGENT_SYSTEM_PROMPT;
  if (pageContext) {
    systemContent += "\n\n【当前页面数据】\n" + pageContext + "\n\n请根据以上页面数据回答用户的问题。如果用户询问页面上的数据，直接参考以上数据回答，不需要额外调用工具。";
  }
  const messages = [{ role: "system", content: systemContent }];
  for (const msg of history) {
    if (msg.role === "system") continue;
    messages.push({ role: msg.role, content: msg.content, tool_call_id: msg.tool_call_id });
  }
  messages.push({ role: "user", content: userQuestion });
  return messages;
}

const TOOL_SCHEMAS = [
  { type: "function", function: { name: "getDashboardStats", description: "获取系统数据概览", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "getUsersList", description: "分页查询用户列表", parameters: { type: "object", properties: { page: { type: "number" }, size: { type: "number" } }, required: [] } } },
  { type: "function", function: { name: "searchUserByAccount", description: "根据用户名查找用户", parameters: { type: "object", properties: { account: { type: "string" } }, required: ["account"] } } },
  { type: "function", function: { name: "getCurrentTime", description: "获取当前时间", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "getProductStats", description: "获取商品统计", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "getOrderStats", description: "获取订单统计", parameters: { type: "object", properties: {}, required: [] } } },
];

async function callDeepSeek(messages, tools) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("未配置 DEEPSEEK_API_KEY 环境变量");
  const body = { model: "deepseek-chat", messages, temperature: 0.7, stream: false };
  if (tools) body.tools = tools;
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`DeepSeek API 请求失败 (${res.status}): ${errorText}`);
  }
  const data = await res.json();
  return data.choices[0].message;
}

export async function deepseekReply(question, userId = 0, pageContext = '') {
  let history = [];
  if (userId > 0) {
    await ConversationManager.ensureTable();
    history = await ConversationManager.loadHistory(userId);
    await ConversationManager.saveMessage(userId, "user", question);
  }
  let messages = buildApiMessages(history, question, pageContext);
  const maxRounds = 5;
  let finalAnswer = "";
  for (let round = 0; round < maxRounds; round++) {
    const response = await callDeepSeek(messages, round === 0 ? TOOL_SCHEMAS : undefined);
    if (!response.tool_calls || response.tool_calls.length === 0) {
      finalAnswer = response.content;
      break;
    }
    for (const tc of response.tool_calls) {
      const toolName = tc.function.name;
      let toolArgs = {};
      try { toolArgs = JSON.parse(tc.function.arguments); } catch {}
      console.log(`[AGI] 调用工具: ${toolName}`);
      const toolResult = await executeToolCall(toolName, toolArgs);
      messages.push({ role: "assistant", content: null, tool_calls: [{ id: tc.id, type: "function", function: { name: toolName, arguments: tc.function.arguments } }] });
      messages.push({ role: "tool", content: toolResult, tool_call_id: tc.id });
      if (userId > 0) {
        await ConversationManager.saveMessage(userId, "assistant", `[调用工具: ${toolName}]`, toolName);
        await ConversationManager.saveMessage(userId, "tool", toolResult, toolName);
      }
    }
  }
  if (!finalAnswer) finalAnswer = response?.content || "抱歉，处理超时。";
  if (userId > 0) await ConversationManager.saveMessage(userId, "assistant", finalAnswer);
  return finalAnswer;
}

export async function clearConversation(userId) {
  return ConversationManager.clearHistory(userId);
}

export function getToolDescriptions() {
  return Object.entries(TOOL_REGISTRY).map(([name, tool]) => ({ name, description: tool.description }));
}

