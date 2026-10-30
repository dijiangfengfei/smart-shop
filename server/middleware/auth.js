// ============================================================
// JWT 认证中间件
// ============================================================
import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET || "smart_shop_secret_key_2024"

// 生成 Token
export function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role || "user" },
    JWT_SECRET,
    { expiresIn: "7d" }
  )
}

// 验证 Token 中间件
export function authMiddleware(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "未登录，请先登录" })
  }

  try {
    const token = header.split(" ")[1]
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ error: "Token 无效或已过期" })
  }
}

// 可选认证（不需要强制登录时可以获取 user 信息）
export function optionalAuth(req, res, next) {
  const header = req.headers.authorization
  if (header && header.startsWith("Bearer ")) {
    try {
      const token = header.split(" ")[1]
      req.user = jwt.verify(token, JWT_SECRET)
    } catch {
      // ignore
    }
  }
  next()
}

// 管理员权限中间件（需在 authMiddleware 之后使用）
export function adminMiddleware(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "无管理员权限" })
  }
  next()
}
