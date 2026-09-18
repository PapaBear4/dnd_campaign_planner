"""
Story Graph & Quest Architecture Overhaul - Data Migration Script
Standardizes narrative graph edge taxonomy on `contains`, `leads_to`, and `recorded_in`.
- Rewrites `parent_of` -> `contains` for story nodes (arc, quest, encounter).
- Standardizes (quest, encounter) relationships to `contains`.
- Deprecates `advances_quest` -> migrates to `associated_with` with `metadata_json: { "is_milestone": True }`.
"""

import json
import sqlite3
import sys
from pathlib import Path

# Adjust path to find database
CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent.parent
WORKSPACE_DIR = BACKEND_DIR.parent
DATA_DIR = WORKSPACE_DIR / "data"
DB_PATH = DATA_DIR / "campaign_graph.db"


def run_migration(db_path: Path = DB_PATH):
    if not db_path.exists():
        print(f"Database not found at {db_path}, skipping migration.")
        return {"migrated_parent_of": 0, "migrated_advances_quest": 0, "standardized_quest_encounter": 0}

    print(f"Connecting to database at {db_path}...")
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 1. Rewrite parent_of -> contains for narrative story nodes:
    # (arc, quest), (quest, quest), (arc, encounter), (quest, encounter)
    cursor.execute("""
        SELECT e.id, e.relation_type, s.type as src_type, t.type as tgt_type
        FROM edges e
        JOIN nodes s ON e.source_id = s.id
        JOIN nodes t ON e.target_id = t.id
        WHERE e.relation_type = 'parent_of'
          AND s.type IN ('arc', 'quest', 'encounter')
          AND t.type IN ('arc', 'quest', 'encounter')
    """)
    parent_of_edges = cursor.fetchall()
    print(f"Found {len(parent_of_edges)} narrative parent_of edges to migrate to 'contains'.")

    migrated_parent_of = 0
    for edge in parent_of_edges:
        cursor.execute(
            "UPDATE edges SET relation_type = 'contains' WHERE id = ?",
            (edge["id"],)
        )
        migrated_parent_of += 1

    # 2. Standardize quest -> encounter relationships to 'contains'
    cursor.execute("""
        SELECT e.id, e.relation_type, s.type as src_type, t.type as tgt_type
        FROM edges e
        JOIN nodes s ON e.source_id = s.id
        JOIN nodes t ON e.target_id = t.id
        WHERE s.type = 'quest'
          AND t.type = 'encounter'
          AND e.relation_type NOT IN ('contains', 'leads_to')
    """)
    quest_encounter_edges = cursor.fetchall()
    print(f"Found {len(quest_encounter_edges)} non-standard quest->encounter edges to migrate to 'contains'.")

    standardized_quest_encounter = 0
    for edge in quest_encounter_edges:
        cursor.execute(
            "UPDATE edges SET relation_type = 'contains' WHERE id = ?",
            (edge["id"],)
        )
        standardized_quest_encounter += 1

    # 3. Deprecate advances_quest: migrate to associated_with with metadata_json: {"is_milestone": True}
    cursor.execute("""
        SELECT e.id, e.relation_type, e.metadata_json, s.type as src_type, t.type as tgt_type
        FROM edges e
        JOIN nodes s ON e.source_id = s.id
        JOIN nodes t ON e.target_id = t.id
        WHERE e.relation_type = 'advances_quest'
    """)
    advances_quest_edges = cursor.fetchall()
    print(f"Found {len(advances_quest_edges)} advances_quest edges to migrate.")

    migrated_advances_quest = 0
    for edge in advances_quest_edges:
        raw_meta = edge["metadata_json"] or "{}"
        try:
            meta = json.loads(raw_meta)
        except Exception:
            meta = {}
        meta["is_milestone"] = True
        meta["migrated_from"] = "advances_quest"

        cursor.execute(
            "UPDATE edges SET relation_type = 'associated_with', metadata_json = ? WHERE id = ?",
            (json.dumps(meta), edge["id"])
        )
        migrated_advances_quest += 1

    conn.commit()
    conn.close()

    print(f"Migration completed successfully:")
    print(f"  - Migrated parent_of -> contains: {migrated_parent_of}")
    print(f"  - Standardized quest->encounter: {standardized_quest_encounter}")
    print(f"  - Migrated advances_quest -> associated_with: {migrated_advances_quest}")

    return {
        "migrated_parent_of": migrated_parent_of,
        "migrated_advances_quest": migrated_advances_quest,
        "standardized_quest_encounter": standardized_quest_encounter,
    }


if __name__ == "__main__":
    db_to_use = DB_PATH
    if len(sys.argv) > 1:
        db_to_use = Path(sys.argv[1])
    run_migration(db_to_use)
