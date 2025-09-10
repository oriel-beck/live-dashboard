#!/bin/bash

# Development startup script for Discord Bot Management Platform

echo "Starting Discord Bot Management Platform Development Environment..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo ".env file not found. Please copy env.example to .env and configure your environment variables."
    echo "cp env.example .env"
    echo "Then edit .env with your actual values."
    exit 1
fi

# Start the development environment with Docker Compose watch
echo "Starting Docker Compose services with file watching..."
echo "Note: API service will automatically set up the database with Prisma"
docker-compose -f docker-compose.dev.yml watch
