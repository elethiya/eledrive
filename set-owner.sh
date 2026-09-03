#!/usr/bin/env bash
# ==============================================================================
# EleDrive - Workspace Ownership Manager
# Manages the 'owner' role. Enforces the rule that exactly ONE account is Owner.
# ==============================================================================

set -euo pipefail

# Text styling
BOLD="\033[1m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
CYAN="\033[0;36m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
RESET="\033[0m"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_PATH="${ROOT_DIR}/database/account.db"

# Fallback to legacy path if database/account.db not yet generated
if [ ! -f "$DB_PATH" ] && [ -f "${ROOT_DIR}/data/eledrive.db" ]; then
    DB_PATH="${ROOT_DIR}/data/eledrive.db"
fi

# Check if sqlite3 is installed
if ! command -v sqlite3 &> /dev/null; then
    echo -e "${RED}[ERROR]${RESET} 'sqlite3' CLI tool is required to run this script."
    exit 1
fi

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}[ERROR]${RESET} Database file not found at: ${DB_PATH}"
    echo -e "${BLUE}[INFO]${RESET} Please start the server at least once to initialize the database."
    exit 1
fi

print_header() {
    echo -e "${BOLD}${BLUE}======================================================${RESET}"
    echo -e "${BOLD}${CYAN}       EleDrive - Workspace Ownership Manager         ${RESET}"
    echo -e "${BOLD}${BLUE}======================================================${RESET}"
}

get_current_owner() {
    sqlite3 "$DB_PATH" "SELECT id, name, username, email, status FROM users WHERE role = 'owner' LIMIT 1;" 2>/dev/null || true
}

list_all_users() {
    echo -e "\n${BOLD}${CYAN}[USERS] Registered Accounts:${RESET}"
    echo -e "----------------------------------------------------------------------"
    printf "%-18s %-20s %-22s %-8s %-8s\n" "USERNAME" "NAME" "EMAIL" "ROLE" "STATUS"
    echo -e "----------------------------------------------------------------------"
    sqlite3 -separator "|" "$DB_PATH" "SELECT username, name, email, role, status FROM users ORDER BY CASE role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END, username ASC;" | while IFS="|" read -r u n e r s; do
        role_color="$RESET"
        if [ "$r" = "owner" ]; then
            role_color="${YELLOW}${BOLD}"
        elif [ "$r" = "admin" ]; then
            role_color="${CYAN}"
        fi
        printf "%-18s %-20s %-22s ${role_color}%-8s${RESET} %-8s\n" "$u" "$n" "$e" "$r" "$s"
    done
    echo -e "----------------------------------------------------------------------"
}

show_current_status() {
    local owner_data
    owner_data=$(get_current_owner)
    if [ -n "$owner_data" ]; then
        IFS="|" read -r oid oname ouser oemail ostatus <<< "$owner_data"
        echo -e "${GREEN}[OWNER]${RESET} Current Workspace Owner: ${BOLD}${oname}${RESET} (${oemail}) [@${ouser}] [status: ${ostatus}]"
    else
        echo -e "${YELLOW}[WARN]${RESET} No workspace Owner currently assigned in the database."
    fi
}

print_header
show_current_status

# If no argument is passed, show list and interactive prompt
TARGET="${1:-}"
if [ -z "$TARGET" ]; then
    list_all_users
    echo -e "\n${BOLD}Usage:${RESET} ./set-owner.sh <email-or-username>"
    echo -e "\nEnter an email or username to promote to Owner (or press Ctrl+C to cancel):"
    read -r -p "Target user: " INPUT_TARGET
    TARGET=$(echo "$INPUT_TARGET" | xargs)
    if [ -z "$TARGET" ]; then
        echo -e "${YELLOW}[INFO]${RESET} Operation cancelled. No user specified."
        exit 0
    fi
fi

# Find target user in DB
TARGET_CLEAN=$(echo "$TARGET" | tr '[:upper:]' '[:lower:]')
TARGET_ROW=$(sqlite3 "$DB_PATH" "SELECT id, name, username, email, role, status FROM users WHERE LOWER(email) = '$TARGET_CLEAN' OR LOWER(username) = '$TARGET_CLEAN' LIMIT 1;")

if [ -z "$TARGET_ROW" ]; then
    echo -e "\n${RED}[ERROR]${RESET} No user found matching: '${TARGET}'"
    list_all_users
    exit 1
fi

IFS="|" read -r TID TNAME TUSER TEMAIL TROLE TSTATUS <<< "$TARGET_ROW"

# Check if already owner
if [ "$TROLE" = "owner" ]; then
    echo -e "\n${BLUE}[INFO]${RESET} ${BOLD}${TNAME}${RESET} (@${TUSER}) is already the workspace Owner. No change needed."
    exit 0
fi

echo -e "\n${BOLD}${CYAN}[ACTION] Transferring workspace ownership:${RESET}"
echo -e "  Target User: ${BOLD}${TNAME}${RESET} (${TEMAIL}) [@${TUSER}]"
echo -e "  Current Role: ${TROLE}"

# Atomic transfer:
# 1. Demote any current owner to admin
# 2. Promote target user to owner and ensure status is approved
# 3. Verify exactly 1 owner exists
sqlite3 "$DB_PATH" <<EOF
BEGIN TRANSACTION;

-- Step 1: Demote current owner to admin
UPDATE users 
SET role = 'admin', updated_at = CURRENT_TIMESTAMP 
WHERE role = 'owner';

-- Step 2: Promote target user to owner and approve account
UPDATE users 
SET role = 'owner', status = 'approved', updated_at = CURRENT_TIMESTAMP 
WHERE id = '${TID}';

-- Step 3: Insert activity log
INSERT INTO activity_logs (id, user_id, user_name, action, item_type, item_id, item_name, details, created_at)
VALUES (
    lower(hex(randomblob(16))),
    '${TID}',
    '${TNAME}',
    'ownership_transferred',
    'user',
    '${TID}',
    '${TNAME}',
    'Workspace ownership assigned via set-owner.sh',
    CURRENT_TIMESTAMP
);

COMMIT;
EOF

# Verification
OWNER_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users WHERE role = 'owner';")
if [ "$OWNER_COUNT" -ne 1 ]; then
    echo -e "${RED}[ERROR]${RESET} Integrity check failed: Expected 1 owner, found ${OWNER_COUNT}."
    exit 1
fi

NEW_OWNER=$(sqlite3 "$DB_PATH" "SELECT name, username, email FROM users WHERE role = 'owner' LIMIT 1;")
IFS="|" read -r NONAME NOUSER NOEMAIL <<< "$NEW_OWNER"

echo -e "\n${BOLD}${GREEN}======================================================${RESET}"
echo -e "${BOLD}${GREEN}[SUCCESS] Ownership Transfer Complete!               ${RESET}"
echo -e "${BOLD}${GREEN}======================================================${RESET}"
echo -e "${GREEN}[OWNER]${RESET} New Workspace Owner: ${BOLD}${NONAME}${RESET} (${NOEMAIL}) [@${NOUSER}]"
echo -e "${BLUE}[INFO]${RESET} Previous Owner was reassigned to Administrator."
echo -e "${BLUE}[INFO]${RESET} Rule enforced: Exactly 1 Owner account is active."
echo ""
