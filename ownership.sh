#!/usr/bin/env bash
# ==============================================================================
# EleDrive - Workspace Ownership & Credential Manager
# Manages the 'owner' role and Owner credentials.
# Enforces the rule that exactly ONE account is Owner.
# Supports:
#   - Changing the Workspace Owner password directly via server CLI
#   - Transferring ownership to an existing account
#   - Creating a brand new Workspace Owner account
#   - Viewing current ownership and registered accounts
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

# Ensure eledrive-app binary is compiled
ensure_binary() {
    if [ ! -f "${ROOT_DIR}/eledrive-app" ]; then
        echo -e "${BLUE}[BUILD]${RESET} Compiling backend binary..."
        (cd "${ROOT_DIR}" && go build -ldflags="-s -w" -o eledrive-app .)
    fi
}

# Ensure database exists; if not, initialize it automatically
if [ ! -f "$DB_PATH" ]; then
    echo -e "${BLUE}[INFO]${RESET} Database file not found. Initializing database schema..."
    ensure_binary
    "${ROOT_DIR}/eledrive-app" --init-db >/dev/null 2>&1 || true
    if [ ! -f "$DB_PATH" ]; then
        echo -e "${RED}[ERROR]${RESET} Failed to initialize database at: ${DB_PATH}"
        exit 1
    fi
fi

print_header() {
    echo -e "${BOLD}${BLUE}======================================================${RESET}"
    echo -e "${BOLD}${CYAN}   EleDrive - Workspace Ownership & Credential CLI    ${RESET}"
    echo -e "${BOLD}${BLUE}======================================================${RESET}"
}

get_current_owner() {
    sqlite3 "$DB_PATH" "SELECT id, name, username, email, status FROM users WHERE role = 'owner' LIMIT 1;" 2>/dev/null || true
}

list_all_users() {
    local total
    total=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
    if [ "$total" -eq 0 ]; then
        echo -e "\n${YELLOW}[WARN] No registered user accounts found in database.${RESET}"
        return
    fi

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

change_owner_password() {
    local owner_data
    owner_data=$(get_current_owner)
    if [ -z "$owner_data" ]; then
        echo -e "${RED}[ERROR]${RESET} No workspace Owner currently exists in the database. Please assign or create an Owner first."
        return 1
    fi

    IFS="|" read -r oid oname ouser oemail ostatus <<< "$owner_data"
    echo -e "\n${BOLD}${CYAN}[ACTION] Change Workspace Owner Password${RESET}"
    echo -e "----------------------------------------------------------------------"
    echo -e "${GREEN}[OWNER]${RESET} Account: ${BOLD}${oname}${RESET} (${oemail}) [@${ouser}]"

    local new_pass="${1:-}"
    if [ -z "$new_pass" ]; then
        local pass1=""
        local pass2=""
        while true; do
            read -r -s -p "New Owner Password (min 6 chars): " pass1
            echo ""
            if [ ${#pass1} -lt 6 ]; then
                echo -e "${RED}[ERROR]${RESET} Password must be at least 6 characters."
                continue
            fi
            read -r -s -p "Confirm New Password: " pass2
            echo ""
            if [ "$pass1" != "$pass2" ]; then
                echo -e "${RED}[ERROR]${RESET} Passwords do not match. Try again."
                continue
            fi
            new_pass="$pass1"
            break
        done
    else
        if [ ${#new_pass} -lt 6 ]; then
            echo -e "${RED}[ERROR]${RESET} Password must be at least 6 characters."
            return 1
        fi
    fi

    ensure_binary
    echo -e "${BLUE}[INFO]${RESET} Generating secure bcrypt password hash..."
    local pass_hash
    pass_hash=$("${ROOT_DIR}/eledrive-app" --hash-password "$new_pass")

    sqlite3 "$DB_PATH" <<EOF
BEGIN TRANSACTION;

UPDATE users 
SET password_hash = '${pass_hash}', updated_at = CURRENT_TIMESTAMP 
WHERE id = '${oid}';

CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_email TEXT NOT NULL,
    user_username TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    reason TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    resolved_by TEXT
);

UPDATE password_resets
SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, resolved_by = 'ownership.sh'
WHERE user_id = '${oid}' AND status = 'pending';

INSERT INTO activity_logs (id, user_id, user_name, action, item_type, item_id, item_name, details, created_at)
VALUES (
    lower(hex(randomblob(16))),
    '${oid}',
    '${oname}',
    'owner_password_changed',
    'user',
    '${oid}',
    '${oname}',
    'Workspace Owner password updated securely via ownership.sh CLI',
    CURRENT_TIMESTAMP
);

COMMIT;
EOF

    echo -e "\n${BOLD}${GREEN}======================================================${RESET}"
    echo -e "${BOLD}${GREEN}[SUCCESS] Owner Password Updated Successfully!        ${RESET}"
    echo -e "${BOLD}${GREEN}======================================================${RESET}"
    echo -e "${GREEN}[OWNER]${RESET} Account:   ${BOLD}${oname}${RESET} (@${ouser})"
    echo -e "${GREEN}[OWNER]${RESET} Email:     ${oemail}"
    echo -e "${BLUE}[INFO]${RESET} You can now log in to the web console using the updated password."
    echo ""
}

create_new_owner() {
    local target_input="${1:-}"
    ensure_binary

    echo -e "\n${BOLD}${CYAN}[ACTION] Create New Workspace Owner Account${RESET}"
    echo -e "----------------------------------------------------------------------"

    local email=""
    local username=""
    local name=""

    if [[ "$target_input" == *"@"* ]]; then
        email="$target_input"
        local default_user
        default_user=$(echo "${target_input%%@*}" | tr '[:upper:]' '[:lower:]' | tr -cd '[:alnum:]_')
        read -r -p "Full Name: " name
        while [ -z "$name" ]; do
            echo -e "${RED}[ERROR]${RESET} Full Name cannot be empty."
            read -r -p "Full Name: " name
        done

        read -r -p "Username [${default_user}]: " input_user
        username="${input_user:-$default_user}"
    elif [ -n "$target_input" ]; then
        username=$(echo "$target_input" | tr '[:upper:]' '[:lower:]' | tr -cd '[:alnum:]_')
        read -r -p "Full Name: " name
        while [ -z "$name" ]; do
            echo -e "${RED}[ERROR]${RESET} Full Name cannot be empty."
            read -r -p "Full Name: " name
        done

        read -r -p "Email address: " email
        while [ -z "$email" ] || [[ "$email" != *"@"* ]]; do
            echo -e "${RED}[ERROR]${RESET} Please provide a valid email address."
            read -r -p "Email address: " email
        done
    else
        read -r -p "Full Name: " name
        while [ -z "$name" ]; do
            echo -e "${RED}[ERROR]${RESET} Full Name cannot be empty."
            read -r -p "Full Name: " name
        done

        read -r -p "Email address: " email
        while [ -z "$email" ] || [[ "$email" != *"@"* ]]; do
            echo -e "${RED}[ERROR]${RESET} Please provide a valid email address."
            read -r -p "Email address: " email
        done

        local auto_user
        auto_user=$(echo "${email%%@*}" | tr '[:upper:]' '[:lower:]' | tr -cd '[:alnum:]_')
        read -r -p "Username [${auto_user}]: " input_user
        username="${input_user:-$auto_user}"
    fi

    # Check if this email or username already exists
    local check_dup
    check_dup=$(sqlite3 "$DB_PATH" "SELECT username FROM users WHERE LOWER(email) = '$(echo "$email" | tr '[:upper:]' '[:lower:]')' OR LOWER(username) = '$(echo "$username" | tr '[:upper:]' '[:lower:]')' LIMIT 1;")
    if [ -n "$check_dup" ]; then
        echo -e "${RED}[ERROR]${RESET} An account with this email or username already exists."
        exit 1
    fi

    # Password prompt
    local pass1=""
    local pass2=""
    while true; do
        read -r -s -p "Password (min 6 chars): " pass1
        echo ""
        if [ ${#pass1} -lt 6 ]; then
            echo -e "${RED}[ERROR]${RESET} Password must be at least 6 characters."
            continue
        fi
        read -r -s -p "Confirm Password: " pass2
        echo ""
        if [ "$pass1" != "$pass2" ]; then
            echo -e "${RED}[ERROR]${RESET} Passwords do not match. Try again."
            continue
        fi
        break
    done

    echo -e "${BLUE}[INFO]${RESET} Generating secure password hash..."
    local pass_hash
    pass_hash=$("${ROOT_DIR}/eledrive-app" --hash-password "$pass1")

    local new_id
    new_id=$(sqlite3 "$DB_PATH" "SELECT lower(hex(randomblob(16)));")
    local avatar_color="#3b82f6"
    local quota=21474836480 # 20 GB

    # Atomic write
    sqlite3 "$DB_PATH" <<EOF
BEGIN TRANSACTION;

-- Step 1: Reassign any existing owner to admin
UPDATE users 
SET role = 'admin', updated_at = CURRENT_TIMESTAMP 
WHERE role = 'owner';

-- Step 2: Insert new user as owner and approved
INSERT INTO users (id, email, username, password_hash, name, avatar_color, role, status, storage_limit, created_at, updated_at)
VALUES ('${new_id}', '${email}', '${username}', '${pass_hash}', '${name}', '${avatar_color}', 'owner', 'approved', ${quota}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Step 3: Insert activity log
INSERT INTO activity_logs (id, user_id, user_name, action, item_type, item_id, item_name, details, created_at)
VALUES (
    lower(hex(randomblob(16))),
    '${new_id}',
    '${name}',
    'owner_created',
    'user',
    '${new_id}',
    '${name}',
    'Created as Workspace Owner via set-owner.sh',
    CURRENT_TIMESTAMP
);

COMMIT;
EOF

    echo -e "\n${BOLD}${GREEN}======================================================${RESET}"
    echo -e "${BOLD}${GREEN}[SUCCESS] Workspace Owner Account Created Successfully!${RESET}"
    echo -e "${BOLD}${GREEN}======================================================${RESET}"
    echo -e "${GREEN}[OWNER]${RESET} Full Name: ${BOLD}${name}${RESET}"
    echo -e "${GREEN}[OWNER]${RESET} Username:  @${username}"
    echo -e "${GREEN}[OWNER]${RESET} Email:     ${email}"
    echo -e "${GREEN}[OWNER]${RESET} Role:      owner [status: approved]"
    echo -e "${BLUE}[INFO]${RESET} You can now log into http://localhost:8080 using these credentials."
    echo ""
    exit 0
}

promote_existing_user() {
    local tid="$1"
    local tname="$2"
    local tuser="$3"
    local temail="$4"
    local trole="$5"

    if [ "$trole" = "owner" ]; then
        echo -e "\n${BLUE}[INFO]${RESET} ${BOLD}${tname}${RESET} (@${tuser}) is already the workspace Owner. No change needed."
        exit 0
    fi

    echo -e "\n${BOLD}${CYAN}[ACTION] Transferring workspace ownership:${RESET}"
    echo -e "  Target User:  ${BOLD}${tname}${RESET} (${temail}) [@${tuser}]"
    echo -e "  Current Role: ${trole}"

    sqlite3 "$DB_PATH" <<EOF
BEGIN TRANSACTION;

-- Step 1: Demote current owner to admin
UPDATE users 
SET role = 'admin', updated_at = CURRENT_TIMESTAMP 
WHERE role = 'owner';

-- Step 2: Promote target user to owner and approve account
UPDATE users 
SET role = 'owner', status = 'approved', updated_at = CURRENT_TIMESTAMP 
WHERE id = '${tid}';

-- Step 3: Insert activity log
INSERT INTO activity_logs (id, user_id, user_name, action, item_type, item_id, item_name, details, created_at)
VALUES (
    lower(hex(randomblob(16))),
    '${tid}',
    '${tname}',
    'ownership_transferred',
    'user',
    '${tid}',
    '${tname}',
    'Workspace ownership assigned via set-owner.sh',
    CURRENT_TIMESTAMP
);

COMMIT;
EOF

    # Verification
    local owner_count
    owner_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users WHERE role = 'owner';")
    if [ "$owner_count" -ne 1 ]; then
        echo -e "${RED}[ERROR]${RESET} Integrity check failed: Expected 1 owner, found ${owner_count}."
        exit 1
    fi

    echo -e "\n${BOLD}${GREEN}======================================================${RESET}"
    echo -e "${BOLD}${GREEN}[SUCCESS] Ownership Transfer Complete!               ${RESET}"
    echo -e "${BOLD}${GREEN}======================================================${RESET}"
    echo -e "${GREEN}[OWNER]${RESET} New Workspace Owner: ${BOLD}${tname}${RESET} (${temail}) [@${tuser}]"
    echo -e "${BLUE}[INFO]${RESET} Previous Owner was reassigned to Administrator."
    echo -e "${BLUE}[INFO]${RESET} Rule enforced: Exactly 1 Owner account is active."
    echo ""
}

# Main Script Entry Point
print_header
show_current_status

TOTAL_USERS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")

# If database has zero users, offer immediate owner creation
if [ "$TOTAL_USERS" -eq 0 ]; then
    TARGET="${1:-}"
    if [ -n "$TARGET" ]; then
        create_new_owner "$TARGET"
    else
        echo -e "\n${YELLOW}[WARN]${RESET} The database has no registered accounts."
        echo -e "${BOLD}Would you like to create the initial Workspace Owner account now? [Y/n]${RESET}"
        read -r -p "> " DO_CREATE
        DO_CREATE=${DO_CREATE:-Y}
        if [[ "$DO_CREATE" =~ ^[Yy]$ ]]; then
            create_new_owner ""
        else
            echo -e "${YELLOW}[INFO]${RESET} Operation cancelled."
            exit 0
        fi
    fi
    exit 0
fi

# Argument handling
FIRST_ARG="${1:-}"

# Check for password change flag
if [[ "$FIRST_ARG" == "--password" || "$FIRST_ARG" == "-p" || "$FIRST_ARG" == "password" || "$FIRST_ARG" == "passwd" || "$FIRST_ARG" == "--passwd" || "$FIRST_ARG" == "--reset-password" ]]; then
    change_owner_password "${2:-}"
    exit 0
fi

# Check for list flag
if [[ "$FIRST_ARG" == "--list" || "$FIRST_ARG" == "-l" || "$FIRST_ARG" == "list" ]]; then
    list_all_users
    exit 0
fi

# Check for create flag
if [[ "$FIRST_ARG" == "--create" || "$FIRST_ARG" == "-c" || "$FIRST_ARG" == "create" ]]; then
    create_new_owner "${2:-}"
    exit 0
fi

# If target user passed directly as argument: ./ownership.sh <user>
if [ -n "$FIRST_ARG" ]; then
    TARGET_CLEAN=$(echo "$FIRST_ARG" | tr '[:upper:]' '[:lower:]')
    TARGET_ROW=$(sqlite3 "$DB_PATH" "SELECT id, name, username, email, role, status FROM users WHERE LOWER(email) = '$TARGET_CLEAN' OR LOWER(username) = '$TARGET_CLEAN' LIMIT 1;")

    if [ -z "$TARGET_ROW" ]; then
        echo -e "\n${YELLOW}[INFO]${RESET} No registered user found matching: '${BOLD}${FIRST_ARG}${RESET}'"
        echo -e "${BOLD}Would you like to create this user as the new Workspace Owner? [Y/n]${RESET}"
        read -r -p "> " CONFIRM_CREATE
        CONFIRM_CREATE=${CONFIRM_CREATE:-Y}
        if [[ "$CONFIRM_CREATE" =~ ^[Yy]$ ]]; then
            create_new_owner "$FIRST_ARG"
        else
            echo -e "${RED}[ERROR]${RESET} User not found. Account creation cancelled."
            list_all_users
            exit 1
        fi
    fi

    IFS="|" read -r TID TNAME TUSER TEMAIL TROLE TSTATUS <<< "$TARGET_ROW"
    promote_existing_user "$TID" "$TNAME" "$TUSER" "$TEMAIL" "$TROLE"
    exit 0
fi

# Interactive Menu when run without arguments
echo ""
echo -e "${BOLD}Available Actions:${RESET}"
echo -e "  ${BOLD}1)${RESET} Change Workspace Owner Password"
echo -e "  ${BOLD}2)${RESET} Transfer Workspace Ownership to Existing Account"
echo -e "  ${BOLD}3)${RESET} Create New Workspace Owner Account"
echo -e "  ${BOLD}4)${RESET} List All Registered Accounts"
echo -e "  ${BOLD}5)${RESET} Exit"
echo ""
read -r -p "Select action [1-5]: " MENU_CHOICE

case "$MENU_CHOICE" in
    1)
        change_owner_password ""
        ;;
    2)
        list_all_users
        echo -e "\nEnter the email or username to promote to Workspace Owner:"
        read -r -p "Target user: " INPUT_TARGET
        TARGET=$(echo "$INPUT_TARGET" | xargs)
        if [ -z "$TARGET" ]; then
            echo -e "${YELLOW}[INFO]${RESET} Operation cancelled."
            exit 0
        fi
        TARGET_CLEAN=$(echo "$TARGET" | tr '[:upper:]' '[:lower:]')
        TARGET_ROW=$(sqlite3 "$DB_PATH" "SELECT id, name, username, email, role, status FROM users WHERE LOWER(email) = '$TARGET_CLEAN' OR LOWER(username) = '$TARGET_CLEAN' LIMIT 1;")
        if [ -z "$TARGET_ROW" ]; then
            echo -e "\n${YELLOW}[INFO]${RESET} No registered user found matching: '${BOLD}${TARGET}${RESET}'"
            echo -e "${BOLD}Would you like to create this user as the new Workspace Owner? [Y/n]${RESET}"
            read -r -p "> " CONFIRM_CREATE
            CONFIRM_CREATE=${CONFIRM_CREATE:-Y}
            if [[ "$CONFIRM_CREATE" =~ ^[Yy]$ ]]; then
                create_new_owner "$TARGET"
            else
                echo -e "${RED}[ERROR]${RESET} User not found. Operation cancelled."
                exit 1
            fi
        fi
        IFS="|" read -r TID TNAME TUSER TEMAIL TROLE TSTATUS <<< "$TARGET_ROW"
        promote_existing_user "$TID" "$TNAME" "$TUSER" "$TEMAIL" "$TROLE"
        ;;
    3)
        create_new_owner ""
        ;;
    4)
        list_all_users
        ;;
    5)
        echo -e "${BLUE}[INFO]${RESET} Exiting ownership manager."
        exit 0
        ;;
    *)
        echo -e "${RED}[ERROR]${RESET} Invalid option selected."
        exit 1
        ;;
esac
