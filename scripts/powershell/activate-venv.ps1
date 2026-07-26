# Activate the correct Python virtual environment for DigiClassroom Pro
# This script activates .venv which contains Python 3.12.8 with all required packages

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DigiClassroom Pro - Virtual Environment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Activating Python 3.12.8 virtual environment..." -ForegroundColor Yellow
Write-Host ""

& .\.venv\Scripts\Activate.ps1

Write-Host ""
Write-Host "✓ Virtual environment activated!" -ForegroundColor Green
Write-Host ""
Write-Host "Python version:" -ForegroundColor Cyan
python --version
Write-Host ""
Write-Host "To deactivate, type: deactivate" -ForegroundColor Gray
Write-Host ""

