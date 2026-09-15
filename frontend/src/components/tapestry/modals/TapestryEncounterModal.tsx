import React from 'react';
import {
  Eye,
  EyeOff,
  ShieldCheck,
  Feather,
  Maximize2,
  Sparkles,
  Trash2,
  X,
  GitBranch,
  ChevronRight,
  Package,
  BookOpen,
} from 'lucide-react';
import { GraphData, NodeItem } from '../../../types';
import { MarkdownView } from '../../MarkdownView';

interface TapestryEncounterModalProps {
  encounter: NodeItem;
  onClose: () => void;
  onSelectNode: (node: NodeItem) => void;
  onFocusCoDM: (node: NodeItem) => void;
  onStatusChange: (node: NodeItem, newStatus: string) => void;
  onToggleCanon: (e: React.MouseEvent, node: NodeItem) => void;
  onToggleReveal: (e: React.MouseEvent, node: NodeItem) => void;
  onDeleteNode: (e: React.MouseEvent, id: string) => void;
  // Graph context
  graphData: GraphData;
  quests: NodeItem[];
  sessions: NodeItem[];
  encounters: NodeItem[];
  nodeMap: Map<string, NodeItem>;
  encounterQuestMap: Map<string, string>;
  encounterSessionMap: Map<string, string>;
  encounterEntitiesMap: Map<string, { locations: NodeItem[]; monsters: NodeItem[]; items: NodeItem[]; npcs: NodeItem[] }>;
  onAssignEncounterToQuest: (encounterId: string, questId: string | null) => void;
  onAssignEncounterToSession: (encounterId: string, sessionId: string | null) => void;
  // Milestone state & handlers
  newMilestoneQuestId: string;
  newMilestoneSummary: string;
  isSavingMilestone: boolean;
  onChangeMilestoneQuestId: (questId: string) => void;
  onChangeMilestoneSummary: (summary: string) => void;
  onAddMilestoneImpact: (encounterId: string) => void;
  onDeleteMilestoneImpact: (edgeId: string) => void;
  // Precedence state & handlers
  newBranchTargetEncounterId: string;
  newBranchLabel: string;
  isSavingPrecedence: boolean;
  onChangeBranchTargetEncounterId: (targetId: string) => void;
  onChangeBranchLabel: (label: string) => void;
  onAddBranchEncounter: (sourceId: string) => void;
  onDeletePrecedenceEdge: (edgeId: string) => void;
}

export const TapestryEncounterModal: React.FC<TapestryEncounterModalProps> = ({
  encounter,
  onClose,
  onSelectNode,
  onFocusCoDM,
  onStatusChange,
  onToggleCanon,
  onToggleReveal,
  onDeleteNode,
  graphData,
  quests,
  sessions,
  encounters,
  nodeMap,
  encounterQuestMap,
  encounterSessionMap,
  encounterEntitiesMap,
  onAssignEncounterToQuest,
  onAssignEncounterToSession,
  newMilestoneQuestId,
  newMilestoneSummary,
  isSavingMilestone,
  onChangeMilestoneQuestId,
  onChangeMilestoneSummary,
  onAddMilestoneImpact,
  onDeleteMilestoneImpact,
  newBranchTargetEncounterId,
  newBranchLabel,
  isSavingPrecedence,
  onChangeBranchTargetEncounterId,
  onChangeBranchLabel,
  onAddBranchEncounter,
  onDeletePrecedenceEdge,
}) => {
  const outgoingMilestones = graphData.edges.filter(
    (e) =>
      e.source_id === encounter.id &&
      (e.relation_type === 'advances_quest' || e.metadata_json?.is_milestone)
  );

  const incomingEdges = graphData.edges.filter(
    (e) => e.target_id === encounter.id && e.relation_type === 'precedes'
  );
  const outgoingEdges = graphData.edges.filter(
    (e) => e.source_id === encounter.id && e.relation_type === 'precedes'
  );

  const attached = encounterEntitiesMap.get(encounter.id) || { locations: [], monsters: [], items: [], npcs: [] };
  const hasAnyEntities = attached.locations.length > 0 || attached.monsters.length > 0 || attached.items.length > 0 || attached.npcs.length > 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(4, 7, 13, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '24px',
        animation: 'fadeIn 0.15s ease-out'
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel animate-scale-up"
        style={{
          width: '92vw',
          maxWidth: '1240px',
          height: '88vh',
          maxHeight: '920px',
          borderRadius: '16px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.75)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="badge badge-encounter" style={{ fontSize: '0.8rem', padding: '4px 10px', fontWeight: 800 }}>
              ENCOUNTER SCENE
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={(e) => onToggleReveal(e, encounter)}
                className="btn btn-ghost"
                style={{ padding: '4px', color: encounter.revealed_to_players ? 'var(--color-emerald)' : 'var(--text-muted)' }}
                title={encounter.revealed_to_players ? 'Revealed to Players' : 'Hidden Secret'}
              >
                {encounter.revealed_to_players ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button
                onClick={(e) => onToggleCanon(e, encounter)}
                className="btn btn-ghost"
                style={{ padding: '4px', color: (encounter.is_canon ?? true) ? 'var(--color-gold)' : 'var(--text-muted)' }}
                title="Canon protection"
              >
                {(encounter.is_canon ?? true) ? <ShieldCheck size={16} /> : <Feather size={16} />}
              </button>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                {encounter.title}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => {
                onSelectNode(encounter);
                onClose();
              }}
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '6px 12px', gap: '5px' }}
              title="Open full entity editor"
            >
              <Maximize2 size={14} /> Full Edit
            </button>
            <button
              onClick={() => {
                onFocusCoDM(encounter);
                onClose();
              }}
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '6px 12px', gap: '5px', color: 'var(--color-gold)', borderColor: 'rgba(245, 158, 11, 0.3)' }}
              title="Brainstorm scene in Co-DM Studio"
            >
              <Sparkles size={14} /> Brainstorm
            </button>
            <button
              onClick={() => onStatusChange(encounter, encounter.data_json?.status === 'completed' ? 'in_progress' : 'completed')}
              className={`btn ${encounter.data_json?.status === 'completed' ? 'btn-secondary' : 'btn-primary'}`}
              style={{ fontSize: '0.78rem', padding: '6px 14px' }}
            >
              {encounter.data_json?.status === 'completed' ? 'Mark In Progress' : '✓ Resolve Scene'}
            </button>
            <button
              onClick={(e) => onDeleteNode(e, encounter.id)}
              className="btn btn-ghost"
              style={{ padding: '6px', color: 'var(--color-crimson)' }}
              title="Delete encounter"
            >
              <Trash2 size={16} />
            </button>
            <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body / Two Columns */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left Column: Synopsis, Tapestry Alignment, Attached Entities */}
          <div
            style={{
              width: '420px',
              minWidth: '360px',
              maxWidth: '460px',
              borderRight: '1px solid var(--border-subtle)',
              padding: '20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              background: 'rgba(0, 0, 0, 0.1)'
            }}
          >
            {/* Synopsis */}
            {encounter.summary && (
              <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-gold)', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
                  Scene Synopsis
                </span>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
                  {encounter.summary}
                </p>
              </div>
            )}

            {/* Narrative Weave Alignment */}
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.05)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '12px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-gold)', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <GitBranch size={14} /> Narrative Tapestry Alignment
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Assigned Story Quest:
                  </label>
                  <select
                    value={encounterQuestMap.get(encounter.id) || ''}
                    onChange={(e) => onAssignEncounterToQuest(encounter.id, e.target.value || null)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      fontSize: '0.8rem',
                      borderRadius: '6px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-medium)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="">None (Open / World Event)</option>
                    {quests.map((q) => (
                      <option key={q.id} value={q.id}>{q.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Assigned Game Session:
                  </label>
                  <select
                    value={encounterSessionMap.get(encounter.id) || ''}
                    onChange={(e) => onAssignEncounterToSession(encounter.id, e.target.value || null)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      fontSize: '0.8rem',
                      borderRadius: '6px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-medium)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="">Unscheduled (Prep Staging)</option>
                    {sessions.map((s, idx) => (
                      <option key={s.id} value={s.id}>Session {idx + 1}: {s.title}</option>
                    ))}
                    {sessions.length === 0 && (
                      <option value="virtual-session-1">Session 1 (Prep & Kickoff)</option>
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* Milestone Consequences & Cross-Quest Impacts */}
            <div
              style={{
                background: 'rgba(168, 85, 247, 0.06)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: '12px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: '#c084fc', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ✦ Milestone Consequences
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Advances Other Quests
                </span>
              </div>

              {outgoingMilestones.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {outgoingMilestones.map((edge) => {
                    const targetQ = nodeMap.get(edge.target_id);
                    return (
                      <div
                        key={edge.id}
                        style={{
                          background: 'rgba(168, 85, 247, 0.12)',
                          border: '1px solid rgba(168, 85, 247, 0.35)',
                          borderRadius: '8px',
                          padding: '8px 10px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: '8px'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase', color: '#e9d5ff', background: 'rgba(168, 85, 247, 0.3)', padding: '1px 5px', borderRadius: '4px' }}>
                              Impacts
                            </span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {targetQ ? targetQ.title : 'Target Quest'}
                            </span>
                          </div>
                          {edge.metadata_json?.summary && (
                            <div style={{ fontSize: '0.72rem', color: '#d8b4fe', marginTop: '4px', lineHeight: 1.3 }}>
                              {edge.metadata_json.summary}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => onDeleteMilestoneImpact(edge.id)}
                          className="btn btn-ghost"
                          style={{ padding: '3px', color: 'var(--color-crimson)' }}
                          title="Remove milestone impact"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add new milestone impact */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: outgoingMilestones.length > 0 ? '8px' : '0', borderTop: outgoingMilestones.length > 0 ? '1px dashed rgba(168, 85, 247, 0.25)' : 'none' }}>
                <span style={{ fontSize: '0.72rem', color: '#e9d5ff', fontWeight: 600 }}>
                  Link to Storyline or Sub-Quest:
                </span>
                <select
                  value={newMilestoneQuestId}
                  onChange={(e) => onChangeMilestoneQuestId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '5px 8px',
                    fontSize: '0.78rem',
                    borderRadius: '6px',
                    background: 'var(--bg-surface)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    color: 'var(--text-primary)'
                  }}
                >
                  <option value="">Select Impacted Quest...</option>
                  {quests.map((q) => (
                    <option key={q.id} value={q.id}>{q.title}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Consequence / milestone note (e.g. Unlocks Chapter 2)"
                  value={newMilestoneSummary}
                  onChange={(e) => onChangeMilestoneSummary(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '5px 8px',
                    fontSize: '0.78rem',
                    borderRadius: '6px',
                    background: 'var(--bg-surface)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    color: 'var(--text-primary)'
                  }}
                />
                <button
                  type="button"
                  onClick={() => onAddMilestoneImpact(encounter.id)}
                  disabled={!newMilestoneQuestId || isSavingMilestone}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.74rem',
                    padding: '4px 10px',
                    color: '#c084fc',
                    borderColor: 'rgba(168, 85, 247, 0.4)',
                    background: 'rgba(168, 85, 247, 0.1)',
                    opacity: (!newMilestoneQuestId || isSavingMilestone) ? 0.5 : 1,
                    cursor: (!newMilestoneQuestId || isSavingMilestone) ? 'not-allowed' : 'pointer'
                  }}
                >
                  ✦ Link Milestone Consequence
                </button>
              </div>
            </div>

            {/* Scene Precedence & Branching Flows */}
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.06)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '12px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-gold)', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⚡ Scene Flow &amp; Precedence
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Golden Connecting Lines
                </span>
              </div>

              {/* Existing Precursor Scenes */}
              {incomingEdges.length > 0 && (
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Preceded By:
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {incomingEdges.map((edge) => {
                      const srcNode = nodeMap.get(edge.source_id);
                      return (
                        <div
                          key={edge.id}
                          style={{
                            background: 'rgba(245, 158, 11, 0.12)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            borderRadius: '6px',
                            padding: '5px 8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '6px'
                          }}
                        >
                          <span style={{ fontSize: '0.76rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                            ← {srcNode?.title || 'Unknown Encounter'} {edge.label ? `(${edge.label})` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => onDeletePrecedenceEdge(edge.id)}
                            className="btn btn-ghost"
                            style={{ padding: '2px', color: 'var(--color-crimson)' }}
                            title="Remove link"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Existing Downstream Branches */}
              {outgoingEdges.length > 0 && (
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Leads To (Branches):
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {outgoingEdges.map((edge) => {
                      const tgtNode = nodeMap.get(edge.target_id);
                      return (
                        <div
                          key={edge.id}
                          style={{
                            background: 'rgba(245, 158, 11, 0.12)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            borderRadius: '6px',
                            padding: '5px 8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '6px'
                          }}
                        >
                          <span style={{ fontSize: '0.76rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                            → {tgtNode?.title || 'Unknown Encounter'} {edge.label ? `[${edge.label}]` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => onDeletePrecedenceEdge(edge.id)}
                            className="btn btn-ghost"
                            style={{ padding: '2px', color: 'var(--color-crimson)' }}
                            title="Remove link"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add Branch Link Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '6px', borderTop: '1px dashed rgba(245, 158, 11, 0.25)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-gold)', fontWeight: 600 }}>
                  Link to Next Scene / Branch:
                </span>
                <select
                  value={newBranchTargetEncounterId}
                  onChange={(e) => onChangeBranchTargetEncounterId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '5px 8px',
                    fontSize: '0.78rem',
                    borderRadius: '6px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)'
                  }}
                >
                  <option value="">Select Next Scene...</option>
                  {encounters
                    .filter((e) => e.id !== encounter.id)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.title}
                      </option>
                    ))}
                </select>
                <input
                  type="text"
                  placeholder="Condition / branch label (e.g. Stealth, Combat, Success)"
                  value={newBranchLabel}
                  onChange={(e) => onChangeBranchLabel(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '5px 8px',
                    fontSize: '0.78rem',
                    borderRadius: '6px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)'
                  }}
                />
                <button
                  type="button"
                  onClick={() => onAddBranchEncounter(encounter.id)}
                  disabled={!newBranchTargetEncounterId || isSavingPrecedence}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.74rem',
                    padding: '4px 10px',
                    color: 'var(--color-gold)',
                    borderColor: 'rgba(245, 158, 11, 0.4)',
                    background: 'rgba(245, 158, 11, 0.1)',
                    opacity: (!newBranchTargetEncounterId || isSavingPrecedence) ? 0.5 : 1,
                    cursor: (!newBranchTargetEncounterId || isSavingPrecedence) ? 'not-allowed' : 'pointer'
                  }}
                >
                  ⚡ Connect Precedence Line
                </button>
              </div>
            </div>

            {/* Attached Entities (Monsters, Locations, Items, NPCs) */}
            <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
                  Attached World Entities
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Click to inspect
                </span>
              </div>

              {!hasAnyEntities ? (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                  No monsters, items, or locations attached yet.
                </p>
              ) : (
                <>
                  {attached.locations.length > 0 && (
                    <div>
                      <span style={{ fontSize: '0.74rem', color: '#34d399', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                        📍 Locations:
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {attached.locations.map((loc) => (
                          <div
                            key={loc.id}
                            onClick={() => onSelectNode(loc)}
                            style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                          >
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{loc.title}</span>
                            <ChevronRight size={13} style={{ color: '#34d399' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {attached.monsters.length > 0 && (
                    <div>
                      <span style={{ fontSize: '0.74rem', color: '#f87171', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                        👹 Monsters &amp; NPCs ({attached.monsters.length}):
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {attached.monsters.map((m) => (
                          <div
                            key={m.id}
                            onClick={() => onSelectNode(m)}
                            style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                          >
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{m.title}</span>
                            <ChevronRight size={13} style={{ color: '#f87171' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {attached.items.length > 0 && (
                    <div>
                      <span style={{ fontSize: '0.74rem', color: '#c084fc', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                        🎁 Loot &amp; Rewards ({attached.items.length}):
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {attached.items.map((it) => (
                          <div
                            key={it.id}
                            onClick={() => onSelectNode(it)}
                            style={{ background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                          >
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{it.title}</span>
                            <Package size={13} style={{ color: '#c084fc' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right Column: Full Read-Aloud & DM Notes Canvas */}
          <div
            style={{
              flex: 1,
              padding: '20px 26px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BookOpen size={16} /> Read-Aloud Boxed Text &amp; DM Tactical Secrets
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Markdown Rendered
              </span>
            </div>

            {encounter.content_markdown ? (
              <div style={{ background: 'rgba(0, 0, 0, 0.2)', borderRadius: '10px', padding: '20px', border: '1px solid var(--border-subtle)' }}>
                <MarkdownView content={encounter.content_markdown} />
              </div>
            ) : (
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.1)',
                  borderRadius: '10px',
                  padding: '32px',
                  border: '1px dashed var(--border-medium)',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem'
                }}
              >
                <p style={{ margin: '0 0 12px' }}>No detailed read-aloud boxed text or DM tactical secrets added yet.</p>
                <button
                  onClick={() => {
                    onSelectNode(encounter);
                    onClose();
                  }}
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem' }}
                >
                  Add Boxed Text in Full Editor
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
