import React from 'react';
import { Trash2, X } from 'lucide-react';
import { NodeItem } from '../../../types';

interface TapestryArcModalProps {
  arc: NodeItem;
  onClose: () => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
}

export const TapestryArcModal: React.FC<TapestryArcModalProps> = ({
  arc,
  onClose,
  onDelete,
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
          maxWidth: '540px',
          borderRadius: '16px',
          padding: '26px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--color-gold)', textTransform: 'uppercase' }}>
              Campaign Arc Milestone
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '4px 0' }}>{arc.title}</h2>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={(e) => onDelete(e, arc.id)}
              className="btn btn-ghost"
              style={{ padding: '6px', color: 'var(--color-crimson)' }}
              title="Delete arc"
            >
              <Trash2 size={16} />
            </button>
            <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {arc.summary && (
          <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--text-primary)' }}>
            {arc.summary}
          </p>
        )}
      </div>
    </div>
  );
};
