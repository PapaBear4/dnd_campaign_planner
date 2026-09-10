import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Compass,
  Edit3,
  FileText,
  Image as ImageIcon,
  MapPin,
  Plus,
  RotateCcw,
  Scroll,
  Shield,
  Target,
  Trash2,
  Users,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { createPlayerNote, deletePlayerNote, getPlayerGraph, getPlayerHierarchy, getPlayerNotes } from '../api';
import { GraphData, HierarchyItem, NodeItem, PlayerNote } from '../types';
import { MarkdownView } from './MarkdownView';

interface PlayerPortalProps {
  campaignId: string;
}

export const PlayerPortal: React.FC<PlayerPortalProps> = ({ campaignId }) => {
  const [activeTab, setActiveTab] = useState<'lore' | 'chronicle' | 'maps' | 'notes'>('lore');
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [hierarchy, setHierarchy] = useState<HierarchyItem[]>([]);
  const [notes, setNotes] = useState<PlayerNote[]>([]);
  const [selectedNode, setSelectedNode] = useState<NodeItem | null>(null);

  // Player Maps State (only maps revealed to players)
  const playerMaps = graphData.nodes.filter((n) => n.type === 'map' && n.revealed_to_players);
  const [selectedPlayerMapId, setSelectedPlayerMapId] = useState<string>('');
  const [selectedPlayerPin, setSelectedPlayerPin] = useState<any>(null);

  // Google Maps Pan & Zoom State for Player
  const [mapScale, setMapScale] = useState(1);
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const [isDraggingPlayerMap, setIsDraggingPlayerMap] = useState(false);

  const playerMapContainerRef = useRef<HTMLDivElement | null>(null);
  const playerDragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const playerPanStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const playerDidDragRef = useRef(false);

  // Auto select first map
  useEffect(() => {
    if (playerMaps.length > 0 && (!selectedPlayerMapId || !playerMaps.some((m) => m.id === selectedPlayerMapId))) {
      setSelectedPlayerMapId(playerMaps[0].id);
    }
  }, [playerMaps, selectedPlayerMapId]);

  const activePlayerMap = playerMaps.find((m) => m.id === selectedPlayerMapId) || playerMaps[0] || null;
  const playerMapUrl = activePlayerMap?.data_json?.map_url || '';
  // Only show pins that are marked as revealed to players
  const playerPins = (activePlayerMap?.data_json?.pins || []).filter((p: any) => p.revealed !== false);

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
            onClick={() => setActiveTab('maps')}
            className={`btn ${activeTab === 'maps' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '6px 14px', fontSize: '0.82rem' }}
          >
            <MapPin size={15} /> World &amp; Battle Maps ({playerMaps.length})
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
                  <div style={{ marginTop: '12px' }}>
                    <MarkdownView content={selectedNode.content_markdown} />
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

      {/* Tab 4: World & Battle Maps (Google Maps-Style Pan & Zoom for Players) */}
      {activeTab === 'maps' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Map Selector Strip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              overflowX: 'auto',
              padding: '8px 12px',
              background: 'var(--bg-surface)',
              borderRadius: '10px',
              border: '1px solid var(--border-medium)',
            }}
          >
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-gold)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ImageIcon size={15} /> Revealed Maps ({playerMaps.length}):
            </span>

            {playerMaps.length === 0 ? (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                No tactical battle maps or regional charts have been revealed by the Dungeon Master yet.
              </span>
            ) : (
              playerMaps.map((m) => {
                const isSelected = activePlayerMap?.id === m.id;
                const pinCount = (m.data_json?.pins || []).filter((p: any) => p.revealed !== false).length;
                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      setSelectedPlayerMapId(m.id);
                      setSelectedPlayerPin(null);
                      setMapScale(1);
                      setMapPan({ x: 0, y: 0 });
                    }}
                    className="glass-panel"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: isSelected ? '1px solid var(--color-gold)' : '1px solid var(--border-subtle)',
                      background: isSelected ? 'var(--color-amber-glow)' : 'var(--bg-card)',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {m.data_json?.map_url ? (
                      <img
                        src={m.data_json.map_url}
                        alt={m.title}
                        style={{ width: '24px', height: '24px', borderRadius: '4px', objectFit: 'cover' }}
                      />
                    ) : (
                      <Compass size={16} style={{ color: 'var(--color-gold)' }} />
                    )}
                    <span style={{ fontSize: '0.84rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--text-gold)' : 'var(--text-primary)' }}>
                      {m.title}
                    </span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        background: 'var(--bg-card-active)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      📍 {pinCount}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Interactive Player Map Viewport */}
          {playerMaps.length > 0 && activePlayerMap ? (
            <div
              ref={playerMapContainerRef}
              onMouseDown={(e) => {
                if (e.button !== 0) return;
                setIsDraggingPlayerMap(true);
                playerDidDragRef.current = false;
                playerDragStartRef.current = { x: e.clientX, y: e.clientY };
                playerPanStartRef.current = { ...mapPan };
              }}
              onMouseMove={(e) => {
                if (!isDraggingPlayerMap) return;
                const dx = e.clientX - playerDragStartRef.current.x;
                const dy = e.clientY - playerDragStartRef.current.y;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) playerDidDragRef.current = true;
                setMapPan({
                  x: playerPanStartRef.current.x + dx,
                  y: playerPanStartRef.current.y + dy,
                });
              }}
              onMouseUp={() => setIsDraggingPlayerMap(false)}
              onMouseLeave={() => setIsDraggingPlayerMap(false)}
              onWheel={(e) => {
                e.preventDefault();
                const rect = playerMapContainerRef.current?.getBoundingClientRect();
                if (!rect) return;
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
                const nextScale = Math.min(Math.max(mapScale * zoomFactor, 0.4), 25.0);
                const worldX = (mouseX - mapPan.x) / mapScale;
                const worldY = (mouseY - mapPan.y) / mapScale;
                setMapScale(nextScale);
                setMapPan({
                  x: mouseX - worldX * nextScale,
                  y: mouseY - worldY * nextScale,
                });
              }}
              onDoubleClick={(e) => {
                const rect = playerMapContainerRef.current?.getBoundingClientRect();
                if (!rect) return;
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                const nextScale = Math.min(mapScale * 1.5, 25.0);
                const worldX = (mouseX - mapPan.x) / mapScale;
                const worldY = (mouseY - mapPan.y) / mapScale;
                setMapScale(nextScale);
                setMapPan({
                  x: mouseX - worldX * nextScale,
                  y: mouseY - worldY * nextScale,
                });
              }}
              style={{
                position: 'relative',
                width: '100%',
                height: 'calc(100vh - 280px)',
                minHeight: '480px',
                background: '#090d15',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid var(--border-medium)',
                boxShadow: 'inset 0 0 40px rgba(0,0,0,0.85)',
                cursor: isDraggingPlayerMap ? 'grabbing' : 'grab',
                userSelect: 'none',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  transform: `translate(${mapPan.x}px, ${mapPan.y}px) scale(${mapScale})`,
                  transformOrigin: '0 0',
                  transition: isDraggingPlayerMap ? 'none' : 'transform 0.08s ease-out',
                }}
              >
                {playerMapUrl && (
                  <img
                    src={playerMapUrl}
                    alt={activePlayerMap.title}
                    draggable={false}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      pointerEvents: 'none',
                    }}
                  />
                )}

                {/* Revealed Pins Only */}
                {playerPins.map((pin: any) => {
                  const isSelected = selectedPlayerPin?.id === pin.id;
                  // Dynamic pin scale so pins don't blow up in size when zooming in deep on large maps
                  const pinScale = Math.max(0.4, Math.min(1.0, 1.2 / Math.sqrt(mapScale)));
                  const pinHeadColor = 'radial-gradient(circle at 35% 35%, #6ee7b7 0%, #10b981 50%, #047857 100%)';
                  const pinBorder = isSelected ? '1.5px solid #38bdf8' : '0.75px solid #000';

                  return (
                    <div
                      key={pin.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPlayerPin(pin);
                        const loc = graphData.nodes.find((n) => n.id === pin.nodeId);
                        if (loc) setSelectedNode(loc);
                      }}
                      style={{
                        position: 'absolute',
                        left: `${pin.x}%`,
                        top: `${pin.y}%`,
                        transform: `translate(-50%, -100%) scale(${pinScale})`,
                        transformOrigin: 'bottom center',
                        cursor: 'pointer',
                        zIndex: isSelected ? 28 : 20,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '8px 12px 0 12px',
                      }}
                    >
                      {/* Label on TOP of the pin so the map landmark remains visible underneath */}
                      <div
                        style={{
                          background: 'rgba(10, 15, 29, 0.92)',
                          backdropFilter: 'blur(6px)',
                          border: `1px solid ${isSelected ? '#38bdf8' : 'rgba(255,255,255,0.18)'}`,
                          borderRadius: '5px',
                          padding: '2px 7px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: isSelected ? '#38bdf8' : '#f8fafc',
                          whiteSpace: 'nowrap',
                          marginBottom: '3px',
                          boxShadow: '0 3px 10px rgba(0,0,0,0.7)',
                          letterSpacing: '0.02em',
                          pointerEvents: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {pin.targetMapId && <span title="Enter local map">🗺️</span>}
                        <span>{pin.label}</span>
                      </div>

                      {/* Stick-Pin Head (Spherical Bead) */}
                      <div
                        style={{
                          width: '13px',
                          height: '13px',
                          borderRadius: '50%',
                          background: pinHeadColor,
                          border: pinBorder,
                          boxShadow: isSelected
                            ? '0 0 16px rgba(56, 189, 248, 0.9), 0 3px 8px rgba(0,0,0,0.8)'
                            : '0 0 10px rgba(16, 185, 129, 0.6), 0 2px 6px rgba(0,0,0,0.7)',
                          position: 'relative',
                          zIndex: 2,
                        }}
                      />

                      {/* Stick-Pin Needle Shaft */}
                      <div
                        style={{
                          width: '2.5px',
                          height: '18px',
                          background: 'linear-gradient(to right, #94a3b8, #f8fafc, #64748b)',
                          boxShadow: '1px 1px 3px rgba(0,0,0,0.75)',
                          borderRadius: '1px 1px 0 0',
                          position: 'relative',
                          zIndex: 1,
                        }}
                      />

                      {/* Needle Tip Point directly on the location */}
                      <div
                        style={{
                          width: 0,
                          height: 0,
                          borderLeft: '1.5px solid transparent',
                          borderRight: '1.5px solid transparent',
                          borderTop: '5px solid #cbd5e1',
                          zIndex: 1,
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Floating Google Maps-Style Controls Widget */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '24px',
                  right: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  zIndex: 30,
                }}
              >
                <button
                  onClick={() => setMapScale((s) => Math.min(s * 1.25, 25.0))}
                  className="btn btn-secondary glass-panel"
                  style={{ width: '38px', height: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
                  title="Zoom In (+)"
                >
                  <ZoomIn size={18} />
                </button>
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.85)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '6px',
                    padding: '2px 4px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: 'var(--text-gold)',
                    textAlign: 'center',
                  }}
                >
                  {Math.round(mapScale * 100)}%
                </div>
                <button
                  onClick={() => setMapScale((s) => Math.max(s * 0.8, 0.4))}
                  className="btn btn-secondary glass-panel"
                  style={{ width: '38px', height: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
                  title="Zoom Out (-)"
                >
                  <ZoomOut size={18} />
                </button>
                <button
                  onClick={() => {
                    setMapScale(1);
                    setMapPan({ x: 0, y: 0 });
                  }}
                  className="btn btn-secondary glass-panel"
                  style={{ width: '38px', height: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
                  title="Reset Pan & Zoom"
                >
                  <RotateCcw size={17} />
                </button>
              </div>

              {/* Pin Detail Card for Players */}
              {selectedPlayerPin && (
                <div
                  className="glass-panel animate-fade-in"
                  style={{
                    position: 'absolute',
                    bottom: '20px',
                    left: '20px',
                    width: '320px',
                    borderRadius: '10px',
                    padding: '16px',
                    zIndex: 30,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
                    border: '1px solid #10b981',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span className="badge badge-location" style={{ borderColor: '#10b981', color: '#10b981' }}>Discovered Location</span>
                    <button
                      onClick={() => setSelectedPlayerPin(null)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                  <h4 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', margin: '4px 0' }}>{selectedPlayerPin.label}</h4>
                  {selectedNode && selectedNode.id === selectedPlayerPin.nodeId && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '6px 0 0 0', lineHeight: 1.5 }}>
                      {selectedNode.summary || selectedNode.subtitle || 'Known point of interest on the campaign map.'}
                    </p>
                  )}

                  {/* Launch Connected Map for Players */}
                  {selectedPlayerPin.targetMapId && (() => {
                    const targetMap = playerMaps.find((m) => m.id === selectedPlayerPin.targetMapId);
                    if (targetMap) {
                      return (
                        <button
                          onClick={() => {
                            setSelectedPlayerMapId(targetMap.id);
                            setSelectedPlayerPin(null);
                            setMapScale(1);
                            setMapPan({ x: 0, y: 0 });
                          }}
                          className="btn btn-primary"
                          style={{
                            width: '100%',
                            marginTop: '12px',
                            padding: '8px 12px',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                            boxShadow: '0 2px 10px rgba(16, 185, 129, 0.4)',
                            cursor: 'pointer',
                          }}
                        >
                          <Compass size={16} />
                          <span>Enter Map: {targetMap.title}</span>
                        </button>
                      );
                    } else {
                      return (
                        <div
                          style={{
                            marginTop: '10px',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            fontSize: '0.74rem',
                            color: '#fca5a5',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <span>🔒 Detailed tactical map is undiscovered or hidden by the DM.</span>
                        </div>
                      );
                    }
                  })()}
                </div>
              )}
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', borderRadius: '12px' }}>
              <ImageIcon size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 10px' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                No maps have been revealed to the party yet. When the DM shares a regional chart or battle grid, it will appear here.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
