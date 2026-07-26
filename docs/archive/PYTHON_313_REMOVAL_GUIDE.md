# Python 3.13 Manual Removal Guide

## Quick Steps (Run as Administrator)

### Step 1: Open PowerShell as Administrator
Right-click PowerShell → "Run as Administrator"

### Step 2: Remove from System PATH
```powershell
$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$newPath = ($machinePath -split ';' | Where-Object { $_ -notlike '*Python313*' }) -join ';'
[Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
Write-Output "✓ Python 3.13 removed from system PATH"
```

### Step 3: Uninstall via Windows Settings
1. Press `Win + I` to open Settings
2. Go to **Apps** → **Installed Apps**
3. Search for "Python 3.13"
4. Click the three dots (⋮) → **Uninstall** for each:
   - Python 3.13.5 Add to Path (64-bit)
   - Python 3.13.5 Development Libraries (64-bit)
   - Python 3.13.5 Core Interpreter (64-bit)
   - Python 3.13.5 Documentation (64-bit)
   - Python 3.13.5 Tcl/Tk Support (64-bit)

### Step 4: Delete Directory (if it remains)
```powershell
Remove-Item -Path "C:\Python313" -Recurse -Force -ErrorAction SilentlyContinue
Write-Output "✓ Python 3.13 directory removed"
```

### Step 5: Verify Cleanup
Open a **NEW** PowerShell window and run:
```powershell
python --version
# Expected output: Python 3.11.9
```

---

## Quick Command (All-in-One)
Run PowerShell **as Administrator**, then paste:
```powershell
# Remove from PATH
$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$newPath = ($machinePath -split ';' | Where-Object { $_ -notlike '*Python313*' }) -join ';'
[Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")

# Delete directory
Remove-Item -Path "C:\Python313" -Recurse -Force -ErrorAction SilentlyContinue

Write-Output "`n✓ Python 3.13 PATH removed"
Write-Output "✓ Python 3.13 directory deleted"
Write-Output "`n⚠️  Still need to uninstall via Windows Settings (Apps → Installed Apps)"
Write-Output "`n✓ After uninstall, restart terminal and run: python --version"
```

---

## Why Manual Steps Are Needed

**Administrator Privileges Required** for:
- Modifying System PATH (Machine-level environment variables)
- Uninstalling system-wide applications
- Deleting protected system directories

**Current Limitations**:
- PowerShell commands run without admin rights
- Automated uninstall requires elevated privileges
