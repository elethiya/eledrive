#!/usr/bin/env bash
# ==============================================================================
# EleDrive - Full Build & Compile Script
# Builds both the React 19 / Vite frontend and the Golang backend binary
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
FRONTEND_DIR="${ROOT_DIR}/frontend"
BINARY_NAME="eledrive-app"

BUILD_FRONTEND=true
BUILD_BACKEND=true
CLEAN=false
INIT_DB=false
SKIP_VET=false

# ------------------------------------------------------------------------------
# Usage / Help
# ------------------------------------------------------------------------------
show_help() {
    cat << EOF
${BOLD}Usage:${RESET} ./build.sh [OPTIONS]

${BOLD}Options:${RESET}
  -f, --frontend-only    Build only the React / Vite frontend
  -b, --backend-only     Compile only the Golang backend binary
  -c, --clean            Clean previous build artifacts before compiling
  -i, --init-db          Initialize / migrate database schema after compilation
      --skip-vet         Skip 'go vet' source code verification
  -h, --help             Show this help message

${BOLD}Examples:${RESET}
  ./build.sh             # Full build (frontend + backend)
  ./build.sh --clean     # Clean previous builds and recompile everything
  ./build.sh -f          # Build only frontend
  ./build.sh -b          # Build only backend
  ./build.sh -b -i       # Build backend and initialize database
EOF
}

# Parse CLI arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        -f|--frontend-only)
            BUILD_FRONTEND=true
            BUILD_BACKEND=false
            shift
            ;;
        -b|--backend-only)
            BUILD_FRONTEND=false
            BUILD_BACKEND=true
            shift
            ;;
        -c|--clean)
            CLEAN=true
            shift
            ;;
        -i|--init-db)
            INIT_DB=true
            shift
            ;;
        --skip-vet)
            SKIP_VET=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Error:${RESET} Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

echo -e "${BOLD}${BLUE}======================================================${RESET}"
echo -e "${BOLD}${CYAN}          EleDrive - Build & Compile System           ${RESET}"
echo -e "${BOLD}${BLUE}======================================================${RESET}"

# ------------------------------------------------------------------------------
# Check Tooling
# ------------------------------------------------------------------------------
check_tool() {
    local cmd="$1"
    local name="$2"
    if ! command -v "$cmd" &> /dev/null; then
        echo -e "${RED}[ERROR]${RESET} $name ('$cmd') is required but not installed or not in PATH."
        exit 1
    fi
}

if [ "$BUILD_FRONTEND" = true ]; then
    check_tool "node" "Node.js"
    check_tool "npm" "npm"
fi

if [ "$BUILD_BACKEND" = true ]; then
    check_tool "go" "Go compiler"
fi

# ------------------------------------------------------------------------------
# Clean step (if requested)
# ------------------------------------------------------------------------------
if [ "$CLEAN" = true ]; then
    echo -e "\n${YELLOW}[CLEAN]${RESET} Removing previous build artifacts..."
    if [ -d "${FRONTEND_DIR}/dist" ]; then
        rm -rf "${FRONTEND_DIR}/dist"
        echo -e "  ${YELLOW}[CLEAN]${RESET} Removed ${FRONTEND_DIR}/dist"
    fi
    if [ -f "${ROOT_DIR}/${BINARY_NAME}" ]; then
        rm -f "${ROOT_DIR}/${BINARY_NAME}"
        echo -e "  ${YELLOW}[CLEAN]${RESET} Removed ${ROOT_DIR}/${BINARY_NAME}"
    fi
    if [ -f "${ROOT_DIR}/eledrive" ]; then
        rm -f "${ROOT_DIR}/eledrive"
        echo -e "  ${YELLOW}[CLEAN]${RESET} Removed ${ROOT_DIR}/eledrive"
    fi
fi

START_TIME=$(date +%s)

# ------------------------------------------------------------------------------
# Step 1: Build Frontend
# ------------------------------------------------------------------------------
if [ "$BUILD_FRONTEND" = true ]; then
    echo -e "\n${BOLD}${CYAN}[BUILD][1/2]${RESET} Compiling React Frontend (Vite)..."
    cd "${FRONTEND_DIR}"

    # Install dependencies if node_modules does not exist
    if [ ! -d "node_modules" ]; then
        echo -e "  ${BLUE}[INFO]${RESET} node_modules not found. Installing npm dependencies..."
        npm install
    fi

    echo -e "  ${BLUE}[VITE]${RESET} Bundling assets..."
    npm run build

    if [ ! -f "dist/index.html" ]; then
        echo -e "${RED}[ERROR]${RESET} Frontend build failed! (dist/index.html was not generated)"
        exit 1
    fi

    DIST_SIZE=$(du -sh dist | awk '{print $1}')
    echo -e "  ${GREEN}[SUCCESS]${RESET} Frontend successfully built: ${FRONTEND_DIR}/dist (${DIST_SIZE})"
    cd "${ROOT_DIR}"
fi

# ------------------------------------------------------------------------------
# Step 2: Build Backend
# ------------------------------------------------------------------------------
if [ "$BUILD_BACKEND" = true ]; then
    STEP_NUM="2/2"
    if [ "$BUILD_FRONTEND" = false ]; then STEP_NUM="1/1"; fi
    echo -e "\n${BOLD}${CYAN}[BUILD][${STEP_NUM}]${RESET} Compiling Golang Backend (${BINARY_NAME})..."
    cd "${ROOT_DIR}"

    # Ensure required data directories exist
    mkdir -p "${ROOT_DIR}/database/uploads" "${ROOT_DIR}/database/logs"

    # Ensure environment file exists
    if [ ! -f "${ROOT_DIR}/.env" ] && [ ! -f "${ROOT_DIR}/.evn" ] && [ -f "${ROOT_DIR}/.env.example" ]; then
        echo -e "  ${YELLOW}[ENV]${RESET} Creating .env from .env.example..."
        cp "${ROOT_DIR}/.env.example" "${ROOT_DIR}/.env"
    fi

    # Check formatting / vet unless skipped
    if [ "$SKIP_VET" = false ]; then
        echo -e "  ${BLUE}[VET]${RESET} Verifying Go source code..."
        go vet ./...
    fi

    # Compile optimized binary (-s -w strips debug symbols for a leaner binary)
    echo -e "  ${BLUE}[GO]${RESET} Compiling binary: ${BINARY_NAME}..."
    go build -ldflags="-s -w" -o "${BINARY_NAME}" .
    chmod +x "${BINARY_NAME}"

    BIN_SIZE=$(du -sh "${BINARY_NAME}" | awk '{print $1}')
    echo -e "  ${GREEN}[SUCCESS]${RESET} Backend binary compiled: ${BINARY_NAME} (${BIN_SIZE})"

    # Initialize database if requested or if database doesn't exist yet
    if [ "$INIT_DB" = true ] || [ ! -f "${ROOT_DIR}/database/account.db" ]; then
        echo -e "  ${BLUE}[DB]${RESET} Initializing / migrating SQLite database schema..."
        "./${BINARY_NAME}" --init-db
    fi
fi

END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))

# ------------------------------------------------------------------------------
# Completion Summary
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${GREEN}======================================================${RESET}"
echo -e "${BOLD}${GREEN}        [SUCCESS] Build completed in ${TOTAL_TIME} seconds!     ${RESET}"
echo -e "${BOLD}${GREEN}======================================================${RESET}"

if [ "$BUILD_BACKEND" = true ]; then
    echo -e "\n${BOLD}Next steps:${RESET}"
    echo -e "  1. Start server:           ${BOLD}${CYAN}./start.sh${RESET}  (or ./${BINARY_NAME})"
    echo -e "  2. Manage Workspace Owner: ${BOLD}${CYAN}./ownership.sh${RESET}"
fi
echo ""
