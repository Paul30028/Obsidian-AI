# One-click setup for the AKC dashboard (Obsidian plugin) + FaithDistill
# (local batch-distillation tool), pointed at the same vault. Windows/PowerShell
# version of install.sh.
#
# Usage: .\scripts\install.ps1 "D:\path\to\your\Obsidian\Vault"
#
# If PowerShell refuses to run this script at all ("cannot be loaded because
# running scripts is disabled"), run it via:
#   powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 "D:\path\to\vault"

param(
    [string]$VaultPath
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot

if (-not $VaultPath) {
    $VaultPath = Read-Host "Obsidian Vault 的绝对路径（一个已经存在的 vault 文件夹）"
}

if (-not (Test-Path -LiteralPath $VaultPath -PathType Container)) {
    Write-Error "找不到目录：$VaultPath"
    exit 1
}
$VaultPath = (Resolve-Path -LiteralPath $VaultPath).Path

Write-Host "==> 1/4 构建 Obsidian 插件"
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "需要先安装 Node.js（含 npm）：https://nodejs.org"
    exit 1
}
Set-Location $RepoRoot
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install 失败" }
npm run css
if ($LASTEXITCODE -ne 0) { throw "npm run css 失败" }
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build 失败" }

Write-Host "==> 2/4 安装插件到 vault"
$PluginDir = Join-Path $VaultPath ".obsidian\plugins\obsidian-ai-dashboard"
New-Item -ItemType Directory -Force -Path $PluginDir | Out-Null
Copy-Item -Path (Join-Path $RepoRoot "manifest.json") -Destination $PluginDir -Force
Copy-Item -Path (Join-Path $RepoRoot "main.js") -Destination $PluginDir -Force
Copy-Item -Path (Join-Path $RepoRoot "styles.css") -Destination $PluginDir -Force
Write-Host "    已复制 manifest.json / main.js / styles.css 到 $PluginDir"

Write-Host "==> 3/4 配置 FaithDistill（批量蒸馏工具，可选）"
# paddlepaddle/paddleocr (used for scanned-PDF OCR) only ship wheels up to
# Python 3.12 as of writing. The `py` launcher's version flags let us pick
# a known-good interpreter directly instead of whatever "python" resolves
# to on a machine with multiple Pythons installed (often the newest one,
# e.g. 3.13/3.14 -- which makes pip install fail with a confusing "No
# matching distribution found: paddlepaddle").
$PythonExe = $null
$PythonExtraArgs = @()

$PyLauncher = Get-Command py -ErrorAction SilentlyContinue
if ($PyLauncher) {
    foreach ($ver in @("-3.12", "-3.11", "-3.10", "-3.13")) {
        & py $ver -c "import sys" *> $null
        if ($LASTEXITCODE -eq 0) {
            $PythonExe = "py"
            $PythonExtraArgs = @($ver)
            break
        }
    }
}
if (-not $PythonExe) {
    $PythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($PythonCmd) {
        $PythonExe = "python"
    } elseif ($PyLauncher) {
        $PythonExe = "py"
    }
}

if ($PythonExe) {
    $PyVersion = & $PythonExe @PythonExtraArgs -c "import sys; print(f'{sys.version_info[0]}.{sys.version_info[1]}')"
    $FaithDistillDir = Join-Path $RepoRoot "faithdistill"
    Set-Location $FaithDistillDir
    & $PythonExe @PythonExtraArgs -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw "创建 venv 失败" }

    $VenvPip = Join-Path $FaithDistillDir ".venv\Scripts\pip.exe"
    & $VenvPip install --quiet -r requirements.txt
    $PipExitCode = $LASTEXITCODE

    if ($PipExitCode -ne 0) {
        # Don't throw here -- the plugin install above already succeeded
        # and its "next steps" summary below should still print.
        Write-Host "    FaithDistill 依赖安装失败（Python $PyVersion）。若上面提示 paddlepaddle 找不到匹配版本："
        Write-Host "    PaddleOCR（扫描件识别）目前只支持到 Python 3.12，装一个 3.12 后重跑本脚本即可（会自动优先选中）。"
    } else {
        $EnvFile = Join-Path $FaithDistillDir ".env"
        if (-not (Test-Path $EnvFile)) {
            Copy-Item (Join-Path $FaithDistillDir ".env.example") $EnvFile
            (Get-Content $EnvFile) -replace '^OBSIDIAN_VAULT=.*', "OBSIDIAN_VAULT=$VaultPath" |
                Set-Content $EnvFile
        }
        Write-Host "    FaithDistill 的 Python 环境已就绪（.venv，Python $PyVersion），.env 已指向 $VaultPath"
    }
} else {
    Write-Host "    未检测到 Python，跳过 FaithDistill 安装。之后装了 Python 可单独运行本脚本的这一步。"
}

Write-Host "==> 4/4 完成"
Write-Host @"

接下来手动做这几步：
  1. 打开 Obsidian -> 设置 -> Community plugins -> 关掉 Restricted mode（如果还没关）
  2. 在插件列表里找到 "Today's Dashboard (AKC)"，打开开关启用
  3. （可选）本地跑 Ollama 才能用 AI 打标/复盘功能：
       ollama serve
       ollama pull qwen3:8b
       ollama pull bge-m3
  4. （可选）要用批量蒸馏功能：
       .\scripts\start-distill.ps1
     然后在 Dashboard 顶部指令栏点 "批量蒸馏" 或输入 /distill 一键跳转

"@
