import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Check,
  Eye,
  EyeOff,
  Feather,
  FileText,
  Save,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { deleteNode, toggleNodeCanon, toggleNodeReveal, updateNode } from '../api';
import { NodeItem, NodeType } from '../types';

interface NodeDrawerProps {
  node: NodeItem | null;
  onClose: () => void;
  onRefresh: () => void;
  onFocusCoDM: (node: NodeItem) => void;
  isAgentOpen?: boolean;
  coDmWidth?: number;
}

export const NodeDrawer: React.FC<NodeDrawerProps> = ({
  node,
  onClose,
  onRefresh,
  onFocusCoDM,
  isAgentOpen = false,
  coDmWidth = 420,
}) => {
  if (!node) return null;

  const [title, setTitle] = useState(node.title);
  const [subtitle, setSubtitle] = useState(node.subtitle || '');
  const [summary, setSummary] = useState(node.summary || '');
  const [content, setContent] = useState(node.content_markdown || '');
  const [revealed, setRevealed] = useState(node.revealed_to_players);
  const [isCanon, setIsCanon] = useState<boolean>(node.is_canon ?? true);
  const [isSaving, setIsSaving] = useState(false);

  // When Co-DM is open, dock on the other (left) side so it doesn't collide
  const [dockSide, setDockSide] = useState<'left' | 'right'>('left');

  useEffect(() => {
    if (isAgentOpen) {
      setDockSide('left');
    }
  }, [isAgentOpen]);

  useEffect(() => {
    setTitle(node.title);
    setSubtitle(node.subtitle || '');
    setSummary(node.summary || '');
    setContent(node.content_markdown || '');
    setRevealed(node.revealed_to_players);
    setIsCanon(node.is_canon ?? true);
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateNode(node.id, {
        title,
        subtitle,
        summary,
        content_markdown: content,
        revealed_to_players: revealed,
        is_canon: isCanon,
      });
      setIsSaving(false);
      onRefresh();
    } catch (err) {
      console.error(err);
      setIsSaving(false);
      alert('Failed to save node changes');
    }
  };

  const isLeft = dockSide === 'left';

  return (
    <div
      style={{
        position: 'fixed',
        top: '64px',
        bottom: 0,
        left: 0,
        right: isAgentOpen && isLeft ? `${coDmWidth}px` : 0,
        background: 'rgba(5, 8, 14, 0.4)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        justifyContent: isLeft ? 'flex-start' : 'flex-end',
        zIndex: 150,
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          width: '520px',
          maxWidth: '100%',
          height: '100%',
          overflowY: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: isLeft ? '10px 0 35px rgba(0,0,0,0.5)' : '-10px 0 35px rgba(0,0,0,0.5)',
          borderRight: isLeft ? '1px solid var(--border-medium)' : 'none',
          borderLeft: !isLeft ? '1px solid var(--border-medium)' : 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={`badge badge-${node.type}`}>{node.type}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Entity Details</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setDockSide(isLeft ? 'right' : 'left')}
              className="btn btn-ghost"
              style={{ fontSize: '0.72rem', padding: '3px 8px', color: 'var(--text-secondary)' }}
              title={`Dock to ${isLeft ? 'right' : 'left'} side`}
            >
              {isLeft ? 'Dock Right ⇥' : '⇤ Dock Left'}
            </button>
            <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Canon Status Card */}
        <div
          style={{
            marginBottom: '14px',
            padding: '10px 14px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            background: isCanon ? 'rgba(245, 158, 11, 0.12)' : 'rgba(148, 163, 184, 0.1)',
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
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {isCanon
                  ? 'Co-DM cannot delete or merge away this node without explicit DM approval.'
                  : 'Provisional draft; editable and prunable by Co-DM during brainstorming.'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleCanon}
            className={`btn ${isCanon ? 'btn-ghost' : 'btn-secondary'}`}
            style={{ fontSize: '0.74rem', padding: '4px 10px', flexShrink: 0 }}
          >
            {isCanon ? 'Demote to Draft' : 'Promote to Canon'}
          </button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '1.05rem',
                fontWeight: 700,
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Subtitle / Epithet
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="e.g. Master Thief, Ancient Basalt Archway"
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Summary &amp; Quick Cues
            </label>
            <textarea
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="1-2 sentences summarizing appearance, role, or core plot hook..."
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Full Details, Secrets, or Boxed Text (Markdown)
            </label>
            <textarea
              rows={10}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Full DM secrets, read-aloud descriptions, statblock details..."
              style={{
                width: '100%',
                flex: 1,
                padding: '10px 12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.82rem',
                lineHeight: 1.6,
                outline: 'none',
              }}
            />
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={handleToggleReveal}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              >
                {revealed ? <Eye size={14} style={{ color: 'var(--color-emerald)' }} /> : <EyeOff size={14} />}
                {revealed ? 'Revealed to Players' : 'Hidden Secret'}
              </button>
              <button
                type="button"
                onClick={() => onFocusCoDM(node)}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                title="Brainstorm this node with Co-DM"
              >
                <Sparkles size={14} style={{ color: 'var(--color-gold)' }} /> Ask Co-DM
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={handleDelete}
                className="btn btn-ghost"
                style={{ color: 'var(--color-crimson)', padding: '6px 10px' }}
                title="Delete Node"
              >
                <Trash2 size={16} />
              </button>
              <button type="submit" disabled={isSaving} className="btn btn-primary" style={{ padding: '6px 16px' }}>
                <Save size={15} /> Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
