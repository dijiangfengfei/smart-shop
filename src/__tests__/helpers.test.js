// ============================================================
// 前端单元测试 — 工具函数：关键词高亮、支付方式、会员等级
// ============================================================
import { describe, it, expect } from "vitest"

// ---- 关键词高亮 ----
function highlightText(text, keyword) {
  if (!keyword || !keyword.trim()) return text
  const keywords = keyword.trim().split(/\s+/).filter(Boolean)
  let result = text
  for (const kw of keywords) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    result = result.replace(new RegExp(`(${escaped})`, "gi"), `<mark class="highlight">$1</mark>`)
  }
  return result
}

// ---- 支付方式配置 ----
const paymentMethods = [
  { value: "wechat", label: "微信支付", icon: "fa-weixin", iconType: "fab", color: "#07c160" },
  { value: "alipay", label: "支付宝", icon: "fa-alipay", iconType: "fab", color: "#1677ff" },
  { value: "card", label: "银行卡", icon: "fa-credit-card", iconType: "fas", color: "#6366f1" },
  { value: "cod", label: "货到付款", icon: "fa-box", iconType: "fas", color: "#f59e0b" },
]

function paymentLabel(method) {
  const m = paymentMethods.find(p => p.value === method)
  return m ? m.label : method
}

function paymentConfig(method) {
  return paymentMethods.find(p => p.value === method) || {}
}

// ---- 会员等级 ----
function membershipLabel(level) {
  const labels = { bronze: "铜牌会员", silver: "银牌会员", gold: "金牌会员", diamond: "钻石会员" }
  return labels[level] || level
}

function membershipColor(level) {
  const colors = { bronze: "#cd7f32", silver: "#a8a8a8", gold: "#f59e0b", diamond: "#6366f1" }
  return colors[level] || "#cd7f32"
}

const levelMin = { bronze: 0, silver: 1000, gold: 5000, diamond: 10000 }

function progressPercent(points, membership, nextLevel) {
  if (!nextLevel) return 100
  const currentMin = levelMin[membership] || 0
  const nextMin = levelMin[nextLevel] || 10000
  const range = nextMin - currentMin
  const progress = points - currentMin
  return Math.min(100, Math.max(0, (progress / range) * 100))
}

// ===================== 测试用例 =====================

describe("highlightText — 关键词高亮", () => {
  it("无关键词时返回原文", () => {
    expect(highlightText("测试商品", "")).toBe("测试商品")
    expect(highlightText("测试商品", "   ")).toBe("测试商品")
  })

  it("单个关键词高亮", () => {
    const result = highlightText("智能降噪耳机", "耳机")
    expect(result).toBe(`智能降噪<mark class="highlight">耳机</mark>`)
  })

  it("多关键词高亮", () => {
    const result = highlightText("智能降噪耳机 Pro", "智能 Pro")
    expect(result).toContain(`<mark class="highlight">智能</mark>`)
    expect(result).toContain(`<mark class="highlight">Pro</mark>`)
  })

  it("不区分大小写", () => {
    const result = highlightText("iPhone 15 Pro", "iphone")
    expect(result).toContain(`<mark class="highlight">iPhone</mark>`)
  })

  it("正则特殊字符转义", () => {
    const result = highlightText("价格 (100)", "(100)")
    expect(result).toBe("价格 <mark class=\"highlight\">(100)</mark>")
  })

  it("无匹配时返回原文", () => {
    expect(highlightText("耳机", "手机")).toBe("耳机")
  })
})

describe("支付方式", () => {
  it("paymentLabel 返回中文标签", () => {
    expect(paymentLabel("wechat")).toBe("微信支付")
    expect(paymentLabel("alipay")).toBe("支付宝")
    expect(paymentLabel("card")).toBe("银行卡")
    expect(paymentLabel("cod")).toBe("货到付款")
  })

  it("未知支付方式返回原值", () => {
    expect(paymentLabel("unknown")).toBe("unknown")
  })

  it("paymentConfig 返回颜色和图标", () => {
    expect(paymentConfig("wechat").color).toBe("#07c160")
    expect(paymentConfig("wechat").icon).toBe("fa-weixin")
    expect(paymentConfig("alipay").color).toBe("#1677ff")
    expect(paymentConfig("cod").iconType).toBe("fas")
  })

  it("未知支付方式返回空对象", () => {
    expect(paymentConfig("unknown")).toEqual({})
  })
})

describe("会员等级", () => {
  it("membershipLabel 返回中文标签", () => {
    expect(membershipLabel("bronze")).toBe("铜牌会员")
    expect(membershipLabel("silver")).toBe("银牌会员")
    expect(membershipLabel("gold")).toBe("金牌会员")
    expect(membershipLabel("diamond")).toBe("钻石会员")
  })

  it("membershipColor 返回颜色值", () => {
    expect(membershipColor("bronze")).toBe("#cd7f32")
    expect(membershipColor("silver")).toBe("#a8a8a8")
    expect(membershipColor("gold")).toBe("#f59e0b")
    expect(membershipColor("diamond")).toBe("#6366f1")
  })

  describe("progressPercent — 等级进度", () => {
    it("铜牌 500/1000 → 50%", () => {
      expect(progressPercent(500, "bronze", "silver")).toBeCloseTo(50)
    })

    it("铜牌 0/1000 → 0%", () => {
      expect(progressPercent(0, "bronze", "silver")).toBeCloseTo(0)
    })

    it("铜牌 1000/1000 → 100%", () => {
      expect(progressPercent(1000, "bronze", "silver")).toBeCloseTo(100)
    })

    it("银牌 3000 → gold(5000) → 50%", () => {
      expect(progressPercent(3000, "silver", "gold")).toBeCloseTo(50)
    })

    it("金牌 8000 → diamond(10000) → 60%", () => {
      expect(progressPercent(8000, "gold", "diamond")).toBeCloseTo(60)
    })

    it("无下一级返回100%", () => {
      expect(progressPercent(20000, "diamond", null)).toBe(100)
    })
  })
})
