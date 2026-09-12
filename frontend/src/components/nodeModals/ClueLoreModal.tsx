import React from 'react';
import { Eye, Key, HelpCircle, FileText, Compass } from 'lucide-react';
import { NodeItem } from '../../types';

interface ClueLoreModalProps {
  node: NodeItem;
  dataJson: Record<string, any>;
  onChangeDataJson: (updated: Record<string, any>) => void;
}

const DISCOVERY_STATES = [
  { value: 'unrevealed', label: 'Hidden Secret (DM Only)', color: 'var(--text-muted)' },
  { value: 'rumored', label: 'Tavern Rumor / Foreshadowed', color: '#f59e0b' },
  { value: 'discovered', label: 'Discovered by Party', color: '#10b981' },
];

export const ClueLoreModal: React.FC<ClueLoreModalProps> = ({ dataJson, onChangeDataJson }) => {
  const curState = dataJson.discovery_state || 'unrevealed';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div
        style={{
          padding: '14px',
          borderRadius: '10px',
          background: 'rgba(139, 92, 246, 0.05)',
          border: '1px solid rgba(139, 92, 246, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Key size={15} /> Secret &amp; Clue Discovery State
        </span>

        <div>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
            Party Discovery Status
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {DISCOVERY_STATES.map((st) => {
              const active = curState === st.value;
              return (
                <button
                  key={st.value}
                  type="button"
                  onClick={() => onChangeDataJson({ ...dataJson, discovery_state: st.value })}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: active ? 700 : 500,
                    background: active ? `${st.color}25` : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${active ? st.color : 'var(--border-subtle)'}`,
                    color: active ? st.color : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {st.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Associated Mystery or Target Node
            </label>
            <input
              type="text"
              placeholder="e.g. Identity of the Night Caller"
              value={dataJson.mystery_title || ''}
              onChange={(e) => onChangeDataJson({ ...dataJson, mystery_title: e.target.value })}
              className="input"
              style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Source Location / Keyed Bearer
            </label>
            <input
              type="text"
              placeholder="e.g. Inscribed on Area 3 altar or Meepo's diary"
              value={dataJson.source_info || ''}
              onChange={(e) => onChangeDataJson({ ...dataJson, source_info: e.target.value })}
              className="input"
              style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
