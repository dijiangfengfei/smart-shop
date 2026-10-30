-- ============================================================
-- 智选商城 - 数据库初始化脚本
-- 用法: mysql -u root -p < init.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS smart_shop DEFAULT CHARACTER SET utf8mb4;
USE smart_shop;

-- ---- 用户表 ----
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- 商品表 ----
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- 购物车表 ----
CREATE TABLE IF NOT EXISTS cart (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  user_id     INT NOT NULL,
  product_id  INT NOT NULL,
  qty         INT DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_product (user_id, product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- 订单表 ----
CREATE TABLE IF NOT EXISTS orders (
  id             INT PRIMARY KEY AUTO_INCREMENT,
  order_no       VARCHAR(30) NOT NULL UNIQUE,
  user_id        INT NOT NULL,
  total          DECIMAL(10,2) NOT NULL,
  status         VARCHAR(20) DEFAULT "pending",
  payment_method VARCHAR(20) DEFAULT "",
  address        VARCHAR(255) DEFAULT "",
  paid_at        DATETIME DEFAULT NULL,
  shipped_at     DATETIME DEFAULT NULL,
  delivered_at   DATETIME DEFAULT NULL,
  completed_at   DATETIME DEFAULT NULL,
  points_earned  INT DEFAULT 0,
  cancelled_at   DATETIME DEFAULT NULL,
  refunded_at    DATETIME DEFAULT NULL,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- 订单明细表 ----
CREATE TABLE IF NOT EXISTS order_items (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  order_id    INT NOT NULL,
  product_id  INT NOT NULL,
  name        VARCHAR(100) NOT NULL,
  price       DECIMAL(10,2) NOT NULL,
  qty         INT NOT NULL,
  FOREIGN KEY (order_id)   REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ---- AI 对话历史表（由 ai.js 自动创建，此处预建保证完整性）----
CREATE TABLE IF NOT EXISTS ai_conversation (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NOT NULL,
  role        VARCHAR(10)  NOT NULL COMMENT 'system/user/assistant/tool',
  content     TEXT         NOT NULL,
  tool_name   VARCHAR(50)  DEFAULT NULL,
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- ---- 积分日志表 ----
CREATE TABLE IF NOT EXISTS points_log (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  user_id     INT NOT NULL,
  points      INT NOT NULL,
  type        VARCHAR(10) NOT NULL,
  description VARCHAR(100) DEFAULT "",
  order_no    VARCHAR(30) DEFAULT "",
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- 种子数据: 16件商品 ----
INSERT IGNORE INTO products (name, category, price, original, stars, reviews, tag, tag_type, bg, image_url) VALUES
('智能降噪耳机 Pro',   '数码', 799,  1299, 5, 2341, '热卖', 'hot',  '#667eea', '/images/product-1.jpg'),
('超薄机械键盘·青轴',  '数码', 459,  599,  4, 1823, NULL,   NULL,   '#f093fb', '/images/product-2.jpg'),
('便携式蓝牙音箱',     '数码', 299,  499,  4, 3127, '新品', 'new',  '#4facfe', '/images/product-3.jpg'),
('4K 高清投影仪',      '数码', 2599, 3599, 5, 876,  '特惠', 'sale', '#43e97b', '/images/product-4.jpg'),
('北欧风台灯',         '家居', 189,  269,  5, 4521, '热卖', 'hot',  '#fa709a', '/images/product-5.jpg'),
('智能香薰加湿器',     '家居', 259,  329,  4, 2678, NULL,   NULL,   '#a18cd1', '/images/product-6.jpeg'),
('记忆棉护颈枕',       '家居', 159,  219,  4, 5632, '特惠', 'sale', '#ffecd2', '/images/product-7.jpg'),
('纯棉四件套·云朵系列', '家居', 399,  599,  5, 3210, '新品', 'new',  '#89f7fe', '/images/product-8.jpg'),
('经典黑白T恤(三件装)', '服饰', 199,  299,  4, 7821, '热卖', 'hot',  '#232526', '/images/product-9.jpg'),
('轻薄运动跑步鞋',     '服饰', 459,  699,  5, 4321, NULL,   NULL,   '#ff9a9e', '/images/product-10.jpg'),
('休闲帆布双肩包',     '服饰', 259,  359,  4, 2198, '新品', 'new',  '#c3cfe2', '/images/product-11.jpg'),
('智能手表 S3',        '数码', 1299, 1799, 5, 6543, '特惠', 'sale', '#764ba2', '/images/product-12.jpg'),
('无线充电底座',       '数码', 129,  199,  4, 9102, NULL,   NULL,   '#667eea', '/images/product-13.jpg'),
('日式简约餐具套装',   '家居', 329,  459,  5, 1823, '热卖', 'hot',  '#43e97b', '/images/product-14.jpg'),
('弹力速干运动服',     '服饰', 239,  339,  4, 3654, NULL,   NULL,   '#4facfe', '/images/product-15.jpg'),
('极简手表·石英机芯',  '服饰', 599,  899,  5, 1432, '新品', 'new',  '#a18cd1', '/images/product-16.jpg');

-- ---- 种子数据: 管理员 admin / admin123 ----
INSERT IGNORE INTO users (username, password, nickname, role) VALUES
('admin', '$2a$10$iiBSU8Xa4TpkVTj33y6YJ.dWYa6f2Pc4DBA24QPodA42o5wqGBRUq', '管理员', 'admin');

