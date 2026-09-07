from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.db.database import init_db
from app.routes import (
    agent,
    campaigns,
    edges,
    graph,
    nodes,
    player,
    settings,
    uploads,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database with WAL mode and schema
    init_db()
    yield

app = FastAPI(
    title="D&D Campaign Planner & Co-DM Graph Studio API",
    version="1.0.0",
    lifespan=lifespan
)

# Allow all origins for LAN / local access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(campaigns.router)
app.include_router(nodes.router)
app.include_router(edges.router)
app.include_router(graph.router)
app.include_router(player.router)
app.include_router(agent.router)
app.include_router(uploads.router)
app.include_router(settings.router)

# Mount uploads static directory
UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "dnd-campaign-planner"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
