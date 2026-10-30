// ============================================================
// 购物车 API 路由 (MySQL 版)
// ============================================================
import { Router } from "express"
import { query, get, run } from "../database/db.js"
import { authMiddleware } from "../middleware/auth.js"

const router = Router()

router.use(authMiddleware)

// GET /api/cart — 获取购物车列表
router.get("/", async (req, res) => {
  try {
    const items = await query(`
      SELECT c.id, c.product_id, c.qty,
             p.name, p.price, p.original, p.bg, p.stars, p.category, p.tag, p.tag_type, p.stock, p.image_url
      FROM cart c
      JOIN products p ON c.product_id = p.id
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC
    `, [req.user.id])
    res.json({ data: items })
  } catch (err) {
    res.status(500).json({ error: "获取购物车失败", message: err.message })
  }
})

// POST /api/cart — 添加到购物车
router.post("/", async (req, res) => {
  try {
    const { product_id, qty = 1 } = req.body

    if (!product_id) {
      return res.status(400).json({ error: "缺少商品ID" })
    }

    const product = await get("SELECT id, name, stock, status FROM products WHERE id = ?", [product_id])
    if (!product) {
      return res.status(404).json({ error: "商品不存在" })
    }
    if (product.status === "off") {
      return res.status(400).json({ error: "商品已下架" })
    }
    if (product.stock <= 0) {
      return res.status(400).json({ error: "商品库存不足" })
    }

    const existing = await get(
      "SELECT id, qty FROM cart WHERE user_id = ? AND product_id = ?",
      [req.user.id, product_id]
    )

    if (existing) {
      if (existing.qty + qty > product.stock) {
        return res.status(400).json({ error: `库存不足，当前库存仅 ${product.stock} 件` })
      }
      await run("UPDATE cart SET qty = qty + ? WHERE id = ?", [qty, existing.id])
    } else {
      await run(
        "INSERT INTO cart (user_id, product_id, qty) VALUES (?, ?, ?)",
        [req.user.id, product_id, qty]
      )
    }

    res.json({ message: "已加入购物车" })
  } catch (err) {
    res.status(500).json({ error: "添加购物车失败", message: err.message })
  }
})

// PUT /api/cart/:id — 更新购物车商品数量
router.put("/:id", async (req, res) => {
  try {
    const { qty } = req.body
    if (qty == null || qty < 1) {
      return res.status(400).json({ error: "数量必须大于0" })
    }

    const item = await get(
      "SELECT c.id, c.product_id, p.stock FROM cart c JOIN products p ON c.product_id = p.id WHERE c.id = ? AND c.user_id = ?",
      [req.params.id, req.user.id]
    )
    if (!item) return res.status(404).json({ error: "购物车商品不存在" })

    if (qty > item.stock) {
      return res.status(400).json({ error: `库存不足，当前库存仅 ${item.stock} 件` })
    }

    await run("UPDATE cart SET qty = ? WHERE id = ?", [qty, req.params.id])
    res.json({ message: "更新成功" })
  } catch (err) {
    res.status(500).json({ error: "更新购物车失败", message: err.message })
  }
})

// DELETE /api/cart/:id — 删除购物车商品
router.delete("/:id", async (req, res) => {
  try {
    const result = await run(
      "DELETE FROM cart WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "购物车商品不存在" })
    }
    res.json({ message: "已删除" })
  } catch (err) {
    res.status(500).json({ error: "删除失败", message: err.message })
  }
})

// DELETE /api/cart — 清空购物车
router.delete("/", async (req, res) => {
  try {
    await run("DELETE FROM cart WHERE user_id = ?", [req.user.id])
    res.json({ message: "购物车已清空" })
  } catch (err) {
    res.status(500).json({ error: "清空购物车失败", message: err.message })
  }
})

export default router
