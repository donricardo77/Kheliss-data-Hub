#!/bin/bash
# Ewura Hub Wallet - Development Server Startup Script

set -e

echo "🚀 Starting Ewura Hub Wallet Development Servers"
echo "================================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if node_modules exists
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    cd "$SCRIPT_DIR"
    pnpm install
fi

# Kill any existing processes on ports 8080 and 5173
echo -e "${YELLOW}Cleaning up any existing processes...${NC}"
lsof -ti :8080 | xargs kill -9 2>/dev/null || true
lsof -ti :5173 | xargs kill -9 2>/dev/null || true
sleep 1

# Load environment variables from .env
if [ -f "$SCRIPT_DIR/.env" ]; then
    export $(cat "$SCRIPT_DIR/.env" | grep -v '^#' | xargs)
fi

# Start backend in background
echo -e "${GREEN}Starting Backend API (Port 8080)...${NC}"
cd "$SCRIPT_DIR/backend/api-server"
PORT=8080 NODE_ENV=development pnpm dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend PID: $BACKEND_PID${NC}"

# Wait for backend to be ready
echo -e "${YELLOW}Waiting for backend to start...${NC}"
sleep 4

# Start frontend in background
echo -e "${GREEN}Starting Frontend (Port 5173)...${NC}"
cd "$SCRIPT_DIR/frontend/kheliss-data-hub"
PORT=5173 BASE_PATH=/ VITE_API_URL=http://localhost:8080 pnpm dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend PID: $FRONTEND_PID${NC}"

# Wait for frontend to be ready
echo -e "${YELLOW}Waiting for frontend to start...${NC}"
sleep 3

# Check if processes are running
if ps -p $BACKEND_PID > /dev/null; then
    echo -e "${GREEN}✓ Backend is running${NC}"
else
    echo -e "${RED}✗ Backend failed to start${NC}"
    echo -e "${YELLOW}Check logs: tail -f /tmp/backend.log${NC}"
fi

if ps -p $FRONTEND_PID > /dev/null; then
    echo -e "${GREEN}✓ Frontend is running${NC}"
else
    echo -e "${RED}✗ Frontend failed to start${NC}"
    echo -e "${YELLOW}Check logs: tail -f /tmp/frontend.log${NC}"
fi

echo ""
echo "================================================="
echo -e "${GREEN}✅ Development Servers Ready!${NC}"
echo "================================================="
echo ""
echo "📱 Frontend:  http://localhost:5173"
echo "🔌 Backend:   http://localhost:8080"
echo "🌐 Network:   http://192.168.0.114:5173"
echo ""
echo "📋 Logs:"
echo "   Backend:  tail -f /tmp/backend.log"
echo "   Frontend: tail -f /tmp/frontend.log"
echo ""
echo "🛑 To stop servers:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "================================================="

# Keep the script running and show logs
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"
wait $BACKEND_PID $FRONTEND_PID
