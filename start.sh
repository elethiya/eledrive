#!/bin/bash
set -e

echo "=================================================="
echo "          EleDrive - Team Cloud Drive             "
echo "=================================================="

# Verify that the backend binary has been compiled
if [ ! -f "eledrive-app" ]; then
    echo -e "\033[1;31m[ERROR]\033[0m Backend binary 'eledrive-app' not found."
    echo -e "\033[1;33m[INFO]\033[0m Please compile the project first using: \033[1;36m./build.sh\033[0m"
    exit 1
fi

# Check if frontend distribution is present
if [ ! -f "frontend/dist/index.html" ]; then
    echo -e "\033[1;33m[WARN]\033[0m Frontend distribution 'frontend/dist/index.html' not found."
    echo -e "\033[1;33m[INFO]\033[0m Run \033[1;36m./build.sh -f\033[0m to compile frontend assets."
fi

# Load environment variables from .env or .evn if present
if [ -f ".env" ]; then
    set -a
    source .env
    set +a
elif [ -f ".evn" ]; then
    set -a
    source .evn
    set +a
fi

SERVER_PORT="${PORT:-8080}"
echo -e "\033[1;32m[START]\033[0m Starting EleDrive server on http://localhost:${SERVER_PORT} ..."
exec ./eledrive-app
