#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

BACKEND_URL="http://127.0.0.1:8000/docs"
FRONTEND_URL="http://localhost:3000"

is_service_up() {
    curl -s -o /dev/null -w "%{http_code}" --connect-timeout 1 "$1" 2>/dev/null | grep -q '^[23]'
}

cleanup() {
    if [ -n "$FRONT_PID" ] || [ -n "$BACK_PID" ]; then
        echo ""
        echo "Shutting down started servers..."
        [ -n "$FRONT_PID" ] && kill "$FRONT_PID" 2>/dev/null || true
        [ -n "$BACK_PID" ] && kill "$BACK_PID" 2>/dev/null || true
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

echo "=============================================="
echo " Starting D&D Campaign Planner & Co-DM Studio "
echo "=============================================="

# 1. Check Backend
if is_service_up "$BACKEND_URL"; then
    echo "[✓] Backend already running on port 8000."
else
    echo "-> Starting Backend (FastAPI)..."
    PY_BIN="python3"
    if [ -f "$DIR/backend/venv/bin/python" ]; then
        PY_BIN="$DIR/backend/venv/bin/python"
    elif [ -f "$DIR/backend/.venv/bin/python" ]; then
        PY_BIN="$DIR/backend/.venv/bin/python"
    fi
    (cd "$DIR/backend" && "$PY_BIN" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000) &
    BACK_PID=$!
fi

# 2. Check Frontend
if is_service_up "$FRONTEND_URL"; then
    echo "[✓] Frontend already running on port 3000."
else
    echo "-> Starting Frontend (Vite)..."
    (cd "$DIR/frontend" && npm run dev) &
    FRONT_PID=$!
    
    echo "Waiting for frontend to become ready..."
    for i in {1..30}; do
        if is_service_up "$FRONTEND_URL"; then
            break
        fi
        sleep 0.5
    done
fi

# 3. Launch App in Browser
echo "-> Launching app in browser ($FRONTEND_URL)..."
if which xdg-open >/dev/null 2>&1; then
    xdg-open "$FRONTEND_URL" >/dev/null 2>&1 &
elif which sensible-browser >/dev/null 2>&1; then
    sensible-browser "$FRONTEND_URL" >/dev/null 2>&1 &
fi

# If neither was started by this shell (both already running), exit cleanly
if [ -z "$FRONT_PID" ] && [ -z "$BACK_PID" ]; then
    echo "All services were already running. Browser launched."
    exit 0
fi

wait
