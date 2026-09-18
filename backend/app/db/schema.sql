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
    type TEXT NOT NULL, -- arc, quest, session, encounter, pc, npc, monster, location, faction, item, clue, map, lore
    title TEXT NOT NULL,
    subtitle TEXT DEFAULT '',
    summary TEXT DEFAULT '',
    content_markdown TEXT DEFAULT '',
    data_json TEXT DEFAULT '{}',
    revealed_to_players INTEGER NOT NULL DEFAULT 0,
    is_canon INTEGER NOT NULL DEFAULT 1,
    confidence REAL NOT NULL DEFAULT 1.0,
    lore_status TEXT NOT NULL DEFAULT 'fact', -- fact, suspicion, rumor
    tags TEXT DEFAULT '[]',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nodes_campaign ON nodes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(campaign_id, type);
CREATE INDEX IF NOT EXISTS idx_nodes_revealed ON nodes(campaign_id, revealed_to_players);
CREATE INDEX IF NOT EXISTS idx_nodes_canon ON nodes(campaign_id, is_canon);
CREATE INDEX IF NOT EXISTS idx_nodes_lore_status ON nodes(campaign_id, lore_status);

CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL, -- contains, leads_to, precedes, recorded_in, located_at, allied_with, hostile_to, gives_quest, rewards, frequents, knows_secret, involved_in, member_of, parent_of, associated_with
    label TEXT DEFAULT '',
    metadata_json TEXT DEFAULT '{}',
    revealed_to_players INTEGER NOT NULL DEFAULT 0,
    is_canon INTEGER NOT NULL DEFAULT 1,
    confidence REAL NOT NULL DEFAULT 1.0,
    lore_status TEXT NOT NULL DEFAULT 'fact', -- fact, suspicion, rumor
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
    category TEXT NOT NULL DEFAULT 'general', -- pdf, statblock, pc, transcript, map, lore, general
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

CREATE TABLE IF NOT EXISTS uploaded_document_sections (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES uploaded_documents(id) ON DELETE CASCADE,
    campaign_id TEXT,
    section_title TEXT,
    page_number INTEGER DEFAULT 1,
    raw_text TEXT NOT NULL,
    chunk_index INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_doc_sections_doc ON uploaded_document_sections(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_sections_campaign ON uploaded_document_sections(campaign_id);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_document_sections USING fts5(
    id UNINDEXED,
    document_id UNINDEXED,
    campaign_id UNINDEXED,
    section_title,
    raw_text,
    content='uploaded_document_sections',
    content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS trg_doc_sections_insert AFTER INSERT ON uploaded_document_sections BEGIN
    INSERT INTO fts_document_sections(rowid, id, document_id, campaign_id, section_title, raw_text)
    VALUES (new.rowid, new.id, new.document_id, new.campaign_id, new.section_title, new.raw_text);
END;

CREATE TRIGGER IF NOT EXISTS trg_doc_sections_delete AFTER DELETE ON uploaded_document_sections BEGIN
    INSERT INTO fts_document_sections(fts_document_sections, rowid, id, document_id, campaign_id, section_title, raw_text)
    VALUES ('delete', old.rowid, old.id, old.document_id, old.campaign_id, old.section_title, old.raw_text);
END;

CREATE TRIGGER IF NOT EXISTS trg_doc_sections_update AFTER UPDATE ON uploaded_document_sections BEGIN
    INSERT INTO fts_document_sections(fts_document_sections, rowid, id, document_id, campaign_id, section_title, raw_text)
    VALUES ('delete', old.rowid, old.id, old.document_id, old.campaign_id, old.section_title, old.raw_text);
    INSERT INTO fts_document_sections(rowid, id, document_id, campaign_id, section_title, raw_text)
    VALUES (new.rowid, new.id, new.document_id, new.campaign_id, new.section_title, new.raw_text);
END;


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

-- Co-DM Chat Conversation Threads & History
CREATE TABLE IF NOT EXISTS chat_threads (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Prep Session',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_campaign ON chat_threads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_updated ON chat_threads(updated_at);

CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'user' | 'assistant' | 'system'
    content TEXT NOT NULL,
    actions_json TEXT DEFAULT '[]',
    scratchpad TEXT,
    loop_steps_json TEXT DEFAULT '[]',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_campaign ON chat_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

-- Persistent decomposition pipeline runs with step-by-step checkpointing
CREATE TABLE IF NOT EXISTS decomposition_jobs (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    filename TEXT,
    page_range TEXT,
    instruction TEXT,
    decomposition_mode TEXT,
    status TEXT NOT NULL, -- 'clustering', 'mining', 'qa_auditing', 'deconflicting', 'completed', 'failed'
    current_step INTEGER NOT NULL DEFAULT 1,
    clusters_json TEXT DEFAULT '[]',
    scratchpads_json TEXT DEFAULT '{}',
    draft_nodes_json TEXT DEFAULT '[]',
    draft_edges_json TEXT DEFAULT '[]',
    qa_results_json TEXT DEFAULT '{}',
    overview_summary TEXT,
    model_name TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_decomp_jobs_campaign ON decomposition_jobs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_decomp_jobs_status ON decomposition_jobs(status);

