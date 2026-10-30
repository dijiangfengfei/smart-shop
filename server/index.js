// ============================================================
// 智能商城 — 后端服务入口 (MySQL 版)
// ============================================================
import express from "express"
import cors from "cors"
import { initDatabase, seedProducts, seedAdmin } from "./database/schema.js"
import productsRouter from "./routes/products.js"
import authRouter from "./routes/auth.js"
import cartRouter from "./routes/cart.js"
import ordersRouter from "./routes/orders.js"
import adminRouter from "./routes/admin.js"
import pointsRouter from "./routes/points.js"
import aiRouter from "./routes/ai.js"

const app = express()
const PORT = process.env.PORT || 3000

// ---- 中间件 ----
app.use(cors())
app.use(express.json())
app.use(express.static("../public"))

// ---- 请求日志 ----
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleString("zh-CN")}] ${req.method} ${req.url}`)
  next()
})

// ---- 路由 ----
app.use("/api/products", productsRouter)
app.use("/api/auth", authRouter)
app.use("/api/cart", cartRouter)
app.use("/api/orders", ordersRouter)
app.use("/api/admin", adminRouter)
app.use("/api/points", pointsRouter)
app.use("/api/ai", aiRouter)

// ---- 根路由 ----
app.get("/", (req, res) => {
  res.json({
    name: "智能商城 API",
    version: "1.0.0",
    endpoints: [
      "GET    /api/products?q=&category=&sort=&page=&limit=",
      "GET    /api/products/categories",
      "GET    /api/products/:id",
      "POST   /api/auth/register",
      "POST   /api/auth/login",
      "GET    /api/auth/me",
      "PUT    /api/auth/profile",
      "PUT    /api/auth/password",
      "GET    /api/cart",
      "POST   /api/cart",
      "PUT    /api/cart/:id",
      "DELETE /api/cart/:id",
      "DELETE /api/cart",
      "POST   /api/orders",
      "GET    /api/orders",
      "GET    /api/orders/:id",
      "PUT    /api/orders/:id/status",
      "PUT    /api/orders/:id/cancel",
      "GET    /api/admin/products (管理员)",
      "POST   /api/admin/products (管理员)",
      "PUT    /api/admin/products/:id (管理员)",
      "PUT    /api/admin/products/:id/status (管理员)",
    ]
  })
})

// ---- 404 处理 ----
app.use((req, res) => {
  res.status(404).json({ error: "接口不存在" })
})

// ---- 全局错误处理 ----
app.use((err, req, res, next) => {
  console.error("[Error]", err)
  res.status(500).json({ error: "服务器内部错误", message: err.message })
})

// ---- 启动 ----
async function start() {
  await initDatabase()
  await seedProducts()
  await seedAdmin()

  app.listen(PORT, () => {
    console.log("========================================")
    console.log("  智能商城后端服务已启动")
    console.log(`  地址: http://localhost:${PORT}`)
    console.log(`  API:  http://localhost:${PORT}/api`)
    console.log("========================================")
  })
}

start().catch((err) => {
  console.error("[FATAL] 启动失败:", err)
  process.exit(1)
})


