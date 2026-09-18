import React, { useState, useMemo, useRef } from 'react';
import {
  GitFork,
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Search,
  Layers,
  Sparkles,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Target,
  Trophy,
  User,
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  Filter,
  Check,
  X,
  AlertCircle
} from 'lucide-react';
import { NodeItem, EdgeItem, GraphData } from '../types';
import { createNode, createEdge, updateNode, deleteEdge, createSubQuest } from '../api';

interface QuestFlowchartProps {
  campaignId: string;
  graphData: GraphData;
  onSelectNode: (node: NodeItem) => void;
  onRefresh: () => void;
  showArchived?: boolean;
}

interface BranchInfo {
  edgeId: string;
  sourceId: string;
  targetId: string;
  label?: string;
}

export const QuestFlowchart: React.FC<QuestFlowchartProps> = ({
  campaignId,
  graphData,
  onSelectNode,
  onRefresh,
  showArchived = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 40, y: 40 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [selectedArcId, setSelectedArcId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hoveredQuestId, setHoveredQuestId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  // Quick Add Sub-quest state
  const [addingSubQuestToId, setAddingSubQuestToId] = useState<string | null>(null);
  const [newSubQuestTitle, setNewSubQuestTitle] = useState<string>('');

  // Track collapsed sub-quests in flowchart (parentQuestId -> collapsed)
  const [collapsedSubQuests, setCollapsedSubQuests] = useState<Set<string>>(new Set());

  // Toggle collapsing sub-quests under a parent on flowchart
  const toggleSubQuestCollapse = (parentId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCollapsedSubQuests((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  };

  // Quick Branch Dialog state
  const [branchingSourceQuest, setBranchingSourceQuest] = useState<NodeItem | null>(null);
  const [newBranchTitle, setNewBranchTitle] = useState<string>('');
  const [newBranchCondition, setNewBranchCondition] = useState<string>('');

  // Edit Edge Condition state
  const [editingEdge, setEditingEdge] = useState<{ id: string; label: string } | null>(null);

  // 1. Separate Arcs, Quests, and Sub-quests
  const { arcs, allQuests, parentQuestMap, childQuestsMap, questArcMap, precedesInMap, precedesOutMap } =
    useMemo(() => {
      const nodeMap = new Map<string, NodeItem>();
      graphData.nodes.forEach((n) => nodeMap.set(n.id, n));

      const arcList = graphData.nodes.filter((n) => n.type === 'arc');
      const questList = graphData.nodes.filter(
        (n) => n.type === 'quest' && (showArchived || n.data_json?.status !== 'archived')
      );

      const parentMap = new Map<string, string>(); // childQuestId -> parentQuestId
      const childMap = new Map<string, string[]>(); // parentQuestId -> childQuestIds[]
      const qArcMap = new Map<string, string>(); // questId -> arcId

      const precIn = new Map<string, BranchInfo[]>(); // targetQuestId -> incoming
      const precOut = new Map<string, BranchInfo[]>(); // sourceQuestId -> outgoing

      graphData.edges.forEach((edge) => {
        const source = nodeMap.get(edge.source_id);
        const target = nodeMap.get(edge.target_id);
        if (!source || !target) return;

        // Arc -> Quest
        if (source.type === 'arc' && target.type === 'quest') {
          qArcMap.set(target.id, source.id);
        } else if (source.type === 'quest' && target.type === 'arc') {
          qArcMap.set(source.id, target.id);
        }

        // Sub-quest: Quest -> contains/parent_of -> Quest
        if (source.type === 'quest' && target.type === 'quest') {
          if (edge.relation_type === 'contains' || edge.relation_type === 'parent_of') {
            parentMap.set(target.id, source.id);
            const children = childMap.get(source.id) || [];
            if (!children.includes(target.id)) {
              children.push(target.id);
              childMap.set(source.id, children);
            }
          } else if (edge.relation_type === 'precedes' || edge.relation_type === 'leads_to') {
            const bInfo: BranchInfo = {
              edgeId: edge.id,
              sourceId: source.id,
              targetId: target.id,
              label: edge.label || '',
            };
            const inList = precIn.get(target.id) || [];
            inList.push(bInfo);
            precIn.set(target.id, inList);

            const outList = precOut.get(source.id) || [];
            outList.push(bInfo);
            precOut.set(source.id, outList);
          }
        }
      });

      return {
        arcs: arcList,
        allQuests: questList,
        parentQuestMap: parentMap,
        childQuestsMap: childMap,
        questArcMap: qArcMap,
        precedesInMap: precIn,
        precedesOutMap: precOut,
      };
    }, [graphData.nodes, graphData.edges, showArchived]);

  // 2. Filter Quests by Arc & Search
  const filteredQuests = useMemo(() => {
    return allQuests.filter((q) => {
      // If filtering by Arc, ensure quest belongs to that Arc
      if (selectedArcId !== 'all') {
        const arcId = questArcMap.get(q.id);
        if (arcId !== selectedArcId) return false;
      }
      // Search
      if (searchQuery.trim()) {
        const term = searchQuery.toLowerCase();
        const matchesTitle = q.title.toLowerCase().includes(term);
        const matchesSummary = (q.summary || '').toLowerCase().includes(term);
        const matchesType = (q.data_json?.quest_type || '').toLowerCase().includes(term);
        if (!matchesTitle && !matchesSummary && !matchesType) return false;
      }
      return true;
    });
  }, [allQuests, selectedArcId, searchQuery, questArcMap]);

  // 3. Layout: Top-level Quests into Stages (Columns)
  // Sub-quests are nested inside their parent cards, so we lay out root quests in DAG stages
  const { stages, questColumnMap, questCoords, stageColumns } = useMemo(() => {
    const rootQuests = filteredQuests.filter((q) => !parentQuestMap.has(q.id));
    const rootIdSet = new Set(rootQuests.map((q) => q.id));

    // Calculate depth for each root quest based on precedes relationships
    const depthMap = new Map<string, number>();

    const getDepth = (qid: string, visited = new Set<string>()): number => {
      if (visited.has(qid)) return 0;
      visited.add(qid);
      if (depthMap.has(qid)) return depthMap.get(qid)!;

      const incoming = precedesInMap.get(qid) || [];
      // only consider incoming from other root quests in this view
      const validIncoming = incoming.filter((b) => rootIdSet.has(b.sourceId));

      if (validIncoming.length === 0) {
        depthMap.set(qid, 0);
        return 0;
      }

      let maxInDepth = 0;
      for (const inc of validIncoming) {
        const d = getDepth(inc.sourceId, new Set(visited));
        if (d + 1 > maxInDepth) maxInDepth = d + 1;
      }
      depthMap.set(qid, maxInDepth);
      return maxInDepth;
    };

    rootQuests.forEach((q) => getDepth(q.id));

    // Group into stages
    const stageMap: Record<number, NodeItem[]> = {};
    rootQuests.forEach((q) => {
      const d = depthMap.get(q.id) || 0;
      if (!stageMap[d]) stageMap[d] = [];
      stageMap[d].push(q);
    });

    const maxStage = Math.max(0, ...Object.keys(stageMap).map((k) => parseInt(k, 10)));
    const stageList: NodeItem[][] = [];
    for (let i = 0; i <= maxStage; i++) {
      stageList.push(stageMap[i] || []);
    }

    // Assign rough 2D coordinates for SVG connectors
    // Column width: 340px, Col gap: 120px
    // Card height roughly 220px, Row gap: 40px
    const colWidth = 340;
    const colGap = 130;
    const rowGap = 36;
    const qCoords = new Map<string, { x: number; y: number; width: number; height: number }>();
    const qCol = new Map<string, number>();

    stageList.forEach((colQuests, colIdx) => {
      let currentY = 70;
      const x = colIdx * (colWidth + colGap) + 40;
      colQuests.forEach((q) => {
        const childCount = (childQuestsMap.get(q.id) || []).length;
        const isFolded = collapsedSubQuests.has(q.id);
        const estHeight = childCount === 0 ? 190 : (isFolded ? 190 : 190 + childCount * 32);
        qCoords.set(q.id, { x, y: currentY, width: colWidth, height: estHeight });
        qCol.set(q.id, colIdx);
        currentY += estHeight + rowGap;
      });
    });

    return {
      stages: stageList,
      questColumnMap: qCol,
      questCoords: qCoords,
      stageColumns: stageList.length,
    };
  }, [filteredQuests, parentQuestMap, precedesInMap, childQuestsMap, collapsedSubQuests]);

  // 4. Connectors (precedes edges between root quests)
  const connectors = useMemo(() => {
    const list: Array<{
      edgeId: string;
      sourceId: string;
      targetId: string;
      label?: string;
      pathD: string;
      midX: number;
      midY: number;
      isHighlighted: boolean;
    }> = [];

    questCoords.forEach((srcCoord, srcId) => {
      const outEdges = precedesOutMap.get(srcId) || [];
      outEdges.forEach((edge) => {
        const tgtCoord = questCoords.get(edge.targetId);
        if (!tgtCoord) return;

        // Start at right center of source card
        const startX = srcCoord.x + srcCoord.width;
        const startY = srcCoord.y + 50; // near header
        // End at left center of target card
        const endX = tgtCoord.x;
        const endY = tgtCoord.y + 50;

        // Cubic bezier control points
        const dx = Math.max(40, (endX - startX) * 0.5);
        const pathD = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;

        const isHighlighted =
          hoveredQuestId === srcId ||
          hoveredQuestId === edge.targetId ||
          hoveredEdgeId === edge.edgeId;

        list.push({
          edgeId: edge.edgeId,
          sourceId: srcId,
          targetId: edge.targetId,
          label: edge.label,
          pathD,
          midX,
          midY,
          isHighlighted,
        });
      });
    });

    return list;
  }, [questCoords, precedesOutMap, hoveredQuestId, hoveredEdgeId]);

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.quest-card-interactive')) return;
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Sub-quest toggle completion
  const handleToggleSubQuestStatus = async (subQuest: NodeItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentStatus = subQuest.data_json?.status || 'planned';
    const nextStatus = currentStatus === 'completed' ? 'planned' : 'completed';
    try {
      await updateNode(subQuest.id, {
        data_json: { ...subQuest.data_json, status: nextStatus },
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to update sub-quest status:', err);
    }
  };

  // Create Sub-quest inline
  const handleAddSubQuestSubmit = async (parentQuestId: string) => {
    if (!newSubQuestTitle.trim()) return;
    try {
      await createSubQuest(campaignId, parentQuestId, newSubQuestTitle.trim());
      setNewSubQuestTitle('');
      setAddingSubQuestToId(null);
      onRefresh();
    } catch (err) {
      console.error('Failed to add sub-quest:', err);
    }
  };

  // Create Branch Quest
  const handleCreateBranchSubmit = async () => {
    if (!branchingSourceQuest || !newBranchTitle.trim()) return;
    try {
      // 1. Create new quest node
      const newQuest = await createNode({
        campaign_id: campaignId,
        type: 'quest',
        title: newBranchTitle.trim(),
        data_json: {
          status: 'planned',
          quest_type: branchingSourceQuest.data_json?.quest_type || 'Main Story Quest',
        },
      });

      // 2. Link sourceQuest -> leads_to -> newQuest
      await createEdge({
        campaign_id: campaignId,
        source_id: branchingSourceQuest.id,
        target_id: newQuest.id,
        relation_type: 'leads_to',
        label: newBranchCondition.trim() || 'Next Objective',
      });

      setBranchingSourceQuest(null);
      setNewBranchTitle('');
      setNewBranchCondition('');
      onRefresh();
    } catch (err) {
      console.error('Failed to create branch:', err);
    }
  };

  // Save edge label edit
  const handleSaveEdgeLabel = async () => {
    if (!editingEdge) return;
    try {
      const edge = graphData.edges.find((e) => e.id === editingEdge.id);
      if (edge) {
        await createEdge({
          ...edge,
          label: editingEdge.label.trim(),
        });
      }
      setEditingEdge(null);
      onRefresh();
    } catch (err) {
      console.error('Failed to edit edge:', err);
    }
  };

  // Delete edge
  const handleDeleteEdge = async (edgeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteEdge(edgeId);
      setEditingEdge(null);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete edge:', err);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-app)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 1. TOP TOOLBAR */}
      <div
        className="glass-panel"
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-medium)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          zIndex: 10,
          background: 'var(--bg-card)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitFork size={18} style={{ color: '#3b82f6' }} />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Story Flow &amp; Quest Branches</h3>
          </div>

          {/* Arc Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={13} style={{ color: 'var(--text-muted)' }} />
            <select
              value={selectedArcId}
              onChange={(e) => setSelectedArcId(e.target.value)}
              className="input"
              style={{ fontSize: '0.78rem', padding: '4px 10px', height: '30px' }}
            >
              <option value="all">All Arcs &amp; Chapters</option>
              {arcs.map((arc) => (
                <option key={arc.id} value={arc.id}>
                  {arc.title}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative' }}>
            <Search
              size={13}
              style={{
                position: 'absolute',
                left: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              placeholder="Search quests or objectives..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input"
              style={{ fontSize: '0.78rem', padding: '4px 8px 4px 26px', width: '210px', height: '30px' }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Zoom & View Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Status Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
              Completed
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
              Active
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
              Planned
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-input)',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
              className="btn btn-ghost"
              style={{ padding: '6px', height: '30px' }}
              title="Zoom Out"
            >
              <ZoomOut size={13} />
            </button>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0 6px', minWidth: '42px', textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(1.8, z + 0.1))}
              className="btn btn-ghost"
              style={{ padding: '6px', height: '30px' }}
              title="Zoom In"
            >
              <ZoomIn size={13} />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 40, y: 40 });
              }}
              className="btn btn-ghost"
              style={{ padding: '6px', height: '30px' }}
              title="Reset View"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. FLOWCHART CANVAS */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{
          flex: 1,
          overflow: 'hidden',
          cursor: isPanning ? 'grabbing' : 'grab',
          position: 'relative',
          userSelect: 'none',
          background: 'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.03) 0%, transparent 70%)',
        }}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            position: 'absolute',
            left: 0,
            top: 0,
            width: `${Math.max(1600, stageColumns * 470 + 200)}px`,
            minHeight: '1200px',
            transition: isPanning ? 'none' : 'transform 0.05s ease-out',
          }}
        >
          {/* SVG Connector Layer */}
          <svg
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            <defs>
              <marker
                id="arrowhead-default"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="rgba(59, 130, 246, 0.6)" />
              </marker>
              <marker
                id="arrowhead-highlight"
                markerWidth="9"
                markerHeight="7"
                refX="8"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 9 3.5, 0 7" fill="#f59e0b" />
              </marker>
            </defs>

            {connectors.map((c) => (
              <g key={c.edgeId} style={{ pointerEvents: 'all', cursor: 'pointer' }}>
                {/* Broad transparent stroke for easy hover/click */}
                <path
                  d={c.pathD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="20"
                  onMouseEnter={() => setHoveredEdgeId(c.edgeId)}
                  onMouseLeave={() => setHoveredEdgeId(null)}
                  onClick={() => setEditingEdge({ id: c.edgeId, label: c.label || '' })}
                />
                {/* Visible Path */}
                <path
                  d={c.pathD}
                  fill="none"
                  stroke={c.isHighlighted ? '#f59e0b' : 'rgba(59, 130, 246, 0.45)'}
                  strokeWidth={c.isHighlighted ? '3.5' : '2'}
                  strokeDasharray={c.isHighlighted ? 'none' : '6 3'}
                  markerEnd={c.isHighlighted ? 'url(#arrowhead-highlight)' : 'url(#arrowhead-default)'}
                  style={{ transition: 'all 0.2s ease' }}
                />
                {/* Condition Chip on Line */}
                {c.label && (
                  <g
                    transform={`translate(${c.midX}, ${c.midY})`}
                    onClick={() => setEditingEdge({ id: c.edgeId, label: c.label || '' })}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      x="-60"
                      y="-11"
                      width="120"
                      height="22"
                      rx="11"
                      fill={c.isHighlighted ? '#1e293b' : '#0f172a'}
                      stroke={c.isHighlighted ? '#f59e0b' : 'rgba(59, 130, 246, 0.6)'}
                      strokeWidth="1.2"
                    />
                    <text
                      x="0"
                      y="3.5"
                      textAnchor="middle"
                      fill={c.isHighlighted ? '#fbbf24' : '#94a3b8'}
                      fontSize="9.5"
                      fontWeight="600"
                      fontFamily="system-ui, sans-serif"
                    >
                      {c.label.length > 20 ? `${c.label.substring(0, 19)}…` : c.label}
                    </text>
                  </g>
                )}
              </g>
            ))}
          </svg>

          {/* Stage Headers (Columns) */}
          {stages.map((_, stageIdx) => {
            const colX = stageIdx * (340 + 130) + 40;
            return (
              <div
                key={`stage-hdr-${stageIdx}`}
                style={{
                  position: 'absolute',
                  left: `${colX}px`,
                  top: '12px',
                  width: '340px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: '8px',
                  borderBottom: '2px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    color: 'var(--text-muted)',
                  }}
                >
                  Stage {stageIdx + 1}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {stages[stageIdx]?.length || 0} Quest{stages[stageIdx]?.length === 1 ? '' : 's'}
                </span>
              </div>
            );
          })}

          {/* Quest Cards */}
          {stages.flatMap((stageQuests, colIdx) =>
            stageQuests.map((quest) => {
              const coord = questCoords.get(quest.id);
              if (!coord) return null;

              const status = quest.data_json?.status || 'planned';
              const questType = quest.data_json?.quest_type || 'Main Story Quest';
              const patron = quest.data_json?.quest_giver;
              const rewards = quest.data_json?.rewards;

              const childIds = childQuestsMap.get(quest.id) || [];
              const childNodes = childIds
                .map((cid) => graphData.nodes.find((n) => n.id === cid))
                .filter((n): n is NodeItem => !!n && (showArchived || n.data_json?.status !== 'archived'));

              const completedChildCount = childNodes.filter(
                (c) => c.data_json?.status === 'completed'
              ).length;
              const progressPct =
                childNodes.length > 0 ? (completedChildCount / childNodes.length) * 100 : 0;

              const isHovered = hoveredQuestId === quest.id;
              const incomingPrereqs = precedesInMap.get(quest.id) || [];
              const outgoingBranches = precedesOutMap.get(quest.id) || [];

              // Status styling
              let borderGlow = 'var(--border-subtle)';
              let statusPillBg = 'rgba(59, 130, 246, 0.15)';
              let statusPillColor = '#60a5fa';

              if (status === 'completed') {
                borderGlow = isHovered ? '#10b981' : 'rgba(16, 185, 129, 0.4)';
                statusPillBg = 'rgba(16, 185, 129, 0.15)';
                statusPillColor = '#34d399';
              } else if (status === 'in_progress' || status === 'active') {
                borderGlow = isHovered ? '#f59e0b' : 'rgba(245, 158, 11, 0.5)';
                statusPillBg = 'rgba(245, 158, 11, 0.15)';
                statusPillColor = '#fbbf24';
              } else if (status === 'abandoned') {
                borderGlow = 'rgba(239, 68, 68, 0.3)';
                statusPillBg = 'rgba(239, 68, 68, 0.12)';
                statusPillColor = '#f87171';
              } else if (status === 'archived') {
                borderGlow = 'rgba(148, 163, 184, 0.3)';
                statusPillBg = 'rgba(100, 116, 139, 0.2)';
                statusPillColor = '#94a3b8';
              } else if (isHovered) {
                borderGlow = '#3b82f6';
              }

              return (
                <div
                  key={quest.id}
                  className="quest-card-interactive glass-panel"
                  onMouseEnter={() => setHoveredQuestId(quest.id)}
                  onMouseLeave={() => setHoveredQuestId(null)}
                  onClick={() => onSelectNode(quest)}
                  style={{
                    position: 'absolute',
                    left: `${coord.x}px`,
                    top: `${coord.y}px`,
                    width: `${coord.width}px`,
                    borderRadius: '12px',
                    padding: '16px',
                    background: isHovered ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                    border: `1px solid ${borderGlow}`,
                    boxShadow: isHovered
                      ? `0 8px 24px rgba(0, 0, 0, 0.4), 0 0 16px ${borderGlow}44`
                      : '0 4px 14px rgba(0, 0, 0, 0.25)',
                    zIndex: isHovered ? 5 : 2,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    opacity: (status === 'abandoned' || status === 'archived') ? 0.6 : 1,
                  }}
                >
                  {/* Card Header: Type Badge & Status Pill */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        color: '#60a5fa',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Target size={12} />
                      {questType}
                    </span>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background: statusPillBg,
                        color: statusPillColor,
                        textTransform: 'capitalize',
                      }}
                    >
                      {status === 'archived' ? '📦 Archived' : status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Title & Summary */}
                  <div>
                    <h4
                      style={{
                        margin: '0 0 4px',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        lineHeight: 1.3,
                        textDecoration: status === 'abandoned' ? 'line-through' : 'none',
                      }}
                    >
                      {quest.title}
                    </h4>
                    {quest.summary && (
                      <p
                        style={{
                          margin: 0,
                          fontSize: '0.78rem',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {quest.summary}
                      </p>
                    )}
                  </div>

                  {/* Patron / Rewards Metadata */}
                  {(patron || rewards) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {patron && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <User size={11} style={{ color: 'var(--color-gold)' }} />
                          <span>Patron: <strong style={{ color: 'var(--text-secondary)' }}>{patron}</strong></span>
                        </div>
                      )}
                      {rewards && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Trophy size={11} style={{ color: '#f59e0b' }} />
                          <span>Rewards: <strong style={{ color: 'var(--text-secondary)' }}>{rewards}</strong></span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sub-Quest Objectives Checklist */}
                  {childNodes.length > 0 && (
                    <div
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div
                        onClick={(e) => toggleSubQuestCollapse(quest.id, e)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.7rem',
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                        title={collapsedSubQuests.has(quest.id) ? "Click to expand sub-quests" : "Click to fold sub-quests"}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {collapsedSubQuests.has(quest.id) ? (
                            <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
                          ) : (
                            <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} />
                          )}
                          <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>
                            Objectives ({completedChildCount}/{childNodes.length})
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: completedChildCount === childNodes.length ? '#10b981' : 'var(--text-muted)' }}>
                            {Math.round(progressPct)}%
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                            {collapsedSubQuests.has(quest.id) ? 'Folded' : ''}
                          </span>
                        </div>
                      </div>

                      {/* Mini Progress Bar */}
                      <div
                        style={{
                          width: '100%',
                          height: '4px',
                          borderRadius: '2px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${progressPct}%`,
                            height: '100%',
                            background: completedChildCount === childNodes.length ? '#10b981' : '#3b82f6',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>

                      {/* Objectives List (hidden when folded) */}
                      {!collapsedSubQuests.has(quest.id) && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                          {childNodes.map((child) => {
                            const isDone = child.data_json?.status === 'completed';
                            return (
                              <div
                                key={child.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontSize: '0.74rem',
                                  padding: '2px 4px',
                                  borderRadius: '4px',
                                  background: 'rgba(255, 255, 255, 0.015)',
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => handleToggleSubQuestStatus(child, e)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    margin: 0,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                  }}
                                  title={isDone ? "Mark as in-progress" : "Mark as completed"}
                                >
                                  {isDone ? (
                                    <CheckCircle2 size={13} style={{ color: '#10b981', flexShrink: 0 }} />
                                  ) : (
                                    <Circle size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                  )}
                                </button>
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectNode(child);
                                  }}
                                  style={{
                                    flex: 1,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    cursor: 'pointer',
                                    color: isDone ? 'var(--text-muted)' : 'var(--text-primary)',
                                    textDecoration: isDone ? 'line-through' : 'none',
                                  }}
                                  className="hover:underline"
                                  title={`Open "${child.title}" quest node details`}
                                >
                                  {child.title}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Add Sub-quest inline */}
                  {addingSubQuestToId === quest.id ? (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{ display: 'flex', gap: '6px', alignItems: 'center' }}
                    >
                      <input
                        type="text"
                        placeholder="New sub-quest title..."
                        value={newSubQuestTitle}
                        onChange={(e) => setNewSubQuestTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddSubQuestSubmit(quest.id);
                          else if (e.key === 'Escape') setAddingSubQuestToId(null);
                        }}
                        autoFocus
                        className="input"
                        style={{ fontSize: '0.75rem', padding: '4px 8px', flex: 1 }}
                      />
                      <button
                        onClick={() => handleAddSubQuestSubmit(quest.id)}
                        className="btn btn-primary"
                        style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                      >
                        <Check size={12} />
                      </button>
                      <button
                        onClick={() => setAddingSubQuestToId(null)}
                        className="btn btn-ghost"
                        style={{ padding: '4px 6px' }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : null}

                  {/* Footer: Dependency indicators & Quick Branching */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '8px',
                      borderTop: '1px solid var(--border-subtle)',
                      fontSize: '0.7rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {incomingPrereqs.length > 0 && (
                        <span
                          style={{
                            color: 'var(--text-muted)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                          title={`${incomingPrereqs.length} prerequisite quest(s) precede this`}
                        >
                          <ArrowRight size={11} style={{ transform: 'rotate(180deg)' }} />
                          {incomingPrereqs.length} Prereq{incomingPrereqs.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {outgoingBranches.length > 0 && (
                        <span
                          style={{
                            color: '#60a5fa',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontWeight: 600,
                          }}
                          title={`${outgoingBranches.length} downstream branch(es) unlock from here`}
                        >
                          <GitFork size={11} />
                          {outgoingBranches.length} Branch{outgoingBranches.length > 1 ? 'es' : ''}
                        </span>
                      )}
                    </div>

                    {/* Quick action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {addingSubQuestToId !== quest.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAddingSubQuestToId(quest.id);
                            setNewSubQuestTitle('');
                          }}
                          className="btn btn-ghost"
                          style={{ padding: '3px 6px', fontSize: '0.68rem', gap: '3px' }}
                          title="Add nested objective / sub-quest"
                        >
                          <Plus size={11} /> Objective
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setBranchingSourceQuest(quest);
                          setNewBranchTitle('');
                          setNewBranchCondition('');
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '3px 8px', fontSize: '0.68rem', gap: '4px' }}
                        title="Branch a new quest path from this outcome"
                      >
                        <GitFork size={11} /> Branch
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. QUICK BRANCH MODAL */}
      {branchingSourceQuest && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setBranchingSourceQuest(null)}
        >
          <div
            className="glass-panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '440px',
              borderRadius: '12px',
              padding: '20px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GitFork size={16} style={{ color: '#3b82f6' }} />
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                  Branch from: {branchingSourceQuest.title}
                </h4>
              </div>
              <button
                onClick={() => setBranchingSourceQuest(null)}
                className="btn btn-ghost"
                style={{ padding: '4px' }}
              >
                <X size={14} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Create a new branching quest that unlocks when this quest progresses or concludes with a specific outcome.
            </p>

            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Branch / Consequence Title *
              </label>
              <input
                type="text"
                placeholder="e.g. Aid Yusdrayl on the Dragon Throne"
                value={newBranchTitle}
                onChange={(e) => setNewBranchTitle(e.target.value)}
                autoFocus
                className="input"
                style={{ width: '100%', fontSize: '0.82rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Choice / Trigger Condition (Optional label on connector)
              </label>
              <input
                type="text"
                placeholder="e.g. If party accepts Kobold truce / Diplomatic Path"
                value={newBranchCondition}
                onChange={(e) => setNewBranchCondition(e.target.value)}
                className="input"
                style={{ width: '100%', fontSize: '0.82rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
              <button
                onClick={() => setBranchingSourceQuest(null)}
                className="btn btn-ghost"
                style={{ fontSize: '0.8rem' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBranchSubmit}
                disabled={!newBranchTitle.trim()}
                className="btn btn-primary"
                style={{ fontSize: '0.8rem', gap: '6px' }}
              >
                <GitFork size={13} /> Create Branch Quest
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. EDIT EDGE LABEL / BRANCH CONDITION MODAL */}
      {editingEdge && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setEditingEdge(null)}
        >
          <div
            className="glass-panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '380px',
              borderRadius: '12px',
              padding: '18px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Edit Branch Condition</span>
              <button onClick={() => setEditingEdge(null)} className="btn btn-ghost" style={{ padding: '4px' }}>
                <X size={14} />
              </button>
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Connector Label
              </label>
              <input
                type="text"
                value={editingEdge.label}
                onChange={(e) => setEditingEdge({ ...editingEdge, label: e.target.value })}
                placeholder="e.g. Diplomatic agreement / Raid"
                autoFocus
                className="input"
                style={{ width: '100%', fontSize: '0.82rem' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
              <button
                onClick={(e) => handleDeleteEdge(editingEdge.id, e)}
                className="btn btn-ghost"
                style={{ color: 'var(--color-crimson)', fontSize: '0.78rem', gap: '4px' }}
              >
                <Trash2 size={13} /> Remove Link
              </button>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setEditingEdge(null)} className="btn btn-ghost" style={{ fontSize: '0.78rem' }}>
                  Cancel
                </button>
                <button onClick={handleSaveEdgeLabel} className="btn btn-primary" style={{ fontSize: '0.78rem' }}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
