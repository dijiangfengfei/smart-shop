// ============================================================
// API 工具 — 封装所有后端请求
// ============================================================

const BASE = "/api"

// 获取存储的 token
function getToken() {
  return localStorage.getItem("token")
}

// 通用请求函数
async function request(url, options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers }
  const token = getToken()
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`${BASE}${url}`, { ...options, headers })
  const data = await res.json()

  if (!res.ok) throw new Error(data.error || "请求失败")
  return data
}

// ---- 商品 API ----
export const productApi = {
  list(params = {}) {
    const qs = new URLSearchParams(params).toString()
    return request(`/products${qs ? "?" + qs : ""}`)
  },
  categories() {
    return request("/products/categories")
  },
  detail(id) {
    return request(`/products/${id}`)
  },
}

// ---- 认证 API ----
export const authApi = {
  register(username, password, nickname) {
    return request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password, nickname }),
    })
  },
  login(username, password) {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    })
  },
  me() {
    return request("/auth/me")
  },
  updateProfile(data) {
    return request("/auth/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },
  changePassword(old_password, new_password) {
    return request("/auth/password", {
      method: "PUT",
      body: JSON.stringify({ old_password, new_password }),
    })
  },
}

// ---- 购物车 API ----
export const cartApi = {
  list() {
    return request("/cart")
  },
  add(product_id, qty = 1) {
    return request("/cart", {
      method: "POST",
      body: JSON.stringify({ product_id, qty }),
    })
  },
  update(id, qty) {
    return request(`/cart/${id}`, {
      method: "PUT",
      body: JSON.stringify({ qty }),
    })
  },
  remove(id) {
    return request(`/cart/${id}`, { method: "DELETE" })
  },
  clear() {
    return request("/cart", { method: "DELETE" })
  },
}

// ---- 订单 API ----
export const orderApi = {
  create(address, payment_method) {
    return request("/orders", {
      method: "POST",
      body: JSON.stringify({ address, payment_method }),
    })
  },
  list() {
    return request("/orders")
  },
  detail(id) {
    return request(`/orders/${id}`)
  },
  cancel(id) {
    return request(`/orders/${id}/cancel`, { method: "PUT" })
  },
  updateStatus(id, status) {
    return request(`/orders/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    })
  },
}

// ---- 积分 & 会员 API ----
export const pointsApi = {
  info() {
    return request("/points")
  },
}

// ---- 管理端 API ----
export const adminApi = {
  listProducts() {
    return request("/admin/products")
  },
  createProduct(data) {
    return request("/admin/products", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },
  updateProduct(id, data) {
    return request(`/admin/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },
  toggleStatus(id, status) {
    return request(`/admin/products/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    })
  },
  deleteProduct(id) {
    return request(`/admin/products/${id}`, { method: "DELETE" })
  },
  // 订单管理
  listOrders(params = {}) {
    const qs = new URLSearchParams(params).toString()
    return request(`/admin/orders${qs ? "?" + qs : ""}`)
  },
  orderDetail(id) {
    return request(`/admin/orders/${id}`)
  },
  updateOrderStatus(id, status, reason) {
    return request(`/admin/orders/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, reason }),
    })
  },
  rejectRefund(id, reason) {
    return request(`/admin/orders/${id}/reject-refund`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    })
  },
}

// ---- AI 智能助手 API ----
export const aiApi = {
  chat(question, pageContext) {
    return request("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ question, page_context: pageContext }),
    })
  },
  clearHistory() {
    return request("/ai/history", { method: "DELETE" })
  },
  getTools() {
    return request("/ai/tools")
  },
}

