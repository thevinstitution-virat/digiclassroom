# Check sizes of virtual environment folders
$folders = @('.venv', '.venv.old', '.venv310', '.venv-py313-backup')

foreach ($folder in $folders) {
    if (Test-Path $folder) {
        Write-Host "Checking $folder..." -ForegroundColor Cyan
        $size = (Get-ChildItem $folder -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1GB
        Write-Host "  Size: $([math]::Round($size, 2)) GB" -ForegroundColor Green
        
        # Check for python.exe
        $pythonPath = Join-Path $folder "Scripts\python.exe"
        if (Test-Path $pythonPath) {
            try {
                $version = & $pythonPath --version 2>&1
                Write-Host "  Python: $version" -ForegroundColor Green
            } catch {
                Write-Host "  Python: Error - $($_.Exception.Message)" -ForegroundColor Red
            }
        } else {
            Write-Host "  Python: Not found or broken" -ForegroundColor Red
        }
        Write-Host ""
    } else {
        Write-Host "$folder does not exist" -ForegroundColor Yellow
    }
}

