// ============================================================
// 积分 & 会员 API 路由
// ============================================================
import { Router } from "express"
import { query } from "../database/db.js"
import { authMiddleware } from "../middleware/auth.js"

const router = Router()
router.use(authMiddleware)

// 会员等级配置
const MEMBERSHIP_CONFIG = {
  bronze: { label: "铜牌会员", icon: "fa-medal", color: "#cd7f32", minPoints: 0, multiplier: 1 },
  silver: { label: "银牌会员", icon: "fa-medal", color: "#a8a8a8", minPoints: 1000, multiplier: 1.2 },
  gold:   { label: "金牌会员", icon: "fa-crown", color: "#f59e0b", minPoints: 5000, multiplier: 1.5 },
  diamond:{ label: "钻石会员", icon: "fa-gem", color: "#6366f1", minPoints: 10000, multiplier: 2 },
}

export function getLevelByPoints(points) {
  if (points >= 10000) return "diamond"
  if (points >= 5000)  return "gold"
  if (points >= 1000)  return "silver"
  return "bronze"
}

export { MEMBERSHIP_CONFIG }

// GET /api/points — 获取积分余额、会员信息、积分日志
router.get("/", async (req, res) => {
  try {
    const [user] = await query(
      "SELECT points, membership FROM users WHERE id = ?",
      [req.user.id]
    )
    const level = user.membership || "bronze"
    const config = MEMBERSHIP_CONFIG[level] || MEMBERSHIP_CONFIG.bronze
    const nextLevel = level === "diamond" ? null
      : level === "bronze" ? "silver"
      : level === "silver" ? "gold"
      : "diamond"

    const nextConfig = nextLevel ? MEMBERSHIP_CONFIG[nextLevel] : null
    const pointsToNext = nextConfig ? nextConfig.minPoints - user.points : 0

    const log = await query(
      "SELECT * FROM points_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
      [req.user.id]
    )

    res.json({
      data: {
        points: user.points,
        membership: level,
        membership_label: config.label,
        membership_icon: config.icon,
        membership_color: config.color,
        multiplier: config.multiplier,
        next_level: nextLevel,
        next_level_label: nextConfig ? nextConfig.label : null,
        points_to_next: pointsToNext > 0 ? pointsToNext : 0,
        levels: Object.entries(MEMBERSHIP_CONFIG).map(([key, val]) => ({
          key, label: val.label, minPoints: val.minPoints, multiplier: val.multiplier
        })),
        log,
      }
    })
  } catch (err) {
    res.status(500).json({ error: "获取积分信息失败", message: err.message })
  }
})

export default router
