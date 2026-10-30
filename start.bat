@echo off
chcp 65001 >nul
title 智选商城 - 一键启动

echo ========================================
echo   智选商城 - 一键启动
echo ========================================
echo.

:: ===== 配置 MySQL 连接 =====
set DB_HOST=localhost
set DB_PORT=3306
set DB_USER=root
set DB_PASSWORD=123456
set DB_NAME=smart_shop

echo [1/4] 初始化数据库...
echo 请输入 MySQL root 密码（默认 123456）：
set /p DB_PASSWORD=
if "%DB_PASSWORD%"=="" set DB_PASSWORD="root"

echo.
echo 正在连接 MySQL 并创建数据库...
mysql -u %DB_USER% -p%DB_PASSWORD% < "%~dp0init.sql" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [警告] 数据库初始化失败，请检查 MySQL 是否已启动、密码是否正确
    echo 您也可以手动执行: mysql -u root -p ^< init.sql
) else (
    echo [成功] 数据库 smart_shop 已就绪
)

:: ===== 配置 DeepSeek AI（可选）=====
echo.
echo [可选] 输入 DeepSeek API Key（直接回车跳过，AI 功能不可用）：
set /p DEEPSEEK_API_KEY=

:: ===== 安装依赖 =====
echo.
echo [2/4] 安装依赖...

cd /d "%~dp0server"
if not exist "node_modules" (
    echo 正在安装后端依赖...
    call npm install
) else (
    echo 后端依赖已存在，跳过
)

cd /d "%~dp0"
if not exist "node_modules" (
    echo 正在安装前端依赖...
    call npm install
) else (
    echo 前端依赖已存在，跳过
)

:: ===== 启动服务 =====
echo.
echo [3/4] 启动后端服务 (端口 3000)...
cd /d "%~dp0server"
start "智选商城-后端" cmd /c "set DB_HOST=%DB_HOST%&& set DB_PORT=%DB_PORT%&& set DB_USER=%DB_USER%&& set DB_PASSWORD=%DB_PASSWORD%&& set DB_NAME=%DB_NAME%&& set DEEPSEEK_API_KEY=%DEEPSEEK_API_KEY%&& echo 后端启动中... && node index.js && pause"

echo [4/4] 启动前端服务 (端口 5173)...
cd /d "%~dp0"
start "智选商城-前端" cmd /c "npx vite --host && pause"

:: ===== 等待并打开浏览器 =====
echo.
echo 等待服务启动...
timeout /t 5 /nobreak >nul
start http://localhost:5173

echo.
echo ========================================
echo   启动完成！
echo   前端: http://localhost:5173
echo   后端: http://localhost:3000
echo   管理员: admin / admin123
echo ========================================
echo.
echo 按任意键退出...
pause >nul
