import React, { useState } from 'react';
import {
  ALIGNMENTS,
  ALIGNMENT_MATRIX,
  SPECIAL_ALIGNMENTS,
  Alignment,
  CREATURE_ROLES,
  CreatureRole,
  CREATURE_SIZES,
  CREATURE_TYPES,
  CreatureSize,
  CreatureType,
} from '../utils/alignmentAndRoles';

// ---------------------------------------------------------------------------
// Alignment Badge Component
// ---------------------------------------------------------------------------
interface AlignmentBadgeProps {
  alignment: Alignment;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const AlignmentBadge: React.FC<AlignmentBadgeProps> = ({
  alignment,
  size = 'md',
  showIcon = true,
  interactive = false,
  onClick,
  style,
}) => {
  const meta = ALIGNMENTS[alignment] || ALIGNMENTS.any;

  const paddingMap = {
    sm: '2px 6px',
    md: '3px 8px',
    lg: '5px 12px',
  };

  const fontSizeMap = {
    sm: '0.65rem',
    md: '0.74rem',
    lg: '0.85rem',
  };

  return (
    <span
      onClick={onClick}
      title={`${meta.label} — ${meta.tagline}\n${meta.description}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size === 'sm' ? '3px' : '5px',
        padding: paddingMap[size],
        fontSize: fontSizeMap[size],
        fontWeight: 600,
        borderRadius: '999px',
        background: meta.bgGlow,
        border: `1px solid ${meta.border}`,
        color: meta.textColor,
        cursor: interactive || onClick ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {showIcon && <span>{meta.icon}</span>}
      <span>{meta.label}</span>
      {size === 'lg' && (
        <span style={{ fontSize: '0.7rem', opacity: 0.8, fontWeight: 400 }}>
          ({meta.abbr})
        </span>
      )}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Interactive 3x3 Alignment Matrix Selector
// ---------------------------------------------------------------------------
interface AlignmentMatrixSelectorProps {
  value: Alignment;
  onChange: (val: Alignment) => void;
  compact?: boolean;
}

export const AlignmentMatrixSelector: React.FC<AlignmentMatrixSelectorProps> = ({
  value,
  onChange,
  compact = false,
}) => {
  const [hoveredAlignment, setHoveredAlignment] = useState<Alignment | null>(null);

  const activeMeta = ALIGNMENTS[hoveredAlignment || value] || ALIGNMENTS.any;

  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(10px)',
        border: '1px solid var(--border-medium)',
        borderRadius: '12px',
        padding: compact ? '10px' : '14px',
        maxWidth: compact ? '320px' : '380px',
        width: '100%',
        boxShadow: '0 12px 30px rgba(0,0,0,0.45)',
      }}
    >
      {/* Header / Current selection cue */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px',
          paddingBottom: '8px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '1rem' }}>{activeMeta.icon}</span>
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: activeMeta.color }}>
              {activeMeta.label} ({activeMeta.abbr})
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {activeMeta.tagline}
            </div>
          </div>
        </div>
        <AlignmentBadge alignment={value} size="sm" />
      </div>

      {/* Column Headers: Lawful, Neutral, Chaotic */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '4px',
          textAlign: 'center',
          fontSize: '0.68rem',
          fontWeight: 700,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '4px',
        }}
      >
        <div>Lawful</div>
        <div>Neutral</div>
        <div>Chaotic</div>
      </div>

      {/* 3x3 Grid Matrix */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          marginBottom: '8px',
        }}
      >
        {ALIGNMENT_MATRIX.map((row, rowIdx) => {
          const rowLabel = rowIdx === 0 ? 'Good' : rowIdx === 1 ? 'Neutral' : 'Evil';
          return (
            <div
              key={rowIdx}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '4px',
              }}
            >
              {row.map((alignKey) => {
                const meta = ALIGNMENTS[alignKey];
                const isSelected = value === alignKey;
                const isHovered = hoveredAlignment === alignKey;

                return (
                  <button
                    key={alignKey}
                    type="button"
                    onClick={() => onChange(alignKey)}
                    onMouseEnter={() => setHoveredAlignment(alignKey)}
                    onMouseLeave={() => setHoveredAlignment(null)}
                    style={{
                      padding: compact ? '6px 4px' : '8px 6px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: isSelected
                        ? meta.bgGlow
                        : isHovered
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isSelected ? meta.border : isHovered ? 'rgba(255,255,255,0.2)' : 'rgba(255, 255, 255, 0.08)'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '2px',
                      transition: 'all 0.12s ease',
                      outline: 'none',
                      boxShadow: isSelected ? `0 0 12px ${meta.border}` : 'none',
                    }}
                  >
                    <span style={{ fontSize: compact ? '0.9rem' : '1.1rem' }}>{meta.icon}</span>
                    <span
                      style={{
                        fontSize: compact ? '0.68rem' : '0.74rem',
                        fontWeight: isSelected ? 700 : 600,
                        color: isSelected ? meta.textColor : 'var(--text-primary)',
                      }}
                    >
                      {meta.abbr}
                    </span>
                    <span
                      style={{
                        fontSize: '0.6rem',
                        color: isSelected ? meta.color : 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {rowLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Special Alignments Bar (Unaligned & Any Alignment) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px',
          paddingTop: '6px',
          borderTop: '1px dashed var(--border-subtle)',
        }}
      >
        {SPECIAL_ALIGNMENTS.map((alignKey) => {
          const meta = ALIGNMENTS[alignKey];
          const isSelected = value === alignKey;
          const isHovered = hoveredAlignment === alignKey;

          return (
            <button
              key={alignKey}
              type="button"
              onClick={() => onChange(alignKey)}
              onMouseEnter={() => setHoveredAlignment(alignKey)}
              onMouseLeave={() => setHoveredAlignment(null)}
              style={{
                padding: compact ? '5px 8px' : '7px 10px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: isSelected
                  ? meta.bgGlow
                  : isHovered
                  ? 'rgba(255, 255, 255, 0.08)'
                  : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${isSelected ? meta.border : isHovered ? 'rgba(255,255,255,0.2)' : 'rgba(255, 255, 255, 0.08)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.12s ease',
                outline: 'none',
                boxShadow: isSelected ? `0 0 10px ${meta.border}` : 'none',
              }}
            >
              <span>{meta.icon}</span>
              <div style={{ textAlign: 'left' }}>
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: isSelected ? 700 : 600,
                    color: isSelected ? meta.textColor : 'var(--text-primary)',
                  }}
                >
                  {meta.label}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer description */}
      <div
        style={{
          marginTop: '8px',
          paddingTop: '6px',
          fontSize: '0.67rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.4,
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        {activeMeta.description}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Role Pill & Selector Components
// ---------------------------------------------------------------------------
interface RolePillProps {
  role: CreatureRole;
  size?: 'sm' | 'md';
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const RolePill: React.FC<RolePillProps> = ({
  role,
  size = 'md',
  onClick,
  style,
}) => {
  const meta = CREATURE_ROLES[role] || CREATURE_ROLES.npc;

  return (
    <span
      onClick={onClick}
      title={`${meta.label}\n${meta.description}${meta.encounterAdvice ? `\n${meta.encounterAdvice}` : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: size === 'sm' ? '2px 6px' : '3px 8px',
        fontSize: size === 'sm' ? '0.65rem' : '0.72rem',
        fontWeight: 700,
        borderRadius: '6px',
        background: meta.bgGlow,
        border: `1px solid ${meta.border}`,
        color: meta.textColor,
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <span>{meta.icon}</span>
      <span>{meta.label}</span>
    </span>
  );
};

interface RoleSelectorProps {
  value: CreatureRole;
  onChange: (role: CreatureRole) => void;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({ value, onChange }) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
      {(Object.keys(CREATURE_ROLES) as CreatureRole[]).map((r) => {
        const meta = CREATURE_ROLES[r];
        const isSelected = value === r;

        return (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            title={meta.description}
            style={{
              padding: '6px 8px',
              borderRadius: '8px',
              cursor: 'pointer',
              background: isSelected ? meta.bgGlow : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${isSelected ? meta.border : 'rgba(255, 255, 255, 0.08)'}`,
              color: isSelected ? meta.textColor : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.72rem',
              fontWeight: isSelected ? 700 : 500,
              transition: 'all 0.12s ease',
              outline: 'none',
              boxShadow: isSelected ? `0 0 10px ${meta.border}` : 'none',
            }}
          >
            <span>{meta.icon}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {meta.label.split(' / ')[0]}
            </span>
          </button>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// 5e Size & Type Selector
// ---------------------------------------------------------------------------
interface CreatureTypeSelectorProps {
  size: CreatureSize;
  type: CreatureType;
  tag?: string;
  onSizeChange: (s: CreatureSize) => void;
  onTypeChange: (t: CreatureType) => void;
  onTagChange?: (tag: string) => void;
}

export const CreatureTypeSelector: React.FC<CreatureTypeSelectorProps> = ({
  size,
  type,
  tag = '',
  onSizeChange,
  onTypeChange,
  onTagChange,
}) => {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <select
        value={size}
        onChange={(e) => onSizeChange(e.target.value as CreatureSize)}
        style={{
          padding: '4px 8px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          borderRadius: '6px',
          color: 'var(--text-primary)',
          fontSize: '0.78rem',
        }}
      >
        {CREATURE_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select
        value={type}
        onChange={(e) => onTypeChange(e.target.value as CreatureType)}
        style={{
          padding: '4px 8px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          borderRadius: '6px',
          color: 'var(--text-primary)',
          fontSize: '0.78rem',
        }}
      >
        {CREATURE_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      {onTagChange && (
        <input
          type="text"
          value={tag}
          onChange={(e) => onTagChange(e.target.value)}
          placeholder="Subtype / Tag (e.g. Druid, Kobold)"
          style={{
            flex: 1,
            padding: '4px 8px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            fontSize: '0.78rem',
          }}
        />
      )}
    </div>
  );
};
