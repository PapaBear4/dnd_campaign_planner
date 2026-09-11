import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"
DB_PATH = Path(os.getenv("DATABASE_PATH", DB_DIR / "campaign_graph.db"))
SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"

def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn

@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("ALTER TABLE nodes ADD COLUMN is_canon INTEGER NOT NULL DEFAULT 1;")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE nodes ADD COLUMN confidence REAL NOT NULL DEFAULT 1.0;")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE nodes ADD COLUMN lore_status TEXT NOT NULL DEFAULT 'fact';")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE edges ADD COLUMN is_canon INTEGER NOT NULL DEFAULT 1;")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE edges ADD COLUMN confidence REAL NOT NULL DEFAULT 1.0;")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE edges ADD COLUMN lore_status TEXT NOT NULL DEFAULT 'fact';")
        except Exception:
            pass

        with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
            conn.executescript(f.read())
        
        # Check if default campaign exists
        cursor.execute("SELECT COUNT(*) as count FROM campaigns")
        if cursor.fetchone()["count"] == 0:
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc).isoformat()
            default_campaign_id = "default-campaign"
            cursor.execute(
                """
                INSERT INTO campaigns (id, name, description, setting, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    default_campaign_id,
                    "Chronicles of the Realm",
                    "A vibrant campaign of mystery, ancient ruins, and shifting factions.",
                    "D&D 5e - Sword Coast & Wildemount",
                    now,
                    now,
                ),
            )
            # Default settings
            cursor.execute(
                """
                INSERT OR IGNORE INTO settings (key, value, updated_at)
                VALUES ('active_campaign_id', ?, ?)
                """,
                (default_campaign_id, now),
            )
            cursor.execute(
                """
                INSERT OR IGNORE INTO settings (key, value, updated_at)
                VALUES ('gemini_model', 'gemini-flash-latest', ?)
                """,
                (now,),
            )
            cursor.execute(
                """
                INSERT OR IGNORE INTO settings (key, value, updated_at)
                VALUES ('gemini_api_key', '', ?)
                """,
                (now,),
            )
    
    # Populate sample starter campaign data if empty
    from app.db.seed_data import seed_sample_campaign
    seed_sample_campaign()

