#!/bin/bash
set -e

echo "Setting up Capacitor Android environment..."

# Check if android platform exists
if [ ! -d "android" ]; then
    echo "Android platform not found. Adding..."
    npx cap add android
else
    echo "Android platform already exists"
fi

# Sync the web content
echo "Syncing web content..."
npx cap sync android

echo "Android setup complete!"
