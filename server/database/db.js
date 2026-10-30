// ============================================================
// 数据库连接 (MySQL)
// ============================================================
import mysql from "mysql2/promise"

const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root",
  database: process.env.DB_NAME || "smart_shop",
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
}

let pool

export async function getPool() {
  if (!pool) {
    pool = mysql.createPool(DB_CONFIG)
    console.log("[DB] MySQL 连接池已创建:", DB_CONFIG.database)
  }
  return pool
}

export async function query(sql, params = []) {
  const p = await getPool()
  const [rows] = await p.query(sql, params)
  return rows
}

export async function get(sql, params = []) {
  const rows = await query(sql, params)
  return rows[0] || null
}

export async function run(sql, params = []) {
  const p = await getPool()
  const [result] = await p.execute(sql, params)
  return result
}

export default { getPool, query, get, run }
