// ============================================================
// 数据库 Schema 初始化（建表 + 种子数据）- MySQL 版
// ============================================================
import { query, run, getPool } from "./db.js"

export async function initDatabase() {
  // ---- 用户表 ----
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id          INT PRIMARY KEY AUTO_INCREMENT,
      username    VARCHAR(50) NOT NULL UNIQUE,
      password    VARCHAR(255) NOT NULL,
      nickname    VARCHAR(50) DEFAULT "",
      phone       VARCHAR(20) DEFAULT "",
      address     VARCHAR(255) DEFAULT "",
      avatar_url  VARCHAR(500) DEFAULT "",
      role        VARCHAR(10) DEFAULT "user",
      points      INT DEFAULT 0,
      membership  VARCHAR(20) DEFAULT "bronze",
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // ---- 商品表（含 image_url） ----
  await run(`
    CREATE TABLE IF NOT EXISTS products (
      id          INT PRIMARY KEY AUTO_INCREMENT,
      name        VARCHAR(100) NOT NULL,
      category    VARCHAR(20) NOT NULL,
      price       DECIMAL(10,2) NOT NULL,
      original    DECIMAL(10,2) DEFAULT NULL,
      stars       INT DEFAULT 5,
      reviews     INT DEFAULT 0,
      tag         VARCHAR(20) DEFAULT NULL,
      tag_type    VARCHAR(10) DEFAULT NULL,
      bg          VARCHAR(100) DEFAULT "#f1f5f9",
      image_url   VARCHAR(500) DEFAULT "",
      description TEXT DEFAULT NULL,
      stock       INT DEFAULT 99,
      status      VARCHAR(10) DEFAULT "on",
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // 兼容已有表：增加 image_url 列
  try {
    await run(`ALTER TABLE products ADD COLUMN image_url VARCHAR(500) DEFAULT "" AFTER bg`)
  } catch (e) { /* 列已存在则忽略 */ }

  // 兼容已有表：增加 status 列（商品上下架）
  try {
    await run(`ALTER TABLE products ADD COLUMN status VARCHAR(10) DEFAULT "on" AFTER stock`)
  } catch (e) { /* 列已存在则忽略 */ }

  // 兼容已有表：增加 role 列（用户角色）
  try {
    await run(`ALTER TABLE users ADD COLUMN role VARCHAR(10) DEFAULT "user" AFTER avatar_url`)
  } catch (e) { /* 列已存在则忽略 */ }

  // 兼容已有表：增加 payment_method 列（支付方式）
  try {
    await run(`ALTER TABLE orders ADD COLUMN payment_method VARCHAR(20) DEFAULT "" AFTER status`)
  } catch (e) { /* 列已存在则忽略 */ }

  // 兼容已有表：增加 points 列（积分）
  try {
    await run(`ALTER TABLE users ADD COLUMN points INT DEFAULT 0 AFTER role`)
  } catch (e) { /* 列已存在则忽略 */ }

  // 兼容已有表：增加 membership 列（会员等级）
  try {
    await run(`ALTER TABLE users ADD COLUMN membership VARCHAR(20) DEFAULT "bronze" AFTER points`)
  } catch (e) { /* 列已存在则忽略 */ }

  // 兼容已有表：增加 points_earned 列（订单完成时获得的积分）
  try {
    await run(`ALTER TABLE orders ADD COLUMN points_earned INT DEFAULT 0 AFTER completed_at`)
  } catch (e) { /* 列已存在则忽略 */ }

  // 兼容已有表：增加 cancelled_at、refunded_at 列
  try {
    await run(`ALTER TABLE orders ADD COLUMN cancelled_at DATETIME DEFAULT NULL AFTER completed_at`)
  } catch (e) { /* 列已存在则忽略 */ }
  try {
    await run(`ALTER TABLE orders ADD COLUMN refunded_at DATETIME DEFAULT NULL AFTER cancelled_at`)
  } catch (e) { /* 列已存在则忽略 */ }

  // ---- 购物车表 ----
  await run(`
    CREATE TABLE IF NOT EXISTS cart (
      id          INT PRIMARY KEY AUTO_INCREMENT,
      user_id     INT NOT NULL,
      product_id  INT NOT NULL,
      qty         INT DEFAULT 1,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      UNIQUE KEY uk_user_product (user_id, product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // ---- 订单表（含状态机字段） ----
  try {
    await run(`ALTER TABLE orders ADD COLUMN paid_at DATETIME DEFAULT NULL AFTER address`)
  } catch (e) { /* 列已存在则忽略 */ }
  try {
    await run(`ALTER TABLE orders ADD COLUMN shipped_at DATETIME DEFAULT NULL AFTER paid_at`)
  } catch (e) { /* 列已存在则忽略 */ }
  try {
    await run(`ALTER TABLE orders ADD COLUMN delivered_at DATETIME DEFAULT NULL AFTER shipped_at`)
  } catch (e) { /* 列已存在则忽略 */ }
  try {
    await run(`ALTER TABLE orders ADD COLUMN completed_at DATETIME DEFAULT NULL AFTER delivered_at`)
  } catch (e) { /* 列已存在则忽略 */ }
  try {
    await run(`ALTER TABLE orders ADD COLUMN avatar_url VARCHAR(500) DEFAULT "" AFTER address`)
  } catch (e) { /* 列已存在则忽略 */ }

  await run(`
    CREATE TABLE IF NOT EXISTS orders (
      id          INT PRIMARY KEY AUTO_INCREMENT,
      order_no    VARCHAR(30) NOT NULL UNIQUE,
      user_id     INT NOT NULL,
      total       DECIMAL(10,2) NOT NULL,
      status      VARCHAR(20) DEFAULT "pending",
      payment_method VARCHAR(20) DEFAULT "",
      address     VARCHAR(255) DEFAULT "",
      paid_at     DATETIME DEFAULT NULL,
      shipped_at  DATETIME DEFAULT NULL,
      delivered_at DATETIME DEFAULT NULL,
      completed_at DATETIME DEFAULT NULL,
      points_earned INT DEFAULT 0,
      cancelled_at DATETIME DEFAULT NULL,
      refunded_at DATETIME DEFAULT NULL,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // ---- 积分日志表 ----
  await run(`
    CREATE TABLE IF NOT EXISTS points_log (
      id          INT PRIMARY KEY AUTO_INCREMENT,
      user_id     INT NOT NULL,
      points      INT NOT NULL,
      type        VARCHAR(10) NOT NULL,
      description VARCHAR(100) DEFAULT "",
      order_no    VARCHAR(30) DEFAULT "",
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // ---- 订单明细表 ----
  await run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id          INT PRIMARY KEY AUTO_INCREMENT,
      order_id    INT NOT NULL,
      product_id  INT NOT NULL,
      name        VARCHAR(100) NOT NULL,
      price       DECIMAL(10,2) NOT NULL,
      qty         INT NOT NULL,
      FOREIGN KEY (order_id)   REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)


  // ---- AI 对话历史表 ----
  await run(`
    CREATE TABLE IF NOT EXISTS ai_conversation (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      user_id     INT          NOT NULL,
      role        VARCHAR(10)  NOT NULL COMMENT 'system/user/assistant/tool',
      content     TEXT         NOT NULL,
      tool_name   VARCHAR(50)  DEFAULT NULL,
      created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  console.log("[Schema] 数据库表已创建/确认")
}

// ---- 种子数据 ----
export async function seedProducts() {
  const rows = await query("SELECT COUNT(*) AS cnt FROM products")
  if (rows[0].cnt > 0) {
    console.log("[Seed] 商品数据已存在，跳过")
    return
  }

  const products = [
    { name: "智能降噪耳机 Pro",   category: "数码", price: 799,  original: 1299, stars: 5, reviews: 2341, tag: "热卖", tag_type: "hot",  bg: "#667eea",   img: 1 },
    { name: "超薄机械键盘·青轴",  category: "数码", price: 459,  original: 599,  stars: 4, reviews: 1823, tag: null,   tag_type: null, bg: "#f093fb",   img: 2 },
    { name: "便携式蓝牙音箱",     category: "数码", price: 299,  original: 499,  stars: 4, reviews: 3127, tag: "新品", tag_type: "new",  bg: "#4facfe",   img: 3 },
    { name: "4K 高清投影仪",      category: "数码", price: 2599, original: 3599, stars: 5, reviews: 876,  tag: "特惠", tag_type: "sale", bg: "#43e97b",   img: 4 },
    { name: "北欧风台灯",         category: "家居", price: 189,  original: 269,  stars: 5, reviews: 4521, tag: "热卖", tag_type: "hot",  bg: "#fa709a",   img: 5 },
    { name: "智能香薰加湿器",     category: "家居", price: 259,  original: 329,  stars: 4, reviews: 2678, tag: null,   tag_type: null, bg: "#a18cd1",   img: 6 },
    { name: "记忆棉护颈枕",       category: "家居", price: 159,  original: 219,  stars: 4, reviews: 5632, tag: "特惠", tag_type: "sale", bg: "#ffecd2",   img: 7 },
    { name: "纯棉四件套·云朵系列", category: "家居", price: 399, original: 599,  stars: 5, reviews: 3210, tag: "新品", tag_type: "new",  bg: "#89f7fe",   img: 8 },
    { name: "经典黑白T恤(三件装)", category: "服饰", price: 199, original: 299,  stars: 4, reviews: 7821, tag: "热卖", tag_type: "hot",  bg: "#232526",   img: 9 },
    { name: "轻薄运动跑步鞋",     category: "服饰", price: 459,  original: 699,  stars: 5, reviews: 4321, tag: null,   tag_type: null, bg: "#ff9a9e",   img: 10 },
    { name: "休闲帆布双肩包",     category: "服饰", price: 259,  original: 359,  stars: 4, reviews: 2198, tag: "新品", tag_type: "new",  bg: "#c3cfe2",   img: 11 },
    { name: "智能手表 S3",        category: "数码", price: 1299, original: 1799, stars: 5, reviews: 6543, tag: "特惠", tag_type: "sale", bg: "#764ba2",   img: 12 },
    { name: "无线充电底座",       category: "数码", price: 129,  original: 199,  stars: 4, reviews: 9102, tag: null,   tag_type: null, bg: "#667eea",   img: 13 },
    { name: "日式简约餐具套装",   category: "家居", price: 329,  original: 459,  stars: 5, reviews: 1823, tag: "热卖", tag_type: "hot",  bg: "#43e97b",   img: 14 },
    { name: "弹力速干运动服",     category: "服饰", price: 239,  original: 339,  stars: 4, reviews: 3654, tag: null,   tag_type: null, bg: "#4facfe",   img: 15 },
    { name: "极简手表·石英机芯",  category: "服饰", price: 599,  original: 899,  stars: 5, reviews: 1432, tag: "新品", tag_type: "new",  bg: "#a18cd1",   img: 16 },
  ]

  for (const p of products) {
    const imageUrl = `/images/product-${p.img}${p.img === 6 ? ".jpeg" : ".jpg"}`
    await run(
      "INSERT INTO products (name, category, price, original, stars, reviews, tag, tag_type, bg, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [p.name, p.category, p.price, p.original, p.stars, p.reviews, p.tag, p.tag_type, p.bg, imageUrl]
    )
  }

  console.log(`[Seed] 已插入 ${products.length} 条商品数据`)
}

// ---- 管理员种子 ----
export async function seedAdmin() {
  const rows = await query("SELECT COUNT(*) AS cnt FROM users WHERE username = 'admin'")
  if (rows[0].cnt > 0) {
    console.log("[Seed] 管理员已存在，跳过")
    return
  }
  // 使用 bcryptjs 生成默认管理员密码
  const bcrypt = await import("bcryptjs")
  const hashed = bcrypt.default.hashSync("admin123", 10)
  await run(
    "INSERT INTO users (username, password, nickname, role) VALUES (?, ?, ?, ?)",
    ["admin", hashed, "管理员", "admin"]
  )
  console.log("[Seed] 已创建默认管理员 (admin / admin123)")
}


