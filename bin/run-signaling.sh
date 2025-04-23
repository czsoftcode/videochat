#!/bin/bash

# Default values
DEFAULT_PORT=3000
DEFAULT_HOST="0.0.0.0"

# Parse command line arguments
PORT=${1:-$DEFAULT_PORT}
HOST=${2:-$DEFAULT_HOST}

echo "================================================"
echo "  VideoChat - Signaling Server Runner"
echo "================================================"
echo "Host: $HOST"
echo "Port: $PORT"
echo "================================================"

# Export environment variables for the server
export SIGNALING_PORT=$PORT
export SIGNALING_HOST=$HOST

# Check if Node.js is installed
if command -v node &> /dev/null; then
    # Check if ws module is installed locally in the project
    if [ ! -d "node_modules/ws" ]; then
        echo "Installing WebSocket module locally..."
        npm install ws
    fi
    
    echo "Starting WebSocket signaling server..."
    echo "Running on ${HOST}:${PORT}"
    echo "To run in background, use: nohup bin/run-signaling.sh > signaling.log 2>&1 &"
    
    node "$(dirname "$0")/simple-signaling-server.js"
    exit 0
fi

# If Node.js is not available, try to use the Mercure hub
echo "Node.js not found, attempting to use Mercure hub..."

# Try using the run-mercure.sh script
bash "$(dirname "$0")/run-mercure.sh"