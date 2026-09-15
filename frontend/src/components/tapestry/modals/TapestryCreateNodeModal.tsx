import React from 'react';
import { NodeType } from '../../../types';

interface TapestryCreateNodeModalProps {
  type: NodeType;
  title: string;
  summary: string;
  onChangeTitle: (title: string) => void;
  onChangeSummary: (summary: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export const TapestryCreateNodeModal: React.FC<TapestryCreateNodeModalProps> = ({
  type,
  title,
  summary,
  onChangeTitle,
  onChangeSummary,
  onSubmit,
  onClose,
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 8, 14, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '480px',
          borderRadius: '14px',
          padding: '24px',
          border: '1px solid var(--border-medium)',
          background: 'var(--bg-surface)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontSize: '1.2rem', marginBottom: '4px', textTransform: 'capitalize' }}>
          Add New {type}
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          {type === 'arc' && 'An overarching milestone act framing several sessions.'}
          {type === 'quest' && 'A player narrative objective that runs across sessions.'}
          {type === 'session' && 'A real-world game night with prep notes.'}
          {type === 'encounter' && 'A specific dramatic beat or combat scene connecting a quest to a session.'}
        </p>

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
              Title
            </label>
            <input
              type="text"
              required
              placeholder={`Enter ${type} title...`}
              value={title}
              onChange={(e) => onChangeTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
              Summary / Synopsis
            </label>
            <textarea
              rows={3}
              placeholder="Key objectives, DM hooks, or scene description..."
              value={summary}
              onChange={(e) => onChangeSummary(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create {type}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
