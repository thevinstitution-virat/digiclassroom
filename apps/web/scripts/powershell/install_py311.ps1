$pythonVersion = "3.11.9"
$pythonInstaller = "python-$pythonVersion-amd64.exe"
$downloadUrl = "https://www.python.org/ftp/python/$pythonVersion/$pythonInstaller"
$installerPath = Join-Path $env:TEMP $pythonInstaller

Write-Host "Downloading Python $pythonVersion..."
Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath -UseBasicParsing

Write-Host "Installing Python $pythonVersion..."
$installArgs = @(
    "/quiet",
    "InstallAllUsers=1",
    "PrependPath=1",
    "Include_pip=1",
    "Include_launcher=1"
)

Start-Process -FilePath $installerPath -ArgumentList $installArgs -Wait -NoNewWindow

Write-Host "Installation complete!"
Write-Host "Verifying..."

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$pythonExe = "C:\Program Files\Python311\python.exe"
if (Test-Path $pythonExe) {
    & $pythonExe --version
} else {
    py -3.11 --version
}

Remove-Item $installerPath -Force -ErrorAction SilentlyContinue

