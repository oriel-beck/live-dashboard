# Development Setup Guide

This guide will help you set up and run the Discord Bot Management Platform in development mode with live reloading.

## Prerequisites

- Docker and Docker Compose installed (version 2.22+ required for watch feature)
- Node.js 20+ (for local development)
- Git

## Quick Start

### 1. Environment Setup

Copy the environment template and configure it:

```bash
# On Linux/Mac
cp env.example .env

# On Windows
copy env.example .env
```

Edit `.env` and set your actual values:
- `DISCORD_BOT_TOKEN` - Your Discord bot token
- `DISCORD_CLIENT_ID` - Your Discord application client ID
- `DISCORD_CLIENT_SECRET` - Your Discord application client secret
- `JWT_SECRET` - A secure random string for JWT signing

### 2. Start Development Environment

#### Option A: Using the startup script (Recommended)

```bash
# On Linux/Mac
chmod +x start-dev.sh
./start-dev.sh

# On Windows
start-dev.bat
```

The startup script will:
1. Build shared types
2. Start all Docker services with file watching enabled
3. API service automatically sets up the database with Prisma

#### Option B: Manual startup

```bash
# Build shared types first
cd shared-types
npm install
npm run build
cd ..

# Start all services with file watching (API will handle database setup)
docker-compose -f docker-compose.dev.yml watch
```

### 3. Watch Shared Types (Optional but Recommended)

In a separate terminal, run the watch script to automatically rebuild shared types when they change:

```bash
# On Linux/Mac
chmod +x watch-shared-types.sh
./watch-shared-types.sh

# On Windows
watch-shared-types.bat
```

## What's Running

Once started, you'll have access to:

- **Dashboard**: http://localhost:4200 (Angular with live reload)
- **API**: http://localhost:3000 (Express with ts-node + Prisma)
- **Bot**: http://localhost:3001 (Discord bot with ts-node)
- **Database**: localhost:5432 (PostgreSQL with Prisma schema)
- **Redis**: localhost:6379 (Redis cache)

## Live Reloading

All services support live reloading using Docker Compose watch:

- **File Watching**: Docker Compose automatically syncs file changes to containers
- **Service Restarts**: Services restart automatically when source files change
- **Shared Types**: Changes are immediately synced to all services
- **No Polling**: Uses efficient file system events for instant updates

## Development Workflow

1. **Shared Types**: Edit files in `shared-types/src/` - use watch script to auto-rebuild
2. **API**: Edit files in `api/src/` - service automatically restarts
3. **Bot**: Edit files in `bot/src/` - service automatically restarts
4. **Dashboard**: Edit files in `dashboard/src/` - service automatically restarts
5. **Database**: Prisma automatically handles schema updates on API service startup

## How It Works

- **Docker Compose Watch**: Built-in file watching and syncing
- **Shared Types**: Built locally and synced to services via watch
- **No Manual Volumes**: Watch feature handles all file synchronization
- **Fast Updates**: Instant file syncing without container rebuilds
- **Database**: PostgreSQL creates the database automatically, API service runs Prisma setup

## Troubleshooting

### Docker Compose Version
Make sure you have Docker Compose version 2.22+ for the watch feature:
```bash
docker-compose version
```

### Port Conflicts
If ports are already in use, check what's running:
```bash
# Check what's using port 3000
netstat -tulpn | grep :3000

# Or on Windows
netstat -an | findstr :3000
```

### Docker Issues
```bash
# Clean up containers and volumes
docker-compose -f docker-compose.dev.yml down -v

# Rebuild everything
docker-compose -f docker-compose.dev.yml watch --build
```

### Shared Types Not Updating
```bash
# Rebuild shared types manually
cd shared-types
npm run build
cd ..

# Or use the watch script in another terminal
./watch-shared-types.sh  # Linux/Mac
watch-shared-types.bat   # Windows
```

### Database Issues
```bash
# Reset database schema (restart API service)
docker-compose -f docker-compose.dev.yml restart api

# Or check API logs for Prisma errors
docker-compose -f docker-compose.dev.yml logs api
```

## Stopping the Environment

```bash
# Stop all services
docker-compose -f docker-compose.dev.yml down

# Stop and remove volumes (will delete database data)
docker-compose -f docker-compose.dev.yml down -v
```

## Production Build

For production builds, use the production Dockerfiles:

```bash
# Build production images
docker-compose -f docker-compose.yml build

# Run production
docker-compose -f docker-compose.yml up
```
