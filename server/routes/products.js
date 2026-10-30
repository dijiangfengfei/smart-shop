// ============================================================
// 商品 API 路由 (MySQL 版) - 模糊搜索 + 排序 + 分页
// ============================================================
import { Router } from "express"
import { query, get } from "../database/db.js"

const router = Router()

// GET /api/products — 商品列表（支持搜索、分类、排序、分页）
router.get("/", async (req, res) => {
  try {
    const { category, q, sort, page, limit } = req.query

    const pageNum = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20))
    const offset = (pageNum - 1) * limitNum

    // ---- 构建 WHERE ----
    const whereClauses = ["status = 'on'"]
    const params = []

    if (category && category !== "全部") {
      whereClauses.push("category = ?")
      params.push(category)
    }

    if (q && q.trim()) {
      const keywords = q.trim().split(/\s+/).filter(Boolean)
      const conds = keywords.map(() =>
        "(name LIKE ? OR category LIKE ? OR tag LIKE ? OR description LIKE ?)"
      )
      whereClauses.push("(" + conds.join(" AND ") + ")")
      for (const kw of keywords) {
        const p = `%${kw}%`
        params.push(p, p, p, p)
      }
    }

    const whereSQL = whereClauses.length ? "WHERE " + whereClauses.join(" AND ") : ""

    // ---- 排序 ----
    let orderSQL = "ORDER BY id ASC"
    if (sort === "price_asc") orderSQL = "ORDER BY price ASC"
    else if (sort === "price_desc") orderSQL = "ORDER BY price DESC"
    else if (sort === "newest") orderSQL = "ORDER BY created_at DESC"
    else if (sort === "popularity") orderSQL = "ORDER BY reviews DESC"
    else if (sort === "rating") orderSQL = "ORDER BY stars DESC"

    // ---- 查询总数 ----
    const countSQL = "SELECT COUNT(*) AS total FROM products " + whereSQL
    const countResult = await query(countSQL, params)
    const total = countResult[0].total
    const totalPages = Math.ceil(total / limitNum)

    // ---- 查询分页数据（不使用表别名，避免execute问题）----
    const dataSQL = "SELECT * FROM products " + whereSQL + " " + orderSQL + " LIMIT ? OFFSET ?"
    const allParams = [...params, limitNum, offset]
    const products = await query(dataSQL, allParams)

    res.json({
      data: products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasMore: pageNum < totalPages,
      },
    })
  } catch (err) {
    console.error("[Products Error]", err)
    res.status(500).json({ error: "获取商品列表失败", message: err.message })
  }
})

// GET /api/products/categories — 分类列表
router.get("/categories", async (req, res) => {
  try {
    const rows = await query("SELECT DISTINCT category FROM products ORDER BY category")
    const categories = ["全部", ...rows.map((r) => r.category)]
    res.json({ data: categories })
  } catch (err) {
    res.status(500).json({ error: "获取分类失败", message: err.message })
  }
})

// GET /api/products/:id — 商品详情
router.get("/:id", async (req, res) => {
  try {
    const product = await get("SELECT * FROM products WHERE id = ?", [req.params.id])
    if (!product) return res.status(404).json({ error: "商品不存在" })
    res.json({ data: product })
  } catch (err) {
    res.status(500).json({ error: "获取商品详情失败", message: err.message })
  }
})

export default router
