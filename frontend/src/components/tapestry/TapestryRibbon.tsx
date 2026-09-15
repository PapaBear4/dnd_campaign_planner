import React from 'react';
import { NodeItem } from '../../types';
import { LEFT_COL_WIDTH } from './hooks/useTapestryDimensions';

interface TapestryRibbonProps {
  canvasWidth: number;
  displayColumns: NodeItem[];
  encounters: NodeItem[];
  encounterSessionMap: Map<string, string>;
  hoveredSessionId: string | null;
  activeRibbonRiff: 'woven' | 'constellation' | 'transit';
  getColX: (index: number) => number;
  onSelectEncounter: (enc: NodeItem) => void;
}

export const TapestryRibbon: React.FC<TapestryRibbonProps> = ({
  canvasWidth,
  displayColumns,
  encounters,
  encounterSessionMap,
  hoveredSessionId,
  activeRibbonRiff,
  getColX,
  onSelectEncounter,
}) => {
  return (
    <div
      className="glass-panel animate-fade-in"
      style={{
        background: 'radial-gradient(ellipse at 50% 50%, rgba(15, 20, 32, 0.95) 0%, rgba(8, 11, 17, 0.98) 100%)',
        border: '1px solid var(--border-medium)',
        borderRadius: '14px',
        padding: '10px 16px',
        position: 'relative'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>
          Narrative Flow Ribbon • Saga Threads &amp; Encounters:
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Golden Cord = Main Storyline • Branches = Side Quests &amp; Factions • Click any knot to inspect
        </span>
      </div>

      <svg width={canvasWidth - 32} height="120" style={{ overflow: 'visible', display: 'block' }}>
        <defs>
          <filter id="gold-glow-large" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="blue-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="purple-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <linearGradient id="gold-rope-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>

        {/* Vertical Session Alignment Guides connecting all the way down */}
        {displayColumns.map((sess, idx) => {
          const x = getColX(idx);
          const isHovered = hoveredSessionId === sess.id;
          const isCurrent = sess.data_json?.status === 'in_progress';
          const isStaging = sess.id === 'unscheduled-staging';

          return (
            <g key={sess.id}>
              <line
                x1={x}
                y1="4"
                x2={x}
                y2="116"
                stroke={isStaging ? 'rgba(59, 130, 246, 0.3)' : isCurrent ? 'var(--color-gold)' : isHovered ? 'var(--border-medium)' : 'rgba(255, 255, 255, 0.08)'}
                strokeWidth={isCurrent ? 1.5 : 1}
                strokeDasharray="3 4"
              />
              <circle cx={x} cy={114} r={2.5} fill={isCurrent ? 'var(--color-gold)' : 'rgba(255, 255, 255, 0.2)'} />
            </g>
          );
        })}

        {/* 1. Branching Side Ribbons */}
        {displayColumns.length >= 3 && (
          <>
            {/* Upper Side Quest Ribbon (Cyan/Arcane) */}
            <path
              d={`M ${getColX(0)},60 C ${getColX(0) + 70},22 ${getColX(1) - 70},22 ${getColX(1)},22 C ${getColX(1) + 70},22 ${getColX(Math.min(3, displayColumns.length - 1)) - 70},60 ${getColX(Math.min(3, displayColumns.length - 1))},60`}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="3.5"
              strokeLinecap="round"
              filter="url(#blue-glow)"
              opacity="0.8"
            />
            <path
              d={`M ${getColX(0)},60 C ${getColX(0) + 70},22 ${getColX(1) - 70},22 ${getColX(1)},22 C ${getColX(1) + 70},22 ${getColX(Math.min(3, displayColumns.length - 1)) - 70},60 ${getColX(Math.min(3, displayColumns.length - 1))},60`}
              fill="none"
              stroke="#67e8f9"
              strokeWidth="1.2"
              strokeDasharray="4 4"
            />
            <text
              x={getColX(1)}
              y={14}
              fill="#67e8f9"
              fontSize="9"
              fontWeight="800"
              textAnchor="middle"
              letterSpacing="0.8px"
            >
              ✦ SIDE QUEST BRANCHES
            </text>

            {/* Lower Faction Threads Ribbon (Royal Purple) */}
            {displayColumns.length >= 4 && (
              <>
                <path
                  d={`M ${getColX(1)},60 C ${getColX(1) + 70},98 ${getColX(2) - 70},98 ${getColX(2)},98 C ${getColX(2) + 70},98 ${getColX(Math.min(5, displayColumns.length - 1)) - 70},60 ${getColX(Math.min(5, displayColumns.length - 1))},60`}
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  filter="url(#purple-glow)"
                  opacity="0.8"
                />
                <path
                  d={`M ${getColX(1)},60 C ${getColX(1) + 70},98 ${getColX(2) - 70},98 ${getColX(2)},98 C ${getColX(2) + 70},98 ${getColX(Math.min(5, displayColumns.length - 1)) - 70},60 ${getColX(Math.min(5, displayColumns.length - 1))},60`}
                  fill="none"
                  stroke="#e9d5ff"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                />
                <text
                  x={getColX(2)}
                  y={114}
                  fill="#c084fc"
                  fontSize="9"
                  fontWeight="800"
                  textAnchor="middle"
                  letterSpacing="0.8px"
                >
                  ✦ FACTION THREADS
                </text>
              </>
            )}
          </>
        )}

        {/* 2. Main Golden Cord Spine */}
        {activeRibbonRiff === 'woven' && (
          <>
            <path
              d={displayColumns.map((_, i) => {
                const x = getColX(i);
                const y = 60 + (i % 2 === 0 ? -10 : 10);
                if (i === 0) return `M ${LEFT_COL_WIDTH - 20},60 C ${x - 50},${y} ${x - 20},${y} ${x},${y}`;
                const prevX = getColX(i - 1);
                const prevY = 60 + ((i - 1) % 2 === 0 ? -10 : 10);
                return `C ${prevX + 50},${prevY} ${x - 50},${y} ${x},${y}`;
              }).join(' ')}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="9"
              strokeLinecap="round"
              filter="url(#gold-glow-large)"
              opacity="0.35"
            />
            <path
              d={displayColumns.map((_, i) => {
                const x = getColX(i);
                const y = 60 + (i % 2 === 0 ? -10 : 10);
                if (i === 0) return `M ${LEFT_COL_WIDTH - 20},60 C ${x - 50},${y} ${x - 20},${y} ${x},${y}`;
                const prevX = getColX(i - 1);
                const prevY = 60 + ((i - 1) % 2 === 0 ? -10 : 10);
                return `C ${prevX + 50},${prevY} ${x - 50},${y} ${x},${y}`;
              }).join(' ')}
              fill="none"
              stroke="url(#gold-rope-grad)"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path
              d={displayColumns.map((_, i) => {
                const x = getColX(i);
                const y = 60 + (i % 2 === 0 ? -10 : 10);
                if (i === 0) return `M ${LEFT_COL_WIDTH - 20},60 C ${x - 50},${y} ${x - 20},${y} ${x},${y}`;
                const prevX = getColX(i - 1);
                const prevY = 60 + ((i - 1) % 2 === 0 ? -10 : 10);
                return `C ${prevX + 50},${prevY} ${x - 50},${y} ${x},${y}`;
              }).join(' ')}
              fill="none"
              stroke="#fef08a"
              strokeWidth="2"
              strokeDasharray="5 5"
            />
            <text
              x={LEFT_COL_WIDTH + 10}
              y={82}
              fill="var(--color-gold)"
              fontSize="9"
              fontWeight="800"
              letterSpacing="0.8px"
            >
              ✦ MAIN SAGA CORD
            </text>
          </>
        )}

        {/* Constellation Loom Riff */}
        {activeRibbonRiff === 'constellation' && (
          displayColumns.map((_, i) => {
            if (i === displayColumns.length - 1) return null;
            return (
              <line
                key={i}
                x1={getColX(i)}
                y1={i % 2 === 0 ? 46 : 74}
                x2={getColX(i + 1)}
                y2={(i + 1) % 2 === 0 ? 46 : 74}
                stroke="#f59e0b"
                strokeWidth="2.5"
                opacity="0.85"
              />
            );
          })
        )}

        {/* Fate Transit Riff */}
        {activeRibbonRiff === 'transit' && (
          <path
            d={`M ${LEFT_COL_WIDTH - 20},60 L ${getColX(displayColumns.length - 1) + 40},60`}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="5"
            strokeLinecap="round"
          />
        )}

        {/* 3. Clickable Encounter Knots along the Ribbon */}
        {displayColumns.map((sess, sIdx) => {
          const sessEncounters = encounters.filter((e) => {
            if (sess.id === 'unscheduled-staging') {
              return !encounterSessionMap.get(e.id);
            }
            return encounterSessionMap.get(e.id) === sess.id;
          });

          const isStaging = sess.id === 'unscheduled-staging';
          const baseX = getColX(sIdx);
          const baseY = 60 + (sIdx % 2 === 0 ? -10 : 10);

          return sessEncounters.map((enc, eIdx) => {
            const xOffset = eIdx > 0 ? (eIdx % 2 === 1 ? 16 : -16) : 0;
            const yOffset = eIdx > 0 ? (eIdx % 2 === 1 ? -22 : 22) : 0;
            const x = baseX + xOffset;
            const y = Math.max(18, Math.min(102, baseY + yOffset));

            const isComplete = enc.data_json?.status === 'completed';
            const isInProgress = enc.data_json?.status === 'in_progress';
            const isCombat = /brawl|troll|ambush|skirmish|gazer|fight|combat/i.test(enc.title);
            const isSocial = /parley|audience|contest|gratitude|friend|talk/i.test(enc.title);

            return (
              <g
                key={enc.id}
                onClick={() => onSelectEncounter(enc)}
                style={{ cursor: 'pointer' }}
              >
                <title>{enc.title} ({enc.data_json?.status || 'planned'})</title>

                {/* Knot Halo */}
                <circle
                  cx={x}
                  cy={y}
                  r={isInProgress ? 12 : 9}
                  fill={isStaging ? 'rgba(56, 189, 248, 0.2)' : isInProgress ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255, 255, 255, 0.08)'}
                />
                {/* Knot Core */}
                <circle
                  cx={x}
                  cy={y}
                  r={isInProgress ? 8 : 6.5}
                  fill={isComplete ? '#10b981' : isInProgress ? '#f59e0b' : isStaging ? '#38bdf8' : 'var(--bg-surface)'}
                  stroke={isStaging ? '#38bdf8' : '#fff'}
                  strokeWidth="1.8"
                />
                {/* Micro Icon Badge */}
                <text
                  x={x}
                  y={y + 3}
                  fontSize="7"
                  textAnchor="middle"
                  fill="#fff"
                  fontWeight="bold"
                  pointerEvents="none"
                >
                  {isCombat ? '⚔' : isSocial ? '💬' : '✦'}
                </text>
              </g>
            );
          });
        })}
      </svg>
    </div>
  );
};
