#!/bin/bash

# 📊 Health Check Script for Deployed Services
# Monitor both Render backend and Vercel frontend

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
RENDER_API_URL=${1:-"https://kheliss-data-hub.onrender.com"}
VERCEL_FRONTEND_URL=${2:-"https://ewuradatahub.vercel.app"}

echo -e "${BLUE}🏥 Ewura Hub - Production Health Check${NC}"
echo "=================================================="
echo ""

# Function to check URL
check_endpoint() {
    local url=$1
    local name=$2
    
    echo -n "Checking $name... "
    
    response=$(curl -s -w "\n%{http_code}" --max-time 10 "$url")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "301" ] || [ "$http_code" = "302" ]; then
        echo -e "${GREEN}✅ OK ($http_code)${NC}"
        return 0
    else
        echo -e "${RED}❌ FAILED ($http_code)${NC}"
        return 1
    fi
}

# Check Backend API
echo -e "${BLUE}Backend (Render)${NC}"
echo "---"
check_endpoint "$RENDER_API_URL/api/health" "Backend Health"
check_endpoint "$RENDER_API_URL/api/health/live" "Backend Liveness"
check_endpoint "$RENDER_API_URL/api/health/ready" "Backend Readiness"
echo ""

# Check Frontend
echo -e "${BLUE}Frontend (Vercel)${NC}"
echo "---"
check_endpoint "$VERCEL_FRONTEND_URL" "Frontend"
check_endpoint "$VERCEL_FRONTEND_URL/index.html" "Frontend HTML"
echo ""

# Check API Response Time
echo -e "${BLUE}Performance Metrics${NC}"
echo "---"
echo -n "Backend response time: "
response_time=$(curl -s -o /dev/null -w "%{time_total}" "$RENDER_API_URL/api/health")
echo -e "${GREEN}${response_time}s${NC}"

echo -n "Frontend response time: "
response_time=$(curl -s -o /dev/null -w "%{time_total}" "$VERCEL_FRONTEND_URL")
echo -e "${GREEN}${response_time}s${NC}"
echo ""

echo -e "${GREEN}✅ Health check complete!${NC}"
