.PHONY: help db-up db-down db-migrate server client build clean

help:
	@echo "Paper Platform - Commands:"
	@echo "  make db-up       Start PostgreSQL 16 container via OrbStack/Docker"
	@echo "  make db-down     Stop PostgreSQL container"
	@echo "  make server      Start Golang Backend API (Port 8088)"
	@echo "  make client      Start React Vite Frontend (Port 5173)"
	@echo "  make build       Compile Go binary and build frontend production assets"

db-up:
	docker compose up -d

db-down:
	docker compose down

server:
	cd server && go run cmd/api/main.go

client:
	cd client && npm run dev

build:
	cd server && go build -o bin/api cmd/api/main.go
	cd client && npm run build

clean:
	rm -rf server/bin client/dist
