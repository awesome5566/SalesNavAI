#!/bin/bash

# Sales Navigator URL Generator - Start Script
# This script builds and starts the full application

set -e  # Exit on any error

echo "🚀 Starting Sales Navigator URL Generator..."
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Cleanup function for graceful shutdown
cleanup() {
    echo ""
    print_status "Shutting down gracefully..."
    
    # Kill any child processes
    if [ ! -z "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null || true
    fi
    
    # Kill any remaining processes on the port
    EXISTING_PID=$(lsof -ti:$PORT 2>/dev/null || true)
    if [ ! -z "$EXISTING_PID" ]; then
        print_status "Cleaning up remaining processes on port $PORT..."
        kill -9 $EXISTING_PID 2>/dev/null || true
    fi
    
    print_success "Cleanup completed. Goodbye!"
    exit 0
}

# Set up signal handlers for graceful shutdown
trap cleanup SIGINT SIGTERM

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    print_error "pnpm is not installed. Please install pnpm first:"
    echo "npm install -g pnpm"
    exit 1
fi

print_status "Checking dependencies..."

# Install dependencies if node_modules doesn't exist or package.json is newer
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    print_status "Installing dependencies with pnpm..."
    pnpm install
    print_success "Dependencies installed successfully"
else
    print_success "Dependencies are up to date"
fi

# Build the TypeScript backend
print_status "Building TypeScript backend..."
pnpm run build
if [ $? -eq 0 ]; then
    print_success "Backend build completed"
else
    print_error "Backend build failed"
    exit 1
fi

# Build the frontend
print_status "Building React frontend..."
pnpm run frontend:build
if [ $? -eq 0 ]; then
    print_success "Frontend build completed"
else
    print_error "Frontend build failed"
    exit 1
fi

# Check for existing processes on port 3001 and kill them
PORT=3001
print_status "Checking for existing processes on port $PORT..."

# Find processes using the port
EXISTING_PID=$(lsof -ti:$PORT 2>/dev/null || true)

if [ ! -z "$EXISTING_PID" ]; then
    print_warning "Found existing process(es) on port $PORT (PID: $EXISTING_PID)"
    print_status "Killing existing processes..."
    
    # Kill the processes
    kill -9 $EXISTING_PID 2>/dev/null || true
    
    # Wait a moment for the port to be released
    sleep 2
    
    # Verify the port is free
    NEW_CHECK=$(lsof -ti:$PORT 2>/dev/null || true)
    if [ ! -z "$NEW_CHECK" ]; then
        print_error "Failed to free port $PORT. Please manually kill the process or use a different port."
        exit 1
    else
        print_success "Port $PORT is now free"
    fi
else
    print_success "Port $PORT is available"
fi

# Start the server
print_status "Starting the application server..."
echo ""
print_success "🎉 Application is ready!"
echo ""
echo -e "${GREEN}📱 Frontend:${NC} http://localhost:$PORT"
echo -e "${GREEN}🔧 API:${NC} http://localhost:$PORT/api/generate"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
echo ""

# Start the server in the background and capture its PID
pnpm run server &
SERVER_PID=$!

# Wait for the server process
wait $SERVER_PID
