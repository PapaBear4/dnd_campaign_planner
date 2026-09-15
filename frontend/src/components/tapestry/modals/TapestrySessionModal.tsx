import React from 'react';
import { BookOpen, Mic, Trash2, X } from 'lucide-react';
import { NodeItem } from '../../../types';

interface TapestrySessionModalProps {
  session: NodeItem;
  onClose: () => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onSelectNode: (node: NodeItem) => void;
  onOpenRunSheet: (session: NodeItem) => void;
  onNavigateToTranscript?: (sessionNodeId?: string) => void;
}

export const TapestrySessionModal: React.FC<TapestrySessionModalProps> = ({
  session,
  onClose,
  onDelete,
  onSelectNode,
  onOpenRunSheet,
  onNavigateToTranscript,
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
              Game Session Dossier
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '4px 0' }}>{session.title}</h2>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={(e) => onDelete(e, session.id)}
              className="btn btn-ghost"
              style={{ padding: '6px', color: 'var(--color-crimson)' }}
              title="Delete session"
            >
              <Trash2 size={16} />
            </button>
            <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {session.summary && (
          <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.5 }}>{session.summary}</p>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          {onNavigateToTranscript && (
            <button
              onClick={() => {
                onNavigateToTranscript(session.id);
                onClose();
              }}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', color: 'var(--color-arcane-blue-text)', borderColor: 'var(--color-arcane-blue-border)' }}
            >
              <Mic size={14} /> Ingest Audio Transcript
            </button>
          )}
          <button
            onClick={() => {
              onOpenRunSheet(session);
              onClose();
            }}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', color: 'var(--color-gold)', borderColor: 'rgba(245, 158, 11, 0.4)' }}
          >
            <BookOpen size={14} /> Open Run-Sheet
          </button>
          <button
            onClick={() => {
              onSelectNode(session);
              onClose();
            }}
            className="btn btn-primary"
            style={{ fontSize: '0.8rem' }}
          >
            Inspect Session
          </button>
        </div>
      </div>
    </div>
  );
};
