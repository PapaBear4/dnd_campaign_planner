import React from 'react';
import { ChevronsDownUp, ChevronsUpDown, BookOpen, Plus } from 'lucide-react';
import { NodeItem } from '../../types';
import { COL_GAP, LEFT_COL_WIDTH } from './hooks/useTapestryDimensions';

interface TapestrySessionHeadersProps {
  matrixGridCols: string;
  displayColumns: NodeItem[];
  displayQuests: NodeItem[];
  collapsedQuestIds: Set<string>;
  collapsedSessionIds: Set<string>;
  hoveredSessionId: string | null;
  encounters: NodeItem[];
  encounterSessionMap: Map<string, string>;
  encounterQuestMap: Map<string, string>;
  sessions: NodeItem[];
  onExpandAllQuests: () => void;
  onCollapseAllQuests: () => void;
  onToggleSessionCollapse: (sessionId: string) => void;
  onSelectSession: (sess: NodeItem) => void;
  onSetHoveredSessionId: (id: string | null) => void;
  onMoveEncounter: (encounterId: string, targetSessionId: string | null, targetQuestId: string | null) => Promise<void>;
  onOpenRunSheet: (sess: NodeItem) => void;
  onQuickCreateSession: (sessNum?: number, title?: string) => Promise<void>;
}

export const TapestrySessionHeaders: React.FC<TapestrySessionHeadersProps> = ({
  matrixGridCols,
  displayColumns,
  displayQuests,
  collapsedQuestIds,
  collapsedSessionIds,
  hoveredSessionId,
  encounters,
  encounterSessionMap,
  encounterQuestMap,
  sessions,
  onExpandAllQuests,
  onCollapseAllQuests,
  onToggleSessionCollapse,
  onSelectSession,
  onSetHoveredSessionId,
  onMoveEncounter,
  onOpenRunSheet,
  onQuickCreateSession,
}) => {
  if (displayColumns.length === 0) return null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: matrixGridCols,
        gap: `${COL_GAP}px`,
        alignItems: 'stretch'
      }}
    >
      <div
        style={{
          position: 'sticky',
          left: 0,
          zIndex: 25,
          background: 'var(--bg-app)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px 0 20px',
          boxSizing: 'border-box',
          width: `${LEFT_COL_WIDTH}px`,
          minWidth: `${LEFT_COL_WIDTH}px`,
          maxWidth: `${LEFT_COL_WIDTH}px`,
          borderRight: '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: '4px 0 12px -2px rgba(0, 0, 0, 0.45)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {displayQuests.length} Story Lines
          </span>
          {displayQuests.length > 0 && (
            <button
              type="button"
              onClick={collapsedQuestIds.size >= displayQuests.length ? onExpandAllQuests : onCollapseAllQuests}
              className="btn btn-ghost"
              style={{ fontSize: '0.68rem', padding: '2px 6px', gap: '4px', height: '22px', color: 'var(--text-muted)' }}
              title={collapsedQuestIds.size >= displayQuests.length ? 'Expand All Story Lines' : 'Collapse All Story Lines'}
            >
              {collapsedQuestIds.size >= displayQuests.length ? (
                <>
                  <ChevronsUpDown size={12} /> Expand All
                </>
              ) : (
                <>
                  <ChevronsDownUp size={12} /> Collapse All
                </>
              )}
            </button>
          )}
        </div>
        {sessions.length === 0 && (
          <span style={{ fontSize: '0.68rem', color: 'var(--color-gold)', background: 'rgba(245, 158, 11, 0.12)', padding: '2px 6px', borderRadius: '4px' }}>
            Staging Mode
          </span>
        )}
      </div>

      {displayColumns.map((sess, idx) => {
        const isHovered = hoveredSessionId === sess.id;
        const isCurrent = sess.data_json?.status === 'in_progress';
        const isStaging = sess.id === 'unscheduled-staging';
        const isVirtual = sess.data_json?.is_virtual;
        const isColCollapsed = collapsedSessionIds.has(sess.id);
        const sessEncounters = encounters.filter((e) =>
          isStaging ? !encounterSessionMap.get(e.id) : encounterSessionMap.get(e.id) === sess.id
        );
        const sessNum = sess.data_json?.session_number || idx + (displayColumns[0]?.id === 'unscheduled-staging' ? 0 : 1);

        if (isColCollapsed) {
          const cleanTitle = sess.title.replace(/^Session\s*\d+\s*:\s*/i, '');
          return (
            <div
              key={sess.id}
              onClick={() => onToggleSessionCollapse(sess.id)}
              className="tapestry-col-spine"
              title={`${sess.title} (Click to unroll column)`}
            >
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--color-gold)', fontFamily: 'var(--font-mono)' }}>
                {isStaging ? 'INT' : `S0${sessNum}`}
              </span>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: isCurrent ? 'var(--color-gold)' : sess.data_json?.status === 'completed' ? 'var(--color-emerald)' : 'var(--text-muted)'
                }}
              />
              <div className="tapestry-spine-vtitle">{cleanTitle}</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {sessEncounters.length}
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--color-gold)', fontWeight: 800 }}>+</span>
              </div>
            </div>
          );
        }

        return (
          <div
            key={sess.id}
            onClick={() => {
              if (!isStaging && !isVirtual) onSelectSession(sess);
            }}
            onMouseEnter={() => onSetHoveredSessionId(sess.id)}
            onMouseLeave={() => onSetHoveredSessionId(null)}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={async (e) => {
              e.preventDefault();
              const raw = e.dataTransfer.getData('text/plain');
              if (!raw) return;
              try {
                const data = JSON.parse(raw);
                if (data.type === 'encounter') {
                  const targetSessionId = isStaging ? null : sess.id;
                  const currentQuestId = encounterQuestMap.get(data.encounterId) || null;
                  await onMoveEncounter(data.encounterId, targetSessionId, currentQuestId);
                }
              } catch (err) {
                console.error(err);
              }
            }}
            style={{
              background: isStaging
                ? 'rgba(59, 130, 246, 0.08)'
                : isCurrent
                ? 'rgba(245, 158, 11, 0.12)'
                : isHovered
                ? 'var(--bg-card-hover)'
                : 'var(--bg-surface)',
              border: `1.5px solid ${
                isStaging
                  ? 'rgba(59, 130, 246, 0.4)'
                  : isCurrent
                  ? 'var(--color-gold)'
                  : isHovered
                  ? 'var(--border-medium)'
                  : 'var(--border-subtle)'
              }`,
              borderRadius: '8px',
              padding: '8px 12px',
              cursor: isStaging ? 'default' : 'pointer',
              boxShadow: isCurrent ? '0 0 14px rgba(245, 158, 11, 0.25)' : 'none',
              position: 'relative',
              transition: 'all 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            {isStaging && (
              <div
                style={{
                  position: 'absolute',
                  top: '-7px',
                  right: '8px',
                  background: '#3b82f6',
                  color: '#fff',
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  padding: '1px 5px',
                  borderRadius: '4px',
                  textTransform: 'uppercase'
                }}
              >
                Intake
              </div>
            )}

            {isCurrent && !isStaging && (
              <div
                style={{
                  position: 'absolute',
                  top: '-7px',
                  right: '8px',
                  background: 'var(--color-gold)',
                  color: '#000',
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  padding: '1px 5px',
                  borderRadius: '4px',
                  textTransform: 'uppercase'
                }}
              >
                Next Session
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSessionCollapse(sess.id);
                  }}
                  className="btn btn-ghost"
                  style={{
                    fontSize: '0.62rem',
                    padding: '1px 5px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    color: 'var(--text-muted)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '4px',
                    background: 'rgba(0,0,0,0.15)'
                  }}
                  title="Fold session column"
                >
                  ◀
                </button>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: isStaging ? '#60a5fa' : isCurrent ? 'var(--color-gold)' : 'var(--text-primary)' }}>
                  {isStaging ? '📥 Prep Staging' : isVirtual ? `Virtual Session ${sess.data_json?.session_number || idx}` : `Session ${sessNum}`}
                </span>
                <span className={`status-pill status-${sess.data_json?.status === 'completed' ? 'completed' : isCurrent ? 'inprogress' : 'planned'}`} style={{ fontSize: '0.6rem', padding: '1px 5px' }}>
                  {sess.data_json?.status === 'completed' ? '✓ Done' : isCurrent ? '● Active' : 'Plan'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenRunSheet(sess);
                  }}
                  className="btn btn-ghost"
                  style={{ fontSize: '0.62rem', padding: '1px 5px', height: '20px', gap: '3px', color: 'var(--color-gold)' }}
                  title="Open Session Run-Sheet"
                >
                  <BookOpen size={10} /> Run-Sheet
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSessionCollapse(sess.id);
                  }}
                  className="btn btn-ghost"
                  style={{ fontSize: '0.65rem', padding: '1px 6px', height: '20px', gap: '3px', color: 'var(--text-muted)' }}
                  title="Fold session column"
                >
                  ◀ Fold
                </button>
              </div>
            </div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {sess.title}
            </div>
            {sess.subtitle && (
              <div style={{ fontSize: '0.68rem', color: isStaging ? '#93c5fd' : 'var(--text-muted)' }}>{sess.subtitle}</div>
            )}

            {/* Quick Commit button for virtual sessions */}
            {isVirtual && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickCreateSession(sess.data_json?.session_number, sess.title);
                }}
                className="btn btn-primary"
                style={{ fontSize: '0.66rem', padding: '2px 6px', marginTop: '6px', width: '100%', gap: '4px' }}
              >
                <Plus size={11} /> Commit to Campaign
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};
