// ============================================================
// 用户认证 API 路由 (MySQL 版)
// ============================================================
import { Router } from "express"
import bcrypt from "bcryptjs"
import { query, get, run } from "../database/db.js"
import { generateToken, authMiddleware } from "../middleware/auth.js"

const router = Router()

// POST /api/auth/register — 注册
router.post("/register", async (req, res) => {
  try {
    const { username, password, nickname } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: "用户名和密码不能为空" })
    }
    if (username.length < 2) {
      return res.status(400).json({ error: "用户名至少2个字符" })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "密码至少6个字符" })
    }

    const existing = await get("SELECT id FROM users WHERE username = ?", [username])
    if (existing) {
      return res.status(409).json({ error: "用户名已存在" })
    }

    const hashed = bcrypt.hashSync(password, 10)
    const result = await run(
      "INSERT INTO users (username, password, nickname) VALUES (?, ?, ?)",
      [username, hashed, nickname || username]
    )

    const token = generateToken({ id: result.insertId, username })
    res.status(201).json({
      message: "注册成功",
      data: { token, user: { id: result.insertId, username, nickname: nickname || username, role: "user" } }
    })
  } catch (err) {
    res.status(500).json({ error: "注册失败", message: err.message })
  }
})

// POST /api/auth/login — 登录
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: "用户名和密码不能为空" })
    }

    const user = await get("SELECT * FROM users WHERE username = ?", [username])
    if (!user) {
      return res.status(401).json({ error: "用户名或密码错误" })
    }

    const valid = bcrypt.compareSync(password, user.password)
    if (!valid) {
      return res.status(401).json({ error: "用户名或密码错误" })
    }

    const token = generateToken(user)
    res.json({
      message: "登录成功",
      data: {
        token,
        user: { id: user.id, username: user.username, nickname: user.nickname, role: user.role }
      }
    })
  } catch (err) {
    res.status(500).json({ error: "登录失败", message: err.message })
  }
})

// GET /api/auth/me — 获取当前用户信息
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await get(
      "SELECT id, username, nickname, phone, address, role, points, membership, created_at FROM users WHERE id = ?",
      [req.user.id]
    )
    if (!user) return res.status(404).json({ error: "用户不存在" })
    res.json({ data: user })
  } catch (err) {
    res.status(500).json({ error: "获取用户信息失败", message: err.message })
  }
})

// PUT /api/auth/profile — 更新用户信息
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const { nickname, phone, address } = req.body
    await run(
      "UPDATE users SET nickname = COALESCE(?, nickname), phone = COALESCE(?, phone), address = COALESCE(?, address) WHERE id = ?",
      [nickname, phone, address, req.user.id]
    )
    res.json({ message: "更新成功" })
  } catch (err) {
    res.status(500).json({ error: "更新失败", message: err.message })
  }
})

// PUT /api/auth/password — 修改密码
router.put("/password", authMiddleware, async (req, res) => {
  try {
    const { old_password, new_password } = req.body

    if (!old_password || !new_password) {
      return res.status(400).json({ error: "旧密码和新密码不能为空" })
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: "新密码至少6个字符" })
    }

    const user = await get("SELECT password FROM users WHERE id = ?", [req.user.id])
    if (!user) return res.status(404).json({ error: "用户不存在" })

    const valid = bcrypt.compareSync(old_password, user.password)
    if (!valid) {
      return res.status(400).json({ error: "旧密码错误" })
    }

    const hashed = bcrypt.hashSync(new_password, 10)
    await run("UPDATE users SET password = ? WHERE id = ?", [hashed, req.user.id])
    res.json({ message: "密码修改成功" })
  } catch (err) {
    res.status(500).json({ error: "修改密码失败", message: err.message })
  }
})

export default router
