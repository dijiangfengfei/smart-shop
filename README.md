# 智能商城 (Smart Shop)

一个基于 Vue 3 + Node.js + MySQL 的全栈智能商城系统。

## 技术栈

- **前端**: Vue 3 (Composition API) + Vite + FontAwesome
- **后端**: Node.js + Express + MySQL (mysql2)
- **认证**: JWT + bcryptjs 密码加密
- **数据库**: MySQL + InnoDB 事务支持

## 功能模块

### ✅ 用户认证与授权
- JWT Token 认证（7天有效期）
- 登录/注册/获取用户信息/更新资料
- 可选认证中间件支持

### ✅ 密码加密与安全存储
- bcryptjs 加密，10轮 salt
- 支持密码修改（需验证旧密码）

### ✅ 用户注册与登录
- 用户名唯一性检查
- 输入长度校验（用户名≥2字符，密码≥6字符）
- 自动返回 JWT Token

### ✅ 用户中心页面
- 个人信息编辑（昵称、手机号、地址）
- 订单列表查看
- 密码修改
- 用户下拉菜单快捷入口

### ✅ 订单业务流程设计
- 购物车→创建订单→订单明细（事务保证）
- 订单列表/详情/取消
- 自动生成订单号（ORD+时间戳+随机码）

### ✅ 事务管理与数据一致性
- 订单创建使用 MySQL 事务（beginTransaction/commit/rollback）
- 下单后自动清空购物车

### ✅ 订单状态机
- 8种状态：pending→paid→shipped→delivered→completed + cancelled/refunding/refunded
- 逆向流程：用户取消(库存恢复)、用户申请退款、管理员拒绝退款(refunding→paid)、管理员退款完成(库存+积分)
- 状态转换严格校验，非法跳转被拦截
- 自动记录各状态时间戳(paid_at/shipped_at/delivered_at/completed_at/cancelled_at/refunded_at)

### ✅ 购物车功能
- 添加/更新数量/删除/清空
- 商品存在性检查
- 重复添加自动增加数量

### ✅ 订单创建与管理
- 从购物车创建订单
- 取消订单（仅待处理状态）
- 订单状态流转（用户侧可操作：模拟付款、确认收货）

### ✅ 商品上下架管理
- 管理员可对商品进行上架/下架操作
- 下架商品对普通用户不可见
- 用户端商品列表自动过滤已下架商品
- 管理员可新增、编辑商品信息
- 默认管理员账号: `admin` / `admin123`

### ✅ 多种支付方式
- 下单时需选择支付方式：微信支付 / 支付宝 / 银行卡 / 货到付款
- 后端校验支付方式有效性
- 订单列表和详情展示支付方式图标和中文标签
- 支付方式存储在订单记录中

### ✅ 用户会员与积分体系
- **会员等级**: 铜牌(默认) → 银牌(1000积分) → 金牌(5000积分) → 钻石(10000积分)
- **积分倍数**: 铜牌1x / 银牌1.2x / 金牌1.5x / 钻石2x
- **积分获取**: 订单确认收货后自动获得积分（订单金额 × 会员倍数）
- **积分扣除**: 退款时自动扣除对应订单获得的积分
- **自动升级**: 积分达到门槛自动升级会员等级
- **积分日志**: 记录每一笔积分收支明细
- 前端会员中心：展示会员卡、等级进度、积分明细

### ✅ 库存系统
- 加入购物车时校验库存，库存不足阻止添加
- 修改购物车数量时检查库存上限
- 下单时在事务内扣减库存，下架/缺货商品阻止下单
- 订单取消/退款时自动恢复库存
- 前端商品卡片显示"仅剩X件"(≤10件)和"售罄"(0件)状态
- 售罄商品自动禁用加入购物车按钮
- 购物车侧栏展示各商品库存数

### ✅ 网页测试
- 基于 Vitest 的前后端单元测试（共 80 个用例）
- **后端测试**: 订单状态机转换规则、支付方式标签、会员等级计算、订单号生成
- **前端测试**: 关键词高亮、支付方式配置、会员等级标签/颜色/进度条
- 运行方式: `npm run test`（前端）/ `cd server && npm run test`（后端）

### ✅ 管理后台 — 订单管理
- 订单列表（分页、搜索订单号/用户名、按状态筛选）
- 订单详情（用户信息、商品明细、各状态时间戳）
- 管理员修改订单状态（动态展示合法目标状态，严格校验状态机）
- 状态变更自动处理库存恢复、积分发放/扣除（事务保证）
- 订单列表和详情均可操作

### ✅ 退款流程
- **用户端**: 已支付/已送达/已完成订单可申请退款，弹出对话框填写原因
- **管理端**: 退款中订单可「拒绝退款」(refunding→paid)，需填写拒绝原因
- 退款完成(refunded)自动恢复库存 + 扣除已发放积分
- 拒绝退款仅更新状态，不操作库存和积分

### ✅ 一键部署
- `init.sql` 完整建库建表脚本，含 16 件种子商品 + 管理员账号
- `start.bat` 双击启动：建库→装依赖→启后端→启前端→开浏览器

## 快速开始

### 方式一：一键启动（Windows）

1. 确保已安装 **Node.js** 和 **MySQL**（MySQL 需在运行中）
2. 双击项目根目录的 **`start.bat`**
3. 输入 MySQL root 密码，脚本会自动：
   - 执行 `init.sql` 创建数据库和表，导入种子数据
   - 安装前后端依赖（首次）
   - 启动后端 (端口 3000) 和前端 (端口 5173)
   - 自动打开浏览器

### 方式二：手动启动

#### 1. 初始化数据库
```bash
mysql -u root -p < init.sql
```

#### 2. 启动后端
```bash
cd server
npm install
# 可选环境变量: DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
npm start
```

#### 3. 启动前端
```bash
npm install
npm run dev
```

### 访问地址
- 前端: http://localhost:5173
- 后端 API: http://localhost:3000
- 管理员: `admin` / `admin123`

## API 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/products | 商品列表（支持搜索&分类） |
| GET | /api/products/categories | 商品分类 |
| GET | /api/products/:id | 商品详情 |
| POST | /api/auth/register | 用户注册 |
| POST | /api/auth/login | 用户登录 |
| GET | /api/auth/me | 获取当前用户信息 |
| PUT | /api/auth/profile | 更新用户资料 |
| PUT | /api/auth/password | 修改密码 |
| GET | /api/cart | 购物车列表 |
| POST | /api/cart | 添加购物车 |
| PUT | /api/cart/:id | 更新购物车数量 |
| DELETE | /api/cart/:id | 删除购物车项 |
| DELETE | /api/cart | 清空购物车 |
| POST | /api/orders | 创建订单 |
| GET | /api/orders | 订单列表 |
| GET | /api/orders/:id | 订单详情 |
| PUT | /api/orders/:id/status | 更新订单状态 |
| PUT | /api/orders/:id/cancel | 取消订单 |
| GET | /api/points | 积分余额 & 会员信息 & 积分日志 |
| GET | /api/admin/products | 管理端-商品列表（需管理员） |
| POST | /api/admin/products | 管理端-新增商品（需管理员） |
| PUT | /api/admin/products/:id | 管理端-编辑商品（需管理员） |
| PUT | /api/admin/products/:id/status | 管理端-商品上下架（需管理员） |
| DELETE | /api/admin/products/:id | 管理端-删除商品（需管理员） |
| GET | /api/admin/orders | 管理端-订单列表（搜索/筛选/分页） |
| GET | /api/admin/orders/:id | 管理端-订单详情（含商品明细） |
| PUT | /api/admin/orders/:id/status | 管理端-更新订单状态 |
| POST | /api/admin/orders/:id/reject-refund | 管理端-拒绝退款（refunding→paid） |
| GET | /api/admin/orders/statuses | 管理端-状态枚举与转换规则 |
# -
