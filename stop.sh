#!/bin/bash

# Sales Navigator URL Generator - Stop Script
# This script stops any running instances of the application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

PORT=3001

echo "🛑 Stopping Sales Navigator URL Generator..."
echo "==========================================="

print_status "Checking for processes on port $PORT..."

# Find processes using the port
EXISTING_PID=$(lsof -ti:$PORT 2>/dev/null || true)

if [ ! -z "$EXISTING_PID" ]; then
    print_warning "Found process(es) on port $PORT (PID: $EXISTING_PID)"
    print_status "Stopping processes..."
    
    # Try graceful shutdown first
    kill $EXISTING_PID 2>/dev/null || true
    
    # Wait a moment
    sleep 2
    
    # Check if still running and force kill if needed
    STILL_RUNNING=$(lsof -ti:$PORT 2>/dev/null || true)
    if [ ! -z "$STILL_RUNNING" ]; then
        print_status "Force killing remaining processes..."
        kill -9 $STILL_RUNNING 2>/dev/null || true
        sleep 1
    fi
    
    # Final check
    FINAL_CHECK=$(lsof -ti:$PORT 2>/dev/null || true)
    if [ -z "$FINAL_CHECK" ]; then
        print_success "All processes stopped successfully"
    else
        print_error "Some processes may still be running"
        exit 1
    fi
else
    print_success "No processes found on port $PORT"
fi

print_success "✅ Application stopped successfully"
