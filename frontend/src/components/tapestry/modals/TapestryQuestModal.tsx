import React from 'react';
import { Sparkles, Trash2, X } from 'lucide-react';
import { NodeItem } from '../../../types';

interface TapestryQuestModalProps {
  quest: NodeItem;
  onClose: () => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onSelectNode: (node: NodeItem) => void;
  onFocusCoDM: (node: NodeItem) => void;
}

export const TapestryQuestModal: React.FC<TapestryQuestModalProps> = ({
  quest,
  onClose,
  onDelete,
  onSelectNode,
  onFocusCoDM,
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(4, 7, 13, 0.82)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '24px'
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '580px',
          borderRadius: '16px',
          padding: '26px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--color-gold)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--color-gold)', textTransform: 'uppercase' }}>
              Quest Line Dossier
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '4px 0' }}>{quest.title}</h2>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={(e) => onDelete(e, quest.id)}
              className="btn btn-ghost"
              style={{ padding: '6px', color: 'var(--color-crimson)' }}
              title="Delete quest"
            >
              <Trash2 size={16} />
            </button>
            <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {quest.summary && (
          <p style={{ margin: '0 0 16px', fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            {quest.summary}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={() => {
              onSelectNode(quest);
              onClose();
            }}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem' }}
          >
            Open Full Codex Drawer
          </button>
          <button
            onClick={() => {
              onFocusCoDM(quest);
              onClose();
            }}
            className="btn btn-primary"
            style={{ fontSize: '0.8rem' }}
          >
            <Sparkles size={14} /> Brainstorm in Co-DM
          </button>
        </div>
      </div>
    </div>
  );
};
