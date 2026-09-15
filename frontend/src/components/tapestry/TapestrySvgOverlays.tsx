import React from 'react';
import { PrecedenceLine, MilestoneLine } from './hooks/useTapestryOverlays';

interface TapestrySvgOverlaysProps {
  milestoneLines: MilestoneLine[];
  precedenceLines: PrecedenceLine[];
  hoveredEncounterId: string | null;
  hoveredMilestoneId: string | null;
  hoveredQuestId: string | null;
}

export const TapestrySvgOverlays: React.FC<TapestrySvgOverlaysProps> = ({
  milestoneLines,
  precedenceLines,
  hoveredEncounterId,
  hoveredMilestoneId,
  hoveredQuestId,
}) => {
  return (
    <>
      {/* SVG Background Layer for Milestone Sync Lines (Advances Quest) */}
      {milestoneLines.length > 0 && (
        <svg className="matrix-milestone-svg-overlay">
          <defs>
            <marker
              id="arrow-purple"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--color-purple, #a855f7)" />
            </marker>
          </defs>
          {milestoneLines.map((line) => {
            const isHighlighted =
              hoveredEncounterId === line.sourceEncounterId ||
              hoveredMilestoneId === line.id ||
              hoveredQuestId === line.targetQuestId;
            const isDimmed = Boolean(
              (hoveredEncounterId || hoveredMilestoneId || hoveredQuestId) && !isHighlighted
            );
            return (
              <path
                key={line.id}
                d={line.d}
                className={`matrix-milestone-curve ${
                  isHighlighted ? 'highlighted' : isDimmed ? 'dimmed' : ''
                }`}
                markerEnd="url(#arrow-purple)"
              />
            );
          })}
        </svg>
      )}

      {/* SVG Precedence Overlay for Encounter Precedence Lines */}
      {precedenceLines.length > 0 && (
        <>
          <svg className="matrix-svg-overlay">
            <defs>
              <marker id="arrow-gold" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f59e0b"/>
              </marker>
            </defs>
            {precedenceLines.map((line) => {
              const isHighlighted = hoveredEncounterId === line.sourceId || hoveredEncounterId === line.targetId;
              const isDimmed = Boolean(hoveredEncounterId && !isHighlighted);
              return (
                <path
                  key={line.edgeId}
                  d={line.d}
                  className={`matrix-curve ${isHighlighted ? 'highlighted' : isDimmed ? 'dimmed' : ''}`}
                  markerEnd="url(#arrow-gold)"
                />
              );
            })}
          </svg>

          {/* Floating Condition Badges along the lines */}
          {precedenceLines.map((line) => {
            if (!line.label) return null;
            if (line.isTight) {
              return (
                <div
                  key={`dot-${line.edgeId}`}
                  className="matrix-condition-dot"
                  style={{ left: `${line.midX}px`, top: `${line.midY}px` }}
                  title={line.label}
                >
                  <span className="dot-icon">➔</span>
                  <div className={`matrix-condition-tooltip ${line.tooltipBelow ? 'tooltip-below' : ''}`}>
                    <span style={{ color: 'var(--color-gold)', fontSize: '0.75rem' }}>➔</span>
                    <span>{line.label}</span>
                  </div>
                </div>
              );
            }
            return (
              <div
                key={`pill-${line.edgeId}`}
                className="matrix-condition-pill"
                style={{ left: `${line.midX}px`, top: `${line.midY}px` }}
                title={line.label}
              >
                ➔ {line.label}
              </div>
            );
          })}
        </>
      )}
    </>
  );
};
