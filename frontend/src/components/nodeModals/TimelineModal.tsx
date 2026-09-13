import React, { useState, useMemo } from 'react';
import {
  Calendar,
  CheckCircle,
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  Layers,
  Sparkles,
  Swords,
  Target,
  Trophy,
  User,
  Users,
  GitFork,
  Plus,
  Trash2,
  ExternalLink,
  Link2,
  ArrowRight,
  X,
  Check,
  Edit2,
  BookOpen
} from 'lucide-react';
import { NodeItem, EdgeItem } from '../../types';
import { createEdge, deleteEdge, createSubQuest, updateNode } from '../../api';
import { RunSheetModal } from '../RunSheetModal';

interface TimelineModalProps {
  node: NodeItem;
  campaignId: string;
  dataJson: Record<string, any>;
  onChangeDataJson: (updated: Record<string, any>) => void;
  allNodes?: NodeItem[];
  edges?: EdgeItem[];
  onNavigateNode?: (targetNode: NodeItem) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  planned: { label: 'Planned / Upcoming', color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.05)' },
  in_progress: { label: 'In Progress / Active', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  completed: { label: 'Completed / Resolved', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
  abandoned: { label: 'Bypassed / Abandoned', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' },
};

const ENCOUNTER_TYPES = ['Combat', 'Social Roleplay', 'Trap & Hazard', 'Puzzle & Mystery', 'Exploration & Travel'];
const ENCOUNTER_DIFFICULTIES = ['Trivial', 'Easy', 'Medium', 'Hard', 'Deadly'];
const QUEST_TYPES = ['Main Story Quest', 'Character Backstory Quest', 'Faction Mission', 'Bounty / Monster Hunt', 'Side Quest'];

export const TimelineModal: React.FC<TimelineModalProps> = ({
  node,
  campaignId,
  dataJson,
  onChangeDataJson,
  allNodes = [],
  edges = [],
  onNavigateNode,
}) => {
  const status = dataJson.status || 'planned';
  const [showRunSheet, setShowRunSheet] = useState<boolean>(false);

  // Sub-quest and branching state
  const [newSubQuestTitle, setNewSubQuestTitle] = useState('');
  const [isAddingSubQuest, setIsAddingSubQuest] = useState(false);
  const [selectedPrereqId, setSelectedPrereqId] = useState('');
  const [isAddingPrereq, setIsAddingPrereq] = useState(false);
  const [selectedBranchTargetId, setSelectedBranchTargetId] = useState('');
  const [branchConditionLabel, setBranchConditionLabel] = useState('');
  const [isAddingBranch, setIsAddingBranch] = useState(false);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [editingEdgeLabel, setEditingEdgeLabel] = useState('');

  // Node lookup map
  const nodeMap = useMemo(() => {
    const map = new Map<string, NodeItem>();
    allNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [allNodes]);

  // Find Parent Quest (if this node is a sub-quest)
  const parentQuest = useMemo(() => {
    if (node.type !== 'quest') return null;
    const parentEdge = edges.find(
      (e) =>
        e.target_id === node.id &&
        (e.relation_type === 'contains' || e.relation_type === 'parent_of') &&
        nodeMap.get(e.source_id)?.type === 'quest'
    );
    return parentEdge ? nodeMap.get(parentEdge.source_id) || null : null;
  }, [node.id, node.type, edges, nodeMap]);

  // Find Child Sub-Quests
  const subQuests = useMemo(() => {
    if (node.type !== 'quest') return [];
    return edges
      .filter(
        (e) =>
          e.source_id === node.id &&
          (e.relation_type === 'contains' || e.relation_type === 'parent_of') &&
          nodeMap.get(e.target_id)?.type === 'quest'
      )
      .map((e) => ({
        edgeId: e.id,
        node: nodeMap.get(e.target_id)!,
      }))
      .filter((item) => !!item.node);
  }, [node.id, node.type, edges, nodeMap]);

  // Find Prerequisites (incoming precedes edges)
  const prerequisites = useMemo(() => {
    if (node.type !== 'quest') return [];
    return edges
      .filter(
        (e) =>
          e.target_id === node.id &&
          e.relation_type === 'precedes' &&
          nodeMap.get(e.source_id)?.type === 'quest'
      )
      .map((e) => ({
        edgeId: e.id,
        node: nodeMap.get(e.source_id)!,
        label: e.label || '',
      }))
      .filter((item) => !!item.node);
  }, [node.id, node.type, edges, nodeMap]);

  // Find Downstream Branches (outgoing precedes edges)
  const downstreamBranches = useMemo(() => {
    if (node.type !== 'quest') return [];
    return edges
      .filter(
        (e) =>
          e.source_id === node.id &&
          e.relation_type === 'precedes' &&
          nodeMap.get(e.target_id)?.type === 'quest'
      )
      .map((e) => ({
        edgeId: e.id,
        node: nodeMap.get(e.target_id)!,
        label: e.label || '',
      }))
      .filter((item) => !!item.node);
  }, [node.id, node.type, edges, nodeMap]);

  // Available quests to link as prerequisite (excluding self, existing prereqs, and sub-quests)
  const availablePrereqQuests = useMemo(() => {
    const existingPrereqIds = new Set(prerequisites.map((p) => p.node.id));
    return allNodes.filter(
      (n) => n.type === 'quest' && n.id !== node.id && !existingPrereqIds.has(n.id)
    );
  }, [allNodes, node.id, prerequisites]);

  // Available quests to link as branch target
  const availableBranchQuests = useMemo(() => {
    const existingBranchIds = new Set(downstreamBranches.map((b) => b.node.id));
    return allNodes.filter(
      (n) => n.type === 'quest' && n.id !== node.id && !existingBranchIds.has(n.id)
    );
  }, [allNodes, node.id, downstreamBranches]);

  // Handlers
  const handleAddSubQuest = async () => {
    if (!newSubQuestTitle.trim()) return;
    try {
      await createSubQuest(campaignId, node.id, newSubQuestTitle.trim());
      setNewSubQuestTitle('');
      setIsAddingSubQuest(false);
    } catch (err) {
      console.error('Failed to add sub-quest:', err);
    }
  };

  const handleToggleSubQuestStatus = async (subNode: NodeItem) => {
    const current = subNode.data_json?.status || 'planned';
    const next = current === 'completed' ? 'planned' : 'completed';
    try {
      await updateNode(subNode.id, {
        data_json: { ...subNode.data_json, status: next },
      });
    } catch (err) {
      console.error('Failed to update sub-quest status:', err);
    }
  };

  const handleAddPrerequisite = async () => {
    if (!selectedPrereqId) return;
    try {
      await createEdge({
        campaign_id: campaignId,
        source_id: selectedPrereqId,
        target_id: node.id,
        relation_type: 'precedes',
        label: 'Prerequisite',
      });
      setSelectedPrereqId('');
      setIsAddingPrereq(false);
    } catch (err) {
      console.error('Failed to add prerequisite:', err);
    }
  };

  const handleAddBranch = async () => {
    if (!selectedBranchTargetId) return;
    try {
      await createEdge({
        campaign_id: campaignId,
        source_id: node.id,
        target_id: selectedBranchTargetId,
        relation_type: 'precedes',
        label: branchConditionLabel.trim() || 'Next Objective',
      });
      setSelectedBranchTargetId('');
      setBranchConditionLabel('');
      setIsAddingBranch(false);
    } catch (err) {
      console.error('Failed to add branch:', err);
    }
  };

  const handleDeleteDependencyEdge = async (edgeId: string) => {
    try {
      await deleteEdge(edgeId);
    } catch (err) {
      console.error('Failed to delete edge:', err);
    }
  };

  const handleSaveEdgeLabel = async (edgeId: string) => {
    try {
      const edge = edges.find((e) => e.id === edgeId);
      if (edge) {
        await createEdge({
          ...edge,
          label: editingEdgeLabel.trim(),
        });
      }
      setEditingEdgeId(null);
    } catch (err) {
      console.error('Failed to update edge label:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Narrative Status Selector */}
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
          <Clock size={15} /> Campaign Progress &amp; Narrative Status
        </span>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          {Object.entries(STATUS_CONFIG).map(([stKey, cfg]) => {
            const active = status === stKey;
            return (
              <button
                key={stKey}
                type="button"
                onClick={() => onChangeDataJson({ ...dataJson, status: stKey })}
                style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: active ? 700 : 500,
                  background: active ? cfg.bg : 'rgba(255, 255, 255, 0.04)',
                  border: `1px solid ${active ? cfg.color : 'var(--border-subtle)'}`,
                  color: active ? cfg.color : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'center',
                }}
              >
                {cfg.label.split(' / ')[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Type-Specific Panels */}

      {/* 1. ARC PANEL */}
      {node.type === 'arc' && (
        <div
          style={{
            padding: '14px',
            borderRadius: '10px',
            background: 'rgba(251, 191, 36, 0.05)',
            border: '1px solid rgba(251, 191, 36, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={15} /> Campaign Arc Parameters
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Target Level Range
              </label>
              <input
                type="text"
                placeholder="e.g. Levels 1 - 4"
                value={dataJson.level_range || ''}
                onChange={(e) => onChangeDataJson({ ...dataJson, level_range: e.target.value })}
                className="input"
                style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Main Villain / Antagonist
              </label>
              <input
                type="text"
                placeholder="e.g. Belak the Outcast"
                value={dataJson.villain || ''}
                onChange={(e) => onChangeDataJson({ ...dataJson, villain: e.target.value })}
                className="input"
                style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. QUEST PANEL */}
      {node.type === 'quest' && (
        <div
          style={{
            padding: '14px',
            borderRadius: '10px',
            background: 'rgba(59, 130, 246, 0.05)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Target size={15} /> Quest Blueprint &amp; Stakes
          </span>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Quest Classification
              </label>
              <select
                value={dataJson.quest_type || 'Main Story Quest'}
                onChange={(e) => onChangeDataJson({ ...dataJson, quest_type: e.target.value })}
                className="input"
                style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
              >
                {QUEST_TYPES.map((qt) => (
                  <option key={qt} value={qt}>
                    {qt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Quest Giver / Patron
              </label>
              <input
                type="text"
                placeholder="e.g. Kerowyn Hucrele"
                value={dataJson.quest_giver || ''}
                onChange={(e) => onChangeDataJson({ ...dataJson, quest_giver: e.target.value })}
                className="input"
                style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Rewards / Bounty (Gold, XP, Magic Item, Renown)
            </label>
          </div>

          {/* STORY FLOW, SUB-QUESTS & BRANCHING */}
          <div
            style={{
              padding: '12px',
              borderRadius: '8px',
              background: 'rgba(0, 0, 0, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginTop: '4px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <GitFork size={14} /> Story Flow &amp; Dependencies
              </span>
              {parentQuest && (
                <span
                  onClick={() => onNavigateNode && onNavigateNode(parentQuest)}
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-secondary)',
                    cursor: onNavigateNode ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Click to view parent quest"
                >
                  Sub-quest of: <strong style={{ color: '#60a5fa' }}>{parentQuest.title}</strong>
                  {onNavigateNode && <ExternalLink size={11} />}
                </span>
              )}
            </div>

            {/* A. PREREQUISITES */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Prerequisites (Must complete before this quest)
                </span>
                {!isAddingPrereq && availablePrereqQuests.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsAddingPrereq(true)}
                    className="btn btn-ghost"
                    style={{ fontSize: '0.68rem', padding: '2px 6px', gap: '3px', height: '22px' }}
                  >
                    <Plus size={11} /> Add Prereq
                  </button>
                )}
              </div>

              {prerequisites.length === 0 && !isAddingPrereq ? (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No prerequisites (unlocked from start of arc).
                </span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {prerequisites.map((p) => {
                    const isDone = p.node.data_json?.status === 'completed';
                    return (
                      <div
                        key={p.edgeId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'rgba(255, 255, 255, 0.03)',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '0.74rem',
                        }}
                      >
                        <div
                          onClick={() => onNavigateNode && onNavigateNode(p.node)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: onNavigateNode ? 'pointer' : 'default',
                            flex: 1,
                            overflow: 'hidden',
                          }}
                        >
                          <Link2 size={12} style={{ color: isDone ? '#10b981' : 'var(--text-muted)', flexShrink: 0 }} />
                          <span style={{ color: isDone ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none' }}>
                            {p.node.title}
                          </span>
                          <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', background: isDone ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.06)', color: isDone ? '#34d399' : 'var(--text-muted)' }}>
                            {p.node.data_json?.status || 'planned'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteDependencyEdge(p.edgeId)}
                          className="btn btn-ghost"
                          style={{ padding: '2px 4px', color: 'var(--text-muted)' }}
                          title="Remove prerequisite"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Prereq form */}
              {isAddingPrereq && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px', alignItems: 'center' }}>
                  <select
                    value={selectedPrereqId}
                    onChange={(e) => setSelectedPrereqId(e.target.value)}
                    className="input"
                    style={{ fontSize: '0.75rem', padding: '4px 8px', flex: 1 }}
                  >
                    <option value="">Select a prerequisite quest...</option>
                    {availablePrereqQuests.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddPrerequisite}
                    disabled={!selectedPrereqId}
                    className="btn btn-primary"
                    style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                  >
                    Link
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingPrereq(false)}
                    className="btn btn-ghost"
                    style={{ padding: '4px 6px' }}
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>

            {/* B. SUB-QUESTS & MILESTONES */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Sub-Quests &amp; Milestone Objectives ({subQuests.filter((s) => s.node.data_json?.status === 'completed').length}/{subQuests.length})
                </span>
                {!isAddingSubQuest && (
                  <button
                    type="button"
                    onClick={() => setIsAddingSubQuest(true)}
                    className="btn btn-ghost"
                    style={{ fontSize: '0.68rem', padding: '2px 6px', gap: '3px', height: '22px' }}
                  >
                    <Plus size={11} /> Add Objective
                  </button>
                )}
              </div>

              {subQuests.length === 0 && !isAddingSubQuest ? (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No sub-quests defined yet.
                </span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {subQuests.map((sq) => {
                    const isDone = sq.node.data_json?.status === 'completed';
                    return (
                      <div
                        key={sq.edgeId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'rgba(255, 255, 255, 0.03)',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '0.74rem',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            flex: 1,
                            overflow: 'hidden',
                          }}
                          onClick={() => handleToggleSubQuestStatus(sq.node)}
                        >
                          {isDone ? (
                            <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                          ) : (
                            <Circle size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          )}
                          <span
                            onClick={(e) => {
                              if (onNavigateNode) {
                                e.stopPropagation();
                                onNavigateNode(sq.node);
                              }
                            }}
                            style={{
                              color: isDone ? 'var(--text-muted)' : 'var(--text-primary)',
                              textDecoration: isDone ? 'line-through' : 'none',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title="Click to view sub-quest details"
                          >
                            {sq.node.title}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteDependencyEdge(sq.edgeId)}
                          className="btn btn-ghost"
                          style={{ padding: '2px 4px', color: 'var(--text-muted)' }}
                          title="Unlink sub-quest"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Sub-quest inline */}
              {isAddingSubQuest && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Sub-quest / objective title..."
                    value={newSubQuestTitle}
                    onChange={(e) => setNewSubQuestTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddSubQuest();
                      else if (e.key === 'Escape') setIsAddingSubQuest(false);
                    }}
                    autoFocus
                    className="input"
                    style={{ fontSize: '0.75rem', padding: '4px 8px', flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={handleAddSubQuest}
                    disabled={!newSubQuestTitle.trim()}
                    className="btn btn-primary"
                    style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingSubQuest(false)}
                    className="btn btn-ghost"
                    style={{ padding: '4px 6px' }}
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>

            {/* C. DOWNSTREAM BRANCHES */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Next Branches &amp; Unlocks (Where this quest leads)
                </span>
                {!isAddingBranch && availableBranchQuests.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsAddingBranch(true)}
                    className="btn btn-ghost"
                    style={{ fontSize: '0.68rem', padding: '2px 6px', gap: '3px', height: '22px' }}
                  >
                    <Plus size={11} /> Add Branch
                  </button>
                )}
              </div>

              {downstreamBranches.length === 0 && !isAddingBranch ? (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No downstream branches linked yet.
                </span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {downstreamBranches.map((b) => (
                    <div
                      key={b.edgeId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(255, 255, 255, 0.03)',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                      }}
                    >
                      <div
                        onClick={() => onNavigateNode && onNavigateNode(b.node)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: onNavigateNode ? 'pointer' : 'default',
                          flex: 1,
                          overflow: 'hidden',
                        }}
                      >
                        <ArrowRight size={12} style={{ color: '#60a5fa', flexShrink: 0 }} />
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                          {b.node.title}
                        </span>
                        {editingEdgeId === b.edgeId ? (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}
                          >
                            <input
                              type="text"
                              value={editingEdgeLabel}
                              onChange={(e) => setEditingEdgeLabel(e.target.value)}
                              placeholder="Condition / trigger"
                              className="input"
                              style={{ fontSize: '0.68rem', padding: '2px 6px', width: '120px' }}
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEdgeLabel(b.edgeId)}
                              className="btn btn-primary"
                              style={{ padding: '2px 4px' }}
                            >
                              <Check size={10} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingEdgeId(null)}
                              className="btn btn-ghost"
                              style={{ padding: '2px 4px' }}
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ) : (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingEdgeId(b.edgeId);
                              setEditingEdgeLabel(b.label || '');
                            }}
                            style={{
                              fontSize: '0.65rem',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: 'rgba(59, 130, 246, 0.15)',
                              color: '#93c5fd',
                              cursor: 'pointer',
                            }}
                            title="Click to edit condition label"
                          >
                            {b.label ? `Condition: ${b.label}` : '+ Add condition'}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteDependencyEdge(b.edgeId)}
                        className="btn btn-ghost"
                        style={{ padding: '2px 4px', color: 'var(--text-muted)' }}
                        title="Remove branch link"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Branch form */}
              {isAddingBranch && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <select
                      value={selectedBranchTargetId}
                      onChange={(e) => setSelectedBranchTargetId(e.target.value)}
                      className="input"
                      style={{ fontSize: '0.75rem', padding: '4px 8px', flex: 1 }}
                    >
                      <option value="">Select target quest to unlock...</option>
                      {availableBranchQuests.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Trigger condition (e.g. 'If party accepts deal')..."
                      value={branchConditionLabel}
                      onChange={(e) => setBranchConditionLabel(e.target.value)}
                      className="input"
                      style={{ fontSize: '0.75rem', padding: '4px 8px', flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={handleAddBranch}
                      disabled={!selectedBranchTargetId}
                      className="btn btn-primary"
                      style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                    >
                      Add Branch
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingBranch(false)}
                      className="btn btn-ghost"
                      style={{ padding: '4px 6px' }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. SESSION PANEL */}
      {node.type === 'session' && (
        <div
          style={{
            padding: '14px',
            borderRadius: '10px',
            background: 'rgba(14, 165, 233, 0.05)',
            border: '1px solid rgba(14, 165, 233, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={15} /> Session Log &amp; Agenda
          </span>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Session Date (Real or In-World)
              </label>
              <input
                type="text"
                placeholder="e.g. 2026-09-12 or 1492 DR Ches 14"
                value={dataJson.session_date || ''}
                onChange={(e) => onChangeDataJson({ ...dataJson, session_date: e.target.value })}
                className="input"
                style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Planned Beats / Focus
              </label>
              <input
                type="text"
                placeholder="e.g. Infiltrate goblin redoubt, free Meepo"
                value={dataJson.agenda || ''}
                onChange={(e) => onChangeDataJson({ ...dataJson, agenda: e.target.value })}
                className="input"
                style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '10px', borderTop: '1px solid rgba(14, 165, 233, 0.15)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              {dataJson.run_sheet?.generated_at ? `⚡ Run-Sheet Active (${new Date(dataJson.run_sheet.generated_at).toLocaleDateString()})` : 'Timeline-centric run-sheet available'}
            </span>
            <button
              type="button"
              onClick={() => setShowRunSheet(true)}
              className="btn btn-secondary"
              style={{
                fontSize: '0.76rem',
                padding: '5px 12px',
                color: 'var(--color-gold, #f59e0b)',
                borderColor: 'rgba(245, 158, 11, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <BookOpen size={13} /> Open Table Run-Sheet
            </button>
          </div>
        </div>
      )}

      {/* 4. ENCOUNTER PANEL */}
      {node.type === 'encounter' && (
        <div
          style={{
            padding: '14px',
            borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Swords size={15} /> Encounter Dynamics &amp; Threat
          </span>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Encounter Type
              </label>
              <select
                value={dataJson.encounter_type || 'Combat'}
                onChange={(e) => onChangeDataJson({ ...dataJson, encounter_type: e.target.value })}
                className="input"
                style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
              >
                {ENCOUNTER_TYPES.map((et) => (
                  <option key={et} value={et}>
                    {et}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Difficulty Rating
              </label>
              <select
                value={dataJson.difficulty || 'Medium'}
                onChange={(e) => onChangeDataJson({ ...dataJson, difficulty: e.target.value })}
                className="input"
                style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
              >
                {ENCOUNTER_DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Hostile Combatants / Hazards Involved
            </label>
            <input
              type="text"
              placeholder="e.g. 4x Kobolds, 1x Dire Rat, Pit Trap DC 13"
              value={dataJson.combatants || ''}
              onChange={(e) => onChangeDataJson({ ...dataJson, combatants: e.target.value })}
              className="input"
              style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
            />
          </div>
        </div>
      )}

      {/* RUN-SHEET MODAL */}
      {showRunSheet && (
        <RunSheetModal
          sessionNode={node}
          campaignId={campaignId}
          onClose={() => setShowRunSheet(false)}
          onSaveNode={(updated) => {
            onChangeDataJson(updated.data_json || {});
          }}
        />
      )}
    </div>
  );
};
