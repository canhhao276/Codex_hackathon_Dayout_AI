# Dayout AI - FastAPI engine launcher (Windows PowerShell)
# Usage:  powershell -ExecutionPolicy Bypass -File start.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example - put your OPENAI_API_KEY in it." -ForegroundColor Yellow
}

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    if (Get-Command uv -ErrorAction SilentlyContinue) {
        uv venv --python 3.12 .venv
    } else {
        python -m venv .venv
    }
}

if (Get-Command uv -ErrorAction SilentlyContinue) {
    uv pip install --python .venv -r requirements.txt
} else {
    .\.venv\Scripts\python.exe -m pip install -r requirements.txt
}

.\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000
