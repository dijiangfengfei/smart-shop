<template>
  <div class="ai-chat-widget" :class="{ open: visible }">
    <!-- 悬浮按钮 -->
    <button class="ai-toggle-btn" @click="visible = !visible" :title="visible ? '关闭AI' : '打开AI助手'">
      <i class="fas" :class="visible ? 'fa-times' : 'fa-robot'"></i>
    </button>

    <!-- 聊天面板 -->
    <Transition name="slide-up">
      <div v-if="visible" class="ai-panel">
        <!-- 头部 -->
        <div class="ai-header">
          <div class="ai-header-left">
            <i class="fas fa-robot" style="color: var(--primary);"></i>
            <span>AI 智能助手</span>
          </div>
          <div class="ai-header-actions">
            <button class="ai-clear-btn" @click="clearHistory" title="清空对话">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </div>

        <!-- 消息列表 -->
        <div class="ai-messages" ref="messagesRef">
          <div v-if="messages.length === 0" class="ai-empty">
            <i class="fas fa-robot" style="font-size: 48px; color: var(--border); margin-bottom: 12px;"></i>
            <p style="color: var(--text-light);">问我关于商城的问题吧！</p>
            <div class="ai-suggestions">
              <span class="ai-suggestion-tag" @click="sendSuggestion('系统数据概览')">📊 数据概览</span>
              <span class="ai-suggestion-tag" @click="sendSuggestion('有哪些商品')">🛒 商品列表</span>
              <span class="ai-suggestion-tag" @click="sendSuggestion('帮我查用户信息')">👤 查用户</span>
              <span class="ai-suggestion-tag" @click="sendSuggestion('订单统计')">📦 订单统计</span>
            </div>
          </div>
          <div v-for="(msg, idx) in messages" :key="idx" class="ai-msg" :class="msg.role">
            <div class="ai-msg-avatar">
              <i :class="msg.role === 'user' ? 'fas fa-user' : 'fas fa-robot'"></i>
            </div>
            <div class="ai-msg-bubble">
              <div class="ai-msg-content" v-html="renderMarkdown(msg.content)"></div>
              <div v-if="msg.tool_name" class="ai-msg-tool">
                <i class="fas fa-tools"></i> 调用了: {{ msg.tool_name }}
              </div>
            </div>
          </div>
          <div v-if="loading" class="ai-msg assistant">
            <div class="ai-msg-avatar"><i class="fas fa-robot"></i></div>
            <div class="ai-msg-bubble">
              <div class="ai-thinking"><span></span><span></span><span></span></div>
            </div>
          </div>
        </div>

        <!-- 输入区 -->
        <div class="ai-input-area">
          <input
            v-model="inputText"
            class="ai-input"
            placeholder="输入你的问题..."
            @keydown.enter="sendMessage"
            :disabled="loading"
          />
          <button class="ai-send-btn" @click="sendMessage" :disabled="loading || !inputText.trim()">
            <i class="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue'
import { aiApi } from '../api.js'

const props = defineProps({
  pageContext: { type: String, default: '' }
})

const visible = ref(false)
const messages = ref([])
const inputText = ref('')
const loading = ref(false)
const messagesRef = ref(null)

async function scrollToBottom() {
  await nextTick()
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || loading.value) return

  messages.value.push({ role: 'user', content: text })
  inputText.value = ''
  loading.value = true
  scrollToBottom()

  try {
    const res = await aiApi.chat(text, props.pageContext)
    messages.value.push({
      role: 'assistant',
      content: res.data.answer,
      timestamp: res.data.timestamp,
    })
  } catch (err) {
    messages.value.push({
      role: 'assistant',
      content: '抱歉，AI 回复出错了: ' + err.message,
    })
  } finally {
    loading.value = false
    scrollToBottom()
  }
}

function sendSuggestion(text) {
  inputText.value = text
  sendMessage()
}

async function clearHistory() {
  try {
    await aiApi.clearHistory()
  } catch { /* ignore */ }
  messages.value = []
}

function renderMarkdown(text) {
  if (!text) return ''
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
  return html
}

watch(visible, (val) => {
  if (val) scrollToBottom()
})
</script>

<style scoped>
.ai-chat-widget {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 10000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.ai-toggle-btn {
  width: 56px; height: 56px; border-radius: 50%; border: none;
  background: linear-gradient(135deg, var(--primary, #667eea), var(--primary-dark, #764ba2));
  color: #fff; font-size: 24px; cursor: pointer;
  box-shadow: 0 4px 16px rgba(102,126,234,0.4);
  transition: transform 0.3s, box-shadow 0.3s;
  display: flex; align-items: center; justify-content: center;
}
.ai-toggle-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 24px rgba(102,126,234,0.6);
}
.ai-panel {
  position: absolute; bottom: 68px; right: 0;
  width: 380px; height: 520px;
  background: #fff; border-radius: 16px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.15);
  display: flex; flex-direction: column; overflow: hidden;
}
.ai-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px;
  background: linear-gradient(135deg, #f8f9ff, #f0f2ff);
  border-bottom: 1px solid var(--border, #e2e8f0);
}
.ai-header-left {
  display: flex; align-items: center; gap: 8px;
  font-weight: 600; font-size: 15px; color: var(--text, #1e293b);
}
.ai-clear-btn {
  background: none; border: none;
  color: var(--text-light, #94a3b8); cursor: pointer;
  font-size: 14px; padding: 4px 8px; border-radius: 6px;
  transition: background 0.2s;
}
.ai-clear-btn:hover { background: rgba(0,0,0,0.05); color: #ef4444; }
.ai-messages { flex: 1; overflow-y: auto; padding: 16px; scroll-behavior: smooth; }
.ai-empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; height: 100%; gap: 8px;
}
.ai-suggestions {
  display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; justify-content: center;
}
.ai-suggestion-tag {
  padding: 6px 14px; background: #f1f5f9; border-radius: 20px;
  font-size: 13px; color: var(--text, #1e293b); cursor: pointer;
  transition: background 0.2s, transform 0.15s;
}
.ai-suggestion-tag:hover {
  background: var(--primary, #667eea); color: #fff; transform: scale(1.05);
}
.ai-msg { display: flex; gap: 10px; margin-bottom: 16px; animation: fadeIn 0.3s ease; }
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.ai-msg.user { flex-direction: row-reverse; }
.ai-msg-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 14px;
}
.ai-msg.user .ai-msg-avatar { background: var(--primary, #667eea); color: #fff; }
.ai-msg.assistant .ai-msg-avatar { background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; }
.ai-msg-bubble {
  max-width: 75%; padding: 10px 14px; border-radius: 12px;
  font-size: 14px; line-height: 1.6; word-break: break-word;
}
.ai-msg.user .ai-msg-bubble {
  background: var(--primary, #667eea); color: #fff; border-bottom-right-radius: 4px;
}
.ai-msg.assistant .ai-msg-bubble {
  background: #f1f5f9; color: var(--text, #1e293b); border-bottom-left-radius: 4px;
}
.ai-msg-content :deep(pre) {
  background: #1e293b; color: #e2e8f0; padding: 12px; border-radius: 8px;
  overflow-x: auto; font-size: 13px; margin: 8px 0;
}
.ai-msg-content :deep(code) {
  background: rgba(0,0,0,0.06); padding: 2px 6px; border-radius: 4px; font-size: 13px;
}
.ai-msg.user .ai-msg-content :deep(code) {
  background: rgba(255,255,255,0.2); color: #fff;
}
.ai-msg-tool {
  font-size: 12px; color: var(--text-light, #94a3b8);
  margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border, #e2e8f0);
}
.ai-thinking { display: flex; gap: 4px; padding: 4px 0; }
.ai-thinking span {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--primary, #667eea);
  animation: bounce 1.4s infinite ease-in-out both;
}
.ai-thinking span:nth-child(1) { animation-delay: -0.32s; }
.ai-thinking span:nth-child(2) { animation-delay: -0.16s; }
.ai-thinking span:nth-child(3) { animation-delay: 0s; }
@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}
.ai-input-area {
  display: flex; gap: 8px; padding: 12px 16px;
  border-top: 1px solid var(--border, #e2e8f0); background: #fff;
}
.ai-input {
  flex: 1; padding: 10px 14px;
  border: 1px solid var(--border, #e2e8f0); border-radius: 24px;
  font-size: 14px; outline: none; transition: border-color 0.2s;
}
.ai-input:focus { border-color: var(--primary, #667eea); }
.ai-send-btn {
  width: 40px; height: 40px; border-radius: 50%; border: none;
  background: var(--primary, #667eea); color: #fff; font-size: 16px;
  cursor: pointer; transition: background 0.2s, transform 0.15s;
  display: flex; align-items: center; justify-content: center;
}
.ai-send-btn:hover:not(:disabled) {
  background: var(--primary-dark, #764ba2); transform: scale(1.05);
}
.ai-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.slide-up-enter-active { animation: slideUpIn 0.3s ease; }
.slide-up-leave-active { animation: slideUpIn 0.25s ease reverse; }
@keyframes slideUpIn {
  from { opacity: 0; transform: translateY(20px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.ai-messages::-webkit-scrollbar { width: 4px; }
.ai-messages::-webkit-scrollbar-track { background: transparent; }
.ai-messages::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
</style>

