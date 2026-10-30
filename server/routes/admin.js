// ============================================================
// 管理端 API 路由 — 商品管理 + 订单管理
// ============================================================
import { Router } from "express"
import { query, get, run, getPool } from "../database/db.js"
import { authMiddleware, adminMiddleware } from "../middleware/auth.js"
import {
  ORDER_STATUS, STATUS_TRANSITIONS, statusLabel, canTransition,
  handlePointsForStatusChange, paymentLabel
} from "./orders.js"

const router = Router()

router.use(authMiddleware)
router.use(adminMiddleware)

// ==================== 商品管理 ====================

// GET /api/admin/products — 获取所有商品（含已下架）
router.get("/products", async (req, res) => {
  try {
    const products = await query("SELECT * FROM products ORDER BY id ASC")
    res.json({ data: products })
  } catch (err) {
    res.status(500).json({ error: "获取商品列表失败", message: err.message })
  }
})

// PUT /api/admin/products/:id/status — 切换商品上下架
router.put("/products/:id/status", async (req, res) => {
  try {
    const { status } = req.body
    if (!status || !["on", "off"].includes(status)) {
      return res.status(400).json({ error: "状态值必须为 on 或 off" })
    }
    const product = await get("SELECT id, name FROM products WHERE id = ?", [req.params.id])
    if (!product) return res.status(404).json({ error: "商品不存在" })

    await run("UPDATE products SET status = ? WHERE id = ?", [status, req.params.id])
    res.json({ message: `商品"${product.name}"已${status === "on" ? "上架" : "下架"}`, data: { id: product.id, status } })
  } catch (err) {
    res.status(500).json({ error: "更新商品状态失败", message: err.message })
  }
})

// PUT /api/admin/products/:id — 编辑商品
router.put("/products/:id", async (req, res) => {
  try {
    const product = await get("SELECT id FROM products WHERE id = ?", [req.params.id])
    if (!product) return res.status(404).json({ error: "商品不存在" })

    const { name, category, price, original, stars, reviews, tag, tag_type, bg, image_url, description, stock } = req.body

    const updates = []
    const params = []
    const fields = { name, category, price, original, stars, reviews, tag, tag_type, bg, image_url, description, stock }
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined && val !== null) {
        updates.push(`${key} = ?`)
        params.push(val)
      }
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: "没有需要更新的字段" })
    }
    params.push(req.params.id)
    await run(`UPDATE products SET ${updates.join(", ")} WHERE id = ?`, params)
    res.json({ message: "商品信息已更新" })
  } catch (err) {
    res.status(500).json({ error: "更新商品失败", message: err.message })
  }
})

// POST /api/admin/products — 新增商品
router.post("/products", async (req, res) => {
  try {
    const { name, category, price, original, stars, reviews, tag, tag_type, bg, image_url, description, stock } = req.body

    if (!name || !category || !price) {
      return res.status(400).json({ error: "商品名称、分类、价格不能为空" })
    }

    const result = await run(
      `INSERT INTO products (name, category, price, original, stars, reviews, tag, tag_type, bg, image_url, description, stock, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "on")`,
      [name, category, price, original || null, stars || 5, reviews || 0, tag || null, tag_type || null, bg || "#f1f5f9", image_url || "", description || null, stock || 99]
    )
    res.status(201).json({ message: "商品已添加", data: { id: result.insertId } })
  } catch (err) {
    res.status(500).json({ error: "添加商品失败", message: err.message })
  }
})

// DELETE /api/admin/products/:id — 删除商品
router.delete("/products/:id", async (req, res) => {
  try {
    const product = await get("SELECT id, name FROM products WHERE id = ?", [req.params.id])
    if (!product) return res.status(404).json({ error: "商品不存在" })

    await run("DELETE FROM products WHERE id = ?", [req.params.id])
    res.json({ message: `商品"${product.name}"已删除` })
  } catch (err) {
    res.status(500).json({ error: "删除商品失败", message: err.message })
  }
})

// ==================== 订单管理 ====================

// GET /api/admin/orders — 所有订单列表（分页、搜索、筛选）
router.get("/orders", async (req, res) => {
  try {
    const { page, limit, q, status } = req.query

    const pageNum = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20))
    const offset = (pageNum - 1) * limitNum

    const whereClauses = []
    const params = []

    if (q && q.trim()) {
      whereClauses.push("(o.order_no LIKE ? OR u.username LIKE ?)")
      const kw = `%${q.trim()}%`
      params.push(kw, kw)
    }

    if (status && status !== "all") {
      whereClauses.push("o.status = ?")
      params.push(status)
    }

    const whereSQL = whereClauses.length ? "WHERE " + whereClauses.join(" AND ") : ""

    // 查询总数
    const countSQL = `SELECT COUNT(*) AS total FROM orders o LEFT JOIN users u ON o.user_id = u.id ${whereSQL}`
    const countResult = await query(countSQL, params)
    const total = countResult[0].total
    const totalPages = Math.ceil(total / limitNum)

    // 查询分页数据
    const dataSQL = `
      SELECT o.*, u.username, u.nickname
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ${whereSQL}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `
    const orders = await query(dataSQL, [...params, limitNum, offset])

    const result = orders.map(o => ({
      ...o,
      status_label: statusLabel(o.status),
      payment_label: paymentLabel(o.payment_method),
      allowed_transitions: STATUS_TRANSITIONS[o.status] || []
    }))

    res.json({
      data: result,
      pagination: { page: pageNum, limit: limitNum, total, totalPages, hasMore: pageNum < totalPages }
    })
  } catch (err) {
    res.status(500).json({ error: "获取订单列表失败", message: err.message })
  }
})

// GET /api/admin/orders/:id — 订单详情（含商品明细）
router.get("/orders/:id", async (req, res) => {
  try {
    const order = await get(`
      SELECT o.*, u.username, u.nickname
      FROM orders o LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `, [req.params.id])
    if (!order) return res.status(404).json({ error: "订单不存在" })

    const items = await query("SELECT * FROM order_items WHERE order_id = ?", [order.id])

    res.json({
      data: {
        ...order,
        status_label: statusLabel(order.status),
        payment_label: paymentLabel(order.payment_method),
        allowed_transitions: STATUS_TRANSITIONS[order.status] || [],
        items
      }
    })
  } catch (err) {
    res.status(500).json({ error: "获取订单详情失败", message: err.message })
  }
})

// PUT /api/admin/orders/:id/status — 管理员更新订单状态
router.put("/orders/:id/status", async (req, res) => {
  try {
    const { status: newStatus, reason } = req.body
    if (!newStatus) {
      return res.status(400).json({ error: "缺少目标状态" })
    }

    // 管理员可以操作任意订单，不加 user_id 限制
    const order = await get(
      "SELECT id, status, total, user_id, points_earned, order_no FROM orders WHERE id = ?",
      [req.params.id]
    )
    if (!order) return res.status(404).json({ error: "订单不存在" })

    if (!canTransition(order.status, newStatus)) {
      return res.status(400).json({
        error: `不允许从"${statusLabel(order.status)}"转为"${statusLabel(newStatus)}"`
      })
    }

    const now = new Date()
    const timeFields = {
      paid: "paid_at", shipped: "shipped_at", delivered: "delivered_at",
      completed: "completed_at", cancelled: "cancelled_at", refunded: "refunded_at"
    }
    const timeField = timeFields[newStatus]

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
      if (reason) extraMsg += `（备注：${reason}）`

      res.json({
        message: `订单状态已更新为"${statusLabel(newStatus)}"${extraMsg}`,
        data: {
          id: order.id, status: newStatus, status_label: statusLabel(newStatus),
          points_changed: pointsChanged, reason: reason || null
        }
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

// POST /api/admin/orders/:id/reject-refund — 拒绝退款（refunding → paid）
router.post("/orders/:id/reject-refund", async (req, res) => {
  try {
    const { reason } = req.body
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: "请填写拒绝退款原因" })
    }

    const order = await get(
      "SELECT id, status, order_no FROM orders WHERE id = ?",
      [req.params.id]
    )
    if (!order) return res.status(404).json({ error: "订单不存在" })
    if (order.status !== ORDER_STATUS.REFUNDING) {
      return res.status(400).json({ error: `当前订单状态为"${statusLabel(order.status)}"，只有退款中的订单才能拒绝退款` })
    }

    await run("UPDATE orders SET status = ? WHERE id = ?", [ORDER_STATUS.PAID, order.id])

    res.json({
      message: `已拒绝退款，订单恢复为"${statusLabel(ORDER_STATUS.PAID)}"，原因：${reason.trim()}`,
      data: { id: order.id, status: ORDER_STATUS.PAID, status_label: statusLabel(ORDER_STATUS.PAID), reason: reason.trim() }
    })
  } catch (err) {
    res.status(500).json({ error: "拒绝退款失败", message: err.message })
  }
})

// GET /api/admin/orders/statuses — 所有状态枚举及标签（供前端使用）
router.get("/orders/statuses", (req, res) => {
  const statuses = Object.entries(ORDER_STATUS).map(([key, value]) => ({
    value, label: statusLabel(value), key
  }))
  res.json({ data: { statuses, transitions: STATUS_TRANSITIONS } })
})

export default router
