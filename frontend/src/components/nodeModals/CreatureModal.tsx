import React, { useState } from 'react';
import {
  Swords,
  Shield,
  Heart,
  Zap,
  Activity,
  User,
  Users,
  Eye,
  Feather,
  Sparkles,
} from 'lucide-react';
import { NodeItem } from '../../types';
import {
  Alignment,
  CreatureRole,
  CreatureSize,
  CreatureType,
  CREATURE_SIZES,
  CREATURE_TYPES,
  CREATURE_ROLES,
  format5eSubtitle,
} from '../../utils/alignmentAndRoles';
import {
  AlignmentBadge,
  AlignmentMatrixSelector,
  RolePill,
} from '../AlignmentSelector';

interface CreatureModalProps {
  node: NodeItem;
  dataJson: Record<string, any>;
  onChangeDataJson: (updated: Record<string, any>) => void;
  role: CreatureRole;
  setRole: (r: CreatureRole) => void;
  alignment: Alignment;
  setAlignment: (a: Alignment) => void;
  size: CreatureSize;
  setSize: (s: CreatureSize) => void;
  type: CreatureType;
  setType: (t: CreatureType) => void;
  tag: string;
  setTag: (tag: string) => void;
  onSyncSubtitle: (s: CreatureSize, t: CreatureType, a: Alignment, tag: string) => void;
}

const STAT_NAMES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;

export const CreatureModal: React.FC<CreatureModalProps> = ({
  node,
  dataJson,
  onChangeDataJson,
  role,
  setRole,
  alignment,
  setAlignment,
  size,
  setSize,
  type,
  setType,
  tag,
  setTag,
  onSyncSubtitle,
}) => {
  const [showMatrix, setShowMatrix] = useState(true);

  const stats = dataJson.stats || {
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
  };

  const getMod = (score: number) => {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  const handleStatChange = (key: string, val: number) => {
    const updatedStats = { ...stats, [key.toLowerCase()]: val };
    onChangeDataJson({ ...dataJson, stats: updatedStats });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 5e Role & Alignment Matrix */}
      <div
        style={{
          padding: '14px',
          borderRadius: '10px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-medium)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Swords size={15} /> 5e Role &amp; Alignment Matrix
          </span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <RolePill role={role} size="sm" />
            <AlignmentBadge alignment={alignment} size="sm" />
          </div>
        </div>

        {/* Role selection */}
        <div>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
            Tactical / Narrative Role:
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {(Object.keys(CREATURE_ROLES) as CreatureRole[]).map((rKey) => {
              const r = CREATURE_ROLES[rKey];
              return (
                <button
                  key={rKey}
                  type="button"
                  onClick={() => setRole(rKey)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: role === rKey ? 700 : 500,
                    background: role === rKey ? `${r.color}25` : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${role === rKey ? r.color : 'var(--border-subtle)'}`,
                    color: role === rKey ? r.color : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Alignment Matrix */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              Moral &amp; Ethical Alignment:
            </label>
            <button
              type="button"
              onClick={() => setShowMatrix(!showMatrix)}
              className="btn btn-ghost"
              style={{ fontSize: '0.7rem', padding: '2px 6px', color: 'var(--color-gold)' }}
            >
              {showMatrix ? 'Compact' : 'Show 3x3 Matrix'}
            </button>
          </div>
          {showMatrix ? (
            <AlignmentMatrixSelector
              value={alignment}
              onChange={(newAlign) => {
                setAlignment(newAlign);
                onSyncSubtitle(size, type, newAlign, tag);
              }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlignmentBadge alignment={alignment} size="md" />
            </div>
          )}
        </div>
      </div>

      {/* 5e Type & Size Classification */}
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
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Activity size={15} /> 5e Anatomy &amp; Classification
        </span>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Size
            </label>
            <select
              value={size}
              onChange={(e) => {
                const newSize = e.target.value as CreatureSize;
                setSize(newSize);
                onSyncSubtitle(newSize, type, alignment, tag);
              }}
              className="input"
              style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
            >
              {CREATURE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Creature Type
            </label>
            <select
              value={type}
              onChange={(e) => {
                const newType = e.target.value as CreatureType;
                setType(newType);
                onSyncSubtitle(size, newType, alignment, tag);
              }}
              className="input"
              style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
            >
              {CREATURE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
            Subtype / Tag (optional, e.g. goblinoid, shapechanger)
          </label>
          <input
            type="text"
            placeholder="e.g. elf, demon, titan"
            value={tag}
            onChange={(e) => {
              const newTag = e.target.value;
              setTag(newTag);
              onSyncSubtitle(size, type, alignment, newTag);
            }}
            className="input"
            style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
          />
        </div>
      </div>

      {/* 5e Combat Profile: AC, HP, Speed, CR */}
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
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Shield size={15} /> Combat Profile &amp; Defense
        </span>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
              AC
            </label>
            <input
              type="number"
              placeholder="10"
              value={dataJson.ac ?? ''}
              onChange={(e) => onChangeDataJson({ ...dataJson, ac: e.target.value ? parseInt(e.target.value) : '' })}
              className="input"
              style={{ width: '100%', fontSize: '0.82rem', padding: '6px', textAlign: 'center', fontWeight: 700 }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
              HP
            </label>
            <input
              type="number"
              placeholder="10"
              value={dataJson.hp ?? ''}
              onChange={(e) => onChangeDataJson({ ...dataJson, hp: e.target.value ? parseInt(e.target.value) : '' })}
              className="input"
              style={{ width: '100%', fontSize: '0.82rem', padding: '6px', textAlign: 'center', fontWeight: 700 }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
              Speed
            </label>
            <input
              type="text"
              placeholder="30 ft."
              value={dataJson.speed || ''}
              onChange={(e) => onChangeDataJson({ ...dataJson, speed: e.target.value })}
              className="input"
              style={{ width: '100%', fontSize: '0.78rem', padding: '6px', textAlign: 'center' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
              CR / Level
            </label>
            <input
              type="text"
              placeholder="1/4 or 3"
              value={dataJson.cr || dataJson.level || ''}
              onChange={(e) => onChangeDataJson({ ...dataJson, cr: e.target.value })}
              className="input"
              style={{ width: '100%', fontSize: '0.82rem', padding: '6px', textAlign: 'center', fontWeight: 700 }}
            />
          </div>
        </div>
      </div>

      {/* Six Ability Scores */}
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
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Zap size={15} /> Ability Scores
        </span>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
          {STAT_NAMES.map((st) => {
            const key = st.toLowerCase();
            const val = stats[key] ?? 10;
            return (
              <div
                key={st}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '6px 4px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{st}</span>
                <input
                  type="number"
                  value={val}
                  onChange={(e) => handleStatChange(key, parseInt(e.target.value) || 10)}
                  style={{
                    width: '38px',
                    textAlign: 'center',
                    background: 'transparent',
                    border: 'none',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    marginTop: '2px',
                  }}
                />
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: 'var(--color-gold)',
                    marginTop: '2px',
                  }}
                >
                  {getMod(val)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
