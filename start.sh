#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

cleanup() {
    echo ""
    echo "Shutting down servers..."
    if [ -n "$FRONT_PID" ] && kill -0 "$FRONT_PID" 2>/dev/null; then
        kill "$FRONT_PID" 2>/dev/null || true
    fi
    if [ -n "$BACK_PID" ] && kill -0 "$BACK_PID" 2>/dev/null; then
        kill "$BACK_PID" 2>/dev/null || true
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

echo "=============================================="
echo " Starting D&D Campaign Planner & Co-DM Studio "
echo "=============================================="

# Check Python environment
PY_BIN="python3"
if [ -f "$DIR/backend/venv/bin/python" ]; then
    PY_BIN="$DIR/backend/venv/bin/python"
elif [ -f "$DIR/backend/.venv/bin/python" ]; then
    PY_BIN="$DIR/backend/.venv/bin/python"
fi

echo "-> Starting Backend (FastAPI)..."
(cd "$DIR/backend" && "$PY_BIN" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000) &
BACK_PID=$!

echo "-> Starting Frontend (Vite)..."
(cd "$DIR/frontend" && npm run dev) &
FRONT_PID=$!

wait
