# Install Python 3.11.9 for DigiClassroom Pro
# This script downloads and installs Python 3.11.9 with the tested configuration

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Python 3.11.9 Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$pythonVersion = "3.11.9"
$pythonInstaller = "python-$pythonVersion-amd64.exe"
$downloadUrl = "https://www.python.org/ftp/python/$pythonVersion/$pythonInstaller"
$installerPath = Join-Path $env:TEMP $pythonInstaller

Write-Host "Downloading Python $pythonVersion..." -ForegroundColor Yellow
Write-Host "URL: $downloadUrl" -ForegroundColor Gray
Write-Host ""

try {
    # Download Python installer
    Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath -UseBasicParsing
    Write-Host "✓ Download complete" -ForegroundColor Green
    Write-Host ""
    
    # Install Python
    Write-Host "Installing Python $pythonVersion..." -ForegroundColor Yellow
    Write-Host "Installation options:" -ForegroundColor Gray
    Write-Host "  - Install for all users" -ForegroundColor Gray
    Write-Host "  - Add to PATH" -ForegroundColor Gray
    Write-Host "  - Include pip, tcl/tk, documentation" -ForegroundColor Gray
    Write-Host ""
    
    $installArgs = @(
        "/quiet",
        "InstallAllUsers=1",
        "PrependPath=1",
        "Include_test=0",
        "Include_pip=1",
        "Include_tcltk=1",
        "Include_doc=1",
        "Include_launcher=1",
        "InstallLauncherAllUsers=1"
    )
    
    Start-Process -FilePath $installerPath -ArgumentList $installArgs -Wait -NoNewWindow
    
    Write-Host ""
    Write-Host "✓ Python $pythonVersion installed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Verifying installation..." -ForegroundColor Yellow
    
    # Refresh environment variables
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    
    # Verify installation
    $pythonExe = "C:\Program Files\Python311\python.exe"
    if (Test-Path $pythonExe) {
        $version = & $pythonExe --version
        Write-Host "✓ Python installed at: $pythonExe" -ForegroundColor Green
        Write-Host "✓ Version: $version" -ForegroundColor Green
    } else {
        Write-Host "⚠ Python executable not found at expected location" -ForegroundColor Yellow
        Write-Host "  Trying py launcher..." -ForegroundColor Gray
        $version = py -3.11 --version
        Write-Host "✓ Version: $version" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Installation Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Close and reopen your terminal" -ForegroundColor Gray
    Write-Host "  2. Run: py -3.11 --version" -ForegroundColor Gray
    Write-Host "  3. Create virtual environment: py -3.11 -m venv .venv-py311" -ForegroundColor Gray
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "Installation failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Manual installation:" -ForegroundColor Yellow
    Write-Host "  1. Download from: https://www.python.org/downloads/release/python-3119/" -ForegroundColor Gray
    Write-Host "  2. Run installer and select Add Python to PATH" -ForegroundColor Gray
    Write-Host "  3. Verify with: py -3.11 version" -ForegroundColor Gray
    Write-Host ""
    exit 1
} finally {
    # Clean up installer
    if (Test-Path $installerPath) {
        Remove-Item $installerPath -Force
    }
}

