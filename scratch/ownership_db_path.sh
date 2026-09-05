# Extract from ownership.sh

if [ -n "${DATABASE_DIR:-}" ]; then
    if [ -z "${ACCOUNT_DB_PATH:-}" ]; then
        DB_PATH="${DATABASE_DIR}/account.db"
    else
        DB_PATH="$ACCOUNT_DB_PATH"
    fi
else
    DB_PATH="${ACCOUNT_DB_PATH:-${ROOT_DIR}/database/account.db}"
fi
