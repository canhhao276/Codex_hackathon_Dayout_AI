# Dayout AI - khởi động toàn bộ hệ thống demo (FastAPI :8000 + Node :3000 + Cloudflare Tunnel)
# Chạy:  powershell -ExecutionPolicy Bypass -File start-demo.ps1
# Mở 3 cửa sổ PowerShell riêng. Đóng cửa sổ nào là tắt dịch vụ đó.
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

# --- 1. AI FastAPI (Người 3) ---
$ai = Join-Path $root "ai-fastapi"
if (-not (Test-Path "$ai\.env")) { Copy-Item "$ai\.env.example" "$ai\.env" }
$envText = Get-Content "$ai\.env" -Raw
if ($envText -notmatch "OPENAI_API_KEY=sk-(?!\.\.\.)\S+") {
    Write-Host "CANH BAO: ai-fastapi\.env chua co OPENAI_API_KEY that -> AI se chay thuat toan du phong (KHONG phai AI)!" -ForegroundColor Red
}
if (-not (Test-Path "$ai\.venv\Scripts\python.exe")) {
    Write-Host "Tao venv + cai thu vien Python..." -ForegroundColor Yellow
    python -m venv "$ai\.venv"
    & "$ai\.venv\Scripts\python.exe" -m pip install -r "$ai\requirements.txt"
}
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='Dayout AI - FastAPI :8000'; Set-Location '$ai'; .\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000"

# --- 2. Node.js BFF (Người 2) ---
$node = Join-Path $root "backend-node"
if (-not (Test-Path "$node\.env")) { Copy-Item "$node\.env.example" "$node\.env" }
if (-not (Test-Path "$node\node_modules")) {
    Write-Host "Cai thu vien Node..." -ForegroundColor Yellow
    Push-Location $node; npm.cmd install; Pop-Location
}
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='Dayout AI - Node :3000'; Set-Location '$node'; node src/server.js"

# --- 3. Cloudflare Quick Tunnel (HTTPS cho điện thoại qua 4G) ---
Start-Sleep -Seconds 4
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='Dayout AI - Tunnel'; Set-Location '$root'; npx.cmd cloudflared tunnel --url http://localhost:3000"

Write-Host ""
Write-Host "Da mo 3 cua so. Trong cua so 'Tunnel', copy link https://xxxx.trycloudflare.com" -ForegroundColor Green
Write-Host "-> App Dayout AI tren dien thoai -> nut banh rang -> dan link -> Kiem tra /health -> Luu." -ForegroundColor Green
Write-Host "Kiem tra nhanh: http://localhost:8000/health (openai_configured phai la true) | http://localhost:3000/admin/stats" -ForegroundColor Green
