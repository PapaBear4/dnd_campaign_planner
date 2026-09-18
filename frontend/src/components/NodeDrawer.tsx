import React, { useState, useEffect } from 'react';
import {
  Archive,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Feather,
  FileText,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { deleteNode, toggleNodeCanon, toggleNodeReveal, updateNode } from '../api';
import { NodeItem, EdgeItem, LoreStatus, NodeType } from '../types';

const ALL_NODE_TYPES: { value: NodeType; label: string }[] = [
  { value: 'location', label: 'Location' },
  { value: 'npc', label: 'NPC' },
  { value: 'monster', label: 'Monster' },
  { value: 'pc', label: 'PC' },
  { value: 'faction', label: 'Faction' },
  { value: 'item', label: 'Item' },
  { value: 'quest', label: 'Quest' },
  { value: 'arc', label: 'Arc' },
  { value: 'session', label: 'Session' },
  { value: 'encounter', label: 'Encounter' },
  { value: 'clue', label: 'Clue' },
  { value: 'lore', label: 'Lore' },
  { value: 'map', label: 'Map' },
  { value: 'campaign', label: 'Campaign' },
];
import {
  Alignment,
  CreatureRole,
  CreatureSize,
  CreatureType,
  format5eSubtitle,
  getCreatureAlignment,
  getCreatureRole,
  getCreature5eType,
} from '../utils/alignmentAndRoles';
import { MarkdownView } from './MarkdownView';

// Specialized Modal Views
import { LocationModal } from './nodeModals/LocationModal';
import { CreatureModal } from './nodeModals/CreatureModal';
import { TimelineModal } from './nodeModals/TimelineModal';
import { ItemModal } from './nodeModals/ItemModal';
import { FactionModal } from './nodeModals/FactionModal';
import { ClueLoreModal } from './nodeModals/ClueLoreModal';
import { MapModal } from './nodeModals/MapModal';

interface NodeDrawerProps {
  node: NodeItem | null;
  onClose: () => void;
  onRefresh: () => void;
  onFocusCoDM: (node: NodeItem) => void;
  isAgentOpen?: boolean;
  coDmWidth?: number;
  allNodes?: NodeItem[];
  edges?: EdgeItem[];
  onNavigateNode?: (targetNode: NodeItem) => void;
}

export const NodeDrawer: React.FC<NodeDrawerProps> = ({
  node,
  onClose,
  onRefresh,
  onFocusCoDM,
  allNodes = [],
  edges = [],
  onNavigateNode,
}) => {
  if (!node) return null;

  const [title, setTitle] = useState(node.title);
  const [nodeType, setNodeType] = useState<NodeType>(node.type);
  const [subtitle, setSubtitle] = useState(node.subtitle || '');
  const [summary, setSummary] = useState(node.summary || '');
  const [content, setContent] = useState(node.content_markdown || '');
  const [revealed, setRevealed] = useState(node.revealed_to_players);
  const [isCanon, setIsCanon] = useState<boolean>(node.is_canon ?? true);
  const [loreStatus, setLoreStatus] = useState<LoreStatus>(node.lore_status || 'fact');
  const [confidence, setConfidence] = useState<number>(node.confidence ?? 1.0);
  const [dataJson, setDataJson] = useState<Record<string, any>>(node.data_json || {});
  const [isSaving, setIsSaving] = useState(false);
  const [markdownTab, setMarkdownTab] = useState<'edit' | 'preview'>('edit');

  // 5e Classification State (for creature nodes)
  const [role, setRole] = useState<CreatureRole>(getCreatureRole(node));
  const [alignment, setAlignment] = useState<Alignment>(getCreatureAlignment(node));
  const [size, setSize] = useState<CreatureSize>(getCreature5eType(node).size);
  const [type, setType] = useState<CreatureType>(getCreature5eType(node).type);
  const [tag, setTag] = useState<string>(getCreature5eType(node).tag || '');

  const currentNode: NodeItem = { ...node, type: nodeType };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    setTitle(node.title);
    setNodeType(node.type);
    setSubtitle(node.subtitle || '');
    setSummary(node.summary || '');
    setContent(node.content_markdown || '');
    setRevealed(node.revealed_to_players);
    setIsCanon(node.is_canon ?? true);
    setLoreStatus(node.lore_status || 'fact');
    setConfidence(node.confidence ?? 1.0);
    setDataJson(node.data_json || {});

    setRole(getCreatureRole(node));
    setAlignment(getCreatureAlignment(node));
    const tInfo = getCreature5eType(node);
    setSize(tInfo.size);
    setType(tInfo.type);
    setTag(tInfo.tag || '');
    setMarkdownTab('edit');
  }, [node.id]);

  const handleToggleCanon = async () => {
    try {
      const updated = await toggleNodeCanon(node.id);
      setIsCanon(updated.is_canon ?? true);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleReveal = async () => {
    try {
      const updated = await toggleNodeReveal(node.id);
      setRevealed(updated.revealed_to_players);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleFastArchive = async () => {
    try {
      const nextData = { ...dataJson, status: 'archived' };
      setDataJson(nextData);
      await updateNode(node.id, { data_json: nextData });
      onRefresh();
    } catch (err) {
      console.error('Failed to archive node:', err);
      alert('Failed to archive node: ' + err);
    }
  };

  const handleFastRestore = async (targetStatus: string = 'active') => {
    try {
      const nextData = { ...dataJson, status: targetStatus };
      setDataJson(nextData);
      await updateNode(node.id, { data_json: nextData });
      onRefresh();
    } catch (err) {
      console.error('Failed to restore node:', err);
      alert('Failed to restore node: ' + err);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${node.title}"?`)) return;
    try {
      await deleteNode(node.id);
      onClose();
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSyncSubtitle = (
    newSize: CreatureSize = size,
    newType: CreatureType = type,
    newAlign: Alignment = alignment,
    newTag: string = tag
  ) => {
    const formatted = format5eSubtitle(newSize, newType, newAlign, newTag);
    setSubtitle(formatted);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let finalDataJson = { ...dataJson };
      if (['npc', 'monster', 'pc'].includes(nodeType)) {
        finalDataJson = {
          ...finalDataJson,
          role,
          alignment,
          creature_size: size,
          creature_type: type,
          creature_tag: tag || undefined,
        };
      }

      await updateNode(node.id, {
        type: nodeType,
        title,
        subtitle,
        summary,
        content_markdown: content,
        data_json: finalDataJson,
        revealed_to_players: revealed,
        is_canon: isCanon,
        confidence,
        lore_status: loreStatus,
      });
      setIsSaving(false);
      onRefresh();
      onClose();
    } catch (err) {
      console.error(err);
      setIsSaving(false);
      alert('Failed to save node changes');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(4, 7, 13, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
        padding: '24px',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel animate-scale-up"
        style={{
          width: '92vw',
          maxWidth: '1320px',
          height: '88vh',
          maxHeight: '920px',
          borderRadius: '16px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.75)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Mutable Type Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <select
                  value={nodeType}
                  onChange={(e) => setNodeType(e.target.value as NodeType)}
                  className={`badge badge-${nodeType}`}
                  title="Change Entity Type (preserves all edges, player notes, and references)"
                  style={{
                    fontSize: '0.8rem',
                    padding: '5px 26px 5px 12px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    cursor: 'pointer',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '6px',
                    background: 'var(--bg-surface)',
                    color: 'inherit',
                  }}
                >
                  {ALL_NODE_TYPES.map((t) => (
                    <option
                      key={t.value}
                      value={t.value}
                      style={{
                        background: '#0f172a',
                        color: '#f8fafc',
                        fontWeight: 600,
                        textTransform: 'none',
                      }}
                    >
                      {t.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    pointerEvents: 'none',
                    opacity: 0.7,
                  }}
                />
              </div>

              {nodeType !== node.type && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    color: '#38bdf8',
                    background: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: 600,
                  }}
                  title={`Entity will be reclassified from ${node.type} to ${nodeType} upon saving`}
                >
                  Type will change on Save
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  {title || node.title}
                </h2>
                {isCanon ? (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--color-gold)',
                      background: 'rgba(245, 158, 11, 0.15)',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <ShieldCheck size={12} /> Canon
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                      background: 'rgba(148, 163, 184, 0.1)',
                      border: '1px solid var(--border-subtle)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Feather size={12} /> Working Draft
                  </span>
                )}
              </div>
              {subtitle && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '2px' }}>
                  {subtitle}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleToggleReveal}
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              title={revealed ? 'Currently visible in Player Portal' : 'Hidden from players'}
            >
              {revealed ? <Eye size={15} style={{ color: 'var(--color-emerald)' }} /> : <EyeOff size={15} />}
              {revealed ? 'Revealed to Players' : 'Hidden Secret'}
            </button>

            {(currentNode.type === 'quest' || currentNode.type === 'encounter') && (
              dataJson.status === 'archived' ? (
                <button
                  type="button"
                  onClick={() => handleFastRestore('active')}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.78rem',
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#4ade80',
                    borderColor: 'rgba(74, 222, 128, 0.4)',
                  }}
                  title="Restore this node to the active campaign deck"
                >
                  <RotateCcw size={14} /> Restore to Active
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFastArchive}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.78rem',
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#c4b5fd',
                    borderColor: 'rgba(139, 92, 246, 0.4)',
                  }}
                  title="Archive this node to the Compendium Vault"
                >
                  <Archive size={14} /> Archive {currentNode.type === 'quest' ? 'Quest' : 'Encounter'}
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => {
                onFocusCoDM(node);
                onClose();
              }}
              className="btn btn-secondary"
              style={{
                fontSize: '0.78rem',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--color-gold)',
                borderColor: 'rgba(245, 158, 11, 0.3)',
              }}
              title="Brainstorm this node with Co-DM Studio"
            >
              <Sparkles size={15} /> Ask Co-DM
            </button>

            <button
              onClick={onClose}
              className="btn btn-ghost"
              style={{ padding: '8px', color: 'var(--text-secondary)' }}
              title="Close modal (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Content / Two-Column Layout */}
        <form
          onSubmit={handleSave}
          style={{
            display: 'flex',
            flex: 1,
            overflow: 'hidden',
          }}
        >
          {/* Left Column: Contextual Attributes & Node-Type-Specific Panels */}
          <div
            style={{
              width: '440px',
              minWidth: '400px',
              maxWidth: '480px',
              borderRight: '1px solid var(--border-subtle)',
              padding: '20px 22px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              background: 'rgba(0, 0, 0, 0.12)',
            }}
          >
            {/* Canon Status Card */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                background: isCanon ? 'rgba(245, 158, 11, 0.12)' : 'rgba(148, 163, 184, 0.08)',
                border: `1px solid ${isCanon ? 'rgba(245, 158, 11, 0.4)' : 'var(--border-subtle)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {isCanon ? (
                  <ShieldCheck size={20} style={{ color: 'var(--color-gold)', flexShrink: 0 }} />
                ) : (
                  <Feather size={20} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                )}
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isCanon ? 'var(--color-gold)' : 'var(--text-secondary)' }}>
                    {isCanon ? '🔒 Canon Lore (Protected)' : '📝 Working Draft (Provisional)'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {isCanon
                      ? 'Protected against automatic pruning or overwrite by Co-DM.'
                      : 'Provisional draft; editable and prunable by Co-DM.'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleCanon}
                className={`btn ${isCanon ? 'btn-ghost' : 'btn-secondary'}`}
                style={{ fontSize: '0.74rem', padding: '4px 10px', flexShrink: 0 }}
              >
                {isCanon ? 'Demote' : 'Promote'}
              </button>
            </div>

            {/* Epistemic Lore Status & Confidence */}
            <div
              style={{
                padding: '14px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-medium)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📜 Epistemic Status &amp; Certainty
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: loreStatus === 'fact' ? '#10b981' : loreStatus === 'suspicion' ? '#f59e0b' : '#ec4899',
                  }}
                >
                  {Math.round(confidence * 100)}% Certainty
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {(['fact', 'suspicion', 'rumor'] as const).map((s) => {
                  const active = loreStatus === s;
                  const meta = {
                    fact: { label: 'Fact', icon: '🔒', color: '#10b981', defaultConf: 1.0 },
                    suspicion: { label: 'Suspicion', icon: '🔍', color: '#f59e0b', defaultConf: 0.75 },
                    rumor: { label: 'Rumor', icon: '🗣️', color: '#ec4899', defaultConf: 0.4 },
                  }[s];
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setLoreStatus(s);
                        setConfidence(meta.defaultConf);
                      }}
                      className="btn"
                      style={{
                        padding: '6px 8px',
                        fontSize: '0.74rem',
                        fontWeight: active ? 700 : 500,
                        background: active ? `${meta.color}25` : 'rgba(255, 255, 255, 0.04)',
                        border: `1px solid ${active ? meta.color : 'var(--border-subtle)'}`,
                        color: active ? meta.color : 'var(--text-secondary)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>{meta.icon}</span>
                      <span>{meta.label}</span>
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Confidence:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={confidence}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setConfidence(val);
                    if (val >= 0.85) setLoreStatus('fact');
                    else if (val >= 0.55) setLoreStatus('suspicion');
                    else setLoreStatus('rumor');
                  }}
                  style={{ flex: 1, accentColor: 'var(--color-gold)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', width: '36px', textAlign: 'right', fontWeight: 600 }}>
                  {Math.round(confidence * 100)}%
                </span>
              </div>
            </div>

            {/* Summary & Quick Cues */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Summary &amp; Quick Cues
              </label>
              <textarea
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="1-2 sentences summarizing core role, appearance, or plot hooks..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* DYNAMIC NODE-SPECIFIC MODAL SECTION */}
            {nodeType === 'location' && (
              <LocationModal
                node={currentNode}
                campaignId={node.campaign_id}
                dataJson={dataJson}
                onChangeDataJson={setDataJson}
                allNodes={allNodes}
                edges={edges}
                onNavigateNode={onNavigateNode}
                onRefresh={onRefresh}
                onFocusCoDM={onFocusCoDM}
              />
            )}

            {['npc', 'monster', 'pc'].includes(nodeType) && (
              <CreatureModal
                node={currentNode}
                dataJson={dataJson}
                onChangeDataJson={setDataJson}
                role={role}
                setRole={setRole}
                alignment={alignment}
                setAlignment={setAlignment}
                size={size}
                setSize={setSize}
                type={type}
                setType={setType}
                tag={tag}
                setTag={setTag}
                onSyncSubtitle={handleSyncSubtitle}
              />
            )}

            {['arc', 'quest', 'session', 'encounter', 'campaign'].includes(nodeType) && (
              <TimelineModal
                node={currentNode}
                campaignId={node.campaign_id}
                dataJson={dataJson}
                onChangeDataJson={setDataJson}
                allNodes={allNodes}
                edges={edges}
                onNavigateNode={onNavigateNode}
              />
            )}

            {nodeType === 'item' && (
              <ItemModal
                node={currentNode}
                dataJson={dataJson}
                onChangeDataJson={setDataJson}
              />
            )}

            {nodeType === 'faction' && (
              <FactionModal
                node={currentNode}
                dataJson={dataJson}
                onChangeDataJson={setDataJson}
              />
            )}

            {(nodeType === 'clue' || nodeType === 'lore') && (
              <ClueLoreModal
                node={currentNode}
                dataJson={dataJson}
                onChangeDataJson={setDataJson}
              />
            )}

            {nodeType === 'map' && (
              <MapModal
                node={currentNode}
                dataJson={dataJson}
                onChangeDataJson={setDataJson}
              />
            )}
          </div>

          {/* Right Column: Title, Subtitle, Markdown Canvas with Tabs */}
          <div
            style={{
              flex: 1,
              padding: '20px 28px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Title & Subtitle Header Controls */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Entity Title / Name
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '1.15rem',
                    fontWeight: 800,
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Subtitle / Epithet
                  </label>
                  {['npc', 'monster', 'pc'].includes(nodeType) && (
                    <button
                      type="button"
                      onClick={() => handleSyncSubtitle()}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '0.68rem',
                        color: 'var(--color-gold)',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                      title="Format subtitle using current 5e classification"
                    >
                      Sync 5e Format
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="e.g. Master Thief, Ancient Basalt Archway"
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Markdown Editor / Preview Container */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minHeight: '380px',
                borderRadius: '10px',
                border: '1px solid var(--border-medium)',
                overflow: 'hidden',
                background: 'rgba(0, 0, 0, 0.15)',
              }}
            >
              {/* Tab Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 14px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setMarkdownTab('edit')}
                    className="btn"
                    style={{
                      padding: '4px 12px',
                      fontSize: '0.76rem',
                      fontWeight: markdownTab === 'edit' ? 700 : 500,
                      background: markdownTab === 'edit' ? 'var(--bg-card-active)' : 'transparent',
                      border: `1px solid ${markdownTab === 'edit' ? 'var(--color-gold)' : 'transparent'}`,
                      color: markdownTab === 'edit' ? 'var(--color-gold)' : 'var(--text-secondary)',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <FileText size={13} /> Edit Markdown
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarkdownTab('preview')}
                    className="btn"
                    style={{
                      padding: '4px 12px',
                      fontSize: '0.76rem',
                      fontWeight: markdownTab === 'preview' ? 700 : 500,
                      background: markdownTab === 'preview' ? 'var(--bg-card-active)' : 'transparent',
                      border: `1px solid ${markdownTab === 'preview' ? 'var(--color-gold)' : 'transparent'}`,
                      color: markdownTab === 'preview' ? 'var(--color-gold)' : 'var(--text-secondary)',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <Eye size={13} /> Rendered Preview
                  </button>
                </div>

                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Supports full GitHub Flavored Markdown &amp; 5e Statblocks
                </span>
              </div>

              {/* Editor or Preview */}
              {markdownTab === 'edit' ? (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter full DM secrets, lore history, read-aloud boxed text, statblock traits, inventory..."
                  style={{
                    flex: 1,
                    width: '100%',
                    padding: '16px',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.88rem',
                    lineHeight: 1.65,
                    resize: 'none',
                  }}
                />
              ) : (
                <div
                  style={{
                    flex: 1,
                    padding: '18px 22px',
                    overflowY: 'auto',
                    background: 'transparent',
                  }}
                >
                  {content ? (
                    <MarkdownView content={content} />
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px', textAlign: 'center' }}>
                      No markdown content written yet. Switch to &quot;Edit Markdown&quot; to add descriptions, secrets, and statblock details.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'rgba(255, 255, 255, 0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            type="button"
            onClick={handleDelete}
            className="btn btn-ghost"
            style={{ color: 'var(--color-crimson)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
            title="Delete this node permanently"
          >
            <Trash2 size={16} /> Delete Entity
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: '8px 18px', fontSize: '0.85rem' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="btn btn-primary"
              style={{ padding: '8px 22px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Save size={16} /> {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NodeDrawer;
