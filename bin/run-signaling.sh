#!/bin/bash

echo "================================================"
echo "  VideoChat - Signaling Server Runner"
echo "================================================"

# Check if Node.js is installed
if command -v node &> /dev/null; then
    # Check if ws module is installed
    if ! npm list -g ws | grep -q ws; then
        echo "Installing WebSocket module..."
        npm install -g ws
    fi
    
    echo "Starting WebSocket signaling server..."
    node "$(dirname "$0")/simple-signaling-server.js"
    exit 0
fi

# If Node.js is not available, try to use the Mercure hub
echo "Node.js not found, attempting to use Mercure hub..."

# Try using the run-mercure.sh script
bash "$(dirname "$0")/run-mercure.sh"