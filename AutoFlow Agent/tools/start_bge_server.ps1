$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root '.venv-bge\Scripts\python.exe'
$server = Join-Path $root 'tools\local_bge_embedding_server.py'
$logDir = Join-Path $root 'local-models\logs'
$stdout = Join-Path $logDir 'bge-server.out.log'
$stderr = Join-Path $logDir 'bge-server.err.log'

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

Start-Process `
  -FilePath $python `
  -ArgumentList @("""$server""") `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdout `
  -RedirectStandardError $stderr

Write-Output "Started local BGE embedding server."
Write-Output "stdout: $stdout"
Write-Output "stderr: $stderr"
