import React from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { NodeItem } from '../../types';
import { COL_GAP, LEFT_COL_WIDTH } from './hooks/useTapestryDimensions';

interface TapestryArcBannersProps {
  matrixGridCols: string;
  displayColumns: NodeItem[];
  arcLayouts: { arc: NodeItem; colSpan: number; sessionIds: string[] }[];
  collapsedSessionIds: Set<string>;
  onSelectArc: (arc: NodeItem) => void;
  onToggleArcCollapse: (sessionIds: string[], forceCollapse?: boolean) => void;
}

export const TapestryArcBanners: React.FC<TapestryArcBannersProps> = ({
  matrixGridCols,
  displayColumns,
  arcLayouts,
  collapsedSessionIds,
  onSelectArc,
  onToggleArcCollapse,
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
      <div
        style={{
          position: 'sticky',
          left: 0,
          zIndex: 25,
          background: 'var(--bg-app)',
          padding: '4px 10px 4px 20px',
          display: 'flex',
          alignItems: 'flex-end',
          boxSizing: 'border-box',
          width: `${LEFT_COL_WIDTH}px`,
          minWidth: `${LEFT_COL_WIDTH}px`,
          maxWidth: `${LEFT_COL_WIDTH}px`,
          borderRight: '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: '4px 0 12px -2px rgba(0, 0, 0, 0.45)',
        }}
      >
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
              onClick={() => onToggleArcCollapse(item.sessionIds, false)}
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
              title={`Act ${aIdx + 1}: ${item.arc.title} (${item.colSpan} session${item.colSpan > 1 ? 's' : ''} collapsed — Click to expand act)`}
            >
              <span style={{ fontSize: '0.66rem', fontWeight: 900, color: 'var(--color-gold)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ACT {aIdx + 1}
              </span>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px', marginTop: '2px' }}>
                <ChevronsRight size={10} />
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
            title={`${item.arc.title} (Click to inspect arc details)`}
          >
            <div style={{ minWidth: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {item.sessionIds && item.sessionIds.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleArcCollapse(item.sessionIds, true);
                  }}
                  className="btn btn-ghost"
                  style={{
                    fontSize: '0.62rem',
                    padding: '2px 5px',
                    height: '22px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    color: 'var(--text-muted)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    background: 'rgba(0,0,0,0.2)',
                    flexShrink: 0
                  }}
                  title={`Collapse all sessions in Act ${aIdx + 1}`}
                >
                  <ChevronsLeft size={11} />
                </button>
              )}
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-gold)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Act {aIdx + 1}
                </span>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                  {item.arc.title}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {item.colSpan} {item.colSpan === 1 ? 'Session' : 'Sessions'}
              </span>
              {item.sessionIds && item.sessionIds.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleArcCollapse(item.sessionIds, true);
                  }}
                  className="btn btn-ghost"
                  style={{
                    fontSize: '0.65rem',
                    padding: '2px 6px',
                    height: '22px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    color: 'var(--text-muted)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    background: 'rgba(0,0,0,0.2)'
                  }}
                  title={`Collapse all sessions in Act ${aIdx + 1}`}
                >
                  <ChevronsLeft size={11} />
                  Collapse
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
