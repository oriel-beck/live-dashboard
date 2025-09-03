#!/bin/sh
echo "Starting API service..."
echo "Running database push..."
npm run db:push
echo "Database push completed. Starting development server..."
npm run dev
