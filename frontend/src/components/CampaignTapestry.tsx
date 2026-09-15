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
  toggleNodeReveal
} from '../api';
import { GraphData, NodeItem, NodeType } from '../types';
import { MarkdownView } from './MarkdownView';
import { QuestFlowchart } from './QuestFlowchart';
import { RunSheetModal } from './RunSheetModal';
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

interface CampaignTapestryProps {
  campaignId: string;
  graphData: GraphData;
  onRefresh: () => void;
  onSelectNode: (node: NodeItem) => void;
  onFocusCoDM: (node: NodeItem) => void;
  onNavigateToIngestion?: () => void;
  onNavigateToTranscript?: (sessionNodeId?: string) => void;
}

export const CampaignTapestry: React.FC<CampaignTapestryProps> = ({
  campaignId,
  graphData,
  onRefresh,
  onSelectNode,
  onFocusCoDM,
  onNavigateToIngestion,
  onNavigateToTranscript,
}) => {
  // Tapestry View Mode: 'matrix' (Sessions x Quests) or 'flowchart' (Story Flow & Branches DAG)
  const [tapestryViewMode, setTapestryViewMode] = useState<'matrix' | 'flowchart'>('matrix');
  const [collapsedSubQuestParents, setCollapsedSubQuestParents] = useState<Set<string>>(new Set());

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
    setCollapsedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      try {
        localStorage.setItem(`dnd_tapestry_collapsed_sessions_${campaignId}`, JSON.stringify(Array.from(next)));
      } catch (e) {
        console.error(e);
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
  } = useTapestryGraph(graphData);

  // Toggle collapsing sub-quests under a parent quest
  const toggleSubQuestsCollapse = (parentQuestId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedSubQuestParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentQuestId)) next.delete(parentQuestId);
      else next.add(parentQuestId);
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
    }> = [];

    // For each root quest, add it, and if it has sub-quests, insert them right beneath
    rootQuests.forEach((rootQ: NodeItem) => {
      const childIds = childQuestsMap.get(rootQ.id) || [];
      const childNodes = childIds
        .map((cid) => nodeMap.get(cid))
        .filter((n): n is NodeItem => !!n);
      const completedCount = childNodes.filter(
        (c) => c.data_json?.status === 'completed'
      ).length;

      list.push({
        ...rootQ,
        isSubQuest: false,
        subQuestCount: childNodes.length,
        completedSubQuestCount: completedCount,
      });

      // If parent's sub-quests are not collapsed, include each child sub-quest directly below
      if (childNodes.length > 0 && !collapsedSubQuestParents.has(rootQ.id)) {
        childNodes.forEach((childQ) => {
          list.push({
            ...childQ,
            isSubQuest: true,
            parentQuestId: rootQ.id,
            subQuestCount: 0,
            completedSubQuestCount: 0,
          });
        });
      }
    });

    // Also include any orphan sub-quests whose parent was deleted or not in list
    orderedQuests.forEach((q: NodeItem) => {
      if (subQuestIds.has(q.id)) {
        const pId = parentQuestMap.get(q.id);
        if (pId && !nodeMap.has(pId)) {
          list.push({ ...q, isSubQuest: false });
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
    displayQuests,
    milestoneReceivers,
  });

  // Quest Color Palette
  const questColors = ['#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#10b981', '#ec4899', '#3b82f6'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-app)', color: 'var(--text-primary)', overflow: 'hidden' }}>
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
        />
      ) : (
        /* Main Tapestry Canvas Area with True Horizontal Scroll */
        <div
          style={{
          flex: 1,
          minHeight: 0,
          overflowX: 'auto',
          overflowY: 'auto',
          padding: '20px 24px',
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
                  flexWrap: 'wrap'
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
              {displayQuests.map((quest, qIdx) => {
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
                      position: 'relative'
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
                          opacity: isCollapsed ? 0.6 : 1
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
                              await handleReorderQuests(data.questId, quest.id, dragOverQuestPosition || 'below');
                            } else if (data.type === 'encounter') {
                              const targetQuestId = isOpenRow ? null : quest.id;
                              const currentSessionId = encounterSessionMap.get(data.encounterId) || null;
                              await handleMoveEncounter(data.encounterId, currentSessionId, targetQuestId);
                            }
                          } catch (err) {
                            console.error(err);
                          } finally {
                            setDraggingQuestId(null);
                            setDragOverQuestId(null);
                            setDragOverQuestPosition(null);
                          }
                        }}
                        onClick={() => toggleQuestCollapse(quest.id)}
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
                            : 'none'
                        }}
                        title="Click to expand story line"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleQuestCollapse(quest.id);
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
                              flexShrink: 0
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
                              whiteSpace: 'nowrap'
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
                              onClick={(e) => toggleSubQuestsCollapse(quest.id, e)}
                              className="btn btn-ghost"
                              style={{ fontSize: '0.62rem', padding: '1px 5px', height: '20px', gap: '3px', color: '#60a5fa', background: 'rgba(59, 130, 246, 0.1)' }}
                              title="Toggle sub-quests visibility in matrix"
                            >
                              {completedSubQuestCount}/{subQuestCount} obj
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
                                color: questColor
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
                                setActiveQuestModal(quest);
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
                              await handleReorderQuests(data.questId, quest.id, dragOverQuestPosition || 'below');
                            } else if (data.type === 'encounter') {
                              const targetQuestId = isOpenRow ? null : quest.id;
                              const currentSessionId = encounterSessionMap.get(data.encounterId) || null;
                              await handleMoveEncounter(data.encounterId, currentSessionId, targetQuestId);
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
                          if (!isOpenRow) setActiveQuestModal(quest);
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
                            : 'none'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleQuestCollapse(quest.id);
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
                                  transition: 'color 0.15s ease'
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
                                onClick={(e) => toggleSubQuestsCollapse(quest.id, e)}
                                className="btn btn-ghost"
                                style={{ fontSize: '0.65rem', padding: '1px 6px', height: '20px', gap: '3px', color: '#60a5fa' }}
                              >
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
                            onClick={() => toggleSessionCollapse(sess.id)}
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
                                          : 'var(--text-muted)'
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
                                  await handleMoveEncounter(data.encounterId, targetSessionId, targetQuestId);
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
                              overflow: 'hidden'
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
                                        setActiveEncounterModal(enc);
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
                                        textOverflow: 'ellipsis'
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
                                await handleMoveEncounter(data.encounterId, targetSessionId, targetQuestId);
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
                              : '1px solid rgba(255, 255, 255, 0.04)'
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
                                    flexShrink: 0
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
                            matchingEncounters.map((enc: NodeItem, encIdx: number) => {
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
                                  key={enc.id}
                                  id={`enc-${enc.id}`}
                                  draggable={true}
                                  onDragStart={(e) => {
                                    e.stopPropagation();
                                    e.dataTransfer.setData(
                                      'text/plain',
                                      JSON.stringify({
                                        type: 'encounter',
                                        encounterId: enc.id
                                      })
                                    );
                                    e.dataTransfer.effectAllowed = 'move';
                                    setDraggingEncounterId(enc.id);
                                  }}
                                  onDragEnd={() => {
                                    setDraggingEncounterId(null);
                                    setDragOverCell(null);
                                  }}
                                  onClick={() => setActiveEncounterModal(enc)}
                                  onMouseEnter={() => setHoveredEncounterId(enc.id)}
                                  onMouseLeave={() => setHoveredEncounterId(null)}
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
                                        : '0 2px 8px rgba(0, 0, 0, 0.2)'
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
                                          letterSpacing: '0.5px'
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
                                          letterSpacing: '0.4px'
                                        }}
                                      >
                                        {encType}
                                      </span>
                                    </div>

                                    {/* Action icons */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleToggleCanon(e, enc);
                                        }}
                                        title={enc.is_canon ? 'Canon Lore (Click to switch to non-canon)' : 'Draft/Alternate (Click to mark Canon)'}
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          cursor: 'pointer',
                                          padding: '2px',
                                          color: enc.is_canon ? 'var(--color-gold)' : 'var(--text-muted)',
                                          opacity: enc.is_canon ? 1 : 0.4
                                        }}
                                      >
                                        <Sparkles size={11} />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleToggleReveal(e, enc);
                                        }}
                                        title={enc.revealed_to_players ? 'Revealed to Players' : 'Hidden / DM Eyes Only'}
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          cursor: 'pointer',
                                          padding: '2px',
                                          color: enc.revealed_to_players ? 'var(--color-emerald)' : 'var(--text-muted)',
                                          opacity: enc.revealed_to_players ? 1 : 0.4
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
                                        WebkitBoxOrient: 'vertical'
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
                                          WebkitBoxOrient: 'vertical'
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
                                          marginTop: '2px'
                                        }}
                                      >
                                        {attached.locations.slice(0, 2).map((loc) => (
                                          <span
                                            key={loc.id}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveEntityModal(loc);
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
                                              whiteSpace: 'nowrap'
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
                                              setActiveEntityModal(mon);
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
                                              whiteSpace: 'nowrap'
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
                                              setActiveEntityModal(npc);
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
                                              whiteSpace: 'nowrap'
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
                                              setActiveEntityModal(itm);
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
                                              whiteSpace: 'nowrap'
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
                                        marginTop: 'auto'
                                      }}
                                    >
                                      {isStagingCol && sessions.length > 0 && (
                                        <select
                                          defaultValue=""
                                          onChange={(e) => {
                                            if (e.target.value) {
                                              handleAssignEncounterToSession(enc.id, e.target.value);
                                            }
                                          }}
                                          style={{
                                            fontSize: '0.68rem',
                                            padding: '2px 4px',
                                            background: 'var(--bg-surface)',
                                            color: 'var(--text-secondary)',
                                            border: '1px solid var(--border-subtle)',
                                            borderRadius: '4px',
                                            maxWidth: '110px'
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
                                              handleAssignEncounterToQuest(enc.id, e.target.value);
                                            }
                                          }}
                                          style={{
                                            fontSize: '0.68rem',
                                            padding: '2px 4px',
                                            background: 'var(--bg-surface)',
                                            color: 'var(--text-secondary)',
                                            border: '1px solid var(--border-subtle)',
                                            borderRadius: '4px',
                                            maxWidth: '110px'
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
                            })
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
                                background: 'rgba(245, 158, 11, 0.08)'
                              }}
                            >
                              <Plus size={13} /> Drop Scene Here
                            </div>
                          ) : (
                            /* Dormant Thread Pass-Through */
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowAddModal('encounter');
                                  setTargetQuestId(isOpenRow ? null : quest.id);
                                  setTargetSessionId(isStagingCol ? null : sess.id);
                                }}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: '4px'
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
                                    transition: 'all 0.15s ease'
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
              })}
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
    </div>
  );
};
