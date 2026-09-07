-- D&D Campaign Planner SQLite Property Graph Schema

CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    setting TEXT DEFAULT 'Forgotten Realms',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- arc, quest, session, encounter, pc, npc, monster, location, faction, item, clue, map
    title TEXT NOT NULL,
    subtitle TEXT DEFAULT '',
    summary TEXT DEFAULT '',
    content_markdown TEXT DEFAULT '',
    data_json TEXT DEFAULT '{}',
    revealed_to_players INTEGER NOT NULL DEFAULT 0,
    tags TEXT DEFAULT '[]',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nodes_campaign ON nodes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(campaign_id, type);
CREATE INDEX IF NOT EXISTS idx_nodes_revealed ON nodes(campaign_id, revealed_to_players);

CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL, -- contains, precedes, located_at, allied_with, hostile_to, gives_quest, rewards, frequents, knows_secret, involved_in, member_of, parent_of
    label TEXT DEFAULT '',
    metadata_json TEXT DEFAULT '{}',
    revealed_to_players INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_edges_campaign ON edges(campaign_id);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
CREATE INDEX IF NOT EXISTS idx_edges_relation ON edges(campaign_id, relation_type);

CREATE TABLE IF NOT EXISTS player_notes (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    node_id TEXT REFERENCES nodes(id) ON DELETE SET NULL,
    author_name TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_player_notes_campaign ON player_notes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_player_notes_node ON player_notes(node_id);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS uploaded_documents (
    id TEXT PRIMARY KEY,
    campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
    filename TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general', -- pdf, statblock, pc, transcript, map, general
    file_size INTEGER NOT NULL DEFAULT 0,
    page_count INTEGER DEFAULT 0,
    file_hash TEXT DEFAULT '',
    metadata_json TEXT DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_uploads_campaign ON uploaded_documents(campaign_id);
CREATE INDEX IF NOT EXISTS idx_uploads_category ON uploaded_documents(category);
CREATE INDEX IF NOT EXISTS idx_uploads_original_name ON uploaded_documents(campaign_id, original_name);


-- Full-Text Search 5 virtual table
CREATE VIRTUAL TABLE IF NOT EXISTS fts_nodes USING fts5(
    id UNINDEXED,
    campaign_id UNINDEXED,
    type,
    title,
    subtitle,
    summary,
    content_markdown,
    content='nodes',
    content_rowid='rowid'
);

-- Triggers to maintain FTS index synchronously with nodes table
CREATE TRIGGER IF NOT EXISTS trg_nodes_insert AFTER INSERT ON nodes BEGIN
    INSERT INTO fts_nodes(rowid, id, campaign_id, type, title, subtitle, summary, content_markdown)
    VALUES (new.rowid, new.id, new.campaign_id, new.type, new.title, new.subtitle, new.summary, new.content_markdown);
END;

CREATE TRIGGER IF NOT EXISTS trg_nodes_delete AFTER DELETE ON nodes BEGIN
    INSERT INTO fts_nodes(fts_nodes, rowid, id, campaign_id, type, title, subtitle, summary, content_markdown)
    VALUES ('delete', old.rowid, old.id, old.campaign_id, old.type, old.title, old.subtitle, old.summary, old.content_markdown);
END;

CREATE TRIGGER IF NOT EXISTS trg_nodes_update AFTER UPDATE ON nodes BEGIN
    INSERT INTO fts_nodes(fts_nodes, rowid, id, campaign_id, type, title, subtitle, summary, content_markdown)
    VALUES ('delete', old.rowid, old.id, old.campaign_id, old.type, old.title, old.subtitle, old.summary, old.content_markdown);
    INSERT INTO fts_nodes(rowid, id, campaign_id, type, title, subtitle, summary, content_markdown)
    VALUES (new.rowid, new.id, new.campaign_id, new.type, new.title, new.subtitle, new.summary, new.content_markdown);
END;
