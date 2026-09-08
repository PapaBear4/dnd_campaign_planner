import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Compass,
  Edit3,
  FileText,
  MapPin,
  Plus,
  Scroll,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import { createPlayerNote, deletePlayerNote, getPlayerGraph, getPlayerHierarchy, getPlayerNotes } from '../api';
import { GraphData, HierarchyItem, NodeItem, PlayerNote } from '../types';

interface PlayerPortalProps {
  campaignId: string;
}

export const PlayerPortal: React.FC<PlayerPortalProps> = ({ campaignId }) => {
  const [activeTab, setActiveTab] = useState<'lore' | 'chronicle' | 'notes'>('lore');
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [hierarchy, setHierarchy] = useState<HierarchyItem[]>([]);
  const [notes, setNotes] = useState<PlayerNote[]>([]);
  const [selectedNode, setSelectedNode] = useState<NodeItem | null>(null);

  // New Note Modal / Form
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteAuthor, setNoteAuthor] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  const loadPlayerData = async () => {
    try {
      const [g, h, n] = await Promise.all([
        getPlayerGraph(campaignId),
        getPlayerHierarchy(campaignId),
        getPlayerNotes(campaignId),
      ]);
      setGraphData(g);
      setHierarchy(h);
      setNotes(n);
      if (g.nodes.length > 0 && !selectedNode) {
        setSelectedNode(g.nodes[0]);
      }
    } catch (err) {
      console.error('Error loading player portal:', err);
    }
  };

  useEffect(() => {
    loadPlayerData();
  }, [campaignId]);

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim()) return;

    try {
      await createPlayerNote({
        campaign_id: campaignId,
        author_name: noteAuthor.trim() || 'Adventurer',
        title: noteTitle.trim(),
        content: noteContent.trim(),
        node_id: selectedNode?.id || null,
      });
      setShowNoteForm(false);
      setNoteTitle('');
      setNoteContent('');
      loadPlayerData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (window.confirm('Delete this player note?')) {
      await deletePlayerNote(noteId);
      loadPlayerData();
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      {/* Banner */}
      <div
        className="glass-panel"
        style={{
          borderRadius: '16px',
          padding: '24px 30px',
          marginBottom: '24px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-medium)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-emerald)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Player View • Progressive Chronicle
          </span>
          <h2 style={{ fontSize: '1.8rem', color: 'var(--text-primary)', margin: '4px 0' }}>The Adventurer's Codex</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Your party's record of discovered lore, known allies &amp; enemies, and shared session notes.
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-surface)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => setActiveTab('lore')}
            className={`btn ${activeTab === 'lore' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '6px 14px', fontSize: '0.82rem' }}
          >
            <Compass size={15} /> Discovered Lore
          </button>
          <button
            onClick={() => setActiveTab('chronicle')}
            className={`btn ${activeTab === 'chronicle' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '6px 14px', fontSize: '0.82rem' }}
          >
            <Scroll size={15} /> Quest Chronicle
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`btn ${activeTab === 'notes' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '6px 14px', fontSize: '0.82rem' }}
          >
            <Edit3 size={15} /> Party Notes
          </button>
        </div>
      </div>

      {/* Tab 1: Discovered Lore (Split View: list on left, details on right) */}
      {activeTab === 'lore' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
          {/* Discovered Entities List */}
          <div className="glass-panel" style={{ borderRadius: '12px', padding: '16px', maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: 'var(--color-gold)' }}>
              Known Entities ({graphData.nodes.length})
            </h3>
            {graphData.nodes.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Your party has not yet discovered or recorded any locations, NPCs, or items.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {graphData.nodes.map((node) => (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: selectedNode?.id === node.id ? 'var(--bg-card-active)' : 'var(--bg-surface)',
                      border: `1px solid ${selectedNode?.id === node.id ? 'var(--color-gold)' : 'var(--border-subtle)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{node.title}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{node.subtitle || node.summary?.slice(0, 45)}</div>
                    </div>
                    <span className={`badge badge-${node.type}`}>{node.type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Details Card */}
          <div className="glass-panel" style={{ borderRadius: '12px', padding: '24px', minHeight: '400px' }}>
            {selectedNode ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span className={`badge badge-${selectedNode.type}`}>{selectedNode.type}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Discovered Lore Entry</span>
                </div>

                <h2 style={{ fontSize: '1.6rem', color: 'var(--text-primary)', marginBottom: '4px' }}>{selectedNode.title}</h2>
                {selectedNode.subtitle && (
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-gold)', fontStyle: 'italic', marginBottom: '14px' }}>
                    {selectedNode.subtitle}
                  </p>
                )}

                {selectedNode.summary && (
                  <div
                    style={{
                      background: 'var(--bg-card)',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      borderLeft: '3px solid var(--color-emerald)',
                      fontSize: '0.88rem',
                      lineHeight: 1.6,
                      color: 'var(--text-primary)',
                      marginBottom: '18px',
                    }}
                  >
                    {selectedNode.summary}
                  </div>
                )}

                {selectedNode.content_markdown && (
                  <div style={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                    {selectedNode.content_markdown}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                Select an entry from the list to view discovered notes and lore.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Quest Chronicle */}
      {activeTab === 'chronicle' && (
        <div className="glass-panel" style={{ borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--color-gold)' }}>
            Completed &amp; Discovered Milestones
          </h3>
          {hierarchy.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No campaign arcs have been made visible to the players yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {hierarchy.map((item) => (
                <div
                  key={item.node.id}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    padding: '16px 20px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span className="badge badge-arc">Campaign Arc</span>
                    <h4 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{item.node.title}</h4>
                  </div>
                  {item.node.summary && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                      {item.node.summary}
                    </p>
                  )}

                  {/* Quests inside this Arc */}
                  {item.children.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                      {item.children.map((q) => (
                        <div
                          key={q.node.id}
                          style={{
                            background: 'var(--bg-card)',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-subtle)',
                            borderLeft: '3px solid var(--color-arcane-blue)',
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            {q.node.title}
                          </div>
                          {q.node.summary && (
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {q.node.summary}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Collaborative Player Notes */}
      {activeTab === 'notes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--color-gold)' }}>Party Session Log &amp; Notes</h3>
            <button onClick={() => setShowNoteForm(true)} className="btn btn-primary">
              <Plus size={15} /> Add Note
            </button>
          </div>

          {showNoteForm && (
            <form
              onSubmit={handleCreateNote}
              className="glass-panel animate-fade-in"
              style={{ padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--border-medium)' }}
            >
              <h4 style={{ fontSize: '1rem', marginBottom: '12px' }}>Write New Party Note</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Author (Character Name)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Valeros the Fighter"
                    value={noteAuthor}
                    onChange={(e) => setNoteAuthor(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '6px', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Note Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Session 2 Clues about the Necromancer"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '6px', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Note Contents
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Record loot, conversations, suspicions, and battle highlights..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '6px', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowNoteForm(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Note
                </button>
              </div>
            </form>
          )}

          {/* Notes List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {notes.length === 0 ? (
              <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', borderRadius: '12px' }}>
                <FileText size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 10px' }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  No player notes yet. Click <strong>Add Note</strong> to keep track of quests, loot, and secrets!
                </p>
              </div>
            ) : (
              notes.map((n) => (
                <div
                  key={n.id}
                  className="glass-panel"
                  style={{ padding: '16px 20px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{n.title}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-arcane-cyan)' }}>by {n.author_name}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteNote(n.id)}
                      className="btn btn-ghost"
                      style={{ padding: '4px', color: 'var(--color-crimson)' }}
                      title="Delete Note"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div style={{ fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                    {n.content}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
