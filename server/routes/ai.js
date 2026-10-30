// ============================================================
// AI 智能助手 API 路由
// ============================================================
import { Router } from 'express'
import { authMiddleware, optionalAuth } from '../middleware/auth.js'
import { deepseekReply, clearConversation, getToolDescriptions } from '../services/ai.js'

const router = Router()

// POST /api/ai/chat — 发送消息给 AI 助手
router.post('/chat', optionalAuth, async (req, res) => {
  try {
    const { question, page_context } = req.body
    if (!question || !question.trim()) {
      return res.status(400).json({ error: '请输入问题' })
    }

    const userId = req.user?.id || 0
    const answer = await deepseekReply(question.trim(), userId, page_context || '')

    res.json({
      data: {
        question: question.trim(),
        answer,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (err) {
    console.error('[AI Chat] 错误:', err)
    res.status(500).json({ error: 'AI 回复失败', message: err.message })
  }
})

// DELETE /api/ai/history — 清空当前用户的对话历史
router.delete('/history', authMiddleware, async (req, res) => {
  try {
    await clearConversation(req.user.id)
    res.json({ message: '对话历史已清空' })
  } catch (err) {
    res.status(500).json({ error: '清空历史失败', message: err.message })
  }
})

// GET /api/ai/tools — 获取可用工具列表
router.get('/tools', (req, res) => {
  res.json({ data: getToolDescriptions() })
})

export default router

