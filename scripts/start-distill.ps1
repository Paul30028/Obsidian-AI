# Starts FaithDistill (Streamlit) after .\scripts\install.ps1 has set up its venv.
#
# Usage: .\scripts\start-distill.ps1
# If PowerShell refuses to run this script, try:
#   powershell -ExecutionPolicy Bypass -File .\scripts\start-distill.ps1

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$FaithDistillDir = Join-Path $RepoRoot "faithdistill"
Set-Location $FaithDistillDir

$VenvStreamlit = Join-Path $FaithDistillDir ".venv\Scripts\streamlit.exe"
if (-not (Test-Path $VenvStreamlit)) {
    Write-Error "还没装 FaithDistill 的 Python 环境，先运行 .\scripts\install.ps1"
    exit 1
}

& $VenvStreamlit run app.py
