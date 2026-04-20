@echo off
cd /d %~dp0
echo [悦读] 启动开发模式...

REM 先启动 Vite（后台）
start "vite-yuedu" cmd /c "cd /d %~dp0 && npm run dev > vite.log 2>&1"

REM 等待 Vite 就绪（最多30秒）
echo [悦读] 等待 Vite dev server 就绪...
:wait_loop
powershell -Command "if (Test-NetConnection -ComputerName localhost -Port 5173 -WarningAction SilentlyContinue -InformationLevel Quiet -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto wait_loop
)

echo [悦读] Vite 已就绪，启动 Electron...
npx electron .
echo [悦读] Electron 已退出。
