import React from 'react';
import { NodeItem } from '../../../types';

interface TapestryEntityModalProps {
  entity: NodeItem;
  onClose: () => void;
  onSelectNode: (node: NodeItem) => void;
}

export const TapestryEntityModal: React.FC<TapestryEntityModalProps> = ({
  entity,
  onClose,
  onSelectNode,
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(4, 7, 13, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
        padding: '24px'
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '440px',
          borderRadius: '14px',
          padding: '24px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span className={`badge badge-${entity.type}`}>{entity.type.toUpperCase()}</span>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Graph Edge Connection</span>
        </div>

        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 4px' }}>{entity.title}</h3>
        {entity.subtitle && (
          <p style={{ fontSize: '0.8rem', color: 'var(--color-gold)', margin: '0 0 14px' }}>
            {entity.subtitle}
          </p>
        )}

        {entity.summary && (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
            {entity.summary}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={() => {
              onSelectNode(entity);
              onClose();
            }}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem' }}
          >
            Inspect in Codex
          </button>
          <button onClick={onClose} className="btn btn-primary" style={{ fontSize: '0.8rem' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
