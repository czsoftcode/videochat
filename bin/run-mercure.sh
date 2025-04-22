#!/bin/bash

# Default configuration
MERCURE_PUBLISHER_JWT_KEY="videochat_mercure_secret_key"
MERCURE_SUBSCRIBER_JWT_KEY="videochat_mercure_secret_key"
MERCURE_PORT=3000

# Display banner
echo "================================================"
echo "  VideoChat - Mercure Hub Server"
echo "================================================"
echo "Starting Mercure Hub at http://localhost:$MERCURE_PORT"
echo "This server is required for real-time communication"
echo "Press Ctrl+C to stop the server"
echo "================================================"

# Check if Docker is available
if command -v docker &> /dev/null; then
    echo "Starting Mercure using Docker..."
    docker run \
        -e MERCURE_PUBLISHER_JWT_KEY="$MERCURE_PUBLISHER_JWT_KEY" \
        -e MERCURE_SUBSCRIBER_JWT_KEY="$MERCURE_SUBSCRIBER_JWT_KEY" \
        -e SERVER_NAME=":$MERCURE_PORT" \
        -e MERCURE_EXTRA_DIRECTIVES="cors_origins *
anonymous
" \
        -p $MERCURE_PORT:$MERCURE_PORT \
        dunglas/mercure
    exit 0
fi

# If Docker is not available, try to use a binary release if available
if [ "$(uname)" == "Darwin" ]; then
    # macOS
    MERCURE_BINARY_URL="https://github.com/dunglas/mercure/releases/download/v0.14.6/mercure_0.14.6_Darwin_x86_64.tar.gz"
    OS="macOS"
elif [ "$(uname)" == "Linux" ]; then
    # Linux
    MERCURE_BINARY_URL="https://github.com/dunglas/mercure/releases/download/v0.14.6/mercure_0.14.6_Linux_x86_64.tar.gz"
    OS="Linux"
else
    # Windows or other
    echo "Unsupported operating system for direct binary download."
    echo "Please install Docker or download Mercure binary manually from:"
    echo "https://github.com/dunglas/mercure/releases"
    exit 1
fi

# Check if the mercure binary exists
if [ ! -f "./mercure" ]; then
    echo "Docker not available. Downloading Mercure binary for $OS..."
    
    # Check if curl or wget is available
    if command -v curl &> /dev/null; then
        curl -L $MERCURE_BINARY_URL -o mercure.tar.gz
    elif command -v wget &> /dev/null; then
        wget $MERCURE_BINARY_URL -O mercure.tar.gz
    else
        echo "Neither curl nor wget is available. Please install one of them or Docker."
        exit 1
    fi
    
    # Extract the binary
    tar -xzf mercure.tar.gz
    rm -f mercure.tar.gz
    chmod +x mercure
fi

# Run Mercure
echo "Starting Mercure using binary..."
./mercure --jwt-key="$MERCURE_PUBLISHER_JWT_KEY" --addr=":$MERCURE_PORT" --cors-allowed-origins="*" --publish-allowed-origins="*" --anonymous