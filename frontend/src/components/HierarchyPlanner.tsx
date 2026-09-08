import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  Feather,
  Flame,
  MessageSquare,
  Mic,
  Plus,
  Shield,
  ShieldCheck,
  Sparkles,
  Swords,
  Trash2,
} from 'lucide-react';
import { createEdge, createNode, deleteNode, toggleNodeCanon, toggleNodeReveal, updateNode } from '../api';
import { HierarchyItem, NodeItem, NodeType } from '../types';

interface HierarchyPlannerProps {
  hierarchy: HierarchyItem[];
  campaignId: string;
  onRefresh: () => void;
  onSelectNode: (node: NodeItem) => void;
  onFocusCoDM: (node: NodeItem) => void;
  onNavigateToIngestion?: () => void;
  onNavigateToTranscript?: (sessionNodeId?: string) => void;
}

export const HierarchyPlanner: React.FC<HierarchyPlannerProps> = ({
  hierarchy,
  campaignId,
  onRefresh,
  onSelectNode,
  onFocusCoDM,
  onNavigateToIngestion,
  onNavigateToTranscript,
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [targetParentId, setTargetParentId] = useState<string | null>(null);
  const [targetChildType, setTargetChildType] = useState<NodeType>('arc');
  const [newTitle, setNewTitle] = useState('');
  const [newSummary, setNewSummary] = useState('');

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleToggleCanon = async (e: React.MouseEvent, node: NodeItem) => {
    e.stopPropagation();
    try {
      await toggleNodeCanon(node.id);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleReveal = async (e: React.MouseEvent, node: NodeItem) => {
    e.stopPropagation();
    try {
      await toggleNodeReveal(node.id);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // Helper to find all ancestor nodes in the hierarchy tree for a given target node id
  const findAncestors = (
    items: HierarchyItem[],
    targetId: string,
    currentPath: NodeItem[] = []
  ): NodeItem[] | null => {
    for (const item of items) {
      if (item.node.id === targetId) {
        return currentPath;
      }
      if (item.children && item.children.length > 0) {
        const found = findAncestors(item.children, targetId, [...currentPath, item.node]);
        if (found) return found;
      }
    }
    return null;
  };

  const handleStatusChange = async (e: React.MouseEvent, node: NodeItem, newStatus: string) => {
    e.stopPropagation();
    try {
      const data = { ...(node.data_json || {}), status: newStatus };
      await updateNode(node.id, { data_json: data });

      // When marking a node "In Progress", automatically cascade upwards so every ancestor
      // (Session, Quest, Arc) that contains it is also marked "In Progress"
      if (newStatus === 'in_progress') {
        const ancestors = findAncestors(hierarchy, node.id) || [];
        for (const ancestor of ancestors) {
          const curStatus = ancestor.data_json?.status || 'planned';
          if (curStatus !== 'in_progress') {
            const updatedData = { ...(ancestor.data_json || {}), status: 'in_progress' };
            await updateNode(ancestor.id, { data_json: updatedData });
          }
        }
      }

      if (newStatus === 'completed') {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#10b981', '#60a5fa'],
        });
      }
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (window.confirm('Delete this planning node and all its children?')) {
      await deleteNode(nodeId);
      onRefresh();
    }
  };

  const openAddChild = (parentId: string, childType: NodeType) => {
    setTargetParentId(parentId);
    setTargetChildType(childType);
    setNewTitle('');
    setNewSummary('');
    setShowAddModal(true);
  };

  const openAddRootArc = () => {
    setTargetParentId(null);
    setTargetChildType('arc');
    setNewTitle('');
    setNewSummary('');
    setShowAddModal(true);
  };

  const handleCreateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const created = await createNode({
        campaign_id: campaignId,
        type: targetChildType,
        title: newTitle.trim(),
        summary: newSummary.trim(),
        data_json: { status: 'planned' },
        revealed_to_players: targetChildType === 'arc' || targetChildType === 'quest',
      });

      if (targetParentId) {
        await createEdge({
          campaign_id: campaignId,
          source_id: targetParentId,
          target_id: created.id,
          relation_type: 'contains',
          label: 'Contains',
          revealed_to_players: true,
        });
        setExpandedNodes((prev) => ({ ...prev, [targetParentId]: true }));
      }

      setShowAddModal(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const renderTreeItem = (item: HierarchyItem, depth: number = 0) => {
    const { node, children } = item;
    const isExpanded = expandedNodes[node.id] ?? true;
    const status = node.data_json?.status || 'planned';

    let nextChildType: NodeType | null = null;
    if (node.type === 'arc') nextChildType = 'quest';
    else if (node.type === 'quest') nextChildType = 'session';
    else if (node.type === 'session') nextChildType = 'encounter';

    return (
      <div key={node.id} style={{ marginLeft: `${depth * 20}px`, marginTop: '8px' }}>
        <div
          onClick={() => onSelectNode(node)}
          className="glass-panel"
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            cursor: 'pointer',
            border: `1px solid ${
              status === 'completed'
                ? 'rgba(16, 185, 129, 0.4)'
                : status === 'in_progress'
                ? 'rgba(245, 158, 11, 0.5)'
                : 'var(--border-subtle)'
            }`,
            background:
              status === 'completed'
                ? 'rgba(16, 185, 129, 0.05)'
                : status === 'in_progress'
                ? 'rgba(245, 158, 11, 0.05)'
                : 'var(--bg-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-gold)')}
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderColor =
              status === 'completed'
                ? 'rgba(16, 185, 129, 0.4)'
                : status === 'in_progress'
                ? 'rgba(245, 158, 11, 0.5)'
                : 'var(--border-subtle)')
          }
        >
          {/* Left: Expand + Icon + Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
            {children.length > 0 ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(node.id);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
              >
                {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>
            ) : (
              <div style={{ width: '18px' }} />
            )}

            <span className={`badge badge-${node.type}`}>{node.type}</span>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{node.title}</span>
                {node.subtitle && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>• {node.subtitle}</span>
                )}
              </div>
              {node.summary && (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', lineClamp: 1 }}>
                  {node.summary.slice(0, 120)}
                </p>
              )}
            </div>
          </div>

          {/* Right: Status Pill, Reveal Eye, Co-DM focus, Add Child, Delete */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Status Selector */}
            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-surface)', padding: '2px 4px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <button
                onClick={(e) => handleStatusChange(e, node, 'planned')}
                title="Status: Planned"
                className={`status-pill ${status === 'planned' ? 'status-planned' : 'status-inactive'}`}
              >
                Planned
              </button>
              <button
                onClick={(e) => handleStatusChange(e, node, 'in_progress')}
                title="Status: In Progress"
                className={`status-pill ${status === 'in_progress' ? 'status-inprogress' : 'status-inactive'}`}
              >
                In Progress
              </button>
              <button
                onClick={(e) => handleStatusChange(e, node, 'completed')}
                title="Status: Completed (Victory!)"
                className={`status-pill ${status === 'completed' ? 'status-completed' : 'status-inactive'}`}
              >
                Completed
              </button>
            </div>

            {/* Reveal / Fog-of-War Button */}
            <button
              onClick={(e) => handleToggleReveal(e, node)}
              className="btn btn-ghost"
              style={{
                padding: '6px',
                color: node.revealed_to_players ? 'var(--color-emerald)' : 'var(--text-muted)',
              }}
              title={node.revealed_to_players ? 'Revealed to Players (Click to Hide)' : 'Hidden Secret (Click to Reveal)'}
            >
              {node.revealed_to_players ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>

            {/* Canon / Protected Lore Button */}
            <button
              onClick={(e) => handleToggleCanon(e, node)}
              className="btn btn-ghost"
              style={{
                padding: '6px',
                color: (node.is_canon ?? true) ? 'var(--color-gold)' : 'var(--text-muted)',
              }}
              title={(node.is_canon ?? true) ? 'Canon Lore 🔒 (Protected from AI deletion) - Click to Mark as Draft' : 'Working Draft 📝 - Click to Promote to Canon'}
            >
              {(node.is_canon ?? true) ? <ShieldCheck size={16} /> : <Feather size={16} />}
            </button>

            {/* Focus in Co-DM */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFocusCoDM(node);
              }}
              className="btn btn-ghost"
              style={{ padding: '6px', color: 'var(--color-gold)' }}
              title="Brainstorm this scene with Co-DM"
            >
              <Sparkles size={16} />
            </button>

            {/* Adapt Session from Transcript */}
            {node.type === 'session' && onNavigateToTranscript && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToTranscript(node.id);
                }}
                className="btn btn-secondary"
                style={{
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: 'var(--color-arcane-blue-text)',
                  borderColor: 'var(--color-arcane-blue-border)',
                  background: 'var(--color-arcane-blue-bg)',
                  fontWeight: 600,
                }}
                title="Upload session transcript to adapt graph & timeline"
              >
                <Mic size={13} style={{ color: 'var(--color-arcane-blue-text)' }} /> Adapt Session
              </button>
            )}

            {/* Add Child */}
            {nextChildType && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openAddChild(node.id, nextChildType!);
                }}
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                title={`Add ${nextChildType.toUpperCase()}`}
              >
                <Plus size={13} /> {nextChildType}
              </button>
            )}

            {/* Delete */}
            <button
              onClick={(e) => handleDelete(e, node.id)}
              className="btn btn-ghost"
              style={{ padding: '6px', color: 'var(--color-crimson)' }}
              title="Delete node"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Children Recursion */}
        {isExpanded && children.length > 0 && (
          <div style={{ borderLeft: '2px dashed var(--border-subtle)', marginLeft: '8px', paddingLeft: '4px' }}>
            {children.map((child) => renderTreeItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar style={{ color: 'var(--color-gold)' }} /> Campaign Arc &amp; Session Timeline
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Plan, organize, and pace your story from overarching campaign Arcs down to Encounters.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {onNavigateToTranscript && (
            <button
              onClick={() => onNavigateToTranscript()}
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--color-arcane-blue-text)',
                borderColor: 'var(--color-arcane-blue-border)',
                background: 'var(--color-arcane-blue-bg)',
                fontWeight: 600,
              }}
              title="Upload session transcript to adapt graph & timeline"
            >
              <Mic size={16} style={{ color: 'var(--color-arcane-blue-text)' }} />
              Ingest Session Transcript
            </button>
          )}
          {onNavigateToIngestion && (
            <button
              onClick={onNavigateToIngestion}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              title="Upload an adventure book or chapter and instruct Co-DM to decompose it"
            >
              <BookOpen size={16} style={{ color: 'var(--color-gold)' }} />
              Decompose Adventure Book
            </button>
          )}
          <button onClick={openAddRootArc} className="btn btn-primary">
            <Plus size={16} /> New Campaign Arc
          </button>
        </div>
      </div>

      {/* Tree Content */}
      {hierarchy.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            padding: '40px',
            textAlign: 'center',
            borderRadius: '12px',
            border: '1px dashed var(--border-medium)',
          }}
        >
          <Flame size={40} style={{ color: 'var(--color-gold)', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>No Campaign Arcs Yet</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px', maxWidth: '480px', margin: '0 auto 16px' }}>
            Every great legend begins with a single act. Create your first Arc to start structuring quests, sessions, and encounters.
          </p>
          <button onClick={openAddRootArc} className="btn btn-primary">
            <Plus size={16} /> Create First Campaign Arc
          </button>
        </div>
      ) : (
        <div>{hierarchy.map((item) => renderTreeItem(item, 0))}</div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 14, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            className="glass-panel animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '500px',
              borderRadius: '14px',
              padding: '24px',
              border: '1px solid var(--border-medium)',
            }}
          >
            <h3 style={{ fontSize: '1.2rem', marginBottom: '4px', textTransform: 'capitalize' }}>
              Add New {targetChildType}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              {targetChildType === 'arc' && 'An overarching story milestone (e.g. "Act I: Secrets of the Ravine")'}
              {targetChildType === 'quest' && 'A player goal with stakes and rewards (e.g. "Rescue the Noble Scions")'}
              {targetChildType === 'session' && 'A single game night session with prep checklist'}
              {targetChildType === 'encounter' && 'A combat, puzzle, or social challenge'}
            </p>

            <form onSubmit={handleCreateNode}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                  Title
                </label>
                <input
                  type="text"
                  required
                  placeholder={`Enter ${targetChildType} title...`}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                  Summary or DM Hook
                </label>
                <textarea
                  rows={3}
                  placeholder="Brief synopsis, objectives, or key secrets..."
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create {targetChildType}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
