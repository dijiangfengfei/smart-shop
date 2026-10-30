// ============================================================
// 后端单元测试 — 订单状态机、支付方式、积分会员
// ============================================================
import { describe, it, expect } from "vitest"

// ---- 订单状态常量（从 orders.js 提取） ----
const ORDER_STATUS = {
  PENDING: "pending",
  PAID: "paid",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  REFUNDING: "refunding",
  REFUNDED: "refunded",
}

const STATUS_TRANSITIONS = {
  [ORDER_STATUS.PENDING]:    [ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PAID]:       [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUNDING],
  [ORDER_STATUS.SHIPPED]:    [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]:  [ORDER_STATUS.COMPLETED, ORDER_STATUS.REFUNDING],
  [ORDER_STATUS.COMPLETED]:  [ORDER_STATUS.REFUNDING],
  [ORDER_STATUS.REFUNDING]:  [ORDER_STATUS.REFUNDED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CANCELLED]:  [],
  [ORDER_STATUS.REFUNDED]:   [],
}

function canTransition(from, to) {
  const allowed = STATUS_TRANSITIONS[from]
  return allowed && allowed.includes(to)
}

function statusLabel(status) {
  const labels = {
    pending: "待处理", paid: "已支付", shipped: "已发货",
    delivered: "已送达", completed: "已完成", cancelled: "已取消",
    refunding: "退款中", refunded: "已退款",
  }
  return labels[status] || status
}

// ---- 支付方式 ----
const PAYMENT_METHODS = ["wechat", "alipay", "card", "cod"]

function paymentLabel(method) {
  const labels = { wechat: "微信支付", alipay: "支付宝", card: "银行卡", cod: "货到付款" }
  return labels[method] || method
}

// ---- 会员积分 ----
const MEMBERSHIP_CONFIG = {
  bronze: { label: "铜牌会员", multiplier: 1 },
  silver: { label: "银牌会员", multiplier: 1.2 },
  gold:   { label: "金牌会员", multiplier: 1.5 },
  diamond:{ label: "钻石会员", multiplier: 2 },
}

function getLevelByPoints(points) {
  if (points >= 10000) return "diamond"
  if (points >= 5000)  return "gold"
  if (points >= 1000)  return "silver"
  return "bronze"
}

// ---- 订单号生成 ----
function genOrderNo(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  const h = String(date.getHours()).padStart(2, "0")
  const mi = String(date.getMinutes()).padStart(2, "0")
  const s = String(date.getSeconds()).padStart(2, "0")
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, "0")
  return `ORD${y}${m}${d}${h}${mi}${s}${rand}`
}

// ===================== 测试用例 =====================

describe("订单状态机", () => {
  describe("canTransition", () => {
    it("待处理 → 已支付 (合法)", () => {
      expect(canTransition("pending", "paid")).toBe(true)
    })

    it("待处理 → 已取消 (合法)", () => {
      expect(canTransition("pending", "cancelled")).toBe(true)
    })

    it("待处理 → 已完成 (非法)", () => {
      expect(canTransition("pending", "completed")).toBe(false)
    })

    it("已支付 → 已发货 (合法)", () => {
      expect(canTransition("paid", "shipped")).toBe(true)
    })

    it("已支付 → 退款中 (合法)", () => {
      expect(canTransition("paid", "refunding")).toBe(true)
    })

    it("已发货 → 已送达 (合法)", () => {
      expect(canTransition("shipped", "delivered")).toBe(true)
    })

    it("已发货 → 已取消 (非法)", () => {
      expect(canTransition("shipped", "cancelled")).toBe(false)
    })

    it("已送达 → 已完成 (合法)", () => {
      expect(canTransition("delivered", "completed")).toBe(true)
    })

    it("已完成 → 退款中 (合法)", () => {
      expect(canTransition("completed", "refunding")).toBe(true)
    })

    it("退款中 → 已退款 (合法)", () => {
      expect(canTransition("refunding", "refunded")).toBe(true)
    })

    it("已取消 → 任何状态都不允许", () => {
      Object.values(ORDER_STATUS).forEach(to => {
        expect(canTransition("cancelled", to)).toBe(false)
      })
    })

    it("已退款 → 任何状态都不允许", () => {
      Object.values(ORDER_STATUS).forEach(to => {
        expect(canTransition("refunded", to)).toBe(false)
      })
    })
  })

  describe("statusLabel", () => {
    it("返回中文状态标签", () => {
      expect(statusLabel("pending")).toBe("待处理")
      expect(statusLabel("paid")).toBe("已支付")
      expect(statusLabel("shipped")).toBe("已发货")
      expect(statusLabel("delivered")).toBe("已送达")
      expect(statusLabel("completed")).toBe("已完成")
      expect(statusLabel("cancelled")).toBe("已取消")
      expect(statusLabel("refunding")).toBe("退款中")
      expect(statusLabel("refunded")).toBe("已退款")
    })

    it("未知状态返回原值", () => {
      expect(statusLabel("unknown")).toBe("unknown")
    })
  })
})

describe("支付方式", () => {
  it("支付方式列表包含4种", () => {
    expect(PAYMENT_METHODS).toHaveLength(4)
    expect(PAYMENT_METHODS).toContain("wechat")
    expect(PAYMENT_METHODS).toContain("alipay")
    expect(PAYMENT_METHODS).toContain("card")
    expect(PAYMENT_METHODS).toContain("cod")
  })

  it("返回中文标签", () => {
    expect(paymentLabel("wechat")).toBe("微信支付")
    expect(paymentLabel("alipay")).toBe("支付宝")
    expect(paymentLabel("card")).toBe("银行卡")
    expect(paymentLabel("cod")).toBe("货到付款")
  })

  it("未知支付方式返回原值", () => {
    expect(paymentLabel("bitcoin")).toBe("bitcoin")
  })
})

describe("会员积分", () => {
  describe("getLevelByPoints", () => {
    it("0积分 → 铜牌会员", () => {
      expect(getLevelByPoints(0)).toBe("bronze")
    })

    it("500积分 → 铜牌会员", () => {
      expect(getLevelByPoints(500)).toBe("bronze")
    })

    it("1000积分 → 银牌会员", () => {
      expect(getLevelByPoints(1000)).toBe("silver")
    })

    it("3000积分 → 银牌会员", () => {
      expect(getLevelByPoints(3000)).toBe("silver")
    })

    it("5000积分 → 金牌会员", () => {
      expect(getLevelByPoints(5000)).toBe("gold")
    })

    it("8000积分 → 金牌会员", () => {
      expect(getLevelByPoints(8000)).toBe("gold")
    })

    it("10000积分 → 钻石会员", () => {
      expect(getLevelByPoints(10000)).toBe("diamond")
    })

    it("50000积分 → 钻石会员", () => {
      expect(getLevelByPoints(50000)).toBe("diamond")
    })
  })

  describe("积分倍数", () => {
    it("铜牌 1x", () => {
      expect(MEMBERSHIP_CONFIG.bronze.multiplier).toBe(1)
    })
    it("银牌 1.2x", () => {
      expect(MEMBERSHIP_CONFIG.silver.multiplier).toBe(1.2)
    })
    it("金牌 1.5x", () => {
      expect(MEMBERSHIP_CONFIG.gold.multiplier).toBe(1.5)
    })
    it("钻石 2x", () => {
      expect(MEMBERSHIP_CONFIG.diamond.multiplier).toBe(2)
    })
  })
})

describe("订单号生成", () => {
  it("格式为 ORD + 14位时间 + 4位随机码", () => {
    const fixedDate = new Date("2024-06-15T14:30:25")
    const orderNo = genOrderNo(fixedDate)
    expect(orderNo).toMatch(/^ORD\d{8}\d{6}\d{4}$/)
    expect(orderNo.startsWith("ORD20240615143025")).toBe(true)
  })

  it("每次生成的订单号不同（随机码不同）", () => {
    const no1 = genOrderNo()
    const no2 = genOrderNo()
    // 极小概率相同，十次取一次不同即可
    const results = Array.from({ length: 10 }, () => genOrderNo())
    const unique = new Set(results)
    expect(unique.size).toBeGreaterThan(1)
  })
})
