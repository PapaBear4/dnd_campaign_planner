import React from 'react';
import {
  GripVertical,
  Sparkles,
  Eye,
  EyeOff,
  Star,
  MapPin,
  Skull,
  Users,
  Package,
} from 'lucide-react';
import { NodeItem } from '../../types';

export interface TapestryEncounterCardProps {
  encounter: NodeItem;
  encIdx: number;
  encounterDensity: 'detailed' | 'compact';
  isStagingCol: boolean;
  isOpenRow: boolean;
  hoveredEncounterId: string | null;
  hoveredMilestoneId: string | null;
  milestoneLines: Array<{ id: string; sourceEncounterId: string }>;
  milestoneEmitters: Map<string, Array<{ targetQuestId: string; label: string; summary?: string }>>;
  encounterEntitiesMap: Map<string, { locations: NodeItem[]; monsters: NodeItem[]; items: NodeItem[]; npcs: NodeItem[] }>;
  sessions: NodeItem[];
  quests: NodeItem[];
  onSelectEncounter: (enc: NodeItem) => void;
  onSelectEntity: (entity: NodeItem) => void;
  onToggleCanon: (e: React.MouseEvent, enc: NodeItem) => void;
  onToggleReveal: (e: React.MouseEvent, enc: NodeItem) => void;
  onAssignToSession: (encId: string, sessionId: string) => void;
  onAssignToQuest: (encId: string, questId: string) => void;
  onDragStart: (encId: string, e: React.DragEvent) => void;
  onDragEnd: () => void;
  onMouseEnter: (encId: string) => void;
  onMouseLeave: () => void;
}

export const TapestryEncounterCard: React.FC<TapestryEncounterCardProps> = ({
  encounter: enc,
  encIdx,
  encounterDensity,
  isStagingCol,
  isOpenRow,
  hoveredEncounterId,
  hoveredMilestoneId,
  milestoneLines,
  milestoneEmitters,
  encounterEntitiesMap,
  sessions,
  quests,
  onSelectEncounter,
  onSelectEntity,
  onToggleCanon,
  onToggleReveal,
  onAssignToSession,
  onAssignToQuest,
  onDragStart,
  onDragEnd,
  onMouseEnter,
  onMouseLeave,
}) => {
  const encStatus = enc.data_json?.status || 'planned';
  const attached = encounterEntitiesMap.get(enc.id) || { locations: [], monsters: [], items: [], npcs: [] };
  const hasMilestoneEmit = milestoneEmitters.has(enc.id);
  const isLinkedToHoveredMilestone = Boolean(
    hoveredMilestoneId &&
      milestoneLines.some((l) => l.id === hoveredMilestoneId && l.sourceEncounterId === enc.id)
  );
  const orderNum = enc.sort_order || encIdx + 1;
  const encType = enc.data_json?.encounter_type || enc.data_json?.type || 'combat';

  return (
    <div
      id={`enc-${enc.id}`}
      draggable={true}
      onDragStart={(e) => onDragStart(enc.id, e)}
      onDragEnd={onDragEnd}
      onClick={() => onSelectEncounter(enc)}
      onMouseEnter={() => onMouseEnter(enc.id)}
      onMouseLeave={onMouseLeave}
      className={`tapestry-encounter-card ${
        encStatus === 'completed'
          ? 'completed'
          : encStatus === 'in_progress'
          ? 'in-progress'
          : ''
      } ${hoveredEncounterId === enc.id ? 'highlighted' : ''} ${
        isLinkedToHoveredMilestone ? 'milestone-highlighted' : ''
      }`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '10px 12px',
        background:
          encStatus === 'completed'
            ? 'rgba(16, 185, 129, 0.08)'
            : encStatus === 'in_progress'
            ? 'rgba(245, 158, 11, 0.08)'
            : 'rgba(30, 41, 59, 0.7)',
        borderRadius: '8px',
        border:
          hoveredEncounterId === enc.id
            ? '1px solid var(--accent-primary)'
            : isLinkedToHoveredMilestone
            ? '1.5px solid #a855f7'
            : encStatus === 'completed'
            ? '1px solid rgba(16, 185, 129, 0.3)'
            : encStatus === 'in_progress'
            ? '1px solid rgba(245, 158, 11, 0.4)'
            : '1px solid rgba(255, 255, 255, 0.06)',
        cursor: 'grab',
        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        minWidth: encounterDensity === 'compact' ? '180px' : '230px',
        maxWidth: encounterDensity === 'compact' ? '200px' : '260px',
        boxShadow:
          hoveredEncounterId === enc.id
            ? '0 6px 20px rgba(0, 0, 0, 0.4)'
            : '0 2px 8px rgba(0, 0, 0, 0.2)',
      }}
    >
      {/* Card Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <GripVertical size={12} style={{ color: 'var(--text-muted)', flexShrink: 0, opacity: 0.6 }} />
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              letterSpacing: '0.5px',
            }}
          >
            #{orderNum}
          </span>
          <span
            className="badge"
            style={{
              fontSize: '0.62rem',
              padding: '1px 5px',
              background:
                encType === 'combat'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : encType === 'roleplay'
                  ? 'rgba(59, 130, 246, 0.15)'
                  : encType === 'puzzle'
                  ? 'rgba(168, 85, 247, 0.15)'
                  : 'rgba(245, 158, 11, 0.15)',
              color:
                encType === 'combat'
                  ? '#ef4444'
                  : encType === 'roleplay'
                  ? '#60a5fa'
                  : encType === 'puzzle'
                  ? '#c084fc'
                  : 'var(--color-gold)',
              border: 'none',
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
            }}
          >
            {encType}
          </span>
        </div>

        {/* Action icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={(e) => onToggleCanon(e, enc)}
            title={enc.is_canon ? 'Canon Lore (Click to switch to non-canon)' : 'Draft/Alternate (Click to mark Canon)'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px',
              color: enc.is_canon ? 'var(--color-gold)' : 'var(--text-muted)',
              opacity: enc.is_canon ? 1 : 0.4,
            }}
          >
            <Sparkles size={11} />
          </button>
          <button
            type="button"
            onClick={(e) => onToggleReveal(e, enc)}
            title={enc.revealed_to_players ? 'Revealed to Players' : 'Hidden / DM Eyes Only'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px',
              color: enc.revealed_to_players ? 'var(--color-emerald)' : 'var(--text-muted)',
              opacity: enc.revealed_to_players ? 1 : 0.4,
            }}
          >
            {enc.revealed_to_players ? <Eye size={11} /> : <EyeOff size={11} />}
          </button>
          {hasMilestoneEmit && (
            <span title="Advances Quest (Emits milestone connection)" style={{ color: '#a855f7', display: 'flex' }}>
              <Star size={12} fill="#a855f7" />
            </span>
          )}
        </div>
      </div>

      {/* Title & Summary */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: '0.82rem',
            fontWeight: 600,
            color: encStatus === 'completed' ? 'var(--text-secondary)' : 'var(--text-primary)',
            textDecoration: encStatus === 'completed' ? 'line-through' : 'none',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {enc.title}
        </div>
        {encounterDensity === 'detailed' && enc.summary && (
          <p
            style={{
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              margin: '3px 0 0 0',
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {enc.summary}
          </p>
        )}
      </div>

      {/* Attached Entities (Pills) */}
      {encounterDensity === 'detailed' && (
        (attached.locations.length > 0 ||
          attached.monsters.length > 0 ||
          attached.npcs.length > 0 ||
          attached.items.length > 0) && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px',
              marginTop: '2px',
            }}
          >
            {attached.locations.slice(0, 2).map((loc) => (
              <span
                key={loc.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEntity(loc);
                }}
                className="badge"
                style={{
                  fontSize: '0.62rem',
                  padding: '1px 5px',
                  background: 'rgba(6, 182, 212, 0.12)',
                  color: '#22d3ee',
                  border: '1px solid rgba(6, 182, 212, 0.25)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  maxWidth: '100px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                <MapPin size={9} />
                {loc.title}
              </span>
            ))}
            {attached.monsters.slice(0, 2).map((mon) => (
              <span
                key={mon.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEntity(mon);
                }}
                className="badge"
                style={{
                  fontSize: '0.62rem',
                  padding: '1px 5px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  maxWidth: '100px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                <Skull size={9} />
                {mon.title}
              </span>
            ))}
            {attached.npcs.slice(0, 2).map((npc) => (
              <span
                key={npc.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEntity(npc);
                }}
                className="badge"
                style={{
                  fontSize: '0.62rem',
                  padding: '1px 5px',
                  background: 'rgba(59, 130, 246, 0.12)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  maxWidth: '100px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                <Users size={9} />
                {npc.title}
              </span>
            ))}
            {attached.items.slice(0, 2).map((itm) => (
              <span
                key={itm.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEntity(itm);
                }}
                className="badge"
                style={{
                  fontSize: '0.62rem',
                  padding: '1px 5px',
                  background: 'rgba(245, 158, 11, 0.12)',
                  color: 'var(--color-gold)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  maxWidth: '100px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                <Package size={9} />
                {itm.title}
              </span>
            ))}
          </div>
        )
      )}

      {/* Quick Assignment Pickers if Unassigned */}
      {(isStagingCol || isOpenRow) && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'flex',
            gap: '6px',
            paddingTop: '6px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            marginTop: 'auto',
          }}
        >
          {isStagingCol && sessions.length > 0 && (
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  onAssignToSession(enc.id, e.target.value);
                }
              }}
              style={{
                fontSize: '0.68rem',
                padding: '2px 4px',
                background: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                maxWidth: '110px',
              }}
            >
              <option value="" disabled>Assign Session...</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          )}
          {isOpenRow && quests.length > 0 && (
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  onAssignToQuest(enc.id, e.target.value);
                }
              }}
              style={{
                fontSize: '0.68rem',
                padding: '2px 4px',
                background: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                maxWidth: '110px',
              }}
            >
              <option value="" disabled>Link Quest...</option>
              {quests.map((q: NodeItem) => (
                <option key={q.id} value={q.id}>{q.title}</option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
};
