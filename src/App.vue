<script setup>
import { ref, computed, onMounted, watch,onBeforeUnmount } from "vue"
import { productApi, authApi, cartApi, orderApi, adminApi, pointsApi } from "./api.js"
import AiChat from "./components/AiChat.vue"

// --- State ---
const searchQuery = ref("")
const activeCategory = ref("全部")
const sortBy = ref("default_")
const currentPage = ref(1)
const totalPages = ref(1)
const totalProducts = ref(0)
const cartOpen = ref(false)
const cartItems = ref([])
const toastMsg = ref("")
const toastShow = ref(false)
const categories = ref(["全部"])
const products = ref([])
const loading = ref(true)
const showAuth = ref(false)
const isLogin = ref(true)
const authForm = ref({ username: "", password: "", nickname: "" })
const user = ref(null)
const showUserCenter = ref(false)
const userCenterTab = ref("profile")
const profileForm = ref({ nickname: "", phone: "", address: "" })
const passwordForm = ref({ old_password: "", new_password: "", confirm_password: "" })
const orders = ref([])
const ordersLoading = ref(false)
const showDropdown = ref(false)
const searchTimer = ref(null)
const showPaymentModal = ref(false)
const selectedPayment = ref("wechat")

// --- 原神角色轮播广告数据 ---
// --- 动态呼吸光效（RGB 时间变化） ---
const time = ref(0);
let rafId = null;

function getBreathingColor(offset = 0) {
  const t = time.value * 0.4 + offset;
  const r = Math.floor(128 + 127 * Math.sin(t));
  const g = Math.floor(128 + 127 * Math.sin(t + 2.094));
  const b = Math.floor(128 + 127 * Math.sin(t + 4.188));
  return `rgb(${r}, ${g}, ${b})`;
}

function startColorLoop() {
  if (rafId) return;
  function update() {
    time.value = performance.now() / 1000;
    rafId = requestAnimationFrame(update);
  }
  update();
}

function stopColorLoop() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

const adSlides = [
  {
    id: 'hutao',
    emoji: '🦋',
    title: '往生堂特惠',
    subtitle: '胡桃邀你共赴黄泉 · 限时折扣',
    btnText: '选购往生堂套餐',
    bg: 'linear-gradient(135deg, #2d1b3d, #4a1942)',
    accent: '#f472b6', // 粉色
  },
  {
    id: 'zhongli',
    emoji: '🧧',
    title: '契约达成',
    subtitle: '钟离精选 · 岩王帝君的珍藏',
    btnText: '查看契约好物',
    bg: 'linear-gradient(135deg, #1e293b, #3e2c1b)',
    accent: '#fbbf24', // 金色
  },
  {
    id: 'keqing',
    emoji: '⚡',
    title: '七星优选',
    subtitle: '刻晴力荐 · 雷厉风行焕新装',
    btnText: '探索七星好物',
    bg: 'linear-gradient(135deg, #1a1a2e, #16213e)',
    accent: '#a78bfa', // 紫色
  },
  {
    id: 'venti',
    emoji: '🍃',
    title: '风与自由',
    subtitle: '温迪的惊喜礼包 · 诗酒趁年华',
    btnText: '聆听风之歌',
    bg: 'linear-gradient(135deg, #064e3b, #047857)',
    accent: '#34d399', // 翠绿
  }
];
const currentAdIndex = ref(0);
let adInterval = null;

// 当前展示的广告（计算属性）
const currentAd = computed(() => adSlides[currentAdIndex.value]);

// 切换到下一个广告
function nextAd() {
  currentAdIndex.value = (currentAdIndex.value + 1) % adSlides.length;
}

// 支付方式配置
const paymentMethods = [
  { value: "wechat", label: "微信支付", icon: "fa-weixin", iconType: "fab", color: "#07c160" },
  { value: "alipay", label: "支付宝", icon: "fa-alipay", iconType: "fab", color: "#1677ff" },
  { value: "card", label: "银行卡", icon: "fa-credit-card", iconType: "fas", color: "#6366f1" },
  { value: "cod", label: "货到付款", icon: "fa-box", iconType: "fas", color: "#f59e0b" },
]

function paymentLabel(method) {
  const m = paymentMethods.find(p => p.value === method)
  return m ? m.label : method
}

function paymentConfig(method) {
  return paymentMethods.find(p => p.value === method) || {}
}
let toastTimer = null

// 管理后台状态
const showAdmin = ref(false)

const adminProducts = ref([])
const adminLoading = ref(false)
const editingProduct = ref(null)
const showProductForm = ref(false)
const isAdding = ref(false)
const productForm = ref({
  name: "", category: "", price: "", original: "", stars: 5, reviews: 0,
  tag: "", tag_type: "", bg: "#f1f5f9", image_url: "", description: "", stock: 99
})

// 积分 & 会员状态
const pointsInfo = ref(null)
const pointsLoading = ref(false)

// 管理后台 — 订单管理状态
const adminTab = ref("products")
const adminOrders = ref([])
const adminOrdersLoading = ref(false)
const adminOrderPage = ref(1)
const adminOrderTotal = ref(0)
const adminOrderTotalPages = ref(1)
const components = { AiChat }
const adminOrderFilter = ref("all")
const adminOrderSearch = ref("")
const showOrderDetail = ref(false)
const detailOrder = ref(null)
const detailItems = ref([])
const showStatusDialog = ref(false)
const targetOrder = ref(null)
const targetStatus = ref("")
const statusReason = ref("")

// ---- 页面上下文（给 AI 了解当前页面数据） ----
const pageContext = computed(() => {
  const ctx = { page: 'home' }
  if (showAdmin.value) {
    ctx.page = 'admin'
    ctx.admin_tab = adminTab.value
    if (adminTab.value === 'products') {
      ctx.products_count = adminProducts.value.length
      ctx.products = adminProducts.value.map(p => ({ id: p.id, name: p.name, price: p.price, stock: p.stock, status: p.status }))
    } else if (adminTab.value === 'orders') {
      ctx.orders_count = adminOrders.value.length
      ctx.orders = adminOrders.value.map(o => ({ id: o.id, order_no: o.order_no, status: o.status, total: o.total, username: o.username }))
    }
  } else if (showUserCenter.value) {
    ctx.page = 'user_center'
    ctx.tab = userCenterTab.value
    ctx.orders_count = orders.value.length
    ctx.orders = orders.value.map(o => ({ id: o.id, order_no: o.order_no, status: o.status, total: o.total }))
    if (pointsInfo.value) ctx.points = pointsInfo.value
  } else {
    ctx.products_preview = products.value.slice(0, 8).map(p => ({ id: p.id, name: p.name, category: p.category, price: p.price }))
    ctx.active_category = activeCategory.value
    ctx.cart_count = cartItems.value.length
  }
  return JSON.stringify(ctx)
})

const orderStatusOptions = [
  { value: "all", label: "全部" },
  { value: "pending", label: "待处理" },
  { value: "paid", label: "已支付" },
  { value: "shipped", label: "已发货" },
  { value: "delivered", label: "已送达" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
  { value: "refunding", label: "退款中" },
  { value: "refunded", label: "已退款" },
]

// 排序选项
const sortOptions = [
  { value: "default_",  label: "默认排序" },
  { value: "price_asc", label: "价格从低到高" },
  { value: "price_desc",label: "价格从高到低" },
  { value: "newest",    label: "最新上架" },
  { value: "popularity",label: "最受欢迎" },
  { value: "rating",    label: "评分最高" },
]

// --- Computed ---
const cartCount = computed(() => cartItems.value.reduce((s, i) => s + i.qty, 0))
const cartTotal = computed(() => cartItems.value.reduce((s, i) => s + i.price * i.qty, 0))

const adminOrderPageRange = computed(() => {
  const range = []
  const total = adminOrderTotalPages.value
  let start = Math.max(1, adminOrderPage.value - 2)
  let end = Math.min(total, start + 4)
  if (end - start < 4) start = Math.max(1, end - 4)
  for (let i = start; i <= end; i++) range.push(i)
  return range
})

// 分页范围（最多显示5页）
const pageRange = computed(() => {
  const range = []
  const total = totalPages.value
  let start = Math.max(1, currentPage.value - 2)
  let end = Math.min(total, start + 4)
  if (end - start < 4) start = Math.max(1, end - 4)
  for (let i = start; i <= end; i++) range.push(i)
  return range
})

// 订单状态配置
const statusConfig = {
  pending:    { label: "待处理", color: "#f59e0b", icon: "fa-clock" },
  paid:       { label: "已支付", color: "#10b981", icon: "fa-check-circle" },
  shipped:    { label: "已发货", color: "#3b82f6", icon: "fa-truck" },
  delivered:  { label: "已送达", color: "#6366f1", icon: "fa-box-open" },
  completed:  { label: "已完成", color: "#10b981", icon: "fa-check-double" },
  cancelled:  { label: "已取消", color: "#ef4444", icon: "fa-times-circle" },
  refunding:  { label: "退款中", color: "#f59e0b", icon: "fa-rotate" },
  refunded:   { label: "已退款", color: "#8b5cf6", icon: "fa-undo" },
}

// --- 关键词高亮 ---
function highlightText(text, keyword) {
  if (!keyword || !keyword.trim()) return text
  const keywords = keyword.trim().split(/\s+/).filter(Boolean)
  let result = text
  for (const kw of keywords) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    result = result.replace(new RegExp(`(${escaped})`, "gi"), `<mark class="highlight">$1</mark>`)
  }
  return result
}

// --- Toast ---
function showToast(msg) {
  toastMsg.value = msg
  toastShow.value = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastShow.value = false }, 2000)
}

// --- 服务端加载商品（带搜索/分类/排序/分页） ---
async function loadProducts() {
  loading.value = true
  try {
    const params = {
      q: searchQuery.value.trim(),
      category: activeCategory.value,
      sort: sortBy.value,
      page: String(currentPage.value),
      limit: "20",
    }
    const res = await productApi.list(params)
    products.value = res.data
    totalPages.value = res.pagination.totalPages
    totalProducts.value = res.pagination.total
    currentPage.value = res.pagination.page
  } catch (e) {
    showToast("加载商品失败: " + e.message)
  } finally {
    loading.value = false
  }
}

async function loadCategories() {
  try {
    const res = await productApi.categories()
    categories.value = res.data
  } catch (e) {
    console.error("加载分类失败", e)
  }
}

async function loadCart() {
  if (!user.value) { cartItems.value = []; return }
  try {
    const res = await cartApi.list()
    // 为每个购物车项补充图片信息
    const cartData = res.data.map(item => {
      // 从当前商品列表中查找匹配
      const product = products.value.find(p => p.id === item.product_id)
      if (product) {
        return {
          ...item,
          image_url: product.image_url || item.image_url,
          bg: product.bg || item.bg || '#f1f5f9'
        }
      }
      // 若匹配不到，至少给个默认背景色
      return {
        ...item,
        bg: item.bg || '#f1f5f9'
      }
    })
    cartItems.value = cartData
  } catch (e) {
    console.error("加载购物车失败", e)
  }
}

// --- 搜索防抖 ---
function onSearchInput() {
  clearTimeout(searchTimer.value)
  searchTimer.value = setTimeout(() => {
    currentPage.value = 1
    loadProducts()
  }, 400)
}

// --- 切换分类 ---
function onCategoryChange(cat) {
  activeCategory.value = cat
  currentPage.value = 1
  loadProducts()
}

// --- 切换排序 ---
function onSortChange() {
  currentPage.value = 1
  loadProducts()
}

// --- 分页操作 ---
function goToPage(page) {
  if (page < 1 || page > totalPages.value || page === currentPage.value) return
  currentPage.value = page
  loadProducts()
  window.scrollTo({ top: 0, behavior: "smooth" })
}

// --- Auth ---
function openAuth(mode = "login") {
  isLogin.value = mode === "login"
  authForm.value = { username: "", password: "", nickname: "" }
  showAuth.value = true
  showUserCenter.value = false
}

async function handleAuth() {
  try {
    let res
    if (isLogin.value) {
      res = await authApi.login(authForm.value.username, authForm.value.password)
    } else {
      res = await authApi.register(authForm.value.username, authForm.value.password, authForm.value.nickname)
    }
    localStorage.setItem("token", res.data.token)
    user.value = res.data.user
    showAuth.value = false
    showToast(isLogin.value ? "登录成功" : "注册成功")
    loadCart()
  } catch (e) {
    showToast(e.message)
  }
}

function logout() {
  localStorage.removeItem("token")
  user.value = null
  cartItems.value = []
  orders.value = []
  showUserCenter.value = false
  showDropdown.value = false
  showToast("已退出登录")
}

async function checkLogin() {
  const token = localStorage.getItem("token")
  if (!token) return
  try {
    const res = await authApi.me()
    user.value = res.data
    profileForm.value = {
      nickname: res.data.nickname || "",
      phone: res.data.phone || "",
      address: res.data.address || ""
    }
    loadCart()
  } catch {
    localStorage.removeItem("token")
  }
}

// --- User Center ---
function openUserCenter(tab = "profile") {
  showAdmin.value = false
  userCenterTab.value = tab
  showUserCenter.value = true
  showDropdown.value = false
  if (tab === "orders") loadOrders()
  if (tab === "membership") loadPoints()
  if (tab === "profile") {
    profileForm.value = {
      nickname: user.value.nickname || "",
      phone: user.value.phone || "",
      address: user.value.address || ""
    }
  }
}

async function saveProfile() {
  try {
    await authApi.updateProfile(profileForm.value)
    user.value = { ...user.value, ...profileForm.value }
    showToast("个人信息已更新")
  } catch (e) {
    showToast(e.message)
  }
}

async function changePassword() {
  if (passwordForm.value.new_password !== passwordForm.value.confirm_password) {
    showToast("两次输入的新密码不一致")
    return
  }
  if (passwordForm.value.new_password.length < 6) {
    showToast("新密码至少6个字符")
    return
  }
  try {
    await authApi.changePassword(passwordForm.value.old_password, passwordForm.value.new_password)
    showToast("密码修改成功")
    passwordForm.value = { old_password: "", new_password: "", confirm_password: "" }
  } catch (e) {
    showToast(e.message)
  }
}

async function loadOrders() {
  if (!user.value) return
  ordersLoading.value = true
  try {
    const res = await orderApi.list()
    orders.value = res.data
  } catch (e) {
    showToast("加载订单失败: " + e.message)
  } finally {
    ordersLoading.value = false
  }
}

const showRefundDialog = ref(false)
const refundTargetId = ref(null)
const refundReason = ref("")

function openRefundDialog(id) {
  refundTargetId.value = id
  refundReason.value = ""
  showRefundDialog.value = true
}

async function submitRefund() {
  try {
    await orderApi.updateStatus(refundTargetId.value, "refunding")
    showToast("退款申请已提交")
    showRefundDialog.value = false
    loadOrders()
  } catch (e) {
    showToast(e.message)
  }
}

async function payOrder(id) {
  try {
    await orderApi.updateStatus(id, "paid")
    showToast("已模拟付款")
    loadOrders()
  } catch (e) {
    showToast(e.message)
  }
}

async function cancelOrder(id) {
  try {
    await orderApi.cancel(id)
    showToast("订单已取消")
    loadOrders()
  } catch (e) {
    showToast(e.message)
  }
}

async function confirmOrder(id) {
  try {
    await orderApi.updateStatus(id, "completed")
    showToast("订单已确认完成")
    loadOrders()
  } catch (e) {
    showToast(e.message)
  }
}

// --- Cart Actions ---
async function addToCart(product) {
  if (!user.value) { showToast("请先登录"); return }
  try {
    await cartApi.add(product.id)
    showToast(`${product.name} 已加入购物车`)
    loadCart()
  } catch (e) {
    showToast(e.message)
  }
}

async function removeFromCart(id) {
  try {
    await cartApi.remove(id)
    loadCart()
  } catch (e) {
    showToast(e.message)
  }
}

async function updateQty(id, delta) {
  const item = cartItems.value.find((i) => i.id === id)
  if (!item) return
  const newQty = item.qty + delta
  if (newQty <= 0) {
    removeFromCart(id)
  } else {
    try {
      await cartApi.update(id, newQty)
      loadCart()
    } catch (e) {
      showToast(e.message)
    }
  }
}

function toggleCart() {
  if (!user.value) { showToast("请先登录"); return }
  cartOpen.value = !cartOpen.value
}

async function checkout() {
  if (cartItems.value.length === 0) return
  selectedPayment.value = "wechat"
  cartOpen.value = false
  showPaymentModal.value = true
}

async function submitPayment() {
  try {
    await orderApi.create("", selectedPayment.value)
    showToast("🎉 下单成功！感谢您的购买")
    showPaymentModal.value = false
    cartOpen.value = false
    loadCart()
  } catch (e) {
    showToast(e.message)
  }
}

// --- Admin ---
function openAdmin() {
  showUserCenter.value = false
  showAdmin.value = true
  showDropdown.value = false
  adminTab.value = "products"
  loadAdminProducts()
}

async function loadAdminProducts() {
  adminLoading.value = true
  try {
    const res = await adminApi.listProducts()
    adminProducts.value = res.data
  } catch (e) {
    showToast("加载管理列表失败: " + e.message)
  } finally {
    adminLoading.value = false
  }
}

async function deleteProduct(product) {
  if (!confirm(`确定要删除商品"${product.name}"吗？此操作不可恢复。`)) return
  try {
    await adminApi.deleteProduct(product.id)
    showToast(`"${product.name}" 已删除`)
    loadAdminProducts()
  } catch (e) {
    showToast(e.message)
  }
}

async function toggleProductStatus(product) {
  const newStatus = product.status === "off" ? "on" : "off"
  try {
    await adminApi.toggleStatus(product.id, newStatus)
    product.status = newStatus
    showToast(newStatus === "on" ? `"${product.name}" 已上架` : `"${product.name}" 已下架`)
  } catch (e) {
    showToast(e.message)
  }
}

function openProductForm(mode, product) {
  isAdding.value = mode === "add"
  editingProduct.value = product || null
  if (mode === "edit" && product) {
    productForm.value = {
      name: product.name, category: product.category, price: String(product.price),
      original: product.original ? String(product.original) : "", stars: product.stars,
      reviews: product.reviews, tag: product.tag || "", tag_type: product.tag_type || "",
      bg: product.bg, image_url: product.image_url || "", description: product.description || "",
      stock: product.stock || 99
    }
  } else {
    productForm.value = {
      name: "", category: "", price: "", original: "", stars: 5, reviews: 0,
      tag: "", tag_type: "", bg: "#f1f5f9", image_url: "", description: "", stock: 99
    }
  }
  showProductForm.value = true
}

async function saveProduct() {
  const f = productForm.value
  if (!f.name || !f.category || !f.price) {
    showToast("请填写商品名称、分类和价格")
    return
  }
  const data = {
    name: f.name, category: f.category, price: parseFloat(f.price),
    original: f.original ? parseFloat(f.original) : null, stars: parseInt(f.stars),
    reviews: parseInt(f.reviews), tag: f.tag || null, tag_type: f.tag_type || null,
    bg: f.bg, image_url: f.image_url, description: f.description, stock: parseInt(f.stock) || 99
  }
  try {
    if (isAdding.value) {
      await adminApi.createProduct(data)
      showToast("商品已添加")
    } else {
      await adminApi.updateProduct(editingProduct.value.id, data)
      showToast("商品已更新")
    }
    showProductForm.value = false
    loadAdminProducts()
  } catch (e) {
    showToast(e.message)
  }
}

// --- Admin Orders ---
async function loadAdminOrders() {
  adminOrdersLoading.value = true
  try {
    const params = {
      page: String(adminOrderPage.value),
      limit: "15",
      q: adminOrderSearch.value.trim(),
      status: adminOrderFilter.value,
    }
    const res = await adminApi.listOrders(params)
    adminOrders.value = res.data
    adminOrderTotal.value = res.pagination.total
    adminOrderTotalPages.value = res.pagination.totalPages
  } catch (e) {
    showToast("加载订单失败: " + e.message)
  } finally {
    adminOrdersLoading.value = false
  }
}

function onAdminOrderSearch() {
  adminOrderPage.value = 1
  loadAdminOrders()
}

function onAdminOrderFilter() {
  adminOrderPage.value = 1
  loadAdminOrders()
}

function adminOrderGoToPage(page) {
  if (page < 1 || page > adminOrderTotalPages.value || page === adminOrderPage.value) return
  adminOrderPage.value = page
  loadAdminOrders()
}

async function viewOrderDetail(order) {
  try {
    const res = await adminApi.orderDetail(order.id)
    detailOrder.value = res.data
    detailItems.value = res.data.items || []
    showOrderDetail.value = true
  } catch (e) {
    showToast(e.message)
  }
}

function openStatusDialog(order) {
  targetOrder.value = order
  targetStatus.value = ""
  statusReason.value = ""
  showStatusDialog.value = true
}

// 拒绝退款
const showRejectDialog = ref(false)
const rejectTarget = ref(null)
const rejectReason = ref("")

function openRejectDialog(order) {
  rejectTarget.value = order
  rejectReason.value = ""
  showRejectDialog.value = true
}

async function submitReject() {
  if (!rejectReason.value.trim()) {
    showToast("请填写拒绝原因")
    return
  }
  try {
    const res = await adminApi.rejectRefund(rejectTarget.value.id, rejectReason.value.trim())
    showToast(res.message)
    showRejectDialog.value = false
    showOrderDetail.value = false
    loadAdminOrders()
  } catch (e) {
    showToast(e.message)
  }
}

async function submitStatusChange() {
  if (!targetStatus.value) {
    showToast("请选择目标状态")
    return
  }
  try {
    const res = await adminApi.updateOrderStatus(targetOrder.value.id, targetStatus.value, statusReason.value)
    showToast(res.message)
    showStatusDialog.value = false
    showOrderDetail.value = false
    loadAdminOrders()
  } catch (e) {
    showToast(e.message)
  }
}

// --- Points & Membership ---
async function loadPoints() {
  if (!user.value) return
  pointsLoading.value = true
  try {
    const res = await pointsApi.info()
    pointsInfo.value = res.data
  } catch (e) {
    console.error("加载积分信息失败", e)
  } finally {
    pointsLoading.value = false
  }
}

function membershipLabel(level) {
  const labels = { bronze: "铜牌会员", silver: "银牌会员", gold: "金牌会员", diamond: "钻石会员" }
  return labels[level] || level
}

function membershipColor(level) {
  const colors = { bronze: "#cd7f32", silver: "#a8a8a8", gold: "#f59e0b", diamond: "#6366f1" }
  return colors[level] || "#cd7f32"
}

function progressPercent() {
  if (!pointsInfo.value || !pointsInfo.value.next_level) return 100
  const levelMin = { bronze: 0, silver: 1000, gold: 5000, diamond: 10000 }
  const currentMin = levelMin[pointsInfo.value.membership] || 0
  const nextMin = levelMin[pointsInfo.value.next_level] || 10000
  const range = nextMin - currentMin
  const progress = pointsInfo.value.points - currentMin
  return Math.min(100, Math.max(0, (progress / range) * 100))
}

// --- Init ---
onMounted(() => {
  checkLogin()
  loadProducts()
  loadCategories()

// 启动广告轮播（每 5 秒切换一次）
  adInterval = setInterval(nextAd, 5000);
  startColorLoop();
})

onBeforeUnmount(() => {
  // 清除广告轮播定时器
  clearInterval(adInterval);
  stopColorLoop();
})
</script>

<template>
  <!-- Header -->
  <header class="header">
    <div class="header-inner">
      <a href="#" class="logo" @click.prevent="showUserCenter = false">
        <div class="logo-icon"><i class="fas fa-bolt"></i></div>
        <span>智选商城</span>
      </a>

      <div class="search-box">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索商品、品类...（支持多关键词）"
          @input="onSearchInput"
          @keyup.enter="currentPage = 1; loadProducts()"
        />
        <button class="search-btn" @click="currentPage = 1; loadProducts()">
          <i class="fas fa-search"></i>
        </button>
      </div>

      <div class="header-actions">
        <template v-if="user">
          <div class="user-menu" @click="showDropdown = !showDropdown">
            <button class="header-btn user-btn" :title="user.nickname || user.username">
              <i class="fas fa-user"></i>
            </button>
            <span class="user-name">{{ user.nickname || user.username }}</span>
            <div class="user-dropdown" :class="{ show: showDropdown }" @click.stop>
              <div class="dropdown-item" @click="openUserCenter('profile')">
                <i class="fas fa-id-card"></i> 个人信息
              </div>
              <div class="dropdown-item" @click="openUserCenter('orders')">
                <i class="fas fa-receipt"></i> 我的订单
              </div>
              <div class="dropdown-item" @click="openUserCenter('password')">
                <i class="fas fa-key"></i> 修改密码
              </div>
              <div v-if="user.role === 'admin'" class="dropdown-divider"></div>
              <div v-if="user.role === 'admin'" class="dropdown-item admin-entry" @click="openAdmin()">
                <i class="fas fa-cog"></i> 管理后台
              </div>
              <div class="dropdown-divider"></div>
              <div class="dropdown-item danger" @click="logout">
                <i class="fas fa-sign-out-alt"></i> 退出登录
              </div>
            </div>
          </div>
          <button class="header-btn" @click="toggleCart" title="购物车">
            <i class="fas fa-shopping-bag"></i>
            <span v-if="cartCount" class="cart-badge">{{ cartCount > 99 ? "99+" : cartCount }}</span>
          </button>
        </template>
        <template v-else>
          <button class="header-btn" @click="openAuth('login')" title="登录">
            <i class="fas fa-user"></i>
          </button>
        </template>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <template v-if="!showUserCenter && !showAdmin">
    <!-- Hero Banner -->
    <section class="hero">
      <div class="hero-banner">
        <div class="hero-text">
          <h1>🔥 夏日大促</h1>
          <p>全场低至5折，限时抢购不容错过</p>
          <button class="hero-btn" @click="searchQuery = ''; activeCategory = '全部'; currentPage = 1; loadProducts()">
            立即抢购 <i class="fas fa-arrow-right"></i>
          </button>
        </div>
        <div class="hero-emoji">🛍️</div>
      </div>
    </section>

    <!-- Filter & Sort Bar -->
    <div class="filter-bar">
      <div class="filter-chips">
        <button
          v-for="cat in categories" :key="cat"
          class="filter-chip" :class="{ active: activeCategory === cat }"
          @click="onCategoryChange(cat)"
        >{{ cat }}</button>
      </div>
      <div class="sort-dropdown">
        <i class="fas fa-arrow-down-wide-short"></i>
        <select v-model="sortBy" @change="onSortChange">
          <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- Search Result Info -->
    <div class="result-bar" v-if="searchQuery.trim() || activeCategory !== '全部'">
      <span>
        <i class="fas fa-search"></i>
        <template v-if="searchQuery.trim()">
          搜索 "{{ searchQuery.trim() }}"
        </template>
        <template v-if="activeCategory !== '全部'">
          {{ searchQuery.trim() ? " · " : "" }}分类: {{ activeCategory }}
        </template>
        — 共 <strong>{{ totalProducts }}</strong> 件商品
      </span>
      <button class="result-clear" @click="searchQuery = ''; activeCategory = '全部'; currentPage = 1; loadProducts()">
        <i class="fas fa-times"></i> 清除筛选
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <i class="fas fa-spinner fa-spin" style="font-size:32px;color:var(--primary);"></i>
      <p style="margin-top:12px;color:var(--text-light);">正在加载商品...</p>
    </div>

    <!-- Product Grid -->
    <div v-else-if="products.length" class="product-grid">
      <div v-for="product in products" :key="product.id" class="product-card">
        <div class="product-img-wrap">
          <img class="product-img" :src="product.image_url || undefined" :style="product.image_url ? {} : { background: product.bg }" alt="" />
          <span v-if="product.tag" :class="['product-tag', product.tag_type]">{{ product.tag }}</span>
          <span v-if="product.stock <= 0" class="product-tag sold-out-tag">售罄</span>
        </div>
        <div class="product-info">
          <div class="product-category">{{ product.category }}</div>
          <div class="product-name" v-html="highlightText(product.name, searchQuery)"></div>
          <div class="product-rating">
            <span class="stars">{{ "★".repeat(product.stars) }}{{ "☆".repeat(5 - product.stars) }}</span>
            <span class="rating-num">({{ product.reviews }})</span>
          </div>
          <div class="product-bottom">
            <div class="product-price">
              <span class="symbol">¥</span>{{ product.price }}
              <span v-if="product.original" class="original">¥{{ product.original }}</span>
            </div>
            <div class="product-stock" v-if="product.stock <= 10 && product.stock > 0" style="color:#f59e0b;font-size:12px;">仅剩 {{ product.stock }} 件</div>
            <div class="product-stock" v-else-if="product.stock <= 0" style="color:#ef4444;font-size:12px;">暂时缺货</div>
            <button class="add-cart-btn" title="加入购物车" @click="addToCart(product)" :disabled="product.stock <= 0" :class="{ disabled: product.stock <= 0 }">
              <i class="fas fa-plus"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else style="text-align:center;padding:80px 24px;color:var(--text-light);">
      <i class="fas fa-search" style="font-size:48px;margin-bottom:16px;opacity:0.4;"></i>
      <p style="font-size:16px;">没有找到匹配的商品，试试其他关键词吧</p>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="pagination">
      <button
        class="page-btn"
        :disabled="currentPage <= 1"
        @click="goToPage(currentPage - 1)"
      ><i class="fas fa-chevron-left"></i></button>

      <button
        v-for="p in pageRange"
        :key="p"
        :class="['page-btn', { active: p === currentPage }]"
        @click="goToPage(p)"
      >{{ p }}</button>

      <button
        class="page-btn"
        :disabled="currentPage >= totalPages"
        @click="goToPage(currentPage + 1)"
      ><i class="fas fa-chevron-right"></i></button>

      <span class="page-info">共 {{ totalPages }} 页 / {{ totalProducts }} 件</span>
    </div>
  </template>

  <!-- ===== User Center ===== -->
  <template v-else-if="showUserCenter">
    <div class="user-center">
      <div class="uc-header">
        <button class="uc-back" @click="showUserCenter = false">
          <i class="fas fa-arrow-left"></i> 返回商城
        </button>
        <h2>个人中心</h2>
      </div>

      <div class="uc-tabs">
        <button :class="['uc-tab', { active: userCenterTab === 'profile' }]" @click="userCenterTab = 'profile'">
          <i class="fas fa-id-card"></i> 个人信息
        </button>
        <button :class="['uc-tab', { active: userCenterTab === 'orders' }]" @click="userCenterTab = 'orders'; loadOrders()">
          <i class="fas fa-receipt"></i> 我的订单
        </button>
        <button :class="['uc-tab', { active: userCenterTab === 'membership' }]" @click="userCenterTab = 'membership'; loadPoints()">
          <i class="fas fa-crown"></i> 会员积分
        </button>
        <button :class="['uc-tab', { active: userCenterTab === 'password' }]" @click="userCenterTab = 'password'">
          <i class="fas fa-key"></i> 修改密码
        </button>
      </div>

      <div class="uc-content">
        <!-- Profile Tab -->
        <div v-if="userCenterTab === 'profile'" class="uc-panel">
          <div class="uc-panel-title">
            <i class="fas fa-user-circle"></i> 个人信息
          </div>
          <div class="profile-info">
            <div class="profile-field">
              <label>用户名</label>
              <div class="profile-value readonly">{{ user.username }}</div>
            </div>
            <div class="profile-field">
              <label>昵称</label>
              <input v-model="profileForm.nickname" placeholder="设置昵称" class="profile-input" />
            </div>
            <div class="profile-field">
              <label>手机号</label>
              <input v-model="profileForm.phone" placeholder="请输入手机号" class="profile-input" />
            </div>
            <div class="profile-field">
              <label>收货地址</label>
              <input v-model="profileForm.address" placeholder="请输入收货地址" class="profile-input" />
            </div>
            <div class="profile-field">
              <label>注册时间</label>
              <div class="profile-value readonly">{{ user.created_at }}</div>
            </div>
            <button class="checkout-btn profile-save-btn" @click="saveProfile">
              <i class="fas fa-save"></i> 保存修改
            </button>
          </div>
        </div>

        <!-- Orders Tab -->
        <div v-if="userCenterTab === 'orders'" class="uc-panel">
          <div class="uc-panel-title">
            <i class="fas fa-receipt"></i> 我的订单
          </div>
          <div v-if="ordersLoading" class="loading-state" style="padding:40px;">
            <i class="fas fa-spinner fa-spin" style="font-size:24px;color:var(--primary);"></i>
            <p style="margin-top:8px;color:var(--text-light);">加载订单中...</p>
          </div>
          <div v-else-if="orders.length === 0" class="uc-empty">
            <i class="fas fa-box-open"></i>
            <p>暂无订单记录</p>
            <button class="checkout-btn" style="margin-top:16px;width:auto;padding:10px 24px;" @click="showUserCenter = false">
              去逛逛
            </button>
          </div>
          <div v-else class="order-list">
            <div v-for="order in orders" :key="order.id" class="order-card">
              <div class="order-header">
                <span class="order-no">订单号：{{ order.order_no }}</span>
                <span class="order-status" :style="{ color: (statusConfig[order.status] || {}).color }">
                  <i :class="['fas', (statusConfig[order.status] || {}).icon || 'fa-circle']"></i>
                  {{ order.status_label || order.status }}
                </span>
              </div>
              <div class="order-body">
                <div class="order-total">
                  <span>合计：</span>
                  <strong>¥{{ Number(order.total).toFixed(2) }}</strong>
                </div>
                <div class="order-payment" v-if="order.payment_method" :style="{ color: (paymentConfig(order.payment_method) || {}).color }">
                  <i :class="['fas', (paymentConfig(order.payment_method) || {}).icon || 'fa-credit-card']"></i>
                  {{ order.payment_label || order.payment_method }}
                </div>
                <div class="order-time">
                  <i class="fas fa-calendar"></i>
                  {{ order.created_at }}
                </div>
              </div>
              <div class="order-actions">
                <button v-if="order.status === 'pending'" class="order-btn cancel" @click="cancelOrder(order.id)">
                  <i class="fas fa-times"></i> 取消订单
                </button>
                <button v-if="order.status === 'pending'" class="order-btn pay" @click="payOrder(order.id)">
                  <i class="fas fa-credit-card"></i> 模拟付款
                </button>
                <button v-if="order.status === 'delivered'" class="order-btn confirm" @click="confirmOrder(order.id)">
                  <i class="fas fa-check"></i> 确认收货
                </button>
                <button v-if="['paid','delivered','completed'].includes(order.status)" class="order-btn refund" @click="openRefundDialog(order.id)">
                  <i class="fas fa-undo"></i> 申请退款
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Membership Tab -->
        <div v-if="userCenterTab === 'membership'" class="uc-panel">
          <div class="uc-panel-title">
            <i class="fas fa-crown"></i> 会员与积分
          </div>
          <div v-if="pointsLoading" class="loading-state" style="padding:40px;">
            <i class="fas fa-spinner fa-spin" style="font-size:24px;color:var(--primary);"></i>
            <p style="margin-top:8px;color:var(--text-light);">加载中...</p>
          </div>
          <template v-else-if="pointsInfo">
            <!-- Membership Card -->
            <div class="member-card" :style="{ background: `linear-gradient(135deg, ${pointsInfo.membership_color}20, ${pointsInfo.membership_color}40)` }">
              <div class="member-card-header">
                <div class="member-badge" :style="{ background: pointsInfo.membership_color }">
                  <i :class="['fas', pointsInfo.membership_icon || 'fa-medal']"></i>
                </div>
                <div class="member-info">
                  <div class="member-level" :style="{ color: pointsInfo.membership_color }">{{ pointsInfo.membership_label }}</div>
                  <div class="member-points">{{ pointsInfo.points }} <span>积分</span></div>
                  <div class="member-multiplier">消费积分 ×{{ pointsInfo.multiplier }} 倍</div>
                </div>
              </div>
              <!-- Progress to next level -->
              <div class="member-progress-wrap" v-if="pointsInfo.next_level">
                <div class="member-progress-text">
                  <span>距{{ pointsInfo.next_level_label }}还需 {{ pointsInfo.points_to_next }} 积分</span>
                </div>
                <div class="member-progress-bar">
                  <div class="member-progress-fill" :style="{ width: progressPercent() + '%', background: pointsInfo.membership_color }"></div>
                </div>
              </div>
              <div class="member-progress-text" v-else style="text-align:center;color:var(--primary);font-weight:700;">
                <i class="fas fa-gem"></i> 已达最高等级
              </div>
            </div>

            <!-- Level Table -->
            <div class="member-levels">
              <div class="section-label">会员等级</div>
              <div class="level-list">
                <div v-for="lv in pointsInfo.levels" :key="lv.key" class="level-item" :class="{ current: lv.key === pointsInfo.membership }">
                  <div class="level-name" :style="{ color: lv.key === pointsInfo.membership ? pointsInfo.membership_color : '' }">
                    {{ lv.label }} {{ lv.key === pointsInfo.membership ? '(当前)' : '' }}
                  </div>
                  <div class="level-require">{{ lv.minPoints > 0 ? lv.minPoints + ' 积分起' : '默认等级' }}</div>
                  <div class="level-rate">{{ lv.multiplier }}x 积分</div>
                </div>
              </div>
            </div>

            <!-- Points Log -->
            <div class="points-log-section">
              <div class="section-label">积分明细</div>
              <div v-if="pointsInfo.log.length === 0" class="uc-empty" style="padding:24px;">
                <i class="fas fa-history" style="font-size:24px;"></i>
                <p style="font-size:14px;">暂无积分记录</p>
              </div>
              <div v-else class="points-log-list">
                <div v-for="entry in pointsInfo.log" :key="entry.id" class="points-log-item">
                  <div class="log-icon" :class="entry.type">
                    <i :class="entry.type === 'earn' ? 'fas fa-plus-circle' : 'fas fa-minus-circle'"></i>
                  </div>
                  <div class="log-info">
                    <div class="log-desc">{{ entry.description }}</div>
                    <div class="log-time">{{ entry.created_at }}</div>
                  </div>
                  <div class="log-points" :class="entry.type">
                    {{ entry.type === 'earn' ? '+' : '' }}{{ entry.points }}
                  </div>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="uc-empty" style="padding:40px;">
            <i class="fas fa-crown" style="font-size:48px;opacity:0.2;"></i>
            <p>加载失败，请重试</p>
          </div>
        </div>

        <!-- Password Tab -->
        <div v-if="userCenterTab === 'password'" class="uc-panel">
          <div class="uc-panel-title">
            <i class="fas fa-key"></i> 修改密码
          </div>
          <div class="password-form">
            <div class="profile-field">
              <label>当前密码</label>
              <input v-model="passwordForm.old_password" type="password" placeholder="请输入当前密码" class="profile-input" />
            </div>
            <div class="profile-field">
              <label>新密码</label>
              <input v-model="passwordForm.new_password" type="password" placeholder="至少6个字符" class="profile-input" />
            </div>
            <div class="profile-field">
              <label>确认新密码</label>
              <input v-model="passwordForm.confirm_password" type="password" placeholder="再次输入新密码" class="profile-input" />
            </div>
            <button class="checkout-btn profile-save-btn" @click="changePassword">
              <i class="fas fa-save"></i> 修改密码
            </button>
          </div>
        </div>
      </div>
    </div>
  </template>

  <!-- ===== Admin Panel ===== -->
  <template v-if="showAdmin">
    <div class="user-center">
      <div class="uc-header">
        <button class="uc-back" @click="showAdmin = false; showProductForm = false; showOrderDetail = false; showStatusDialog = false">
          <i class="fas fa-arrow-left"></i> 返回商城
        </button>
        <h2><i class="fas fa-cog"></i> 管理后台</h2>
        <div class="admin-tabs">
          <button :class="['admin-tab-btn', { active: adminTab === 'products' }]" @click="adminTab = 'products'; showProductForm = false">
            <i class="fas fa-boxes"></i> 商品管理
          </button>
          <button :class="['admin-tab-btn', { active: adminTab === 'orders' }]" @click="adminTab = 'orders'; showProductForm = false; loadAdminOrders()">
            <i class="fas fa-receipt"></i> 订单管理
          </button>
        </div>
        <button v-if="adminTab === 'products'" class="checkout-btn" style="margin-left:auto;width:auto;padding:8px 20px;" @click="openProductForm('add')">
          <i class="fas fa-plus"></i> 新增商品
        </button>
      </div>

      <!-- ===== Product Management ===== -->
      <div v-if="adminTab === 'products'">
      <!-- Product Form Modal -->
      <div v-if="showProductForm" class="uc-content">
        <div class="uc-panel">
          <div class="uc-panel-title">
            <i :class="isAdding ? 'fas fa-plus-circle' : 'fas fa-edit'"></i>
            {{ isAdding ? '新增商品' : '编辑商品' }}
          </div>
          <div class="product-form">
            <div class="form-row">
              <div class="form-field">
                <label>商品名称 *</label>
                <input v-model="productForm.name" placeholder="请输入商品名称" class="profile-input" />
              </div>
              <div class="form-field">
                <label>分类 *</label>
                <input v-model="productForm.category" placeholder="如：数码、家居、服饰" class="profile-input" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-field">
                <label>售价 (¥) *</label>
                <input v-model="productForm.price" type="number" step="0.01" placeholder="售价" class="profile-input" />
              </div>
              <div class="form-field">
                <label>原价 (¥)</label>
                <input v-model="productForm.original" type="number" step="0.01" placeholder="原价（可选）" class="profile-input" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-field">
                <label>评分 (1-5)</label>
                <input v-model.number="productForm.stars" type="number" min="1" max="5" class="profile-input" />
              </div>
              <div class="form-field">
                <label>评价数</label>
                <input v-model.number="productForm.reviews" type="number" min="0" class="profile-input" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-field">
                <label>标签文字</label>
                <input v-model="productForm.tag" placeholder="如：热卖、新品、特惠" class="profile-input" />
              </div>
              <div class="form-field">
                <label>标签类型</label>
                <select v-model="productForm.tag_type" class="profile-input">
                  <option value="">无</option>
                  <option value="hot">热卖</option>
                  <option value="new">新品</option>
                  <option value="sale">特惠</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-field">
                <label>背景色</label>
                <input v-model="productForm.bg" placeholder="#f1f5f9" class="profile-input" />
              </div>
              <div class="form-field">
                <label>图片 URL</label>
                <input v-model="productForm.image_url" placeholder="/images/product-1.jpg" class="profile-input" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-field">
                <label>描述</label>
                <input v-model="productForm.description" placeholder="商品描述" class="profile-input" />
              </div>
              <div class="form-field">
                <label>库存</label>
                <input v-model.number="productForm.stock" type="number" min="0" class="profile-input" />
              </div>
            </div>
            <div class="form-actions">
              <button class="checkout-btn" @click="saveProduct">
                <i class="fas fa-save"></i> {{ isAdding ? '添加商品' : '保存修改' }}
              </button>
              <button class="order-btn cancel" style="margin-left:12px;" @click="showProductForm = false">
                <i class="fas fa-times"></i> 取消
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Product List -->
      <div class="uc-content">
        <div class="uc-panel">
          <div class="uc-panel-title">
            <i class="fas fa-boxes"></i> 商品管理 ({{ adminProducts.length }} 件)
          </div>
          <div v-if="adminLoading" class="loading-state" style="padding:40px;">
            <i class="fas fa-spinner fa-spin" style="font-size:24px;color:var(--primary);"></i>
            <p style="margin-top:8px;color:var(--text-light);">加载中...</p>
          </div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>商品名称</th>
                  <th>分类</th>
                  <th>售价</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in adminProducts" :key="p.id" :class="{ offline: p.status === 'off' }">
                  <td>{{ p.id }}</td>
                  <td class="admin-name-cell">{{ p.name }}</td>
                  <td>{{ p.category }}</td>
                  <td>¥{{ Number(p.price).toFixed(2) }}</td>
                  <td>
                    <span :class="['status-badge', p.status === 'on' ? 'on' : 'off']">
                      {{ p.status === 'on' ? '上架' : '下架' }}
                    </span>
                  </td>
                  <td class="admin-actions">
                    <button class="admin-btn edit" @click="openProductForm('edit', p)" title="编辑">
                      <i class="fas fa-edit"></i>
                    </button>
                    <button class="admin-btn toggle" :class="p.status" @click="toggleProductStatus(p)" :title="p.status === 'on' ? '下架' : '上架'">
                      <i :class="p.status === 'on' ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
                    </button>
                    <button class="admin-btn del" @click="deleteProduct(p)" title="删除">
                      <i class="fas fa-trash-alt"></i>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

      <!-- ===== Order Management ===== -->
      <div v-if="adminTab === 'orders'">
        <div class="uc-content">
          <div class="uc-panel" style="padding:20px 24px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
              <div class="uc-panel-title" style="margin:0;"><i class="fas fa-receipt"></i> 订单管理（共 {{ adminOrderTotal }} 笔）</div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <input v-model="adminOrderSearch" type="text" placeholder="搜索订单号/用户名..." @keyup.enter="onAdminOrderSearch"
                  style="width:200px;border-radius:8px;padding:8px 12px;border:1px solid var(--border);font-size:13px;background:var(--bg-card);color:var(--text-main);" />
                <select v-model="adminOrderFilter" @change="onAdminOrderFilter"
                  style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg-card);color:var(--text-main);">
                  <option v-for="opt in orderStatusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
                <button class="checkout-btn" style="width:auto;padding:7px 14px;font-size:13px;" @click="onAdminOrderSearch">
                  <i class="fas fa-search"></i> 搜索
                </button>
              </div>
            </div>
            <div v-if="adminOrdersLoading" class="loading-state" style="padding:40px;">
              <i class="fas fa-spinner fa-spin" style="font-size:24px;color:var(--primary);"></i>
              <p style="margin-top:8px;color:var(--text-light);">加载中...</p>
            </div>
            <div v-else class="admin-table-wrap">
              <table class="admin-table">
                <thead><tr>
                  <th>ID</th><th>订单号</th><th>用户</th><th>金额</th><th>支付方式</th><th>状态</th><th>创建时间</th><th>操作</th>
                </tr></thead>
                <tbody>
                  <tr v-for="o in adminOrders" :key="o.id">
                    <td>{{ o.id }}</td>
                    <td class="admin-name-cell">{{ o.order_no }}</td>
                    <td>{{ o.nickname || o.username || '-' }}</td>
                    <td>¥{{ Number(o.total).toFixed(2) }}</td>
                    <td>
                      <span v-if="o.payment_method" :style="{ color: paymentConfig(o.payment_method).color }">
                        <i :class="['fas', paymentConfig(o.payment_method).icon || 'fa-credit-card']"></i> {{ o.payment_label }}
                      </span>
                      <span v-else style="color:var(--text-light);">-</span>
                    </td>
                    <td>
                      <span class="status-badge" :class="o.status === 'refunded' || o.status === 'cancelled' ? 'off' : 'on'"
                        :style="o.status === 'pending' ? 'background:#fef3c7;color:#92400e;' : ''">{{ o.status_label }}</span>
                    </td>
                    <td style="font-size:13px;white-space:nowrap;">{{ o.created_at }}</td>
                    <td class="admin-actions">
                      <button class="admin-btn edit" @click="viewOrderDetail(o)" title="详情"><i class="fas fa-info-circle"></i></button>
                      <button v-if="o.allowed_transitions.length" class="admin-btn toggle" @click="openStatusDialog(o)" title="修改状态"><i class="fas fa-exchange-alt"></i></button>
                      <button v-if="o.status === 'refunding'" class="admin-btn del" @click="openRejectDialog(o)" title="拒绝退款"><i class="fas fa-ban"></i></button>
                    </td>
                  </tr>
                  <tr v-if="adminOrders.length === 0 && !adminOrdersLoading">
                    <td colspan="8" style="text-align:center;padding:40px;color:var(--text-light);"><i class="fas fa-box-open" style="font-size:32px;opacity:0.3;"></i><p style="margin-top:8px;">暂无订单记录</p></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="adminOrderTotalPages > 1" class="pagination" style="margin-top:16px;">
              <button class="page-btn" :disabled="adminOrderPage <= 1" @click="adminOrderGoToPage(adminOrderPage - 1)"><i class="fas fa-chevron-left"></i></button>
              <button v-for="p in adminOrderPageRange" :key="p" :class="['page-btn', { active: p === adminOrderPage }]" @click="adminOrderGoToPage(p)">{{ p }}</button>
              <button class="page-btn" :disabled="adminOrderPage >= adminOrderTotalPages" @click="adminOrderGoToPage(adminOrderPage + 1)"><i class="fas fa-chevron-right"></i></button>
              <span class="page-info">共 {{ adminOrderTotalPages }} 页 / {{ adminOrderTotal }} 笔</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Order Detail Modal -->
      <div v-if="showOrderDetail" class="cart-overlay open" @click="showOrderDetail = false"></div>
      <div v-if="showOrderDetail" class="auth-modal open">
        <div class="payment-box" style="max-width:560px;max-height:80vh;overflow-y:auto;">
          <h2 style="display:flex;align-items:center;gap:8px;">
            <i class="fas fa-receipt" style="color:var(--primary);"></i> 订单详情
            <button style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:20px;color:var(--text-light);" @click="showOrderDetail = false"><i class="fas fa-times"></i></button>
          </h2>
          <div v-if="detailOrder" style="font-size:14px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;margin-bottom:16px;">
              <div><span style="color:var(--text-light)">订单号：</span>{{ detailOrder.order_no }}</div>
              <div><span style="color:var(--text-light)">用户：</span>{{ detailOrder.nickname || detailOrder.username }}</div>
              <div><span style="color:var(--text-light)">金额：</span><strong>¥{{ Number(detailOrder.total).toFixed(2) }}</strong></div>
              <div><span style="color:var(--text-light)">支付方式：</span>{{ detailOrder.payment_label || '-' }}</div>
              <div><span style="color:var(--text-light)">状态：</span><span :style="{ color: (statusConfig[detailOrder.status] || {}).color, fontWeight: 600 }">{{ detailOrder.status_label }}</span></div>
              <div><span style="color:var(--text-light)">创建时间：</span>{{ detailOrder.created_at }}</div>
              <div v-if="detailOrder.paid_at"><span style="color:var(--text-light)">付款时间：</span>{{ detailOrder.paid_at }}</div>
              <div v-if="detailOrder.shipped_at"><span style="color:var(--text-light)">发货时间：</span>{{ detailOrder.shipped_at }}</div>
              <div v-if="detailOrder.delivered_at"><span style="color:var(--text-light)">送达时间：</span>{{ detailOrder.delivered_at }}</div>
              <div v-if="detailOrder.cancelled_at"><span style="color:var(--text-light)">取消时间：</span>{{ detailOrder.cancelled_at }}</div>
              <div v-if="detailOrder.refunded_at"><span style="color:var(--text-light)">退款时间：</span>{{ detailOrder.refunded_at }}</div>
            </div>
            <div v-if="detailItems.length" style="border-top:1px solid var(--border);padding-top:12px;">
              <div style="font-weight:600;margin-bottom:8px;">商品明细</div>
              <div v-for="item in detailItems" :key="item.id" style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;">
                <span>{{ item.name }} × {{ item.qty }}</span>
                <span style="color:var(--text-secondary);">¥{{ Number(item.price).toFixed(2) }}</span>
              </div>
            </div>
            <div style="display:flex;gap:10px;margin-top:16px;">
              <button v-if="detailOrder.allowed_transitions && detailOrder.allowed_transitions.length" class="checkout-btn" style="flex:1;" @click="openStatusDialog(detailOrder); showOrderDetail = false">
                <i class="fas fa-exchange-alt"></i> 修改订单状态
              </button>
              <button v-if="detailOrder.status === 'refunding'" class="order-btn refund" style="flex:1;padding:12px;" @click="openRejectDialog(detailOrder); showOrderDetail = false">
                <i class="fas fa-ban"></i> 拒绝退款
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Status Change Dialog -->
      <div v-if="showStatusDialog" class="cart-overlay open" @click="showStatusDialog = false"></div>
      <div v-if="showStatusDialog" class="auth-modal open">
        <div class="payment-box" style="max-width:420px;">
          <h2><i class="fas fa-exchange-alt" style="color:var(--primary);"></i> 修改订单状态
            <p style="font-size:13px;font-weight:400;color:var(--text-light);margin-top:4px;">
              订单 {{ targetOrder ? targetOrder.order_no : '' }} · 当前：<strong>{{ targetOrder ? targetOrder.status_label : '' }}</strong>
            </p>
          </h2>
          <div style="margin-bottom:16px;">
            <div style="font-size:14px;font-weight:600;margin-bottom:8px;">可转换的状态：</div>
            <div class="status-select-grid">
              <button v-for="s in (targetOrder ? targetOrder.allowed_transitions : [])" :key="s"
                :class="['status-select-btn', { selected: targetStatus === s }]"
                :style="targetStatus === s ? { borderColor: (statusConfig[s] || {}).color || '#6366f1', background: ((statusConfig[s] || {}).color || '#6366f1') + '12' } : {}"
                @click="targetStatus = s">
                <i :class="['fas', (statusConfig[s] || {}).icon || 'fa-circle']" :style="{ color: (statusConfig[s] || {}).color }"></i>
                {{ (statusConfig[s] || {}).label || s }}
              </button>
            </div>
            <div v-if="!targetOrder || !targetOrder.allowed_transitions.length" style="color:var(--text-light);font-size:13px;text-align:center;padding:16px;">该状态下无可变更的目标状态</div>
          </div>
          <div class="profile-field" style="margin-bottom:16px;">
            <label>备注（可选）</label>
            <input v-model="statusReason" placeholder="状态变更原因..." class="profile-input" />
          </div>
          <div style="display:flex;gap:12px;">
            <button class="checkout-btn" style="flex:1;" @click="submitStatusChange" :disabled="!targetStatus"><i class="fas fa-check"></i> 确认变更</button>
            <button class="order-btn cancel" style="flex:1;margin-left:0;" @click="showStatusDialog = false"><i class="fas fa-times"></i> 取消</button>
          </div>
        </div>
      </div>
      <!-- Reject Refund Dialog -->
      <div v-if="showRejectDialog" class="cart-overlay open" @click="showRejectDialog = false"></div>
      <div v-if="showRejectDialog" class="auth-modal open">
        <div class="payment-box" style="max-width:420px;">
          <h2><i class="fas fa-ban" style="color:#ef4444;"></i> 拒绝退款
            <p style="font-size:13px;font-weight:400;color:var(--text-light);margin-top:4px;">
              订单 {{ rejectTarget ? rejectTarget.order_no : '' }}
            </p>
          </h2>
          <div class="profile-field" style="margin-bottom:16px;">
            <label>拒绝原因 *</label>
            <textarea v-model="rejectReason" placeholder="请填写拒绝退款的原因..." class="profile-input" rows="3" style="resize:vertical;"></textarea>
          </div>
          <div style="display:flex;gap:12px;">
            <button class="checkout-btn" style="flex:1;background:#ef4444;" @click="submitReject" :disabled="!rejectReason.trim()"><i class="fas fa-ban"></i> 确认拒绝</button>
            <button class="order-btn cancel" style="flex:1;margin-left:0;" @click="showRejectDialog = false"><i class="fas fa-times"></i> 取消</button>
          </div>
        </div>
      </div>
    </div>
  </template>

  <!-- Refund Reason Dialog (User) -->
  <div v-if="showRefundDialog" class="cart-overlay open" @click="showRefundDialog = false"></div>
  <div v-if="showRefundDialog" class="auth-modal open">
    <div class="payment-box" style="max-width:400px;">
      <h2><i class="fas fa-undo" style="color:#f59e0b;"></i> 申请退款</h2>
      <p style="font-size:13px;color:var(--text-light);margin-bottom:16px;">退款后库存将自动恢复</p>
      <div class="profile-field" style="margin-bottom:16px;">
        <label>退款原因（选填）</label>
        <textarea v-model="refundReason" placeholder="请简要说明退款原因..." class="profile-input" rows="4" style="resize:vertical;min-height:80px;"></textarea>
      </div>
      <div style="display:flex;gap:12px;">
        <button class="checkout-btn" style="flex:1;background:#f59e0b;" @click="submitRefund"><i class="fas fa-check"></i> 确认申请</button>
        <button class="order-btn cancel" style="flex:1;margin-left:0;" @click="showRefundDialog = false"><i class="fas fa-times"></i> 取消</button>
      </div>
    </div>
  </div>

  <!-- Payment Method Modal -->
  <div class="cart-overlay" :class="{ open: showPaymentModal }" @click="showPaymentModal = false"></div>
  <div class="auth-modal" :class="{ open: showPaymentModal }">
    <div class="payment-box">
      <h2>
        <i class="fas fa-wallet" style="color:var(--primary);"></i> 选择支付方式
        <p style="font-size:14px;font-weight:400;color:var(--text-light);margin-top:4px;">
          订单金额：<strong style="color:var(--danger);">¥{{ cartTotal.toFixed(2) }}</strong>
        </p>
      </h2>
      <div class="payment-options">
        <div
          v-for="pm in paymentMethods" :key="pm.value"
          class="payment-option" :class="{ selected: selectedPayment === pm.value }"
          @click="selectedPayment = pm.value"
        >
          <div class="payment-radio">
            <i :class="['fas', selectedPayment === pm.value ? 'fa-dot-circle' : 'fa-circle']" :style="{ color: selectedPayment === pm.value ? pm.color : '#ccc' }"></i>
          </div>
          <div class="payment-icon-wrap" :style="{ background: pm.color + '18', color: pm.color }">
            <i :class="[pm.iconType, pm.icon]"></i>
          </div>
          <span class="payment-label">{{ pm.label }}</span>
          <i v-if="selectedPayment === pm.value" class="fas fa-check-circle" :style="{ color: pm.color, marginLeft: 'auto' }"></i>
        </div>
      </div>
      <button class="checkout-btn" style="width:100%;margin-top:16px;" @click="submitPayment">
        <i class="fas fa-check"></i> 确认支付
      </button>
    </div>
  </div>

  <!-- Auth Modal -->
  <div class="cart-overlay" :class="{ open: showAuth }" @click="showAuth = false"></div>
  <div class="auth-modal" :class="{ open: showAuth }">
    <div class="auth-box">
      <h2>{{ isLogin ? "登录" : "注册" }}</h2>
      <input v-model="authForm.username" placeholder="用户名" />
      <input v-model="authForm.password" type="password" placeholder="密码" />
      <input v-if="!isLogin" v-model="authForm.nickname" placeholder="昵称（可选）" />
      <button class="checkout-btn" style="margin-top:12px;" @click="handleAuth">
        {{ isLogin ? "登录" : "注册" }}
      </button>
      <p style="margin-top:12px;font-size:13px;color:var(--text-light);text-align:center;">
        {{ isLogin ? "还没有账号？" : "已有账号？" }}
        <a href="#" @click.prevent="openAuth(isLogin ? 'register' : 'login')" style="color:var(--primary);">
          {{ isLogin ? "去注册" : "去登录" }}
        </a>
      </p>
    </div>
  </div>

  <!-- Cart Overlay -->
  <div class="cart-overlay" :class="{ open: cartOpen }" @click="cartOpen = false"></div>

  <!-- Cart Sidebar -->
  <aside class="cart-sidebar" :class="{ open: cartOpen }">
    <div class="cart-header">
      <h2>
        <i class="fas fa-shopping-bag" style="color:var(--primary);"></i>
        购物车
        <span style="font-size:14px;font-weight:400;color:var(--text-light);">({{ cartCount }} 件)</span>
      </h2>
      <button class="cart-close" @click="cartOpen = false"><i class="fas fa-times"></i></button>
    </div>
    <div class="cart-items">
      <div v-if="cartItems.length === 0" class="cart-empty">
        <i class="fas fa-shopping-bag"></i>
        <p>购物车还是空的</p>
        <p style="font-size:13px;margin-top:4px;">快去逛逛吧～</p>
      </div>
      <div v-for="item in cartItems" :key="item.id" class="cart-item">
        <img class="cart-item-img" :src="item.image_url || undefined" :style="item.image_url ? {} : { background: item.bg }" alt="" />
        <div class="cart-item-info">
          <div class="cart-item-name">{{ item.name }}</div>
          <div class="cart-item-price">¥{{ item.price }}</div>
          <div class="cart-item-stock" v-if="item.stock !== undefined" :class="{ low: item.stock <= 5 && item.stock > 0, out: item.stock <= 0 }">
            库存 {{ item.stock }} 件
          </div>
          <div class="cart-item-qty">
            <button class="qty-btn" @click="updateQty(item.id, -1)"><i class="fas fa-minus"></i></button>
            <span class="qty-num">{{ item.qty }}</span>
            <button class="qty-btn" @click="updateQty(item.id, 1)"><i class="fas fa-plus"></i></button>
          </div>
        </div>
        <button class="cart-item-remove" @click="removeFromCart(item.id)"><i class="fas fa-trash-alt"></i></button>
      </div>
    </div>
    <div class="cart-footer">
      <div class="cart-total">
        <span>合计</span>
        <span>¥{{ cartTotal.toFixed(2) }}</span>
      </div>
      <button class="checkout-btn" :disabled="cartItems.length === 0" @click="checkout">
        <i class="fas fa-credit-card"></i> 去结算
      </button>
    </div>
  </aside>
<AiChat :pageContext="pageContext" />
<!-- ===== 原神角色轮播广告 ===== -->
<footer class="ad-footer" v-if="!showUserCenter && !showAdmin">
  <a href="https://ys.mihoyo.com/main/?af_adset=1&utm_source=backup205&from_channel=backup205#/">
    <div class="ad-banner" :style="{ background: currentAd.bg }">
      <!-- 装饰星星（固定不变） -->
      <div class="ad-stars">
        <span class="star">✦</span>
        <span class="star">✦</span>
        <span class="star">✦</span>
        <span class="star">✦</span>
        <span class="star">✦</span>
      </div>
      <!-- 动态光晕 -->
      <div class="ad-glow" :style="{ 
  background: `radial-gradient(circle, ${getBreathingColor()} 0%, transparent 70%)`,
  opacity: 0.6 + 0.4 * Math.sin(time.value * 0.5) 
}"></div>

      <!-- 轮播内容（带淡入淡出动画） -->
      <Transition name="fade-ad" mode="out-in">
        <div :key="currentAdIndex" class="ad-content">
          <div class="ad-brand">
            <div class="ad-logo">
              <span class="ad-icon">{{ currentAd.emoji }}</span>
              <span class="ad-title" :style="{ color: currentAd.accent }">原神</span>
            </div>
            <div class="ad-badge">Genshin Impact</div>
          </div>
          <div class="ad-text">
            <p class="ad-slogan" :style="{ color: currentAd.accent }">{{ currentAd.title }}</p>
            <p class="ad-sub">{{ currentAd.subtitle }}</p>
          </div>
          <div class="ad-action">
            <span class="ad-button" :style="{ 
  background: `linear-gradient(135deg, ${currentAd.accent}, ${currentAd.accent}dd)`, 
  color: getBreathingColor(1.5),
  boxShadow: `0 4px 24px ${getBreathingColor()}66`
}">
  {{ currentAd.btnText }} <i class="fas fa-arrow-right"></i>
</span>
          </div>
        </div>
      </Transition>
    </div>
  </a>
</footer>

  <!-- Toast -->
  <div class="toast" :class="{ show: toastShow }">{{ toastMsg }}</div>
</template>





