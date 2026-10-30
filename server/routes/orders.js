// ============================================================
// 订单 API 路由 (MySQL 版) — 完整订单状态机
// ============================================================
import { Router } from "express"
import { query, get, run, getPool } from "../database/db.js"
import { authMiddleware } from "../middleware/auth.js"
import { MEMBERSHIP_CONFIG, getLevelByPoints } from "./points.js"

const router = Router()

router.use(authMiddleware)

// ---- 订单状态常量 ----
export const ORDER_STATUS = {
  PENDING: "pending",       // 待处理（已下单）
  PAID: "paid",             // 已支付
  SHIPPED: "shipped",       // 已发货
  DELIVERED: "delivered",   // 已送达
  COMPLETED: "completed",   // 已完成
  CANCELLED: "cancelled",   // 已取消
  REFUNDING: "refunding",   // 退款中
  REFUNDED: "refunded",     // 已退款
}

// ---- 允许的状态转换映射 ----
export const STATUS_TRANSITIONS = {
  [ORDER_STATUS.PENDING]:    [ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PAID]:       [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUNDING],
  [ORDER_STATUS.SHIPPED]:    [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]:  [ORDER_STATUS.COMPLETED, ORDER_STATUS.REFUNDING],
  [ORDER_STATUS.COMPLETED]:  [ORDER_STATUS.REFUNDING],
  [ORDER_STATUS.REFUNDING]:  [ORDER_STATUS.REFUNDED, ORDER_STATUS.CANCELLED, ORDER_STATUS.PAID],
  [ORDER_STATUS.CANCELLED]:  [],
  [ORDER_STATUS.REFUNDED]:   [],
}

function genOrderNo() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  const h = String(now.getHours()).padStart(2, "0")
  const mi = String(now.getMinutes()).padStart(2, "0")
  const s = String(now.getSeconds()).padStart(2, "0")
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, "0")
  return `ORD${y}${m}${d}${h}${mi}${s}${rand}`
}

export function statusLabel(status) {
  const labels = {
    pending: "待处理", paid: "已支付", shipped: "已发货",
    delivered: "已送达", completed: "已完成", cancelled: "已取消",
    refunding: "退款中", refunded: "已退款",
  }
  return labels[status] || status
}

// 检查状态转换是否允许
export function canTransition(from, to) {
  const allowed = STATUS_TRANSITIONS[from]
  return allowed && allowed.includes(to)
}

// 处理订单状态变更时的积分变动
export async function handlePointsForStatusChange(connection, order, newStatus) {
  if (newStatus === ORDER_STATUS.COMPLETED && order.points_earned === 0) {
    const [[user]] = await connection.execute(
      "SELECT points, membership FROM users WHERE id = ?", [order.user_id]
    )
    const membership = (user && user.membership) || "bronze"
    const multiplier = (MEMBERSHIP_CONFIG[membership] || MEMBERSHIP_CONFIG.bronze).multiplier
    const earned = Math.floor(order.total * multiplier)

    await connection.execute("UPDATE users SET points = points + ? WHERE id = ?", [earned, order.user_id])
    await connection.execute("UPDATE orders SET points_earned = ? WHERE id = ?", [earned, order.id])
    await connection.execute(
      "INSERT INTO points_log (user_id, points, type, description, order_no) VALUES (?, ?, 'earn', ?, ?)",
      [order.user_id, earned, `订单完成奖励(+${earned}积分, ${multiplier}x倍数)`, order.order_no]
    )

    const [[updated]] = await connection.execute("SELECT points FROM users WHERE id = ?", [order.user_id])
    const newLevel = getLevelByPoints(updated ? updated.points : 0)
    if (newLevel !== membership) {
      await connection.execute("UPDATE users SET membership = ? WHERE id = ?", [newLevel, order.user_id])
    }
    return earned
  }

  if (newStatus === ORDER_STATUS.REFUNDED && order.points_earned > 0) {
    await connection.execute("UPDATE users SET points = GREATEST(points - ?, 0) WHERE id = ?", [order.points_earned, order.user_id])
    await connection.execute(
      "INSERT INTO points_log (user_id, points, type, description, order_no) VALUES (?, ?, 'spend', ?, ?)",
      [order.user_id, -order.points_earned, `订单退款扣除积分(${order.points_earned}积分)`, order.order_no]
    )
    return -order.points_earned
  }
  return 0
}

// 支付方式
const PAYMENT_METHODS = ["wechat", "alipay", "card", "cod"]

export function paymentLabel(method) {
  const labels = { wechat: "微信支付", alipay: "支付宝", card: "银行卡", cod: "货到付款" }
  return labels[method] || method
}

// POST /api/orders — 创建订单
router.post("/", async (req, res) => {
  try {
    const { address, payment_method } = req.body

    if (!payment_method || !PAYMENT_METHODS.includes(payment_method)) {
      return res.status(400).json({ error: "请选择有效的支付方式" })
    }

    const cartItems = await query(`
      SELECT c.product_id, c.qty, p.name, p.price, p.stock, p.status
      FROM cart c
      JOIN products p ON c.product_id = p.id
      WHERE c.user_id = ?
    `, [req.user.id])

    if (cartItems.length === 0) {
      return res.status(400).json({ error: "购物车为空，无法下单" })
    }

    // 校验库存
    for (const item of cartItems) {
      if (item.status === "off") {
        return res.status(400).json({ error: `商品"${item.name}"已下架，无法下单` })
      }
      if (item.qty > item.stock) {
        return res.status(400).json({ error: `商品"${item.name}"库存不足，当前库存仅 ${item.stock} 件` })
      }
    }

    const total = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0)
    const orderNo = genOrderNo()

    const pool = await getPool()
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()

      const [orderResult] = await connection.execute(
        "INSERT INTO orders (order_no, user_id, total, address, status, payment_method) VALUES (?, ?, ?, ?, ?, ?)",
        [orderNo, req.user.id, total, address || "", ORDER_STATUS.PENDING, payment_method]
      )
      const orderId = orderResult.insertId

      for (const item of cartItems) {
        await connection.execute(
          "INSERT INTO order_items (order_id, product_id, name, price, qty) VALUES (?, ?, ?, ?, ?)",
          [orderId, item.product_id, item.name, item.price, item.qty]
        )
        // 扣减库存
        await connection.execute(
          "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?",
          [item.qty, item.product_id, item.qty]
        )
      }

      await connection.execute("DELETE FROM cart WHERE user_id = ?", [req.user.id])

      await connection.commit()

      res.status(201).json({
        message: "下单成功",
        data: { order_id: orderId, order_no: orderNo, total, status: ORDER_STATUS.PENDING, payment_method, payment_label: paymentLabel(payment_method) }
      })
    } catch (err) {
      await connection.rollback()
      throw err
    } finally {
      connection.release()
    }
  } catch (err) {
    res.status(500).json({ error: "创建订单失败", message: err.message })
  }
})

// GET /api/orders — 获取用户订单列表
router.get("/", async (req, res) => {
  try {
    const orders = await query(
      "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC",
      [req.user.id]
    )
    // 附带状态中文标签 + 支付方式标签
    const result = orders.map(o => ({
      ...o,
      status_label: statusLabel(o.status),
      payment_label: paymentLabel(o.payment_method)
    }))
    res.json({ data: result })
  } catch (err) {
    res.status(500).json({ error: "获取订单列表失败", message: err.message })
  }
})

// GET /api/orders/:id — 获取订单详情
router.get("/:id", async (req, res) => {
  try {
    const order = await get(
      "SELECT * FROM orders WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    )
    if (!order) return res.status(404).json({ error: "订单不存在" })

    const items = await query(
      "SELECT * FROM order_items WHERE order_id = ?",
      [order.id]
    )

    res.json({ data: { ...order, status_label: statusLabel(order.status), payment_label: paymentLabel(order.payment_method), items } })
  } catch (err) {
    res.status(500).json({ error: "获取订单详情失败", message: err.message })
  }
})

// PUT /api/orders/:id/status — 更新订单状态（状态机流转）
router.put("/:id/status", async (req, res) => {
  try {
    const { status: newStatus } = req.body
    if (!newStatus) {
      return res.status(400).json({ error: "缺少目标状态" })
    }

    const order = await get(
      "SELECT id, status, total, user_id, points_earned, order_no FROM orders WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    )
    if (!order) return res.status(404).json({ error: "订单不存在" })

    if (!canTransition(order.status, newStatus)) {
      return res.status(400).json({
        error: `不允许从"${statusLabel(order.status)}"转为"${statusLabel(newStatus)}"`
      })
    }

    const now = new Date()
    const timeFields = {
      paid: "paid_at",
      shipped: "shipped_at",
      delivered: "delivered_at",
      completed: "completed_at",
      cancelled: "cancelled_at",
      refunded: "refunded_at"
    }
    const timeField = timeFields[newStatus]

    // 使用事务处理状态更新 + 积分变动
    const pool = await getPool()
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()

      if (timeField) {
        await connection.execute(
          `UPDATE orders SET status = ?, ${timeField} = ? WHERE id = ?`,
          [newStatus, now, order.id]
        )
      } else {
        await connection.execute(
          "UPDATE orders SET status = ? WHERE id = ?",
          [newStatus, order.id]
        )
      }

      // 取消/退款时恢复库存
      if (newStatus === ORDER_STATUS.CANCELLED || newStatus === ORDER_STATUS.REFUNDED) {
        const [items] = await connection.execute(
          "SELECT product_id, qty FROM order_items WHERE order_id = ?",
          [order.id]
        )
        for (const item of items) {
          await connection.execute(
            "UPDATE products SET stock = stock + ? WHERE id = ?",
            [item.qty, item.product_id]
          )
        }
      }

      const pointsChanged = await handlePointsForStatusChange(connection, order, newStatus)

      await connection.commit()

      let extraMsg = ""
      if (pointsChanged > 0) extraMsg = `，获得 ${pointsChanged} 积分`
      else if (pointsChanged < 0) extraMsg = `，扣除 ${-pointsChanged} 积分`

      res.json({
        message: `订单状态已更新为"${statusLabel(newStatus)}"${extraMsg}`,
        data: { id: order.id, status: newStatus, status_label: statusLabel(newStatus), points_changed: pointsChanged }
      })
    } catch (err) {
      await connection.rollback()
      throw err
    } finally {
      connection.release()
    }
  } catch (err) {
    res.status(500).json({ error: "更新订单状态失败", message: err.message })
  }
})

// PUT /api/orders/:id/cancel — 取消订单（原接口兼容）
router.put("/:id/cancel", async (req, res) => {
  try {
    const order = await get(
      "SELECT id, status FROM orders WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    )
    if (!order) return res.status(404).json({ error: "订单不存在" })

    if (!canTransition(order.status, ORDER_STATUS.CANCELLED)) {
      return res.status(400).json({
        error: `当前订单状态为"${statusLabel(order.status)}"，无法取消`
      })
    }

    const pool = await getPool()
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()

      await connection.execute(
        "UPDATE orders SET status = ? WHERE id = ?",
        [ORDER_STATUS.CANCELLED, order.id]
      )

      // 恢复库存
      const [items] = await connection.execute(
        "SELECT product_id, qty FROM order_items WHERE order_id = ?",
        [order.id]
      )
      for (const item of items) {
        await connection.execute(
          "UPDATE products SET stock = stock + ? WHERE id = ?",
          [item.qty, item.product_id]
        )
      }

      await connection.commit()

      res.json({
        message: "订单已取消，库存已恢复",
        data: { id: order.id, status: ORDER_STATUS.CANCELLED, status_label: statusLabel(ORDER_STATUS.CANCELLED) }
      })
    } catch (err) {
      await connection.rollback()
      throw err
    } finally {
      connection.release()
    }
  } catch (err) {
    res.status(500).json({ error: "取消订单失败", message: err.message })
  }
})

export default router

