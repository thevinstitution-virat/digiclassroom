# DigiClassroom Pro - Development Environment Startup Script
# This script starts all required Docker services and verifies connections

Write-Host "🚀 DigiClassroom Pro - Development Environment Setup" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "📦 Checking Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version
    Write-Host "✅ Docker is installed: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not installed or not running!" -ForegroundColor Red
    Write-Host "Please install Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

# Check if Docker daemon is running
try {
    docker ps | Out-Null
    Write-Host "✅ Docker daemon is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker daemon is not running!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

Write-Host ""

# Check if Node.js is installed
Write-Host "📦 Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    $npmVersion = npm --version
    Write-Host "✅ Node.js is installed: $nodeVersion" -ForegroundColor Green
    Write-Host "✅ npm is installed: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js/npm is not installed!" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/ and try again." -ForegroundColor Red
    Write-Host "After installation, restart your terminal and run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Check if containers are already running
Write-Host "🔍 Checking existing containers..." -ForegroundColor Yellow
$existingContainers = docker ps -a --filter "name=digiclassroom" --format "{{.Names}}"

if ($existingContainers) {
    Write-Host "Found existing containers:" -ForegroundColor Yellow
    $existingContainers | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }
    
    $response = Read-Host "Do you want to remove and recreate them? (y/N)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        Write-Host "🗑️  Stopping and removing existing containers..." -ForegroundColor Yellow
        docker-compose -f docker-compose.dev.yml down -v
        Write-Host "✅ Containers removed" -ForegroundColor Green
    }
}

Write-Host ""

# Start Docker services
Write-Host "🐳 Starting Docker services..." -ForegroundColor Yellow
Write-Host "This may take a few minutes on first run..." -ForegroundColor Gray
Write-Host ""

docker-compose -f docker-compose.dev.yml up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start Docker services!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Docker services started!" -ForegroundColor Green
Write-Host ""

# Wait for services to be healthy
Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check MySQL
Write-Host "🔍 Checking MySQL..." -ForegroundColor Yellow
$mysqlHealthy = $false
for ($i = 1; $i -le 30; $i++) {
    try {
        $result = docker exec digiclassroom-mysql-dev mysqladmin ping -h localhost -u root -prootpassword123 2>&1
        if ($result -match "mysqld is alive") {
            $mysqlHealthy = $true
            break
        }
    } catch {
        # Continue waiting
    }
    Write-Host "  Waiting for MySQL... ($i/30)" -ForegroundColor Gray
    Start-Sleep -Seconds 2
}

if ($mysqlHealthy) {
    Write-Host "✅ MySQL is ready (port 3307)" -ForegroundColor Green
} else {
    Write-Host "⚠️  MySQL may not be fully ready yet" -ForegroundColor Yellow
}

# Check Qdrant
Write-Host "🔍 Checking Qdrant..." -ForegroundColor Yellow
try {
    $qdrantHealth = Invoke-WebRequest -Uri "http://localhost:6333/health" -UseBasicParsing -TimeoutSec 5
    if ($qdrantHealth.StatusCode -eq 200) {
        Write-Host "✅ Qdrant is ready (port 6333)" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Qdrant may not be fully ready yet" -ForegroundColor Yellow
}

# Check Redis
Write-Host "🔍 Checking Redis..." -ForegroundColor Yellow
try {
    $redisTest = docker exec digiclassroom-redis-dev redis-cli -a redis123 PING 2>&1
    if ($redisTest -match "PONG") {
        Write-Host "✅ Redis is ready (port 6379)" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Redis may not be fully ready yet" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "🎉 Development Environment is Ready!" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Display service information
Write-Host "📊 Service Information:" -ForegroundColor Cyan
Write-Host ""
Write-Host "MySQL Database:" -ForegroundColor Yellow
Write-Host "  Host: localhost" -ForegroundColor Gray
Write-Host "  Port: 3307" -ForegroundColor Gray
Write-Host "  Database: virat_gyankosh" -ForegroundColor Gray
Write-Host "  User: digiclassroom_user" -ForegroundColor Gray
Write-Host "  Password: digiclassroom123" -ForegroundColor Gray
Write-Host ""

Write-Host "Qdrant Vector Database:" -ForegroundColor Yellow
Write-Host "  URL: http://localhost:6333" -ForegroundColor Gray
Write-Host "  Dashboard: http://localhost:6333/dashboard" -ForegroundColor Gray
Write-Host ""

Write-Host "Redis Cache:" -ForegroundColor Yellow
Write-Host "  Host: localhost" -ForegroundColor Gray
Write-Host "  Port: 6379" -ForegroundColor Gray
Write-Host "  Password: redis123" -ForegroundColor Gray
Write-Host ""

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "🚀 Next Steps:" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Install dependencies (if needed):" -ForegroundColor Yellow
Write-Host "   npm install" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Start the development server:" -ForegroundColor Yellow
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Open your browser:" -ForegroundColor Yellow
Write-Host "   http://localhost:3000" -ForegroundColor Gray
Write-Host ""

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "📝 Useful Commands:" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "View logs:" -ForegroundColor Yellow
Write-Host "  docker-compose -f docker-compose.dev.yml logs -f" -ForegroundColor Gray
Write-Host ""
Write-Host "Stop services:" -ForegroundColor Yellow
Write-Host "  docker-compose -f docker-compose.dev.yml down" -ForegroundColor Gray
Write-Host ""
Write-Host "Restart services:" -ForegroundColor Yellow
Write-Host "  docker-compose -f docker-compose.dev.yml restart" -ForegroundColor Gray
Write-Host ""
Write-Host "Check container status:" -ForegroundColor Yellow
Write-Host "  docker ps" -ForegroundColor Gray
Write-Host ""

# Ask if user wants to start the dev server
Write-Host "=================================================" -ForegroundColor Cyan
$startDev = Read-Host "Do you want to start the development server now? (y/N)"

if ($startDev -eq 'y' -or $startDev -eq 'Y') {
    Write-Host ""
    Write-Host "🚀 Starting development server..." -ForegroundColor Green
    Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
    Write-Host ""
    npm run dev
} else {
    Write-Host ""
    Write-Host "✅ Setup complete! Run 'npm run dev' when you're ready." -ForegroundColor Green
    Write-Host ""
}

