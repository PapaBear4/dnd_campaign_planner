import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Check,
  Eye,
  EyeOff,
  FileText,
  Save,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { deleteNode, toggleNodeReveal, updateNode } from '../api';
import { NodeItem, NodeType } from '../types';

interface NodeDrawerProps {
  node: NodeItem | null;
  onClose: () => void;
  onRefresh: () => void;
  onFocusCoDM: (node: NodeItem) => void;
}

export const NodeDrawer: React.FC<NodeDrawerProps> = ({
  node,
  onClose,
  onRefresh,
  onFocusCoDM,
}) => {
  if (!node) return null;

  const [title, setTitle] = useState(node.title);
  const [subtitle, setSubtitle] = useState(node.subtitle || '');
  const [summary, setSummary] = useState(node.summary || '');
  const [content, setContent] = useState(node.content_markdown || '');
  const [revealed, setRevealed] = useState(node.revealed_to_players);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setTitle(node.title);
    setSubtitle(node.subtitle || '');
    setSummary(node.summary || '');
    setContent(node.content_markdown || '');
    setRevealed(node.revealed_to_players);
  }, [node.id]);

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
      });
      setIsSaving(false);
      onRefresh();
    } catch (err) {
      console.error(err);
      setIsSaving(false);
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
    if (window.confirm(`Delete "${node.title}" from campaign?`)) {
      await deleteNode(node.id);
      onClose();
      onRefresh();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 8, 14, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 250,
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          width: '540px',
          maxWidth: '100vw',
          height: '100%',
          overflowY: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-10px 0 40px rgba(0,0,0,0.8)',
          borderLeft: '1px solid var(--border-medium)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={`badge badge-${node.type}`}>{node.type}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Node Inspector</span>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }}>
            <X size={18} />
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
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: '#fff',
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
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: '#fff',
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
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: '#fff',
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
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: '#fff',
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
                {revealed ? <Eye size={14} style={{ color: '#10b981' }} /> : <EyeOff size={14} />}
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
