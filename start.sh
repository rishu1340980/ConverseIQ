#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
echo "🚀 Starting ConverseIQ Phase 2 Production System..."
echo "📂 Project Directory: $DIR"

# 1. Backend Setup
echo "📦 Setting up Backend..."
cd "$DIR/backend"
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt

# Start backend in background
echo "⚡ Launching FastAPI Backend on http://0.0.0.0:8000..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# 2. Frontend Setup
echo "🌐 Setting up Frontend..."
cd "$DIR/frontend"
if [ ! -d "node_modules" ]; then
    npm install
fi

echo "✨ Launching Next.js Frontend on http://localhost:3000..."
npm run dev &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true" EXIT

echo "✅ ConverseIQ Phase 2 running!"
echo "Backend:  http://localhost:8000/docs"
echo "Frontend: http://localhost:3000"
echo "Press Ctrl+C to stop."

wait
