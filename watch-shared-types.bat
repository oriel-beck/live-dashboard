@echo off
REM Watch script for shared types - rebuilds when files change

echo 📦 Watching shared types for changes...
echo    Press Ctrl+C to stop watching

cd shared-types
npm run watch
