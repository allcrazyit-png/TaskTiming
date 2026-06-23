#!/bin/bash

# get-dev-urls.sh - Print local dev server URLs for desktop and mobile
# Usage: ./get-dev-urls.sh
# Output: Desktop and mobile URLs for Vite dev server

set -e

# Configuration
DEV_PORT=5173
BASE_PATH="/TaskTiming/"
VITE_CONFIG="vite.config.js"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "$VITE_CONFIG" ]; then
    echo -e "${YELLOW}⚠ Warning: vite.config.js not found in current directory${NC}"
    echo "Make sure you're in the project root directory"
    exit 1
fi

# Get local IP address
get_local_ip() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}'
    elif [[ "$OSTYPE" == "linux"* ]]; then
        # Linux
        hostname -I | awk '{print $1}'
    else
        # Windows or other
        echo "127.0.0.1"
    fi
}

# Check if dev server is running
check_dev_server() {
    if nc -z localhost $DEV_PORT 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Get local IP
LOCAL_IP=$(get_local_ip)

# Check dev server status
if check_dev_server; then
    SERVER_STATUS="${GREEN}✓ Running${NC}"
else
    SERVER_STATUS="${YELLOW}✗ Not running${NC}"
fi

# Print results
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Dev Server Status: ${SERVER_STATUS}${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

echo -e "${GREEN}Desktop/Laptop:${NC}"
echo "  http://localhost:${DEV_PORT}${BASE_PATH}"

echo -e "\n${GREEN}Mobile (same WiFi):${NC}"
echo "  http://${LOCAL_IP}:${DEV_PORT}${BASE_PATH}"

echo -e "\n${BLUE}─────────────────────────────────────────────────────────${NC}"
echo -e "${YELLOW}Quick Tips:${NC}"
echo "  • Open desktop URL in browser: $(echo "open http://localhost:${DEV_PORT}${BASE_PATH}")"
echo "  • Mobile must be on same WiFi network"
echo "  • Changes auto-reload via Vite HMR"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
