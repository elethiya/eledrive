#!/bin/bash
set -e

echo "=================================================="
echo "          EleDrive - Team Cloud Drive             "
echo "=================================================="

# Check if frontend/dist exists, if not build it
if [ ! -d "frontend/dist" ]; then
    echo "📦 Building React frontend..."
    (cd frontend && npm install && npm run build)
fi

# Build Go application if binary doesn't exist or main.go is newer
if [ ! -f "eledrive-app" ] || [ "main.go" -nt "eledrive-app" ]; then
    echo "🔨 Compiling Golang backend..."
    go build -o eledrive-app .
fi

echo "🚀 Starting EleDrive server on http://localhost:8080 ..."
./eledrive-app
