# Remove Python 3.13 from PATH and set Python 3.11.9 as default
# This script needs to be run with Administrator privileges

Write-Host "Setting Python 3.11.9 as default..." -ForegroundColor Green

# Get current Machine PATH
$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")

# Remove Python313 entries
$newMachinePath = ($machinePath -split ';' | Where-Object { $_ -notlike '*Python313*' }) -join ';'

# Set the new Machine PATH (requires admin rights)
try {
    [Environment]::SetEnvironmentVariable("Path", $newMachinePath, "Machine")
    Write-Host "✓ Successfully removed Python 3.13 from system PATH" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to update system PATH. Please run this script as Administrator." -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

# Get current User PATH
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")

# Ensure Python 3.11 paths are in User PATH
$python311Path = "C:\Users\thevi\AppData\Local\Programs\Python\Python311"
$python311Scripts = "C:\Users\thevi\AppData\Local\Programs\Python\Python311\Scripts"

$pathsToAdd = @($python311Path, $python311Scripts)
$userPathArray = $userPath -split ';'

foreach ($pathToAdd in $pathsToAdd) {
    if ($userPathArray -notcontains $pathToAdd) {
        $userPath = "$pathToAdd;$userPath"
    }
}

try {
    [Environment]::SetEnvironmentVariable("Path", $userPath, "User")
    Write-Host "✓ Updated user PATH with Python 3.11.9" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to update user PATH" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host "`nPath configuration complete. Please restart your terminal for changes to take effect." -ForegroundColor Yellow
Write-Host "`nTo verify, open a new terminal and run: python --version" -ForegroundColor Cyan
