import React from 'react';
import {
  ChevronRight,
  ChevronDown,
  GripVertical,
  Link2,
  GitFork,
  CornerDownRight,
  CheckCircle2,
  Plus,
  Swords,
} from 'lucide-react';
import { NodeItem, NodeType } from '../../types';
import { LEFT_COL_WIDTH } from './hooks/useTapestryDimensions';
import { TapestryEncounterCard } from './TapestryEncounterCard';

export interface TapestryQuestRowProps {
  quest: NodeItem;
  qIdx: number;
  matrixGridCols: string;
  COL_GAP: number;
  displayColumns: NodeItem[];
  collapsedQuestIds: Set<string>;
  collapsedSessionIds: Set<string>;
  collapsedSubQuestParents: Set<string>;
  hoveredQuestId: string | null;
  hoveredSessionId: string | null;
  hoveredEncounterId: string | null;
  hoveredMilestoneId: string | null;
  draggingQuestId: string | null;
  dragOverQuestId: string | null;
  dragOverQuestPosition: 'above' | 'below' | null;
  dragOverCell: { questId: string | null; sessionId: string | null } | null;
  questColors: string[];
  encounters: NodeItem[];
  encounterQuestMap: Map<string, string>;
  encounterSessionMap: Map<string, string>;
  unassignedQuestEncounters: NodeItem[];
  questPrereqsMap: Map<string, Array<{ quest: NodeItem; label?: string }>>;
  questBranchesMap: Map<string, Array<{ quest: NodeItem; label?: string }>>;
  milestoneReceivers: Map<string, Array<{ id: string; label: string; summary?: string; sourceEncounterId: string; sourceEncounterTitle: string }>>;
  milestoneLines: Array<{ id: string; sourceEncounterId: string }>;
  milestoneEmitters: Map<string, Array<{ targetQuestId: string; label: string; summary?: string }>>;
  encounterEntitiesMap: Map<string, { locations: NodeItem[]; monsters: NodeItem[]; items: NodeItem[]; npcs: NodeItem[] }>;
  sessions: NodeItem[];
  quests: NodeItem[];
  encounterDensity: 'detailed' | 'compact';
  // Callbacks
  onToggleQuestCollapse: (questId: string) => void;
  onToggleSubQuestsCollapse: (parentQuestId: string, e: React.MouseEvent) => void;
  onToggleSessionCollapse: (sessionId: string) => void;
  onSelectQuest: (quest: NodeItem) => void;
  onSelectEncounter: (enc: NodeItem) => void;
  onSelectEntity: (entity: NodeItem) => void;
  onToggleCanon: (e: React.MouseEvent, enc: NodeItem) => void;
  onToggleReveal: (e: React.MouseEvent, enc: NodeItem) => void;
  onAssignToSession: (encId: string, sessionId: string) => void;
  onAssignToQuest: (encId: string, questId: string) => void;
  onMoveEncounter: (encId: string, targetSessionId: string | null, targetQuestId: string | null) => Promise<void>;
  onReorderQuests: (sourceQuestId: string, targetQuestId: string, position: 'above' | 'below') => Promise<void>;
  onOpenAddEncounterModal: (targetQuestId: string | null, targetSessionId: string | null) => void;
  // Drag & drop handlers
  setHoveredQuestId: (questId: string | null) => void;
  setHoveredEncounterId: (encId: string | null) => void;
  setHoveredMilestoneId: (msId: string | null) => void;
  setDraggingQuestId: (questId: string | null) => void;
  setDragOverQuestId: (questId: string | null) => void;
  setDragOverQuestPosition: (pos: 'above' | 'below' | null) => void;
  setDraggingEncounterId: (encId: string | null) => void;
  setDragOverCell: (cell: { questId: string | null; sessionId: string | null } | null) => void;
}

export const TapestryQuestRow: React.FC<TapestryQuestRowProps> = ({
  quest,
  qIdx,
  matrixGridCols,
  COL_GAP,
  displayColumns,
  collapsedQuestIds,
  collapsedSessionIds,
  collapsedSubQuestParents,
  hoveredQuestId,
  hoveredSessionId,
  hoveredEncounterId,
  hoveredMilestoneId,
  draggingQuestId,
  dragOverQuestId,
  dragOverQuestPosition,
  dragOverCell,
  questColors,
  encounters,
  encounterQuestMap,
  encounterSessionMap,
  unassignedQuestEncounters,
  questPrereqsMap,
  questBranchesMap,
  milestoneReceivers,
  milestoneLines,
  milestoneEmitters,
  encounterEntitiesMap,
  sessions,
  quests,
  encounterDensity,
  onToggleQuestCollapse,
  onToggleSubQuestsCollapse,
  onToggleSessionCollapse,
  onSelectQuest,
  onSelectEncounter,
  onSelectEntity,
  onToggleCanon,
  onToggleReveal,
  onAssignToSession,
  onAssignToQuest,
  onMoveEncounter,
  onReorderQuests,
  onOpenAddEncounterModal,
  setHoveredQuestId,
  setHoveredEncounterId,
  setHoveredMilestoneId,
  setDraggingQuestId,
  setDragOverQuestId,
  setDragOverQuestPosition,
  setDraggingEncounterId,
  setDragOverCell,
}) => {
  const isQuestHovered = hoveredQuestId === quest.id;
  const isOpenRow = quest.id === 'open-world-events';
  const isSubQuest = Boolean((quest as any).isSubQuest);
  const subQuestCount = (quest as any).subQuestCount || 0;
  const completedSubQuestCount = (quest as any).completedSubQuestCount || 0;
  const isSubQuestsCollapsed = collapsedSubQuestParents.has(quest.id);
  const incomingPrereqs = questPrereqsMap.get(quest.id) || [];
  const outgoingBranches = questBranchesMap.get(quest.id) || [];

  const questColor = isOpenRow ? '#10b981' : isSubQuest ? '#60a5fa' : questColors[qIdx % questColors.length];
  const isCollapsed = collapsedQuestIds.has(quest.id);
  const rowEncountersCount = isOpenRow
    ? unassignedQuestEncounters.length
    : encounters.filter((e: NodeItem) => encounterQuestMap.get(e.id) === quest.id).length;

  return (
    <div
      key={quest.id}
      id={`quest-row-${quest.id}`}
      style={{
        display: 'grid',
        gridTemplateColumns: matrixGridCols,
        gap: `${COL_GAP}px`,
        alignItems: isCollapsed ? 'center' : 'stretch',
        position: 'relative',
      }}
      onMouseEnter={() => setHoveredQuestId(quest.id)}
      onMouseLeave={() => setHoveredQuestId(null)}
    >
      {/* Background Thread Beam connecting the whole row */}
      {displayColumns.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: `${LEFT_COL_WIDTH}px`,
            right: '0',
            top: '50%',
            height: isCollapsed ? '2px' : '3px',
            background: `linear-gradient(90deg, ${questColor}66 0%, ${questColor}22 100%)`,
            transform: 'translateY(-50%)',
            zIndex: 0,
            pointerEvents: 'none',
            opacity: isCollapsed ? 0.6 : 1,
          }}
        />
      )}

      {/* LEFT: Quest Header Card (Collapsed Single-Line vs Expanded) */}
      {isCollapsed ? (
        <div
          draggable={!isOpenRow}
          onDragStart={(e) => {
            if (isOpenRow) return;
            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'quest', questId: quest.id }));
            e.dataTransfer.effectAllowed = 'move';
            setDraggingQuestId(quest.id);
          }}
          onDragEnd={() => {
            setDraggingQuestId(null);
            setDragOverQuestId(null);
            setDragOverQuestPosition(null);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (!isOpenRow && draggingQuestId && draggingQuestId !== quest.id) {
              const rect = e.currentTarget.getBoundingClientRect();
              const pos = (e.clientY - rect.top) < rect.height / 2 ? 'above' : 'below';
              setDragOverQuestId(quest.id);
              setDragOverQuestPosition(pos);
            }
          }}
          onDragLeave={(e) => {
            const related = e.relatedTarget as Node | null;
            if (!e.currentTarget.contains(related)) {
              if (dragOverQuestId === quest.id) {
                setDragOverQuestId(null);
                setDragOverQuestPosition(null);
              }
            }
          }}
          onDrop={async (e) => {
            e.preventDefault();
            const raw = e.dataTransfer.getData('text/plain');
            if (!raw) return;
            try {
              const data = JSON.parse(raw);
              if (data.type === 'quest' && !isOpenRow && data.questId !== quest.id) {
                await onReorderQuests(data.questId, quest.id, dragOverQuestPosition || 'below');
              } else if (data.type === 'encounter') {
                const targetQuestId = isOpenRow ? null : quest.id;
                const currentSessionId = encounterSessionMap.get(data.encounterId) || null;
                await onMoveEncounter(data.encounterId, currentSessionId, targetQuestId);
              }
            } catch (err) {
              console.error(err);
            } finally {
              setDraggingQuestId(null);
              setDragOverQuestId(null);
              setDragOverQuestPosition(null);
            }
          }}
          onClick={() => onToggleQuestCollapse(quest.id)}
          className="glass-panel"
          style={{
            borderRadius: '8px',
            padding: '0 10px',
            marginLeft: isSubQuest ? '22px' : '0',
            background: isQuestHovered ? 'var(--bg-card-hover)' : 'var(--bg-card)',
            border: `1px solid ${isQuestHovered ? questColor : 'var(--border-subtle)'}`,
            borderLeft: isSubQuest ? `3px solid #60a5fa` : `4px solid ${questColor}`,
            cursor: 'pointer',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '38px',
            minHeight: '38px',
            boxSizing: 'border-box',
            transition: 'all 0.15s ease',
            opacity: draggingQuestId === quest.id ? 0.35 : 1,
            boxShadow: dragOverQuestId === quest.id
              ? dragOverQuestPosition === 'above'
                ? '0 -4px 0 0 var(--color-gold), 0 0 16px rgba(245, 158, 11, 0.4)'
                : '0 4px 0 0 var(--color-gold), 0 0 16px rgba(245, 158, 11, 0.4)'
              : 'none',
          }}
          title="Click to expand story line"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleQuestCollapse(quest.id);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: questColor,
                cursor: 'pointer',
                padding: '2px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              title="Expand story line"
            >
              <ChevronRight size={14} />
            </button>
            {!isOpenRow && (
              <GripVertical size={12} style={{ color: 'var(--text-muted)', cursor: 'grab', flexShrink: 0 }} />
            )}
            {isSubQuest && (
              <CornerDownRight size={12} style={{ color: '#60a5fa', flexShrink: 0 }} />
            )}
            <span
              style={{
                fontWeight: 700,
                fontSize: '0.82rem',
                lineHeight: 1.2,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {quest.title}
            </span>
            {isSubQuest && (
              <span style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '3px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', fontWeight: 600, flexShrink: 0 }}>
                Sub
              </span>
            )}
            {incomingPrereqs.length > 0 && (
              <span style={{ fontSize: '0.6rem', color: 'var(--color-gold)', display: 'inline-flex', alignItems: 'center', gap: '2px', flexShrink: 0 }} title={`Prerequisite: ${incomingPrereqs.map((p) => p.quest.title).join(', ')}`}>
                <Link2 size={10} />
              </span>
            )}
            {outgoingBranches.length > 0 && (
              <span style={{ fontSize: '0.6rem', color: '#60a5fa', display: 'inline-flex', alignItems: 'center', gap: '2px', flexShrink: 0 }} title={`Branches to ${outgoingBranches.length} path(s): ${outgoingBranches.map((b) => b.quest.title).join(', ')}`}>
                <GitFork size={10} />
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, marginLeft: '6px' }}>
            {subQuestCount > 0 && (
              <button
                type="button"
                onClick={(e) => onToggleSubQuestsCollapse(quest.id, e)}
                className="btn btn-ghost"
                style={{
                  fontSize: '0.62rem',
                  padding: '1px 6px',
                  height: '20px',
                  gap: '3px',
                  color: '#60a5fa',
                  background: isSubQuestsCollapsed ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.2)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
                title={isSubQuestsCollapsed ? 'Sub-quests folded. Click to unfold' : 'Sub-quests visible. Click to fold'}
              >
                {isSubQuestsCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                <span>{completedSubQuestCount}/{subQuestCount} sub</span>
              </button>
            )}
            <span
              className={`status-pill status-${quest.data_json?.status === 'completed' ? 'completed' : quest.data_json?.status === 'in_progress' ? 'inprogress' : 'planned'}`}
              style={{
                fontSize: '0.6rem',
                padding: '1px 5px',
              }}
            >
              {isOpenRow ? `${rowEncountersCount} scenes` : quest.data_json?.status === 'completed' ? '✓ Done' : quest.data_json?.status === 'in_progress' ? '● Active' : 'Planned'}
            </span>
            {!isOpenRow && (
              <span
                className="status-pill"
                style={{
                  fontSize: '0.6rem',
                  padding: '1px 5px',
                  background: `${questColor}1a`,
                  borderColor: `${questColor}44`,
                  color: questColor,
                }}
              >
                {rowEncountersCount} {rowEncountersCount === 1 ? 'scene' : 'scenes'}
              </span>
            )}
            {!isOpenRow && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectQuest(quest);
                }}
                className="btn btn-ghost"
                style={{ padding: '2px', height: '20px', width: '20px', minWidth: '20px' }}
                title="View Quest Details"
              >
                <ChevronRight size={12} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          draggable={!isOpenRow}
          onDragStart={(e) => {
            if (isOpenRow) return;
            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'quest', questId: quest.id }));
            e.dataTransfer.effectAllowed = 'move';
            setDraggingQuestId(quest.id);
          }}
          onDragEnd={() => {
            setDraggingQuestId(null);
            setDragOverQuestId(null);
            setDragOverQuestPosition(null);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (!isOpenRow && draggingQuestId && draggingQuestId !== quest.id) {
              const rect = e.currentTarget.getBoundingClientRect();
              const pos = (e.clientY - rect.top) < rect.height / 2 ? 'above' : 'below';
              setDragOverQuestId(quest.id);
              setDragOverQuestPosition(pos);
            }
          }}
          onDragLeave={(e) => {
            const related = e.relatedTarget as Node | null;
            if (!e.currentTarget.contains(related)) {
              if (dragOverQuestId === quest.id) {
                setDragOverQuestId(null);
                setDragOverQuestPosition(null);
              }
            }
          }}
          onDrop={async (e) => {
            e.preventDefault();
            const raw = e.dataTransfer.getData('text/plain');
            if (!raw) return;
            try {
              const data = JSON.parse(raw);
              if (data.type === 'quest' && !isOpenRow && data.questId !== quest.id) {
                await onReorderQuests(data.questId, quest.id, dragOverQuestPosition || 'below');
              } else if (data.type === 'encounter') {
                const targetQuestId = isOpenRow ? null : quest.id;
                const currentSessionId = encounterSessionMap.get(data.encounterId) || null;
                await onMoveEncounter(data.encounterId, currentSessionId, targetQuestId);
              }
            } catch (err) {
              console.error(err);
            } finally {
              setDraggingQuestId(null);
              setDragOverQuestId(null);
              setDragOverQuestPosition(null);
            }
          }}
          onClick={() => {
            if (!isOpenRow) onSelectQuest(quest);
          }}
          className="glass-panel"
          style={{
            borderRadius: '10px',
            padding: '14px',
            marginLeft: isSubQuest ? '22px' : '0',
            background: isQuestHovered ? 'var(--bg-card-hover)' : 'var(--bg-card)',
            border: `1px solid ${isQuestHovered ? questColor : 'var(--border-subtle)'}`,
            borderLeft: isSubQuest ? `4px solid #60a5fa` : `5px solid ${questColor}`,
            cursor: isOpenRow ? 'default' : 'grab',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'all 0.15s ease',
            opacity: draggingQuestId === quest.id ? 0.35 : 1,
            boxShadow: dragOverQuestId === quest.id
              ? dragOverQuestPosition === 'above'
                ? '0 -4px 0 0 var(--color-gold), 0 0 16px rgba(245, 158, 11, 0.4)'
                : '0 4px 0 0 var(--color-gold), 0 0 16px rgba(245, 158, 11, 0.4)'
              : 'none',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleQuestCollapse(quest.id);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  title="Collapse story line to single line"
                >
                  <ChevronDown size={14} />
                </button>
                {!isOpenRow && (
                  <GripVertical size={13} style={{ color: 'var(--text-muted)', cursor: 'grab', flexShrink: 0 }} />
                )}
                {isSubQuest && (
                  <CornerDownRight size={13} style={{ color: '#60a5fa', flexShrink: 0 }} />
                )}
                <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: questColor, letterSpacing: '0.5px' }}>
                  {quest.data_json?.category || (isOpenRow ? 'World Events' : isSubQuest ? 'Sub-Quest' : 'Storyline')}
                </span>
              </div>
              <span className={`status-pill status-${quest.data_json?.status === 'completed' ? 'completed' : quest.data_json?.status === 'in_progress' ? 'inprogress' : 'planned'}`}>
                {isOpenRow ? `${unassignedQuestEncounters.length} Scenes` : quest.data_json?.status === 'completed' ? '✓ Done' : (quest.data_json?.status === 'in_progress' ? '● Active' : 'Planned')}
              </span>
            </div>
            <h4 style={{ margin: '4px 0 2px', fontSize: '0.88rem', fontWeight: 700, lineHeight: 1.3 }}>
              {quest.title}
            </h4>
            {quest.summary && (
              <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)', lineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {quest.summary}
              </p>
            )}

            {/* Sub-Quest Milestone Rollup */}
            {subQuestCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', padding: '4px 8px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <span style={{ fontSize: '0.7rem', color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={12} style={{ color: completedSubQuestCount === subQuestCount ? '#10b981' : '#3b82f6' }} />
                  Objectives: {completedSubQuestCount}/{subQuestCount}
                </span>
                <button
                  type="button"
                  onClick={(e) => onToggleSubQuestsCollapse(quest.id, e)}
                  className="btn btn-ghost"
                  style={{
                    fontSize: '0.65rem',
                    padding: '2px 8px',
                    height: '22px',
                    gap: '4px',
                    color: '#60a5fa',
                    background: isSubQuestsCollapsed ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.2)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                  title={isSubQuestsCollapsed ? 'Unfold sub-quests in matrix' : 'Fold sub-quests under this quest'}
                >
                  {isSubQuestsCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                  {isSubQuestsCollapsed ? 'Show Sub-Quests' : 'Hide Sub-Quests'}
                </button>
              </div>
            )}

            {/* Prerequisites and Branches Badges */}
            {(incomingPrereqs.length > 0 || outgoingBranches.length > 0) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', marginTop: '6px' }}>
                {incomingPrereqs.map((p, pIdx) => (
                  <span
                    key={pIdx}
                    onClick={(e) => {
                      e.stopPropagation();
                      const targetEl = document.getElementById(`quest-row-${p.quest.id}`);
                      if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    style={{
                      fontSize: '0.64rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      cursor: 'pointer',
                    }}
                    title={`Prerequisite: ${p.quest.title}`}
                  >
                    <Link2 size={10} style={{ color: 'var(--color-gold)' }} />
                    Prereq: {p.quest.title.length > 14 ? `${p.quest.title.substring(0, 13)}…` : p.quest.title}
                  </span>
                ))}
                {outgoingBranches.length > 0 && (
                  <span
                    style={{
                      fontSize: '0.64rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(59, 130, 246, 0.12)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      color: '#93c5fd',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                    title={`Branches to: ${outgoingBranches.map((b) => b.quest.title).join(', ')}`}
                  >
                    <GitFork size={10} />
                    {outgoingBranches.length} Branch{outgoingBranches.length > 1 ? 'es' : ''}
                  </span>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', paddingTop: '6px', borderTop: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {rowEncountersCount} Encounters
            </span>
            {!isOpenRow && (
              <span style={{ fontSize: '0.7rem', color: questColor, display: 'flex', alignItems: 'center', gap: '3px' }}>
                Details <ChevronRight size={11} />
              </span>
            )}
          </div>
        </div>
      )}

      {/* SESSIONS COLUMNS: Placing Encounter Cards at Intersections */}
      {displayColumns.map((sess) => {
        const isStagingCol = sess.id === 'unscheduled-staging';
        const targetSessionId = isStagingCol ? null : sess.id;
        const targetQuestId = isOpenRow ? null : quest.id;
        const isCellDragOver =
          dragOverCell?.questId === targetQuestId && dragOverCell?.sessionId === targetSessionId;

        // Match encounters that belong to this quest AND this session
        const matchingEncounters = encounters.filter((e: NodeItem) => {
          const encQuestId = encounterQuestMap.get(e.id);
          const encSessionId = encounterSessionMap.get(e.id);

          const matchesQuest = isOpenRow ? !encQuestId : encQuestId === quest.id;
          const matchesSession = isStagingCol ? !encSessionId : encSessionId === sess.id;

          return matchesQuest && matchesSession;
        });

        const isSessionHovered = hoveredSessionId === sess.id;
        const isCellHighlighted = isQuestHovered || isSessionHovered;
        const isColCollapsed = collapsedSessionIds.has(sess.id);

        // CASE 1: Column itself is collapsed horizontally into a spine
        if (isColCollapsed) {
          return (
            <div
              key={sess.id}
              onClick={() => onToggleSessionCollapse(sess.id)}
              className="tapestry-collapsed-cell"
              title={`${matchingEncounters.length} scenes in ${sess.title} (Click to unroll)`}
            >
              {matchingEncounters.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                  <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '32px' }}>
                    {matchingEncounters.map((e: NodeItem) => (
                      <div
                        key={e.id}
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: e.data_json?.status === 'completed'
                            ? 'var(--color-emerald)'
                            : e.data_json?.status === 'in_progress'
                            ? 'var(--color-gold)'
                            : 'var(--text-muted)',
                        }}
                      />
                    ))}
                  </div>
                  <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {matchingEncounters.length}
                  </span>
                </div>
              ) : (
                <span style={{ color: 'rgba(255, 255, 255, 0.1)', fontSize: '0.7rem' }}>-</span>
              )}
            </div>
          );
        }

        // CASE 2: Quest row is collapsed vertically to a single line
        if (isCollapsed) {
          return (
            <div
              key={sess.id}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOverCell({ questId: targetQuestId, sessionId: targetSessionId });
              }}
              onDragLeave={(e) => {
                const related = e.relatedTarget as Node | null;
                if (!e.currentTarget.contains(related)) {
                  if (dragOverCell?.questId === targetQuestId && dragOverCell?.sessionId === targetSessionId) {
                    setDragOverCell(null);
                  }
                }
              }}
              onDrop={async (e) => {
                e.preventDefault();
                const raw = e.dataTransfer.getData('text/plain');
                if (!raw) return;
                try {
                  const data = JSON.parse(raw);
                  if (data.type === 'encounter') {
                    await onMoveEncounter(data.encounterId, targetSessionId, targetQuestId);
                  }
                } catch (err) {
                  console.error(err);
                } finally {
                  setDraggingEncounterId(null);
                  setDragOverCell(null);
                }
              }}
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                flexDirection: 'row',
                gap: '6px',
                alignItems: 'center',
                justifyContent: matchingEncounters.length > 0 ? 'flex-start' : 'center',
                background: isCellDragOver
                  ? 'rgba(245, 158, 11, 0.12)'
                  : isCellHighlighted
                  ? 'rgba(255, 255, 255, 0.02)'
                  : 'transparent',
                borderRadius: '8px',
                height: '38px',
                minHeight: '38px',
                maxHeight: '38px',
                padding: '0 6px',
                boxSizing: 'border-box',
                border: isCellDragOver
                  ? '2px dashed var(--color-gold)'
                  : isSessionHovered
                  ? '1px dashed var(--border-subtle)'
                  : '1px solid transparent',
                transition: 'all 0.15s ease',
                overflow: 'hidden',
              }}
            >
              {matchingEncounters.length > 0 ? (
                <>
                  {matchingEncounters.slice(0, 3).map((enc: NodeItem) => {
                    const encStatus = enc.data_json?.status || 'planned';
                    return (
                      <div
                        key={enc.id}
                        draggable={true}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'encounter', encounterId: enc.id }));
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggingEncounterId(enc.id);
                        }}
                        onDragEnd={() => {
                          setDraggingEncounterId(null);
                          setDragOverCell(null);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEncounter(enc);
                        }}
                        onMouseEnter={() => setHoveredEncounterId(enc.id)}
                        onMouseLeave={() => setHoveredEncounterId(null)}
                        title={`${enc.title} (${encStatus === 'completed' ? 'Done' : encStatus === 'in_progress' ? 'Active' : 'Planned'})`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: encStatus === 'completed'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : encStatus === 'in_progress'
                            ? 'rgba(245, 158, 11, 0.2)'
                            : isStagingCol
                            ? 'rgba(59, 130, 246, 0.1)'
                            : 'var(--bg-surface)',
                          border: `1px solid ${
                            encStatus === 'completed'
                              ? '#10b981'
                              : encStatus === 'in_progress'
                              ? 'var(--color-gold)'
                              : isStagingCol
                              ? 'rgba(59, 130, 246, 0.4)'
                              : 'var(--border-medium)'
                          }`,
                          fontSize: '0.7rem',
                          cursor: 'grab',
                          whiteSpace: 'nowrap',
                          maxWidth: '140px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        <Swords size={10} style={{ color: questColor, flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {enc.title}
                        </span>
                      </div>
                    );
                  })}
                  {matchingEncounters.length > 3 && (
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                      +{matchingEncounters.length - 3}
                    </span>
                  )}
                </>
              ) : (
                <span style={{ color: 'rgba(255, 255, 255, 0.1)', fontSize: '0.7rem' }}>-</span>
              )}
            </div>
          );
        }

        // CASE 3: Fully expanded cell with horizontal encounter beat flow & milestones
        const cellMilestones = milestoneReceivers.get(`${quest.id}-${sess.id}`) || [];

        return (
          <div
            key={sess.id}
            className="tapestry-expanded-cell"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOverCell({ questId: targetQuestId, sessionId: targetSessionId });
            }}
            onDragLeave={(e) => {
              const related = e.relatedTarget as Node | null;
              if (!e.currentTarget.contains(related)) {
                if (dragOverCell?.questId === targetQuestId && dragOverCell?.sessionId === targetSessionId) {
                  setDragOverCell(null);
                }
              }
            }}
            onDrop={async (e) => {
              e.preventDefault();
              const raw = e.dataTransfer.getData('text/plain');
              if (!raw) return;
              try {
                const data = JSON.parse(raw);
                if (data.type === 'encounter') {
                  await onMoveEncounter(data.encounterId, targetSessionId, targetQuestId);
                }
              } catch (err) {
                console.error(err);
              } finally {
                setDraggingEncounterId(null);
                setDragOverCell(null);
              }
            }}
            style={{
              background: isCellDragOver
                ? 'rgba(245, 158, 11, 0.12)'
                : isCellHighlighted
                ? 'rgba(255, 255, 255, 0.02)'
                : 'rgba(15, 20, 32, 0.3)',
              border: isCellDragOver
                ? '2px dashed var(--color-gold)'
                : isSessionHovered
                ? '1px dashed var(--border-subtle)'
                : '1px solid rgba(255, 255, 255, 0.04)',
            }}
          >
            {/* Milestone Sync Receiver Card */}
            {cellMilestones.map((ms, msIdx) => {
              const isMsHighlighted =
                hoveredMilestoneId === ms.id || hoveredEncounterId === ms.sourceEncounterId;
              return (
                <div
                  key={ms.id || msIdx}
                  id={`milestone-card-${ms.id}`}
                  className={`tapestry-milestone-sync-card ${isMsHighlighted ? 'highlighted' : ''}`}
                  title={`Milestone from ${ms.sourceEncounterTitle}: ${ms.summary || ms.label} (Click to focus emitter encounter)`}
                  onMouseEnter={() => setHoveredMilestoneId(ms.id)}
                  onMouseLeave={() => setHoveredMilestoneId(null)}
                  onClick={() => {
                    const encEl = document.getElementById(`enc-${ms.sourceEncounterId}`);
                    if (encEl) {
                      encEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    }
                    setHoveredEncounterId(ms.sourceEncounterId);
                  }}
                >
                  <div
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: 'var(--color-purple)',
                      color: '#080b11',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: '0.7rem',
                      flexShrink: 0,
                    }}
                  >
                    ✦
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#d8b4fe', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ms.label}
                    </div>
                    <div style={{ fontSize: '0.66rem', color: 'var(--text-secondary)', lineHeight: 1.2, marginTop: '2px', lineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {ms.summary || `Unlocked by ${ms.sourceEncounterTitle}`}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Encounter Cards rendered horizontally */}
            {matchingEncounters.length > 0 ? (
              matchingEncounters.map((enc: NodeItem, encIdx: number) => (
                <TapestryEncounterCard
                  key={enc.id}
                  encounter={enc}
                  encIdx={encIdx}
                  encounterDensity={encounterDensity}
                  isStagingCol={isStagingCol}
                  isOpenRow={isOpenRow}
                  hoveredEncounterId={hoveredEncounterId}
                  hoveredMilestoneId={hoveredMilestoneId}
                  milestoneLines={milestoneLines}
                  milestoneEmitters={milestoneEmitters}
                  encounterEntitiesMap={encounterEntitiesMap}
                  sessions={sessions}
                  quests={quests}
                  onSelectEncounter={onSelectEncounter}
                  onSelectEntity={onSelectEntity}
                  onToggleCanon={onToggleCanon}
                  onToggleReveal={onToggleReveal}
                  onAssignToSession={onAssignToSession}
                  onAssignToQuest={onAssignToQuest}
                  onDragStart={(encId, e) => {
                    e.stopPropagation();
                    e.dataTransfer.setData(
                      'text/plain',
                      JSON.stringify({
                        type: 'encounter',
                        encounterId: encId,
                      })
                    );
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggingEncounterId(encId);
                  }}
                  onDragEnd={() => {
                    setDraggingEncounterId(null);
                    setDragOverCell(null);
                  }}
                  onMouseEnter={(encId) => setHoveredEncounterId(encId)}
                  onMouseLeave={() => setHoveredEncounterId(null)}
                />
              ))
            ) : isCellDragOver ? (
              <div
                style={{
                  border: '1.5px dashed var(--color-gold)',
                  borderRadius: '8px',
                  padding: '16px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-gold)',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  gap: '5px',
                  background: 'rgba(245, 158, 11, 0.08)',
                }}
              >
                <Plus size={13} /> Drop Scene Here
              </div>
            ) : (
              /* Dormant Thread Pass-Through */
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <button
                  type="button"
                  onClick={() => onOpenAddEncounterModal(isOpenRow ? null : quest.id, isStagingCol ? null : sess.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                  }}
                  title={`Stage encounter for ${quest.title} in ${sess.title}`}
                >
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: `${questColor}44`,
                      border: `1px solid ${questColor}88`,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.4)';
                      e.currentTarget.style.background = questColor;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.background = `${questColor}44`;
                    }}
                  />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
