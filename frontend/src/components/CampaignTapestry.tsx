import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  Calendar,
  Sparkles,
  Swords,
  Package,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  Plus,
  GitBranch,
  Info,
  Eye,
  EyeOff,
  ArrowRight,
  Maximize2,
  Minimize2,
  X,
  Flame,
  BookOpen,
  Star,
  Workflow,
  ChevronsDownUp,
  ChevronsUpDown,
  Mic,
  Feather,
  Trash2,
  GripVertical,
  GitFork,
  LayoutGrid,
  Link2,
  CornerDownRight,
  CheckCircle2,
  Circle,
  MapPin,
  Skull,
  Users
} from 'lucide-react';
import {
  createNode,
  createEdge,
  deleteEdge,
  updateNode,
  deleteNode,
  toggleNodeCanon,
  toggleNodeReveal,
  archiveNode,
  restoreNode,
} from '../api';
import { GraphData, NodeItem, NodeType } from '../types';
import { MarkdownView } from './MarkdownView';
import { QuestFlowchart } from './QuestFlowchart';
import { RunSheetModal } from './RunSheetModal';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { TapestryEncounterModal } from './tapestry/modals/TapestryEncounterModal';
import { TapestryQuestModal } from './tapestry/modals/TapestryQuestModal';
import { TapestrySessionModal } from './tapestry/modals/TapestrySessionModal';
import { TapestryArcModal } from './tapestry/modals/TapestryArcModal';
import { TapestryEntityModal } from './tapestry/modals/TapestryEntityModal';
import { TapestryCreateNodeModal } from './tapestry/modals/TapestryCreateNodeModal';
import { useTapestryGraph } from './tapestry/hooks/useTapestryGraph';
import { useTapestryDimensions, LEFT_COL_WIDTH, COL_GAP } from './tapestry/hooks/useTapestryDimensions';
import { useTapestryOverlays } from './tapestry/hooks/useTapestryOverlays';
import { TapestryRibbon } from './tapestry/TapestryRibbon';
import { TapestryArcBanners } from './tapestry/TapestryArcBanners';
import { TapestrySessionHeaders } from './tapestry/TapestrySessionHeaders';
import { TapestrySvgOverlays } from './tapestry/TapestrySvgOverlays';
import { TapestryQuestRow } from './tapestry/TapestryQuestRow';

interface CampaignTapestryProps {
  campaignId: string;
  graphData: GraphData;
  onRefresh: () => void;
  onSelectNode: (node: NodeItem) => void;
  onFocusCoDM: (node: NodeItem) => void;
  onNavigateToIngestion?: () => void;
  onNavigateToTranscript?: (sessionNodeId?: string) => void;
  showArchived?: boolean;
  onToggleShowArchived?: () => void;
}

export const CampaignTapestry: React.FC<CampaignTapestryProps> = ({
  campaignId,
  graphData,
  onRefresh,
  onSelectNode,
  onFocusCoDM,
  onNavigateToIngestion,
  onNavigateToTranscript,
  showArchived = false,
  onToggleShowArchived,
}) => {
  // Tapestry View Mode: 'matrix' (Sessions x Quests) or 'flowchart' (Story Flow & Branches DAG)
  const [tapestryViewMode, setTapestryViewMode] = useState<'matrix' | 'flowchart'>('matrix');
  // Collapsed Sub-Quest rows state (persisted per campaign)
  const [collapsedSubQuestParents, setCollapsedSubQuestParents] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`dnd_tapestry_collapsed_subquests_${campaignId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch (e) {
      console.error('Failed to load collapsed sub-quests:', e);
    }
    return new Set();
  });

  // Top Minimal Ribbon style & collapse state
  const [activeRibbonRiff, setActiveRibbonRiff] = useState<'woven' | 'constellation' | 'transit'>('woven');
  const [isRibbonCollapsed, setIsRibbonCollapsed] = useState<boolean>(false);

  // Collapsed Quest Rows state (persisted per campaign; defaults to 'open-world-events' and completed quests folded)
  const [collapsedQuestIds, setCollapsedQuestIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`dnd_tapestry_collapsed_${campaignId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch (e) {
      console.error('Failed to load collapsed quests:', e);
    }
    const defaultCollapsed = new Set<string>(['open-world-events']);
    graphData.nodes
      .filter((n) => n.type === 'quest' && n.data_json?.status === 'completed')
      .forEach((q) => defaultCollapsed.add(q.id));
    return defaultCollapsed;
  });

  // Scene card density in expanded rows: 'detailed' (default) or 'compact'
  const [encounterDensity, setEncounterDensity] = useState<'detailed' | 'compact'>(() => {
    try {
      const saved = localStorage.getItem('dnd_tapestry_encounter_density');
      if (saved === 'compact' || saved === 'detailed') return saved;
    } catch (e) {
      console.error('Failed to load encounter density:', e);
    }
    return 'detailed';
  });

  const toggleQuestCollapse = (questId: string) => {
    setCollapsedQuestIds((prev) => {
      const next = new Set(prev);
      if (next.has(questId)) {
        next.delete(questId);
      } else {
        next.add(questId);
      }
      try {
        localStorage.setItem(`dnd_tapestry_collapsed_${campaignId}`, JSON.stringify(Array.from(next)));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  const handleCollapseAll = () => {
    const allIds = displayQuests.map((q) => q.id);
    const next = new Set(allIds);
    setCollapsedQuestIds(next);
    try {
      localStorage.setItem(`dnd_tapestry_collapsed_${campaignId}`, JSON.stringify(allIds));
    } catch (e) {
      console.error(e);
    }
  };

  const handleExpandAll = () => {
    setCollapsedQuestIds(new Set());
    try {
      localStorage.setItem(`dnd_tapestry_collapsed_${campaignId}`, JSON.stringify([]));
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleDensity = () => {
    const next = encounterDensity === 'detailed' ? 'compact' : 'detailed';
    setEncounterDensity(next);
    try {
      localStorage.setItem('dnd_tapestry_encounter_density', next);
    } catch (e) {
      console.error(e);
    }
  };

  // Modals state
  const [activeEncounterNode, setActiveEncounterNode] = useState<NodeItem | null>(null);
  const [activeQuestNode, setActiveQuestNode] = useState<NodeItem | null>(null);
  const [activeSessionNode, setActiveSessionNode] = useState<NodeItem | null>(null);
  const [runSheetSessionNode, setRunSheetSessionNode] = useState<NodeItem | null>(null);
  const [activeArcNode, setActiveArcNode] = useState<NodeItem | null>(null);
  const [activeEntityNode, setActiveEntityNode] = useState<NodeItem | null>(null);

  const setActiveEncounterModal = setActiveEncounterNode;
  const setActiveQuestModal = setActiveQuestNode;
  const setActiveSessionModal = setActiveSessionNode;
  const setActiveArcModal = setActiveArcNode;
  const setActiveEntityModal = setActiveEntityNode;

  // Creation modal state
  const [showAddModal, setShowAddModal] = useState<NodeType | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [targetParentId, setTargetParentId] = useState<string | null>(null);
  const [targetQuestId, setTargetQuestId] = useState<string | null>(null);
  const [targetSessionId, setTargetSessionId] = useState<string | null>(null);

  // Hover highlighting
  const [hoveredEncounterId, setHoveredEncounterId] = useState<string | null>(null);
  const [hoveredQuestId, setHoveredQuestId] = useState<string | null>(null);
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);

  // Drag & Drop State
  const [draggingEncounterId, setDraggingEncounterId] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ questId: string | null; sessionId: string | null } | null>(null);
  const [draggingQuestId, setDraggingQuestId] = useState<string | null>(null);
  const [dragOverQuestId, setDragOverQuestId] = useState<string | null>(null);
  const [dragOverQuestPosition, setDragOverQuestPosition] = useState<'above' | 'below' | null>(null);
  const [localQuestOrder, setLocalQuestOrder] = useState<string[] | null>(null);

  // Horizontal Session Folding State (persisted per campaign; defaults to 'unscheduled-staging' and completed sessions folded)
  const [collapsedSessionIds, setCollapsedSessionIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`dnd_tapestry_collapsed_sessions_${campaignId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch (e) {
      console.error('Failed to load collapsed sessions:', e);
    }
    const defaultCollapsed = new Set<string>(['unscheduled-staging']);
    graphData.nodes
      .filter((n) => n.type === 'session' && n.data_json?.status === 'completed')
      .forEach((s) => defaultCollapsed.add(s.id));
    return defaultCollapsed;
  });

  // Sync collapsed state when active campaign changes
  useEffect(() => {
    try {
      const savedQuests = localStorage.getItem(`dnd_tapestry_collapsed_${campaignId}`);
      if (savedQuests) {
        const parsed = JSON.parse(savedQuests);
        if (Array.isArray(parsed)) {
          setCollapsedQuestIds(new Set(parsed));
        } else {
          const defaultQ = new Set<string>(['open-world-events']);
          graphData.nodes
            .filter((n) => n.type === 'quest' && n.data_json?.status === 'completed')
            .forEach((q) => defaultQ.add(q.id));
          setCollapsedQuestIds(defaultQ);
        }
      } else {
        const defaultQ = new Set<string>(['open-world-events']);
        graphData.nodes
          .filter((n) => n.type === 'quest' && n.data_json?.status === 'completed')
          .forEach((q) => defaultQ.add(q.id));
        setCollapsedQuestIds(defaultQ);
      }
    } catch (e) {
      console.error('Failed to load collapsed quests:', e);
      const defaultQ = new Set<string>(['open-world-events']);
      graphData.nodes
        .filter((n) => n.type === 'quest' && n.data_json?.status === 'completed')
        .forEach((q) => defaultQ.add(q.id));
      setCollapsedQuestIds(defaultQ);
    }

    try {
      const savedSessions = localStorage.getItem(`dnd_tapestry_collapsed_sessions_${campaignId}`);
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        if (Array.isArray(parsed)) {
          setCollapsedSessionIds(new Set(parsed));
        } else {
          const defaultS = new Set<string>(['unscheduled-staging']);
          graphData.nodes
            .filter((n) => n.type === 'session' && n.data_json?.status === 'completed')
            .forEach((s) => defaultS.add(s.id));
          setCollapsedSessionIds(defaultS);
        }
      } else {
        const defaultS = new Set<string>(['unscheduled-staging']);
        graphData.nodes
          .filter((n) => n.type === 'session' && n.data_json?.status === 'completed')
          .forEach((s) => defaultS.add(s.id));
        setCollapsedSessionIds(defaultS);
      }
    } catch (e) {
      console.error('Failed to load collapsed sessions:', e);
      const defaultS = new Set<string>(['unscheduled-staging']);
      graphData.nodes
        .filter((n) => n.type === 'session' && n.data_json?.status === 'completed')
        .forEach((s) => defaultS.add(s.id));
      setCollapsedSessionIds(defaultS);
    }

    try {
      const savedSubQuests = localStorage.getItem(`dnd_tapestry_collapsed_subquests_${campaignId}`);
      if (savedSubQuests) {
        const parsed = JSON.parse(savedSubQuests);
        if (Array.isArray(parsed)) {
          setCollapsedSubQuestParents(new Set(parsed));
        } else {
          setCollapsedSubQuestParents(new Set());
        }
      } else {
        setCollapsedSubQuestParents(new Set());
      }
    } catch (e) {
      console.error('Failed to load collapsed sub-quests:', e);
      setCollapsedSubQuestParents(new Set());
    }
  }, [campaignId, graphData.nodes]);

  // Milestone authoring state
  const [newMilestoneQuestId, setNewMilestoneQuestId] = useState<string>('');
  const [newMilestoneSummary, setNewMilestoneSummary] = useState<string>('');
  const [isSavingMilestone, setIsSavingMilestone] = useState(false);

  // Encounter Precedence Authoring state
  const [newPrecedingEncounterId, setNewPrecedingEncounterId] = useState<string>('');
  const [newBranchTargetEncounterId, setNewBranchTargetEncounterId] = useState<string>('');
  const [newBranchLabel, setNewBranchLabel] = useState<string>('');
  const [isSavingPrecedence, setIsSavingPrecedence] = useState(false);

  const toggleSessionCollapse = (sessionId: string) => {
    setCollapsedSessionIds(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      try {
        localStorage.setItem(`dnd_tapestry_collapsed_sessions_${campaignId}`, JSON.stringify(Array.from(next)));
      } catch (e) {
        console.error('Failed to save collapsed sessions:', e);
      }
      return next;
    });
  };

  const toggleArcCollapse = (sessionIds: string[], forceCollapse?: boolean) => {
    setCollapsedSessionIds(prev => {
      const next = new Set(prev);
      const shouldCollapse = forceCollapse !== undefined
        ? forceCollapse
        : !sessionIds.every(id => next.has(id));
      sessionIds.forEach(id => {
        if (shouldCollapse) next.add(id);
        else next.delete(id);
      });
      try {
        localStorage.setItem(`dnd_tapestry_collapsed_sessions_${campaignId}`, JSON.stringify(Array.from(next)));
      } catch (e) {
        console.error('Failed to save collapsed sessions:', e);
      }
      return next;
    });
  };

  const collapseAllSessions = () => {
    const allIds = displayColumns.map((c) => c.id);
    setCollapsedSessionIds(new Set(allIds));
    try {
      localStorage.setItem(`dnd_tapestry_collapsed_sessions_${campaignId}`, JSON.stringify(allIds));
    } catch (e) {
      console.error(e);
    }
  };

  const expandAllSessions = () => {
    setCollapsedSessionIds(new Set());
    try {
      localStorage.setItem(`dnd_tapestry_collapsed_sessions_${campaignId}`, JSON.stringify([]));
    } catch (e) {
      console.error(e);
    }
  };

  // Context menu state for right-clicking quests and encounters
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: NodeItem } | null>(null);

  // 1. Graph Data, Filtered Nodes, and Relations from custom hook
  const {
    arcs,
    sessions,
    quests,
    encounters,
    nodeMap,
    encounterSessionMap,
    encounterQuestMap,
    encounterEntitiesMap,
    sessionArcMap,
    parentQuestMap,
    childQuestsMap,
    questPrereqsMap,
    questBranchesMap,
    unassignedSessionEncounters,
    unassignedQuestEncounters,
    encounterPrecedenceEdges,
  } = useTapestryGraph(graphData, showArchived);

  // Context menu action items
  const contextMenuItems = useMemo((): ContextMenuItem[] => {
    if (!contextMenu) return [];
    const { node } = contextMenu;
    const isArchived = node.data_json?.status === 'archived';
    const isQuest = node.type === 'quest';
    const isEncounter = node.type === 'encounter';

    const items: ContextMenuItem[] = [
      {
        label: `Open ${isQuest ? 'Quest' : isEncounter ? 'Encounter' : 'Node'} Details`,
        onClick: () => {
          onSelectNode(node);
          setContextMenu(null);
        },
      },
      {
        label: 'Focus in Co-DM',
        onClick: () => {
          onFocusCoDM(node);
          setContextMenu(null);
        },
      },
    ];

    if (isQuest || isEncounter) {
      if (isArchived) {
        items.push(
          {
            label: 'Restore to Active',
            onClick: async () => {
              try {
                await restoreNode(node.id, 'active');
                onRefresh();
              } catch (e) {
                console.error('Failed to restore node:', e);
              }
              setContextMenu(null);
            },
          },
          {
            label: 'Restore to Planned',
            onClick: async () => {
              try {
                await restoreNode(node.id, 'planned');
                onRefresh();
              } catch (e) {
                console.error('Failed to restore node:', e);
              }
              setContextMenu(null);
            },
          }
        );
      } else {
        items.push({
          label: `Archive ${isQuest ? 'Quest' : 'Encounter'} 📦`,
          onClick: async () => {
            try {
              await archiveNode(node.id);
              onRefresh();
            } catch (e) {
              console.error('Failed to archive node:', e);
            }
            setContextMenu(null);
          },
        });
      }
    }

    return items;
  }, [contextMenu, onSelectNode, onFocusCoDM, onRefresh]);

  // Toggle collapsing sub-quests under a parent quest
  const toggleSubQuestsCollapse = (parentQuestId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedSubQuestParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentQuestId)) next.delete(parentQuestId);
      else next.add(parentQuestId);
      try {
        localStorage.setItem(`dnd_tapestry_collapsed_subquests_${campaignId}`, JSON.stringify(Array.from(next)));
      } catch (err) {
        console.error('Failed to save collapsed sub-quests:', err);
      }
      return next;
    });
  };

  // Handle status changes with celebratory confetti on victory
  const handleStatusChange = async (node: NodeItem, newStatus: string) => {
    try {
      const data = { ...(node.data_json || {}), status: newStatus };
      await updateNode(node.id, { data_json: data });
      if (newStatus === 'completed') {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#10b981', '#3b82f6', '#a855f7']
        });
      }
      onRefresh();
    } catch (err) {
      console.error('Failed to update node status:', err);
    }
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

  const handleDeleteNode = async (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (window.confirm('Delete this narrative node? Connected edges will be removed.')) {
      try {
        await deleteNode(nodeId);
        setActiveEncounterModal(null);
        setActiveQuestModal(null);
        setActiveSessionModal(null);
        setActiveArcModal(null);
        onRefresh();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Node Creation
  const handleCreateNewNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAddModal || !newTitle.trim()) return;

    try {
      const created = await createNode({
        campaign_id: campaignId,
        type: showAddModal,
        title: newTitle.trim(),
        summary: newSummary.trim(),
        data_json: { status: 'planned' },
        revealed_to_players: showAddModal === 'arc' || showAddModal === 'quest',
      });

      // Connect edges if context target specified
      if (showAddModal === 'encounter') {
        if (targetSessionId) {
          await createEdge({
            campaign_id: campaignId,
            source_id: targetSessionId,
            target_id: created.id,
            relation_type: 'contains',
            label: 'Includes Encounter',
            revealed_to_players: true,
          });
        }
        if (targetQuestId) {
          await createEdge({
            campaign_id: campaignId,
            source_id: targetQuestId,
            target_id: created.id,
            relation_type: 'contains',
            label: 'Advances Quest',
            revealed_to_players: true,
          });
        }
      } else if (showAddModal === 'session' && targetParentId) {
        await createEdge({
          campaign_id: campaignId,
          source_id: targetParentId,
          target_id: created.id,
          relation_type: 'contains',
          label: 'Contains Session',
          revealed_to_players: true,
        });
      }

      setShowAddModal(null);
      setNewTitle('');
      setNewSummary('');
      setTargetParentId(null);
      setTargetQuestId(null);
      setTargetSessionId(null);
      onRefresh();
    } catch (err) {
      console.error('Failed to create node:', err);
    }
  };

  // Handle edge assignment for Encounter <-> Quest
  const handleAssignEncounterToQuest = async (encounterId: string, newQuestId: string | null) => {
    try {
      const existingEdges = graphData.edges.filter(
        (e) =>
          ((e.source_id === encounterId && nodeMap.get(e.target_id)?.type === 'quest') ||
          (e.target_id === encounterId && nodeMap.get(e.source_id)?.type === 'quest')) &&
          (e.relation_type === 'contains' || e.relation_type === 'parent_of')
      );
      for (const edge of existingEdges) {
        await deleteEdge(edge.id);
      }
      if (newQuestId) {
        await createEdge({
          campaign_id: campaignId,
          source_id: newQuestId,
          target_id: encounterId,
          relation_type: 'contains',
          label: 'Contains Encounter',
          revealed_to_players: true,
        });
      }
      const encNode = nodeMap.get(encounterId);
      if (encNode) {
        const d = { ...(encNode.data_json || {}) };
        if (newQuestId) d.quest_id = newQuestId;
        else delete d.quest_id;
        await updateNode(encounterId, { data_json: d });
      }
      onRefresh();
    } catch (err) {
      console.error('Failed to assign encounter to quest:', err);
    }
  };

  // Handle edge assignment for Encounter <-> Session
  const handleAssignEncounterToSession = async (encounterId: string, newSessionId: string | null) => {
    try {
      const existingEdges = graphData.edges.filter(
        (e) =>
          (e.source_id === encounterId && nodeMap.get(e.target_id)?.type === 'session') ||
          (e.target_id === encounterId && nodeMap.get(e.source_id)?.type === 'session')
      );
      for (const edge of existingEdges) {
        await deleteEdge(edge.id);
      }

      if (newSessionId && newSessionId !== 'unscheduled') {
        let actualSessionId = newSessionId;
        if (newSessionId.startsWith('virtual-session-')) {
          const sessNum = parseInt(newSessionId.replace('virtual-session-', ''), 10) || 1;
          const createdSess = await createNode({
            campaign_id: campaignId,
            type: 'session',
            title: `Session ${sessNum}: The Adventure Begins`,
            summary: 'Active campaign game session',
            data_json: { status: 'in_progress', session_number: sessNum },
            revealed_to_players: true,
          });
          actualSessionId = createdSess.id;
        }

        await createEdge({
          campaign_id: campaignId,
          source_id: actualSessionId,
          target_id: encounterId,
          relation_type: 'contains',
          label: 'Includes Encounter',
          revealed_to_players: true,
        });

        const encNode = nodeMap.get(encounterId);
        if (encNode) {
          await updateNode(encounterId, {
            data_json: { ...(encNode.data_json || {}), session_id: actualSessionId },
          });
        }
      } else {
        const encNode = nodeMap.get(encounterId);
        if (encNode) {
          const d = { ...(encNode.data_json || {}) };
          delete d.session_id;
          await updateNode(encounterId, { data_json: d });
        }
      }
      onRefresh();
    } catch (err) {
      console.error('Failed to assign encounter to session:', err);
    }
  };

  // Milestone consequence actions
  const handleAddMilestoneImpact = async (encounterId: string) => {
    if (!newMilestoneQuestId.trim()) return;
    try {
      setIsSavingMilestone(true);
      await createEdge({
        campaign_id: campaignId,
        source_id: encounterId,
        target_id: newMilestoneQuestId,
        relation_type: 'advances_quest',
        label: 'Advances Quest',
        revealed_to_players: true,
        metadata_json: {
          is_milestone: true,
          summary: newMilestoneSummary.trim() || undefined
        }
      });
      setNewMilestoneQuestId('');
      setNewMilestoneSummary('');
      await onRefresh();
    } catch (err) {
      console.error('Failed to register milestone impact:', err);
    } finally {
      setIsSavingMilestone(false);
    }
  };

  const handleDeleteMilestoneImpact = async (edgeId: string) => {
    try {
      await deleteEdge(edgeId);
      await onRefresh();
    } catch (err) {
      console.error('Failed to delete milestone impact:', err);
    }
  };

  // Encounter Precedence actions
  const handleAddPrecedingEncounter = async (targetEncounterId: string) => {
    if (!newPrecedingEncounterId.trim()) return;
    try {
      setIsSavingPrecedence(true);
      await createEdge({
        campaign_id: campaignId,
        source_id: newPrecedingEncounterId,
        target_id: targetEncounterId,
        relation_type: 'precedes',
        label: newBranchLabel.trim() || undefined,
        revealed_to_players: true,
      });
      setNewPrecedingEncounterId('');
      setNewBranchLabel('');
      await onRefresh();
    } catch (err) {
      console.error('Failed to link preceding encounter:', err);
    } finally {
      setIsSavingPrecedence(false);
    }
  };

  const handleAddBranchEncounter = async (sourceEncounterId: string) => {
    if (!newBranchTargetEncounterId.trim()) return;
    try {
      setIsSavingPrecedence(true);
      await createEdge({
        campaign_id: campaignId,
        source_id: sourceEncounterId,
        target_id: newBranchTargetEncounterId,
        relation_type: 'precedes',
        label: newBranchLabel.trim() || undefined,
        revealed_to_players: true,
      });
      setNewBranchTargetEncounterId('');
      setNewBranchLabel('');
      await onRefresh();
    } catch (err) {
      console.error('Failed to link branch encounter:', err);
    } finally {
      setIsSavingPrecedence(false);
    }
  };

  const handleDeletePrecedenceEdge = async (edgeId: string) => {
    try {
      await deleteEdge(edgeId);
      await onRefresh();
    } catch (err) {
      console.error('Failed to delete precedence edge:', err);
    }
  };

  // Fast session creation
  const handleQuickCreateSession = async (sessNum?: number, title?: string) => {
    try {
      const num = sessNum || (sessions.length + 1);
      await createNode({
        campaign_id: campaignId,
        type: 'session',
        title: title || `Session ${num}: The Adventure Begins`,
        summary: 'Active campaign game session',
        data_json: { status: num === 1 ? 'in_progress' : 'planned', session_number: num },
        revealed_to_players: true,
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to quick create session:', err);
    }
  };

  // 3. SVG Overlay Geometry & Precedence/Milestone Links from custom hook
  const {
    matrixContainerRef,
    precedenceLines,
    milestoneLines,
    hoveredMilestoneId,
    setHoveredMilestoneId,
    milestoneEmitters,
    milestoneReceivers,
  } = useTapestryOverlays({
    graphData,
    nodeMap,
    encounterSessionMap,
    encounterPrecedenceEdges,
    collapsedSessionIds,
    collapsedQuestIds,
    collapsedSubQuestParents,
    encounters,
  });

  const orderedQuests = useMemo(() => {
    if (!localQuestOrder) return quests;
    const map = new Map<string, NodeItem>(quests.map((q: NodeItem) => [q.id, q]));
    const result: NodeItem[] = [];
    localQuestOrder.forEach((id: string) => {
      const q = map.get(id);
      if (q) result.push(q);
    });
    quests.forEach((q: NodeItem) => {
      if (!result.some((r: NodeItem) => r.id === q.id)) result.push(q);
    });
    return result;
  }, [quests, localQuestOrder]);

  const displayQuests = useMemo(() => {
    // Separate root quests from sub-quests
    const subQuestIds = new Set(parentQuestMap.keys());
    const rootQuests: NodeItem[] = [];

    orderedQuests.forEach((q: NodeItem) => {
      if (!subQuestIds.has(q.id)) {
        rootQuests.push(q);
      }
    });

    const list: Array<NodeItem & {
      isSubQuest?: boolean;
      parentQuestId?: string;
      subQuestCount?: number;
      completedSubQuestCount?: number;
      depth?: number;
    }> = [];

    // Helper to recursively append a quest and its sub-quests
    const appendQuestBranch = (q: NodeItem, currentDepth: number, parentId?: string) => {
      const childIds = childQuestsMap.get(q.id) || [];
      const childNodes = childIds
        .map((cid) => nodeMap.get(cid))
        .filter((n): n is NodeItem => !!n);
      const completedCount = childNodes.filter(
        (c) => c.data_json?.status === 'completed'
      ).length;

      list.push({
        ...q,
        isSubQuest: currentDepth > 0,
        parentQuestId: parentId,
        subQuestCount: childNodes.length,
        completedSubQuestCount: completedCount,
        depth: currentDepth,
      });

      // If parent's sub-quests are not collapsed, recursively add each child sub-quest directly below
      if (childNodes.length > 0 && !collapsedSubQuestParents.has(q.id)) {
        childNodes.forEach((childQ) => {
          appendQuestBranch(childQ, currentDepth + 1, q.id);
        });
      }
    };

    // Append all root quests and their descendant sub-quest trees
    rootQuests.forEach((rootQ: NodeItem) => {
      appendQuestBranch(rootQ, 0);
    });

    // Also include any orphan sub-quests whose parent was deleted or not in list
    orderedQuests.forEach((q: NodeItem) => {
      if (subQuestIds.has(q.id)) {
        const pId = parentQuestMap.get(q.id);
        if (pId && !nodeMap.has(pId)) {
          appendQuestBranch(q, 0);
        }
      }
    });

    // If there are encounters without an assigned quest, add an Open Encounters lane
    if (unassignedQuestEncounters.length > 0) {
      const openRow = {
        id: 'open-world-events',
        campaign_id: campaignId,
        type: 'quest' as NodeType,
        title: 'Open Encounters & World Events',
        summary: `${unassignedQuestEncounters.length} scenes not yet attached to a specific quest line`,
        data_json: { category: 'World Events', status: 'in_progress', is_open_lane: true },
        sort_order: -1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_canon: true,
        revealed_to_players: true,
        isSubQuest: false,
      };
      return [openRow, ...list];
    }
    return list;
  }, [orderedQuests, parentQuestMap, childQuestsMap, nodeMap, collapsedSubQuestParents, unassignedQuestEncounters.length, campaignId]);

  // Unified Encounter Move Handler (Drag & Drop across sessions & quests)
  const handleMoveEncounter = async (
    encounterId: string,
    targetSessionId: string | null,
    targetQuestId: string | null
  ) => {
    try {
      const currentSessionId = encounterSessionMap.get(encounterId) || null;
      const currentQuestId = encounterQuestMap.get(encounterId) || null;

      // Update session assignment if changed
      if (targetSessionId !== currentSessionId) {
        await handleAssignEncounterToSession(encounterId, targetSessionId);
      }

      // Update quest assignment if changed
      if (targetQuestId !== currentQuestId) {
        await handleAssignEncounterToQuest(encounterId, targetQuestId);
      }
    } catch (err) {
      console.error('Failed to move encounter via drag & drop:', err);
    } finally {
      setDraggingEncounterId(null);
      setDragOverCell(null);
    }
  };

  // Reorder Quests in Stack (Vertical Drag & Drop)
  const handleReorderQuests = async (
    draggedQuestId: string,
    targetQuestId: string,
    position: 'above' | 'below'
  ) => {
    if (draggedQuestId === targetQuestId) return;

    const currentOrder = orderedQuests.map((q: NodeItem) => q.id);
    const fromIndex = currentOrder.indexOf(draggedQuestId);
    if (fromIndex === -1) return;

    // Remove dragged item
    const newOrder = [...currentOrder];
    newOrder.splice(fromIndex, 1);

    // Calculate new insertion index
    const targetCurrentIndex = newOrder.indexOf(targetQuestId);
    if (targetCurrentIndex === -1) return;

    const insertIndex = position === 'below' ? targetCurrentIndex + 1 : targetCurrentIndex;
    newOrder.splice(insertIndex, 0, draggedQuestId);

    // Immediate optimistic UI update
    setLocalQuestOrder(newOrder);

    // Persist sort_order to backend
    try {
      await Promise.all(
        newOrder.map((qId, idx) =>
          updateNode(qId, { sort_order: (idx + 1) * 10 })
        )
      );
      onRefresh();
    } catch (err) {
      console.error('Failed to persist quest reordering:', err);
    }
  };

  // 4. Tapestry Dimensions, Columns, Matrix Grid, Canvas Width & Column Positions from custom hook
  const {
    displayColumns,
    arcLayouts,
    sessionColWidths,
    matrixGridCols,
    canvasWidth,
    getColX,
  } = useTapestryDimensions({
    campaignId,
    arcs,
    sessions,
    encounters,
    sessionArcMap,
    encounterSessionMap,
    encounterQuestMap,
    collapsedSessionIds,
    collapsedSubQuestParents,
    childQuestsMap,
    displayQuests,
    milestoneReceivers,
    encounterDensity,
  });

  // Quest Color Palette
  const questColors = ['#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#10b981', '#ec4899', '#3b82f6'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, minWidth: 0, background: 'var(--bg-app)', color: 'var(--text-primary)', overflow: 'hidden', position: 'relative' }}>
      {/* Top Header & Tapestry Controls */}
      <div
        style={{
          background: 'linear-gradient(180deg, rgba(15, 20, 32, 0.98) 0%, rgba(8, 11, 17, 0.95) 100%)',
          borderBottom: '1px solid var(--border-medium)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          flexShrink: 0,
          minWidth: 0,
          maxWidth: '100%',
          boxSizing: 'border-box',
          zIndex: 10
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                background: 'var(--color-gold)',
                color: '#000',
                padding: '2px 8px',
                borderRadius: '6px',
                fontWeight: 800,
                fontSize: '0.72rem',
                textTransform: 'uppercase',
                letterSpacing: '0.6px'
              }}
            >
              Campaign Tapestry
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} style={{ color: 'var(--color-gold)' }} />
              Story Threads &amp; Session Matrix
            </h2>

            {/* View Mode Switcher: Matrix vs Story Flow DAG */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'var(--bg-input)',
                padding: '2px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                marginLeft: '12px',
              }}
            >
              <button
                type="button"
                onClick={() => setTapestryViewMode('matrix')}
                className={`btn ${tapestryViewMode === 'matrix' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: '0.74rem', padding: '3px 10px', gap: '5px', height: '28px' }}
                title="Matrix Timeline of Quests and Sessions"
              >
                <LayoutGrid size={13} /> Matrix Timeline
              </button>
              <button
                type="button"
                onClick={() => setTapestryViewMode('flowchart')}
                className={`btn ${tapestryViewMode === 'flowchart' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: '0.74rem', padding: '3px 10px', gap: '5px', height: '28px' }}
                title="Story Flow & Branching DAG Flowchart"
              >
                <GitFork size={13} /> Story Flow &amp; Branches
              </button>
            </div>
          </div>
          <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Quests flow horizontally • Sessions weave vertically • Encounters bridge your narrative goals with game night reality.
          </p>
        </div>

        {/* Action Buttons: Add Arc, Add Quest, Add Session, Ingestion */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Top Graphic Ribbon Selector */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-surface)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginRight: '6px' }}>
            <button
              type="button"
              onClick={() => setActiveRibbonRiff('woven')}
              className={`btn ${activeRibbonRiff === 'woven' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '0.76rem', padding: '5px 9px', gap: '5px' }}
              title="Sleek braided golden cord"
            >
              <Sparkles size={13} style={{ color: activeRibbonRiff === 'woven' ? '#000' : 'var(--color-gold)' }} />
              Woven Cord
            </button>
            <button
              type="button"
              onClick={() => setActiveRibbonRiff('constellation')}
              className={`btn ${activeRibbonRiff === 'constellation' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '0.76rem', padding: '5px 9px', gap: '5px' }}
              title="Celestial star paths"
            >
              <Star size={13} style={{ color: activeRibbonRiff === 'constellation' ? '#000' : '#c084fc' }} />
              Constellation
            </button>
            <button
              type="button"
              onClick={() => setActiveRibbonRiff('transit')}
              className={`btn ${activeRibbonRiff === 'transit' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '0.76rem', padding: '5px 9px', gap: '5px' }}
              title="Clean 45° schematic subway line"
            >
              <Workflow size={13} style={{ color: activeRibbonRiff === 'transit' ? '#000' : '#34d399' }} />
              Fate Transit
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsRibbonCollapsed(!isRibbonCollapsed)}
            className="btn btn-secondary"
            style={{ fontSize: '0.76rem', padding: '5px 9px', gap: '5px' }}
            title={isRibbonCollapsed ? 'Show Minimal Thread Ribbon' : 'Hide Minimal Thread Ribbon'}
          >
            {isRibbonCollapsed ? <ChevronsUpDown size={14} /> : <ChevronsDownUp size={14} />}
            {isRibbonCollapsed ? 'Show Ribbon' : 'Hide Ribbon'}
          </button>

          <button
            type="button"
            onClick={handleToggleDensity}
            className="btn btn-secondary"
            style={{ fontSize: '0.76rem', padding: '5px 9px', gap: '5px' }}
            title={encounterDensity === 'detailed' ? 'Switch to Compact Scene Cards' : 'Switch to Detailed Scene Cards'}
          >
            {encounterDensity === 'detailed' ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            {encounterDensity === 'detailed' ? 'Compact Scenes' : 'Detailed Scenes'}
          </button>

          {onNavigateToTranscript && (
            <button
              type="button"
              onClick={() => onNavigateToTranscript()}
              className="btn btn-secondary"
              style={{ fontSize: '0.76rem', padding: '5px 9px', gap: '5px', color: 'var(--color-arcane-blue-text)', borderColor: 'var(--color-arcane-blue-border)' }}
            >
              <Mic size={14} /> Ingest Transcript
            </button>
          )}

          {onNavigateToIngestion && (
            <button
              type="button"
              onClick={onNavigateToIngestion}
              className="btn btn-secondary"
              style={{ fontSize: '0.76rem', padding: '5px 9px', gap: '5px' }}
            >
              <BookOpen size={14} style={{ color: 'var(--color-gold)' }} /> Decompose Book
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowAddModal('quest')}
            className="btn btn-secondary"
            style={{ fontSize: '0.76rem', padding: '5px 10px', gap: '5px' }}
          >
            <Plus size={14} /> New Quest
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal('session')}
            className="btn btn-secondary"
            style={{ fontSize: '0.76rem', padding: '5px 10px', gap: '5px' }}
          >
            <Plus size={14} /> New Session
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal('arc')}
            className="btn btn-primary"
            style={{ fontSize: '0.76rem', padding: '5px 12px', gap: '5px' }}
          >
            <Plus size={14} /> New Arc
          </button>
        </div>
      </div>

      {tapestryViewMode === 'flowchart' ? (
        <QuestFlowchart
          campaignId={campaignId}
          graphData={graphData}
          onSelectNode={onSelectNode}
          onRefresh={onRefresh}
          showArchived={showArchived}
        />
      ) : (
        /* Main Tapestry Canvas Area with True Horizontal Scroll */
        <div
          style={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            overflowX: 'auto',
            overflowY: 'auto',
            padding: '16px 24px 24px 0',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
        {displayQuests.length === 0 && displayColumns.length === 0 && encounters.length === 0 ? (
          /* Empty State */
          <div
            className="glass-panel"
            style={{
              padding: '60px 40px',
              textAlign: 'center',
              borderRadius: '16px',
              border: '1px dashed var(--border-medium)',
              maxWidth: '680px',
              margin: '40px auto'
            }}
          >
            <Flame size={48} style={{ color: 'var(--color-gold)', margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '8px' }}>Your Campaign Tapestry is Unwoven</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.6 }}>
              A grand campaign is woven from overarching <strong>Story Arcs</strong>, active <strong>Quests</strong>, and real-world <strong>Game Sessions</strong>. Create your first act to start charting the story!
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setShowAddModal('arc')} className="btn btn-primary">
                <Plus size={16} /> Create First Story Arc
              </button>
              <button onClick={() => setShowAddModal('quest')} className="btn btn-secondary">
                <Plus size={16} /> Create First Quest
              </button>
              {onNavigateToIngestion && (
                <button onClick={onNavigateToIngestion} className="btn btn-secondary">
                  <BookOpen size={16} style={{ color: 'var(--color-gold)' }} /> Decompose Adventure Book
                </button>
              )}
            </div>
          </div>
        ) : (
          <div
            style={{
              width: `${canvasWidth}px`,
              minWidth: `${canvasWidth}px`,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            {/* Unassigned Intake Banner if scenes need weaving */}
            {unassignedSessionEncounters.length > 0 && (
              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: '10px',
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                  position: 'sticky',
                  left: '20px',
                  width: 'fit-content',
                  maxWidth: 'calc(100vw - 340px)',
                  marginLeft: '20px',
                  zIndex: 15
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', color: '#93c5fd' }}>
                  <Info size={18} style={{ color: '#38bdf8', flexShrink: 0 }} />
                  <span>
                    <strong>{unassignedSessionEncounters.length} scenes</strong> staged in your <strong>📥 Prep Staging</strong> column. Use <strong>"To Session 1"</strong> or click any scene to weave them into game sessions!
                  </span>
                </div>
                {sessions.length === 0 && (
                  <button
                    type="button"
                    onClick={() => handleQuickCreateSession(1, 'Session 1: The Adventure Begins')}
                    className="btn btn-primary"
                    style={{ fontSize: '0.74rem', padding: '4px 10px', gap: '5px', whiteSpace: 'nowrap' }}
                  >
                    <Plus size={13} /> Create Session 1 in DB
                  </button>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* 1. TOP MINIMALIST THREAD RIBBON (ACROSS THE SESSIONS)                    */}
            {/* ========================================================================= */}
            {!isRibbonCollapsed && displayColumns.length > 0 && (
              <TapestryRibbon
                canvasWidth={canvasWidth}
                displayColumns={displayColumns}
                encounters={encounters}
                encounterSessionMap={encounterSessionMap}
                hoveredSessionId={hoveredSessionId}
                activeRibbonRiff={activeRibbonRiff}
                getColX={getColX}
                onSelectEncounter={setActiveEncounterModal}
              />
            )}

            {/* ========================================================================= */}
            {/* 2. CAMPAIGN STORY ARCS ROW (ACT BANNERS SPANNING SESSIONS)               */}
            {/* ========================================================================= */}
            <TapestryArcBanners
              matrixGridCols={matrixGridCols}
              displayColumns={displayColumns}
              arcLayouts={arcLayouts}
              collapsedSessionIds={collapsedSessionIds}
              onSelectArc={setActiveArcModal}
              onToggleArcCollapse={toggleArcCollapse}
            />

            {/* ========================================================================= */}
            {/* 3. SESSIONS HEADER ROW (VERTICAL TIMELINE ANCHORS)                       */}
            {/* ========================================================================= */}
            <TapestrySessionHeaders
              matrixGridCols={matrixGridCols}
              displayColumns={displayColumns}
              displayQuests={displayQuests}
              collapsedQuestIds={collapsedQuestIds}
              collapsedSessionIds={collapsedSessionIds}
              hoveredSessionId={hoveredSessionId}
              encounters={encounters}
              encounterSessionMap={encounterSessionMap}
              encounterQuestMap={encounterQuestMap}
              sessions={sessions}
              onExpandAllQuests={handleExpandAll}
              onCollapseAllQuests={handleCollapseAll}
              onToggleSessionCollapse={toggleSessionCollapse}
              onSelectSession={setActiveSessionModal}
              onSetHoveredSessionId={setHoveredSessionId}
              onMoveEncounter={handleMoveEncounter}
              onOpenRunSheet={(sess) => setRunSheetSessionNode(sess)}
              onQuickCreateSession={handleQuickCreateSession}
            />

            {/* ========================================================================= */}
            {/* 4. THE TAPESTRY MATRIX (QUEST ROWS × SESSION COLUMNS)                    */}
            {/* ========================================================================= */}
            <div
              ref={matrixContainerRef}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative' }}
            >
              {/* SVG Overlays for Milestone Sync Lines and Encounter Precedence Lines */}
              <TapestrySvgOverlays
                milestoneLines={milestoneLines}
                precedenceLines={precedenceLines}
                hoveredEncounterId={hoveredEncounterId}
                hoveredMilestoneId={hoveredMilestoneId}
                hoveredQuestId={hoveredQuestId}
              />
              {displayQuests.map((quest, qIdx) => (
                <TapestryQuestRow
                  key={quest.id}
                  quest={quest}
                  qIdx={qIdx}
                  matrixGridCols={matrixGridCols}
                  COL_GAP={COL_GAP}
                  displayColumns={displayColumns}
                  collapsedQuestIds={collapsedQuestIds}
                  collapsedSessionIds={collapsedSessionIds}
                  collapsedSubQuestParents={collapsedSubQuestParents}
                  childQuestsMap={childQuestsMap}
                  hoveredQuestId={hoveredQuestId}
                  hoveredSessionId={hoveredSessionId}
                  hoveredEncounterId={hoveredEncounterId}
                  hoveredMilestoneId={hoveredMilestoneId}
                  draggingQuestId={draggingQuestId}
                  dragOverQuestId={dragOverQuestId}
                  dragOverQuestPosition={dragOverQuestPosition}
                  dragOverCell={dragOverCell}
                  questColors={questColors}
                  encounters={encounters}
                  encounterQuestMap={encounterQuestMap}
                  encounterSessionMap={encounterSessionMap}
                  encounterPrecedenceEdges={encounterPrecedenceEdges}
                  unassignedQuestEncounters={unassignedQuestEncounters}
                  questPrereqsMap={questPrereqsMap}
                  questBranchesMap={questBranchesMap}
                  milestoneReceivers={milestoneReceivers}
                  milestoneLines={milestoneLines}
                  milestoneEmitters={milestoneEmitters}
                  encounterEntitiesMap={encounterEntitiesMap}
                  sessions={sessions}
                  quests={quests}
                  encounterDensity={encounterDensity}
                  onToggleQuestCollapse={toggleQuestCollapse}
                  onToggleSubQuestsCollapse={toggleSubQuestsCollapse}
                  onToggleSessionCollapse={toggleSessionCollapse}
                  onSelectQuest={(q) => setActiveQuestModal(q)}
                  onSelectEncounter={(e) => setActiveEncounterModal(e)}
                  onSelectEntity={(ent) => setActiveEntityModal(ent)}
                  onToggleCanon={handleToggleCanon}
                  onToggleReveal={handleToggleReveal}
                  onAssignToSession={handleAssignEncounterToSession}
                  onAssignToQuest={handleAssignEncounterToQuest}
                  onMoveEncounter={handleMoveEncounter}
                  onReorderQuests={handleReorderQuests}
                  onNodeContextMenu={(node, e) => setContextMenu({ x: e.clientX, y: e.clientY, node })}
                  onOpenAddEncounterModal={(qId, sId) => {
                    setShowAddModal('encounter');
                    setTargetQuestId(qId);
                    setTargetSessionId(sId);
                  }}
                  setHoveredQuestId={setHoveredQuestId}
                  setHoveredEncounterId={setHoveredEncounterId}
                  setHoveredMilestoneId={setHoveredMilestoneId}
                  setDraggingQuestId={setDraggingQuestId}
                  setDragOverQuestId={setDragOverQuestId}
                  setDragOverQuestPosition={setDragOverQuestPosition}
                  setDraggingEncounterId={setDraggingEncounterId}
                  setDragOverCell={setDragOverCell}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL SUITE                                                           */}
      {/* ========================================================================= */}

      {/* A. ENCOUNTER MODAL */}
      {activeEncounterNode && (
        <TapestryEncounterModal
          encounter={activeEncounterNode}
          onClose={() => setActiveEncounterNode(null)}
          onSelectNode={onSelectNode}
          onFocusCoDM={onFocusCoDM}
          onStatusChange={handleStatusChange}
          onToggleCanon={handleToggleCanon}
          onToggleReveal={handleToggleReveal}
          onDeleteNode={handleDeleteNode}
          graphData={graphData}
          quests={quests}
          sessions={sessions}
          encounters={encounters}
          nodeMap={nodeMap}
          encounterQuestMap={encounterQuestMap}
          encounterSessionMap={encounterSessionMap}
          encounterEntitiesMap={encounterEntitiesMap}
          onAssignEncounterToQuest={handleAssignEncounterToQuest}
          onAssignEncounterToSession={handleAssignEncounterToSession}
          newMilestoneQuestId={newMilestoneQuestId}
          newMilestoneSummary={newMilestoneSummary}
          isSavingMilestone={isSavingMilestone}
          onChangeMilestoneQuestId={setNewMilestoneQuestId}
          onChangeMilestoneSummary={setNewMilestoneSummary}
          onAddMilestoneImpact={handleAddMilestoneImpact}
          onDeleteMilestoneImpact={handleDeleteMilestoneImpact}
          newBranchTargetEncounterId={newBranchTargetEncounterId}
          newBranchLabel={newBranchLabel}
          isSavingPrecedence={isSavingPrecedence}
          onChangeBranchTargetEncounterId={setNewBranchTargetEncounterId}
          onChangeBranchLabel={setNewBranchLabel}
          onAddBranchEncounter={handleAddBranchEncounter}
          onDeletePrecedenceEdge={handleDeletePrecedenceEdge}
        />
      )}

      {/* B. QUEST MODAL */}
      {activeQuestNode && (
        <TapestryQuestModal
          quest={activeQuestNode}
          onClose={() => setActiveQuestNode(null)}
          onDelete={handleDeleteNode}
          onSelectNode={onSelectNode}
          onFocusCoDM={onFocusCoDM}
        />
      )}

      {/* C. SESSION MODAL */}
      {activeSessionNode && (
        <TapestrySessionModal
          session={activeSessionNode}
          onClose={() => setActiveSessionNode(null)}
          onDelete={handleDeleteNode}
          onSelectNode={onSelectNode}
          onOpenRunSheet={(sess) => setRunSheetSessionNode(sess)}
          onNavigateToTranscript={onNavigateToTranscript}
        />
      )}

      {/* C2. RUN-SHEET STUDIO MODAL */}
      {runSheetSessionNode && (
        <RunSheetModal
          sessionNode={runSheetSessionNode}
          campaignId={campaignId || graphData.nodes[0]?.campaign_id || 'default-campaign'}
          onClose={() => setRunSheetSessionNode(null)}
          onSaveNode={(updatedNode) => {
            onRefresh();
            setRunSheetSessionNode(updatedNode);
          }}
        />
      )}

      {/* D. ARC MODAL */}
      {activeArcNode && (
        <TapestryArcModal
          arc={activeArcNode}
          onClose={() => setActiveArcNode(null)}
          onDelete={handleDeleteNode}
        />
      )}

      {/* E. ENTITY MODAL (Inspection of attached Monster, Location, Item) */}
      {activeEntityNode && (
        <TapestryEntityModal
          entity={activeEntityNode}
          onClose={() => setActiveEntityNode(null)}
          onSelectNode={onSelectNode}
        />
      )}

      {/* F. CREATE NODE MODAL */}
      {showAddModal && (
        <TapestryCreateNodeModal
          type={showAddModal}
          title={newTitle}
          summary={newSummary}
          onChangeTitle={setNewTitle}
          onChangeSummary={setNewSummary}
          onSubmit={handleCreateNewNode}
          onClose={() => setShowAddModal(null)}
        />
      )}

      {/* Right-click Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};
