.PHONY: all build frontend backend clean run help

BINARY_NAME := eledrive-app

all: build

help:
	@echo "EleDrive Build Commands:"
	@echo "  make build      - Build both frontend and backend"
	@echo "  make frontend   - Build only React/Vite frontend"
	@echo "  make backend    - Compile only Go backend"
	@echo "  make clean      - Remove build artifacts"
	@echo "  make run        - Build and run the server"

build: frontend backend

frontend:
	@echo "\033[1;34m[BUILD]\033[0m Building frontend..."
	cd frontend && npm install && npm run build

backend:
	@echo "\033[1;34m[BUILD]\033[0m Compiling backend..."
	go vet ./...
	go build -ldflags="-s -w" -o $(BINARY_NAME) .
	chmod +x $(BINARY_NAME)

clean:
	@echo "\033[1;33m[CLEAN]\033[0m Cleaning artifacts..."
	rm -rf frontend/dist $(BINARY_NAME) eledrive

run: build
	@echo "\033[1;32m[RUN]\033[0m Running $(BINARY_NAME)..."
	./$(BINARY_NAME)
