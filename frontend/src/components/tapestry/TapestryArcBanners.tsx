import React from 'react';
import { NodeItem } from '../../types';
import { COL_GAP } from './hooks/useTapestryDimensions';

interface TapestryArcBannersProps {
  matrixGridCols: string;
  displayColumns: NodeItem[];
  arcLayouts: { arc: NodeItem; colSpan: number; sessionIds: string[] }[];
  collapsedSessionIds: Set<string>;
  onSelectArc: (arc: NodeItem) => void;
}

export const TapestryArcBanners: React.FC<TapestryArcBannersProps> = ({
  matrixGridCols,
  displayColumns,
  arcLayouts,
  collapsedSessionIds,
  onSelectArc,
}) => {
  if (arcLayouts.length === 0) return null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: matrixGridCols,
        gap: `${COL_GAP}px`,
        alignItems: 'stretch',
        whiteSpace: 'nowrap'
      }}
    >
      <div style={{ padding: '4px 10px', display: 'flex', alignItems: 'flex-end' }}>
        <span style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.8px' }}>
          Storyline Threads ↓
        </span>
      </div>

      {/* If intake staging column is present, render staging banner above it */}
      {displayColumns[0]?.id === 'unscheduled-staging' && (() => {
        const isStagingFolded = collapsedSessionIds.has('unscheduled-staging');
        return (
          <div
            style={{
              gridColumn: 'span 1',
              minWidth: 0,
              overflow: 'hidden',
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px dashed rgba(59, 130, 246, 0.35)',
              borderRadius: '8px',
              padding: isStagingFolded ? '6px 2px' : '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isStagingFolded ? 'center' : 'space-between',
              boxSizing: 'border-box'
            }}
            title="📥 Intake Pool (Unscheduled Scenes)"
          >
            {isStagingFolded ? (
              <span style={{ fontSize: '0.85rem' }} title="Intake Pool (Unscheduled Scenes)">
                📥
              </span>
            ) : (
              <>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  📥 Intake Pool
                </span>
                <span style={{ fontSize: '0.68rem', color: '#93c5fd', whiteSpace: 'nowrap' }}>
                  Unscheduled
                </span>
              </>
            )}
          </div>
        );
      })()}

      {/* Render Arc Banners in a SINGLE horizontal non-wrapping row */}
      {arcLayouts.map((item, aIdx) => {
        const isAllFolded = Boolean(item.sessionIds && item.sessionIds.length > 0 && item.sessionIds.every((id) => collapsedSessionIds.has(id)));

        if (isAllFolded) {
          return (
            <div
              key={item.arc.id}
              onClick={() => onSelectArc(item.arc)}
              style={{
                gridColumn: `span ${item.colSpan}`,
                minWidth: 0,
                overflow: 'hidden',
                background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.16) 0%, rgba(245, 158, 11, 0.05) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '8px',
                padding: '4px 2px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                boxSizing: 'border-box',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-gold)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.4)')}
              title={`${item.arc.title} (${item.colSpan} session${item.colSpan > 1 ? 's' : ''} folded — Click to inspect arc)`}
            >
              <span style={{ fontSize: '0.66rem', fontWeight: 900, color: 'var(--color-gold)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ACT {aIdx + 1}
              </span>
            </div>
          );
        }

        return (
          <div
            key={item.arc.id}
            onClick={() => onSelectArc(item.arc)}
            style={{
              gridColumn: `span ${item.colSpan}`,
              minWidth: 0,
              overflow: 'hidden',
              background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.04) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: '8px',
              padding: '8px 14px',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              boxSizing: 'border-box',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-gold)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.35)')}
            title={item.arc.title}
          >
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-gold)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Act {aIdx + 1}
              </span>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                {item.arc.title}
              </div>
            </div>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
              {item.colSpan} {item.colSpan === 1 ? 'Session' : 'Sessions'}
            </span>
          </div>
        );
      })}
    </div>
  );
};
