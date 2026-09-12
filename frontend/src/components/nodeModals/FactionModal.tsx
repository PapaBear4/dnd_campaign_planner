import React from 'react';
import { Flag, Users, Shield, MapPin, Target } from 'lucide-react';
import { NodeItem } from '../../types';

interface FactionModalProps {
  node: NodeItem;
  dataJson: Record<string, any>;
  onChangeDataJson: (updated: Record<string, any>) => void;
}

const FACTION_SCOPES = ['Local Settlement', 'City-Wide Guild', 'Regional Power', 'Continental Empire', 'Planar Cabal'];
const PARTY_DISPOSITIONS = [
  { value: 'hostile', label: 'Hostile / Sworn Enemy', color: '#ef4444' },
  { value: 'suspicious', label: 'Suspicious / Cold', color: '#f59e0b' },
  { value: 'neutral', label: 'Neutral / Business-Only', color: 'var(--text-secondary)' },
  { value: 'friendly', label: 'Friendly / Cordial', color: '#38bdf8' },
  { value: 'allied', label: 'Allied / Patron Guild', color: '#10b981' },
];

export const FactionModal: React.FC<FactionModalProps> = ({ dataJson, onChangeDataJson }) => {
  const curDisp = dataJson.party_disposition || 'neutral';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div
        style={{
          padding: '14px',
          borderRadius: '10px',
          background: 'rgba(234, 179, 8, 0.05)',
          border: '1px solid rgba(234, 179, 8, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#facc15', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Flag size={15} /> Faction Scope &amp; Party Standing
        </span>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Organizational Scope
            </label>
            <select
              value={dataJson.scope || 'Regional Power'}
              onChange={(e) => onChangeDataJson({ ...dataJson, scope: e.target.value })}
              className="input"
              style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
            >
              {FACTION_SCOPES.map((sc) => (
                <option key={sc} value={sc}>
                  {sc}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Headquarters / Seat of Power
            </label>
            <input
              type="text"
              placeholder="e.g. Citadel of the Mists or Neverwinter"
              value={dataJson.headquarters || ''}
              onChange={(e) => onChangeDataJson({ ...dataJson, headquarters: e.target.value })}
              className="input"
              style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
            />
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
            Current Party Standing / Renown
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {PARTY_DISPOSITIONS.map((disp) => {
              const active = curDisp === disp.value;
              return (
                <button
                  key={disp.value}
                  type="button"
                  onClick={() => onChangeDataJson({ ...dataJson, party_disposition: disp.value })}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: active ? 700 : 500,
                    background: active ? `${disp.color}25` : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${active ? disp.color : 'var(--border-subtle)'}`,
                    color: active ? disp.color : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {disp.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
