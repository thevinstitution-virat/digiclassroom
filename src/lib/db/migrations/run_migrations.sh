#!/bin/bash

# ============================================================================
# SANCHIKA (संचिका) DATABASE MIGRATION RUNNER
# ============================================================================
# Purpose: Automated script to run all Sanchika database migrations
# Usage: ./run_migrations.sh [options]
# 
# Options:
#   --all          Run all migrations (required + optional)
#   --required     Run only required migrations (default)
#   --container    Specify MySQL container name (default: mysql_container)
#   --user         Specify MySQL user (default: root)
#   --database     Specify database name (default: virat_gyankosh)
#   --help         Show this help message
#
# Examples:
#   ./run_migrations.sh --required
#   ./run_migrations.sh --all --container my_mysql
#   ./run_migrations.sh --all --user admin --database my_db
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
CONTAINER_NAME="mysql_container"
MYSQL_USER="root"
DATABASE_NAME="virat_gyankosh"
RUN_MODE="required"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --all)
      RUN_MODE="all"
      shift
      ;;
    --required)
      RUN_MODE="required"
      shift
      ;;
    --container)
      CONTAINER_NAME="$2"
      shift 2
      ;;
    --user)
      MYSQL_USER="$2"
      shift 2
      ;;
    --database)
      DATABASE_NAME="$2"
      shift 2
      ;;
    --help)
      head -n 20 "$0" | tail -n 18
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Print header
echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}  SANCHIKA (संचिका) DATABASE MIGRATION RUNNER${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo -e "  Container: ${GREEN}$CONTAINER_NAME${NC}"
echo -e "  User:      ${GREEN}$MYSQL_USER${NC}"
echo -e "  Database:  ${GREEN}$DATABASE_NAME${NC}"
echo -e "  Mode:      ${GREEN}$RUN_MODE${NC}"
echo ""

# Check if Docker is running
if ! docker ps &> /dev/null; then
  echo -e "${RED}❌ Error: Docker is not running or you don't have permission to access it${NC}"
  exit 1
fi

# Check if MySQL container exists and is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo -e "${RED}❌ Error: MySQL container '${CONTAINER_NAME}' is not running${NC}"
  echo -e "${YELLOW}Available containers:${NC}"
  docker ps --format "  - {{.Names}}"
  exit 1
fi

echo -e "${GREEN}✅ Docker and MySQL container are running${NC}"
echo ""

# Function to run a migration
run_migration() {
  local file=$1
  local description=$2
  local required=$3
  
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}Running: ${NC}$description"
  echo -e "${YELLOW}File:    ${NC}$file"
  
  if [ "$required" = "true" ]; then
    echo -e "${YELLOW}Status:  ${NC}${RED}REQUIRED${NC}"
  else
    echo -e "${YELLOW}Status:  ${NC}${GREEN}OPTIONAL${NC}"
  fi
  
  echo ""
  
  if [ ! -f "$file" ]; then
    echo -e "${RED}❌ Error: Migration file not found: $file${NC}"
    return 1
  fi
  
  # Run the migration
  if docker exec -i "$CONTAINER_NAME" mysql -u"$MYSQL_USER" -p "$DATABASE_NAME" < "$file" 2>&1 | grep -v "Enter password:"; then
    echo -e "${GREEN}✅ Migration completed successfully!${NC}"
    echo ""
    return 0
  else
    echo -e "${RED}❌ Migration failed!${NC}"
    echo ""
    return 1
  fi
}

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Required migrations
REQUIRED_MIGRATIONS=(
  "$SCRIPT_DIR/create_user_notes_table.sql|Main notes table (REQUIRED)|true"
)

# Optional migrations
OPTIONAL_MIGRATIONS=(
  "$SCRIPT_DIR/create_note_folders_table.sql|Folder organization system|false"
  "$SCRIPT_DIR/create_note_activity_log_table.sql|Activity log and audit trail|false"
  "$SCRIPT_DIR/create_note_shares_table.sql|Note sharing functionality|false"
  "$SCRIPT_DIR/create_note_templates_table.sql|Reusable note templates|false"
)

# Run required migrations
echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}  REQUIRED MIGRATIONS${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

for migration in "${REQUIRED_MIGRATIONS[@]}"; do
  IFS='|' read -r file description required <<< "$migration"
  run_migration "$file" "$description" "$required" || exit 1
done

# Run optional migrations if --all flag is set
if [ "$RUN_MODE" = "all" ]; then
  echo -e "${BLUE}============================================================================${NC}"
  echo -e "${BLUE}  OPTIONAL MIGRATIONS${NC}"
  echo -e "${BLUE}============================================================================${NC}"
  echo ""
  
  for migration in "${OPTIONAL_MIGRATIONS[@]}"; do
    IFS='|' read -r file description required <<< "$migration"
    run_migration "$file" "$description" "$required" || echo -e "${YELLOW}⚠️  Optional migration failed, continuing...${NC}"
  done
fi

# Final summary
echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}  MIGRATION SUMMARY${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# Verify tables were created
echo -e "${YELLOW}Verifying tables...${NC}"
echo ""

TABLES=$(docker exec "$CONTAINER_NAME" mysql -u"$MYSQL_USER" -p"$DATABASE_NAME" -e "SHOW TABLES LIKE 'user_notes';" 2>/dev/null | grep -v "Tables_in" || true)

if [ -n "$TABLES" ]; then
  echo -e "${GREEN}✅ user_notes table exists${NC}"
else
  echo -e "${RED}❌ user_notes table not found${NC}"
  exit 1
fi

if [ "$RUN_MODE" = "all" ]; then
  echo -e "${YELLOW}Checking optional tables...${NC}"
  
  for table in "note_folders" "note_activity_log" "note_shares" "note_templates"; do
    TABLE_EXISTS=$(docker exec "$CONTAINER_NAME" mysql -u"$MYSQL_USER" -p"$DATABASE_NAME" -e "SHOW TABLES LIKE '$table';" 2>/dev/null | grep -v "Tables_in" || true)
    if [ -n "$TABLE_EXISTS" ]; then
      echo -e "${GREEN}✅ $table table exists${NC}"
    else
      echo -e "${YELLOW}⚠️  $table table not found (optional)${NC}"
    fi
  done
fi

echo ""
echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}  🎉 MIGRATION COMPLETED SUCCESSFULLY!${NC}"
echo -e "${GREEN}============================================================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Restart your Next.js development server"
echo -e "  2. Navigate to AI Tutor and create a test note"
echo -e "  3. Check 'Sanchika - Notes' from the sidebar"
echo ""
echo -e "${BLUE}Happy note-taking! 📚${NC}"
echo ""

