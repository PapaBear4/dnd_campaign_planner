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

  // 1. Filter Nodes by Type
  const { arcs, sessions, quests, encounters, nodeMap } = useMemo(() => {
    const map = new Map<string, NodeItem>();
    graphData.nodes.forEach((n) => map.set(n.id, n));

    const naturalNum = (title: string) => {
      const match = title.match(/(?:session|arc|act|quest|part|chapter|encounter|beat)?\s*#?\s*(\d+)/i) || title.match(/\b(\d+)\b/);
      return match ? parseInt(match[1], 10) : 999;
    };

    const arcList = graphData.nodes
      .filter((n) => n.type === 'arc')
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || naturalNum(a.title) - naturalNum(b.title));

    const sessionList = graphData.nodes
      .filter((n) => n.type === 'session')
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || naturalNum(a.title) - naturalNum(b.title));

    const questList = graphData.nodes
      .filter((n) => n.type === 'quest')
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    const encounterList = graphData.nodes
      .filter((n) => n.type === 'encounter')
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || naturalNum(a.title) - naturalNum(b.title));

    return {
      arcs: arcList,
      sessions: sessionList,
      quests: questList,
      encounters: encounterList,
      nodeMap: map
    };
  }, [graphData.nodes]);

  // 2. Build Edge Connections: Encounter -> Session, Encounter -> Quest, Encounter -> Entities
  const { encounterSessionMap, encounterQuestMap, encounterEntitiesMap } = useMemo(() => {
    const encToSession = new Map<string, string>();
    const encToQuest = new Map<string, string>();
    const encToEntities = new Map<string, { locations: NodeItem[]; monsters: NodeItem[]; items: NodeItem[]; npcs: NodeItem[] }>();

    // Seed empty entity lists
    encounters.forEach((e) => {
      encToEntities.set(e.id, { locations: [], monsters: [], items: [], npcs: [] });
      if (e.data_json?.session_id) encToSession.set(e.id, e.data_json.session_id);
      if (e.data_json?.quest_id) encToQuest.set(e.id, e.data_json.quest_id);
    });

    graphData.edges.forEach((edge) => {
      const source = nodeMap.get(edge.source_id);
      const target = nodeMap.get(edge.target_id);
      if (!source || !target) return;

      // Encounter <-> Session connection
      if (source.type === 'encounter' && target.type === 'session') {
        encToSession.set(source.id, target.id);
      } else if (source.type === 'session' && target.type === 'encounter') {
        encToSession.set(target.id, source.id);
      }

      // Encounter <-> Quest connection
      if (source.type === 'encounter' && target.type === 'quest') {
        encToQuest.set(source.id, target.id);
      } else if (source.type === 'quest' && target.type === 'encounter') {
        encToQuest.set(target.id, source.id);
      }

      // Encounter <-> Entity connections (Location, Monster, Item, NPC)
      const connectEntity = (encId: string, entity: NodeItem) => {
        const entObj = encToEntities.get(encId);
        if (!entObj) return;
        if (entity.type === 'location' && !entObj.locations.some((l) => l.id === entity.id)) entObj.locations.push(entity);
        else if (entity.type === 'monster' && !entObj.monsters.some((m) => m.id === entity.id)) entObj.monsters.push(entity);
        else if (entity.type === 'item' && !entObj.items.some((i) => i.id === entity.id)) entObj.items.push(entity);
        else if (entity.type === 'npc' && !entObj.npcs.some((n) => n.id === entity.id)) entObj.npcs.push(entity);
      };

      if (source.type === 'encounter' && ['location', 'monster', 'item', 'npc'].includes(target.type)) {
        connectEntity(source.id, target);
      } else if (target.type === 'encounter' && ['location', 'monster', 'item', 'npc'].includes(source.type)) {
        connectEntity(target.id, source);
      }
    });

    return {
      encounterSessionMap: encToSession,
      encounterQuestMap: encToQuest,
      encounterEntitiesMap: encToEntities
    };
  }, [graphData.edges, encounters, nodeMap]);

  // Session <-> Arc association
  const sessionArcMap = useMemo(() => {
    const sToA = new Map<string, string>();
    graphData.edges.forEach((edge) => {
      const source = nodeMap.get(edge.source_id);
      const target = nodeMap.get(edge.target_id);
      if (!source || !target) return;
      if (source.type === 'arc' && target.type === 'session') sToA.set(target.id, source.id);
      else if (source.type === 'session' && target.type === 'arc') sToA.set(source.id, target.id);
    });
    return sToA;
  }, [graphData.edges, nodeMap]);

  // 2b. Build Quest Hierarchy (Sub-Quests) & Branches (Prerequisites & Outgoing Forks)
  const {
    parentQuestMap,
    childQuestsMap,
    questPrereqsMap,
    questBranchesMap,
  } = useMemo(() => {
    const parentMap = new Map<string, string>();
    const childMap = new Map<string, string[]>();
    const prereqs = new Map<string, Array<{ quest: NodeItem; label?: string }>>();
    const branches = new Map<string, Array<{ quest: NodeItem; label?: string }>>();

    graphData.edges.forEach((edge) => {
      const source = nodeMap.get(edge.source_id);
      const target = nodeMap.get(edge.target_id);
      if (!source || !target) return;

      if (source.type === 'quest' && target.type === 'quest') {
        if (edge.relation_type === 'contains' || edge.relation_type === 'parent_of') {
          parentMap.set(target.id, source.id);
          const c = childMap.get(source.id) || [];
          if (!c.includes(target.id)) {
            c.push(target.id);
            childMap.set(source.id, c);
          }
        } else if (edge.relation_type === 'precedes') {
          const inList = prereqs.get(target.id) || [];
          inList.push({ quest: source, label: edge.label });
          prereqs.set(target.id, inList);

          const outList = branches.get(source.id) || [];
          outList.push({ quest: target, label: edge.label });
          branches.set(source.id, outList);
        }
      }
    });

    return {
      parentQuestMap: parentMap,
      childQuestsMap: childMap,
      questPrereqsMap: prereqs,
      questBranchesMap: branches,
    };
  }, [graphData.edges, nodeMap]);

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

  // 3. Fallback / Dynamic Columns & Rows Setup
  const unassignedSessionEncounters = useMemo(() => {
    return encounters.filter((e) => !encounterSessionMap.get(e.id));
  }, [encounters, encounterSessionMap]);

  const unassignedQuestEncounters = useMemo(() => {
    return encounters.filter((e) => !encounterQuestMap.get(e.id));
  }, [encounters, encounterQuestMap]);

  // Dimensions for pixel-perfect horizontal timeline
  const LEFT_COL_WIDTH = 280;
  const SESSION_COL_EXPANDED_WIDTH = 680;
  const SESSION_COL_COLLAPSED_WIDTH = 48;
  const COL_GAP = 12;

  const { displayColumns, arcLayouts } = useMemo(() => {
    const unassignedSessions = encounters.filter((e) => !encounterSessionMap.get(e.id));
    const cols: NodeItem[] = [];
    const layouts: { arc: NodeItem; colSpan: number; sessionIds: string[] }[] = [];

    // Always include Intake / Prep Staging column if there are unassigned encounters OR 0 sessions
    const needsStaging = unassignedSessions.length > 0 || sessions.length === 0;
    if (needsStaging) {
      cols.push({
        id: 'unscheduled-staging',
        campaign_id: campaignId,
        type: 'session',
        title: '📥 Prep Staging',
        subtitle: `${unassignedSessions.length} unassigned`,
        summary: 'Scenes waiting to be scheduled into a game session',
        data_json: { is_staging: true },
        sort_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_canon: true,
        revealed_to_players: false,
      });
    }

    if (arcs.length > 0) {
      arcs.forEach((arc, aIdx) => {
        // Find actual sessions linked to this arc
        const linkedSessions = sessions.filter((s) => sessionArcMap.get(s.id) === arc.id);

        if (linkedSessions.length > 0) {
          linkedSessions.forEach((s) => cols.push(s));
          layouts.push({ arc, colSpan: linkedSessions.length, sessionIds: linkedSessions.map((s) => s.id) });
        } else {
          // Provide at least 1 staging session pillar for this Arc so each Arc has its own horizontal space!
          const sessNum = aIdx + 1;
          const cleanArcTitle = arc.title.replace(/^(?:arc|act)\s*\d+:\s*/i, '');
          const virtualId = `virtual-session-${sessNum}`;
          cols.push({
            id: virtualId,
            campaign_id: campaignId,
            type: 'session',
            title: `Session ${sessNum}: ${cleanArcTitle}`,
            subtitle: aIdx === 0 ? 'Upcoming Game Night' : `Act ${aIdx + 1} Staging`,
            summary: `Session staging for ${arc.title}`,
            data_json: { status: aIdx === 0 ? 'in_progress' : 'planned', session_number: sessNum, is_virtual: true, arc_id: arc.id },
            sort_order: sessNum,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_canon: true,
            revealed_to_players: aIdx === 0,
          });
          layouts.push({ arc, colSpan: 1, sessionIds: [virtualId] });
        }
      });
    } else if (sessions.length > 0) {
      sessions.forEach((s) => cols.push(s));
    } else {
      cols.push(
        {
          id: 'virtual-session-1',
          campaign_id: campaignId,
          type: 'session',
          title: 'Session 1: Prep & Kickoff',
          subtitle: 'Upcoming Game Night',
          summary: 'Current upcoming session prep',
          data_json: { status: 'in_progress', session_number: 1, is_virtual: true },
          sort_order: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_canon: true,
          revealed_to_players: true,
        },
        {
          id: 'virtual-session-2',
          campaign_id: campaignId,
          type: 'session',
          title: 'Session 2 (Planned)',
          subtitle: 'Future Session',
          summary: 'Next chapter in the storyline',
          data_json: { status: 'planned', session_number: 2, is_virtual: true },
          sort_order: 2,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_canon: true,
          revealed_to_players: false,
        }
      );
    }

    return {
      displayColumns: cols,
      arcLayouts: layouts,
    };
  }, [arcs, sessions, sessionArcMap, encounters, encounterSessionMap, campaignId]);

  const { milestoneEmitters, milestoneReceivers, allMilestoneLinks } = useMemo(() => {
    const emitters = new Map<string, { targetQuestId: string; label: string; summary?: string }[]>();
    const receivers = new Map<string, { id: string; sourceEncounterId: string; sourceEncounterTitle: string; targetQuestId: string; sessionId: string; label: string; summary?: string }[]>();
    const links: { id: string; sourceEncounterId: string; sourceEncounterTitle: string; targetQuestId: string; sessionId: string; label: string; summary?: string }[] = [];

    const naturalNum = (title: string) => {
      const match = title.match(/(?:session|arc|act|quest|part|chapter|encounter|beat)?\s*#?\s*(\d+)/i) || title.match(/\b(\d+)\b/);
      return match ? parseInt(match[1], 10) : 999;
    };

    graphData.edges.forEach((edge) => {
      const isMilestone = edge.relation_type === 'advances_quest' || edge.metadata_json?.is_milestone;
      if (!isMilestone) return;

      const sourceNode = nodeMap.get(edge.source_id);
      const targetNode = nodeMap.get(edge.target_id);
      if (!sourceNode || !targetNode) return;

      const sourceEnc = sourceNode.type === 'encounter' ? sourceNode : null;
      const targetQuest = targetNode.type === 'quest' ? targetNode : null;
      if (!sourceEnc || !targetQuest) return;

      const sourceSessionId = encounterSessionMap.get(sourceEnc.id) || edge.metadata_json?.session_id;
      const label = edge.label || edge.metadata_json?.milestone_title || 'Milestone Breakthrough';
      const summary = edge.metadata_json?.summary || '';

      if (!emitters.has(sourceEnc.id)) emitters.set(sourceEnc.id, []);
      emitters.get(sourceEnc.id)!.push({ targetQuestId: targetQuest.id, label, summary });

      if (sourceSessionId) {
        const key = `${targetQuest.id}-${sourceSessionId}`;
        if (!receivers.has(key)) receivers.set(key, []);
        const item = {
          id: edge.id,
          sourceEncounterId: sourceEnc.id,
          sourceEncounterTitle: sourceEnc.title,
          targetQuestId: targetQuest.id,
          sessionId: sourceSessionId,
          label,
          summary
        };
        receivers.get(key)!.push(item);
        links.push(item);
      }
    });

    // Sort receivers in each cell in encounter-chronological order
    receivers.forEach((list) => {
      list.sort((a, b) => {
        const encA = nodeMap.get(a.sourceEncounterId);
        const encB = nodeMap.get(b.sourceEncounterId);
        const orderA = encA?.sort_order ?? 0;
        const orderB = encB?.sort_order ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        const natA = naturalNum(encA?.title || '');
        const natB = naturalNum(encB?.title || '');
        if (natA !== natB) return natA - natB;
        return (encA?.title || '').localeCompare(encB?.title || '');
      });
    });

    return { milestoneEmitters: emitters, milestoneReceivers: receivers, allMilestoneLinks: links };
  }, [graphData.edges, nodeMap, encounterSessionMap]);

  // Precedence edges between encounters (Encounter -> precedes -> Encounter)
  const encounterPrecedenceEdges = useMemo(() => {
    return graphData.edges.filter(
      (e) =>
        e.relation_type === 'precedes' &&
        nodeMap.get(e.source_id)?.type === 'encounter' &&
        nodeMap.get(e.target_id)?.type === 'encounter'
    );
  }, [graphData.edges, nodeMap]);

  interface PrecedenceLine {
    edgeId: string;
    d: string;
    label?: string;
    midX: number;
    midY: number;
    sourceId: string;
    targetId: string;
    isTight: boolean;
    tooltipBelow: boolean;
  }

  interface MilestoneLine {
    id: string;
    sourceEncounterId: string;
    targetQuestId: string;
    d: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }

  const matrixContainerRef = useRef<HTMLDivElement>(null);
  const [precedenceLines, setPrecedenceLines] = useState<PrecedenceLine[]>([]);
  const [milestoneLines, setMilestoneLines] = useState<MilestoneLine[]>([]);
  const [hoveredMilestoneId, setHoveredMilestoneId] = useState<string | null>(null);

  const calculatePrecedenceLines = useCallback(() => {
    if (!matrixContainerRef.current) return;
    const mRect = matrixContainerRef.current.getBoundingClientRect();
    const lines: PrecedenceLine[] = [];

    encounterPrecedenceEdges.forEach((edge) => {
      const fromEl = document.getElementById(`enc-${edge.source_id}`);
      const toEl = document.getElementById(`enc-${edge.target_id}`);
      if (!fromEl || !toEl) return;

      const fRect = fromEl.getBoundingClientRect();
      const tRect = toEl.getBoundingClientRect();

      const x1 = fRect.right - mRect.left;
      const y1 = fRect.top + fRect.height / 2 - mRect.top;
      const x2 = tRect.left - mRect.left;
      const y2 = tRect.top + tRect.height / 2 - mRect.top;

      const dx = Math.max(30, Math.abs(x2 - x1) * 0.5);
      const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;

      let isTight = false;
      if (edge.label) {
        // Estimate rendered width of the full condition pill
        const estWidth = (edge.label.length * 7.2) + 28;
        const pillLeft = midX - estWidth / 2 - 4;
        const pillRight = midX + estWidth / 2 + 4;
        const pillTop = midY - 14;
        const pillBottom = midY + 14;

        const srcLeft = fRect.left - mRect.left;
        const srcRight = fRect.right - mRect.left;
        const srcTop = fRect.top - mRect.top;
        const srcBottom = fRect.bottom - mRect.top;

        const tgtLeft = tRect.left - mRect.left;
        const tgtRight = tRect.right - mRect.left;
        const tgtTop = tRect.top - mRect.top;
        const tgtBottom = tRect.bottom - mRect.top;

        // Detect collision with source or target cards
        const overlapsSource = (pillRight > srcLeft && pillLeft < srcRight && pillBottom > srcTop && pillTop < srcBottom);
        const overlapsTarget = (pillRight > tgtLeft && pillLeft < tgtRight && pillBottom > tgtTop && pillTop < tgtBottom);

        isTight = overlapsSource || overlapsTarget || (Math.abs(y1 - y2) < 40 && (x2 - x1) < estWidth + 16);
      }

      lines.push({
        edgeId: edge.id,
        d,
        label: edge.label,
        midX,
        midY,
        sourceId: edge.source_id,
        targetId: edge.target_id,
        isTight,
        tooltipBelow: midY < 50,
      });
    });

    setPrecedenceLines(lines);
  }, [encounterPrecedenceEdges]);

  const calculateMilestoneLines = useCallback(() => {
    if (!matrixContainerRef.current) return;
    const mRect = matrixContainerRef.current.getBoundingClientRect();
    const mLines: MilestoneLine[] = [];

    allMilestoneLinks.forEach((ms) => {
      const fromEl = document.getElementById(`enc-${ms.sourceEncounterId}`);
      const toEl = document.getElementById(`milestone-card-${ms.id}`);
      if (!fromEl || !toEl) return;

      const fRect = fromEl.getBoundingClientRect();
      const tRect = toEl.getBoundingClientRect();

      let x1: number, y1: number, x2: number, y2: number;
      let d: string;

      // Case 1: Encounter is below Milestone Card
      if (fRect.top > tRect.bottom - 10) {
        x1 = fRect.left + Math.min(36, fRect.width / 2) - mRect.left;
        y1 = fRect.top - mRect.top;
        x2 = tRect.left + 23 - mRect.left; // aligned with the purple circle badge
        y2 = tRect.bottom - mRect.top;
        const dy = Math.max(25, Math.abs(y1 - y2) * 0.45);
        d = `M ${x1} ${y1} C ${x1} ${y1 - dy}, ${x2} ${y2 + dy}, ${x2} ${y2}`;
      }
      // Case 2: Encounter is above Milestone Card
      else if (fRect.bottom < tRect.top + 10) {
        x1 = fRect.left + Math.min(36, fRect.width / 2) - mRect.left;
        y1 = fRect.bottom - mRect.top;
        x2 = tRect.left + 23 - mRect.left;
        y2 = tRect.top - mRect.top;
        const dy = Math.max(25, Math.abs(y2 - y1) * 0.45);
        d = `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;
      }
      // Case 3: Same horizontal band / row
      else {
        if (fRect.right < tRect.left) {
          x1 = fRect.right - mRect.left;
          y1 = fRect.top + fRect.height / 2 - mRect.top;
          x2 = tRect.left - mRect.left;
          y2 = tRect.top + tRect.height / 2 - mRect.top;
          const dx = Math.max(25, Math.abs(x2 - x1) * 0.5);
          d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
        } else {
          x1 = fRect.left - mRect.left;
          y1 = fRect.top + fRect.height / 2 - mRect.top;
          x2 = tRect.right - mRect.left;
          y2 = tRect.top + tRect.height / 2 - mRect.top;
          const dx = Math.max(25, Math.abs(x1 - x2) * 0.5);
          d = `M ${x1} ${y1} C ${x1 - dx} ${y1}, ${x2 + dx} ${y2}, ${x2} ${y2}`;
        }
      }

      mLines.push({
        id: ms.id,
        sourceEncounterId: ms.sourceEncounterId,
        targetQuestId: ms.targetQuestId,
        d,
        x1,
        y1,
        x2,
        y2
      });
    });

    setMilestoneLines(mLines);
  }, [allMilestoneLinks]);

  useEffect(() => {
    const runCalc = () => {
      calculatePrecedenceLines();
      calculateMilestoneLines();
    };
    const timeout = setTimeout(runCalc, 60);
    window.addEventListener('resize', runCalc);
    const container = matrixContainerRef.current;
    if (container) {
      container.addEventListener('scroll', runCalc, { passive: true, capture: true });
    }
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', runCalc);
      if (container) {
        container.removeEventListener('scroll', runCalc, { capture: true });
      }
    };
  }, [calculatePrecedenceLines, calculateMilestoneLines, collapsedSessionIds, collapsedQuestIds, collapsedSubQuestParents, encounters, allMilestoneLinks]);

  const orderedQuests = useMemo(() => {
    if (!localQuestOrder) return quests;
    const map = new Map(quests.map((q) => [q.id, q]));
    const result: NodeItem[] = [];
    localQuestOrder.forEach((id) => {
      const q = map.get(id);
      if (q) result.push(q);
    });
    quests.forEach((q) => {
      if (!result.some((r) => r.id === q.id)) result.push(q);
    });
    return result;
  }, [quests, localQuestOrder]);

  const displayQuests = useMemo(() => {
    // Separate root quests from sub-quests
    const subQuestIds = new Set(parentQuestMap.keys());
    const rootQuests: NodeItem[] = [];

    orderedQuests.forEach((q) => {
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
    rootQuests.forEach((rootQ) => {
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
    orderedQuests.forEach((q) => {
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

    const currentOrder = orderedQuests.map((q) => q.id);
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

  // Dynamic Session Column Widths:
  // Automatically scales each session column to comfortably fit its encounters without dead whitespace or internal horizontal scrolling!
  const sessionColWidths = useMemo(() => {
    const map = new Map<string, number>();

    displayColumns.forEach((col) => {
      if (collapsedSessionIds.has(col.id)) {
        map.set(col.id, SESSION_COL_COLLAPSED_WIDTH);
        return;
      }

      const isStaging = col.id === 'unscheduled-staging';
      let maxCardsInCol = 0;

      // Scan all quest rows to find the quest with the most horizontal cards in this session
      displayQuests.forEach((quest) => {
        const isOpenRow = quest.id === 'open-world-events';
        const matchingEncounters = encounters.filter((e) => {
          const eQuestId = encounterQuestMap.get(e.id);
          const isQuestMatch = isOpenRow ? !eQuestId : eQuestId === quest.id;
          const isSessionMatch = isStaging ? !encounterSessionMap.get(e.id) : encounterSessionMap.get(e.id) === col.id;
          return isQuestMatch && isSessionMatch;
        });

        const cellMilestones = (milestoneReceivers.get(quest.id) || []).filter((ms) => {
          const sourceSessId = encounterSessionMap.get(ms.sourceEncounterId);
          return isStaging ? !sourceSessId : sourceSessId === col.id;
        });

        const totalInCell = matchingEncounters.length + cellMilestones.length;
        if (totalInCell > maxCardsInCol) {
          maxCardsInCol = totalInCell;
        }
      });

      // Also check unassigned encounters in open row for staging column
      if (isStaging) {
        const unassignedCount = encounters.filter((e) => !encounterSessionMap.get(e.id)).length;
        maxCardsInCol = Math.max(maxCardsInCol, Math.min(3, unassignedCount));
      }

      // Base minimum width for a session column (allows header title + 'Plan' badge + '◀ Fold' to fit cleanly)
      const MIN_SESSION_WIDTH = 260;

      if (maxCardsInCol <= 0) {
        map.set(col.id, MIN_SESSION_WIDTH);
      } else {
        // 24px cell padding (12px * 2) + 16px buffer + (N * 185px card) + ((N - 1) * 14px gap)
        const computed = 40 + (maxCardsInCol * 185) + ((maxCardsInCol - 1) * 14);
        map.set(col.id, Math.max(MIN_SESSION_WIDTH, computed));
      }
    });

    return map;
  }, [displayColumns, collapsedSessionIds, displayQuests, encounters, encounterQuestMap, encounterSessionMap, milestoneReceivers]);

  const matrixGridCols = useMemo(() => {
    const cols = displayColumns.map((col) => `${sessionColWidths.get(col.id) || 260}px`);
    return `${LEFT_COL_WIDTH}px ${cols.join(' ')}`;
  }, [displayColumns, sessionColWidths]);

  // Pixel-perfect canvas dimensions for horizontal scrolling
  const canvasWidth = useMemo(() => {
    const sessionColsWidth = displayColumns.reduce((sum, col) => {
      const w = sessionColWidths.get(col.id) || 260;
      return sum + w + COL_GAP;
    }, 0);
    return LEFT_COL_WIDTH + sessionColsWidth + 40;
  }, [displayColumns, sessionColWidths]);

  const getColX = (index: number) => {
    let x = LEFT_COL_WIDTH;
    for (let i = 0; i < index; i++) {
      const w = sessionColWidths.get(displayColumns[i]?.id) || 260;
      x += w + COL_GAP;
    }
    const currentWidth = sessionColWidths.get(displayColumns[index]?.id) || 260;
    return x + currentWidth / 2;
  };

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

                  {/* 1. Branching Side Ribbons (Inspired by the Saga Anatomy reference) */}
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

                  {/* 2. Main Golden Cord Spine (weaving across all columns) */}
                  {activeRibbonRiff === 'woven' && (
                    <>
                      {/* Outer Golden Aura Glow */}
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
                      {/* Braided Golden Spine */}
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
                      {/* Braided highlight dash */}
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
                          onClick={() => setActiveEncounterModal(enc)}
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
            )}

            {/* ========================================================================= */}
            {/* 2. CAMPAIGN STORY ARCS ROW (ACT BANNERS SPANNING SESSIONS)               */}
            {/* ========================================================================= */}
            {arcLayouts.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: matrixGridCols,
                  gap: `${COL_GAP}px`,
                  alignItems: 'stretch',
                  whiteSpace: 'nowrap'
                }}
              >
                <div style={{ padding: '4px 10px', display: 'flex', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.8px' }}>
                    Storyline Threads ↓
                  </span>
                </div>

                {/* If intake staging column is present, render staging banner above it */}
                {displayColumns[0]?.id === 'unscheduled-staging' && (() => {
                  const isStagingFolded = collapsedSessionIds.has('unscheduled-staging');
                  return (
                    <div
                      style={{
                        gridColumn: 'span 1',
                        minWidth: 0,
                        overflow: 'hidden',
                        background: 'rgba(59, 130, 246, 0.08)',
                        border: '1px dashed rgba(59, 130, 246, 0.35)',
                        borderRadius: '8px',
                        padding: isStagingFolded ? '6px 2px' : '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isStagingFolded ? 'center' : 'space-between',
                        boxSizing: 'border-box'
                      }}
                      title="📥 Intake Pool (Unscheduled Scenes)"
                    >
                      {isStagingFolded ? (
                        <span style={{ fontSize: '0.85rem' }} title="Intake Pool (Unscheduled Scenes)">
                          📥
                        </span>
                      ) : (
                        <>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                            📥 Intake Pool
                          </span>
                          <span style={{ fontSize: '0.68rem', color: '#93c5fd', whiteSpace: 'nowrap' }}>
                            Unscheduled
                          </span>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* Render Arc Banners in a SINGLE horizontal non-wrapping row */}
                {arcLayouts.map((item, aIdx) => {
                  const isAllFolded = Boolean(item.sessionIds && item.sessionIds.length > 0 && item.sessionIds.every((id) => collapsedSessionIds.has(id)));

                  if (isAllFolded) {
                    return (
                      <div
                        key={item.arc.id}
                        onClick={() => setActiveArcModal(item.arc)}
                        style={{
                          gridColumn: `span ${item.colSpan}`,
                          minWidth: 0,
                          overflow: 'hidden',
                          background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.16) 0%, rgba(245, 158, 11, 0.05) 100%)',
                          border: '1px solid rgba(245, 158, 11, 0.4)',
                          borderRadius: '8px',
                          padding: '4px 2px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          alignItems: 'center',
                          boxSizing: 'border-box',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-gold)')}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.4)')}
                        title={`${item.arc.title} (${item.colSpan} session${item.colSpan > 1 ? 's' : ''} folded — Click to inspect arc)`}
                      >
                        <span style={{ fontSize: '0.66rem', fontWeight: 900, color: 'var(--color-gold)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          ACT {aIdx + 1}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item.arc.id}
                      onClick={() => setActiveArcModal(item.arc)}
                      style={{
                        gridColumn: `span ${item.colSpan}`,
                        minWidth: 0,
                        overflow: 'hidden',
                        background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.04) 100%)',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                        borderRadius: '8px',
                        padding: '8px 14px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px',
                        boxSizing: 'border-box',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-gold)')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.35)')}
                      title={item.arc.title}
                    >
                      <div style={{ minWidth: 0, overflow: 'hidden' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-gold)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Act {aIdx + 1}
                        </span>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                          {item.arc.title}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                        {item.colSpan} {item.colSpan === 1 ? 'Session' : 'Sessions'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ========================================================================= */}
            {/* 3. SESSIONS HEADER ROW (VERTICAL TIMELINE ANCHORS)                       */}
            {/* ========================================================================= */}
            {displayColumns.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: matrixGridCols,
                  gap: `${COL_GAP}px`,
                  alignItems: 'stretch'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {displayQuests.length} Story Lines
                    </span>
                    {displayQuests.length > 0 && (
                      <button
                        type="button"
                        onClick={collapsedQuestIds.size >= displayQuests.length ? handleExpandAll : handleCollapseAll}
                        className="btn btn-ghost"
                        style={{ fontSize: '0.68rem', padding: '2px 6px', gap: '4px', height: '22px', color: 'var(--text-muted)' }}
                        title={collapsedQuestIds.size >= displayQuests.length ? 'Expand All Story Lines' : 'Collapse All Story Lines'}
                      >
                        {collapsedQuestIds.size >= displayQuests.length ? (
                          <>
                            <ChevronsUpDown size={12} /> Expand All
                          </>
                        ) : (
                          <>
                            <ChevronsDownUp size={12} /> Collapse All
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  {sessions.length === 0 && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--color-gold)', background: 'rgba(245, 158, 11, 0.12)', padding: '2px 6px', borderRadius: '4px' }}>
                      Staging Mode
                    </span>
                  )}
                </div>

                {displayColumns.map((sess, idx) => {
                  const isHovered = hoveredSessionId === sess.id;
                  const isCurrent = sess.data_json?.status === 'in_progress';
                  const isStaging = sess.id === 'unscheduled-staging';
                  const isVirtual = sess.data_json?.is_virtual;
                  const isColCollapsed = collapsedSessionIds.has(sess.id);
                  const sessEncounters = encounters.filter((e) =>
                    isStaging ? !encounterSessionMap.get(e.id) : encounterSessionMap.get(e.id) === sess.id
                  );
                  const sessNum = sess.data_json?.session_number || idx + (displayColumns[0]?.id === 'unscheduled-staging' ? 0 : 1);

                  if (isColCollapsed) {
                    const cleanTitle = sess.title.replace(/^Session\s*\d+\s*:\s*/i, '');
                    return (
                      <div
                        key={sess.id}
                        onClick={() => toggleSessionCollapse(sess.id)}
                        className="tapestry-col-spine"
                        title={`${sess.title} (Click to unroll column)`}
                      >
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--color-gold)', fontFamily: 'var(--font-mono)' }}>
                          {isStaging ? 'INT' : `S0${sessNum}`}
                        </span>
                        <div
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: isCurrent ? 'var(--color-gold)' : sess.data_json?.status === 'completed' ? 'var(--color-emerald)' : 'var(--text-muted)'
                          }}
                        />
                        <div className="tapestry-spine-vtitle">{cleanTitle}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {sessEncounters.length}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--color-gold)', fontWeight: 800 }}>+</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={sess.id}
                      onClick={() => {
                        if (!isStaging && !isVirtual) setActiveSessionModal(sess);
                      }}
                      onMouseEnter={() => setHoveredSessionId(sess.id)}
                      onMouseLeave={() => setHoveredSessionId(null)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={async (e) => {
                        e.preventDefault();
                        const raw = e.dataTransfer.getData('text/plain');
                        if (!raw) return;
                        try {
                          const data = JSON.parse(raw);
                          if (data.type === 'encounter') {
                            const targetSessionId = isStaging ? null : sess.id;
                            const currentQuestId = encounterQuestMap.get(data.encounterId) || null;
                            await handleMoveEncounter(data.encounterId, targetSessionId, currentQuestId);
                          }
                        } catch (err) {
                          console.error(err);
                        } finally {
                          setDraggingEncounterId(null);
                          setDragOverCell(null);
                        }
                      }}
                      style={{
                        background: isStaging
                          ? 'rgba(59, 130, 246, 0.08)'
                          : isCurrent
                          ? 'rgba(245, 158, 11, 0.12)'
                          : isHovered
                          ? 'var(--bg-card-hover)'
                          : 'var(--bg-surface)',
                        border: `1.5px solid ${
                          isStaging
                            ? 'rgba(59, 130, 246, 0.4)'
                            : isCurrent
                            ? 'var(--color-gold)'
                            : isHovered
                            ? 'var(--border-medium)'
                            : 'var(--border-subtle)'
                        }`,
                        borderRadius: '8px',
                        padding: '8px 12px',
                        cursor: isStaging ? 'default' : 'pointer',
                        boxShadow: isCurrent ? '0 0 14px rgba(245, 158, 11, 0.25)' : 'none',
                        position: 'relative',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      {isStaging && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '-7px',
                            right: '8px',
                            background: '#3b82f6',
                            color: '#fff',
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            padding: '1px 5px',
                            borderRadius: '4px',
                            textTransform: 'uppercase'
                          }}
                        >
                          Intake
                        </div>
                      )}

                      {isCurrent && !isStaging && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '-7px',
                            right: '8px',
                            background: 'var(--color-gold)',
                            color: '#000',
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            padding: '1px 5px',
                            borderRadius: '4px',
                            textTransform: 'uppercase'
                          }}
                        >
                          Next Session
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: isStaging ? '#60a5fa' : isCurrent ? 'var(--color-gold)' : 'var(--text-primary)' }}>
                            {isStaging ? '📥 Prep Staging' : isVirtual ? `Virtual Session ${sess.data_json?.session_number || idx}` : `Session ${sessNum}`}
                          </span>
                          <span className={`status-pill status-${sess.data_json?.status === 'completed' ? 'completed' : isCurrent ? 'inprogress' : 'planned'}`} style={{ fontSize: '0.6rem', padding: '1px 5px' }}>
                            {sess.data_json?.status === 'completed' ? '✓ Done' : isCurrent ? '● Active' : 'Plan'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRunSheetSessionNode(sess);
                            }}
                            className="btn btn-ghost"
                            style={{ fontSize: '0.62rem', padding: '1px 5px', height: '20px', gap: '3px', color: 'var(--color-gold)' }}
                            title="Open Session Run-Sheet"
                          >
                            <BookOpen size={10} /> Run-Sheet
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSessionCollapse(sess.id);
                            }}
                            className="btn btn-ghost"
                            style={{ fontSize: '0.65rem', padding: '1px 6px', height: '20px', gap: '3px', color: 'var(--text-muted)' }}
                            title="Fold session column"
                          >
                            ◀ Fold
                          </button>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {sess.title}
                      </div>
                      {sess.subtitle && (
                        <div style={{ fontSize: '0.68rem', color: isStaging ? '#93c5fd' : 'var(--text-muted)' }}>{sess.subtitle}</div>
                      )}

                      {/* Quick Commit button for virtual sessions */}
                      {isVirtual && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickCreateSession(sess.data_json?.session_number, sess.title);
                          }}
                          className="btn btn-primary"
                          style={{ fontSize: '0.66rem', padding: '2px 6px', marginTop: '6px', width: '100%', gap: '4px' }}
                        >
                          <Plus size={11} /> Commit to Campaign
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ========================================================================= */}
            {/* 4. THE TAPESTRY MATRIX (QUEST ROWS × SESSION COLUMNS)                    */}
            {/* ========================================================================= */}
            <div
              ref={matrixContainerRef}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative' }}
            >
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
                  : encounters.filter((e) => encounterQuestMap.get(e.id) === quest.id).length;

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
                      const matchingEncounters = encounters.filter((e) => {
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
                                  {matchingEncounters.map((e) => (
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
                                {matchingEncounters.slice(0, 3).map((enc) => {
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
                            matchingEncounters.map((enc, encIdx) => {
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
                                  className="tapestry-encounter-card"
                                  style={{
                                    border: isLinkedToHoveredMilestone
                                      ? '2px solid #f3e8ff'
                                      : hasMilestoneEmit
                                      ? '1.5px solid var(--color-purple)'
                                      : encStatus === 'completed'
                                      ? '1.5px solid #10b981'
                                      : encStatus === 'in_progress'
                                      ? '1.5px solid var(--color-gold)'
                                      : '1.5px solid var(--border-medium)',
                                    opacity: draggingEncounterId === enc.id ? 0.35 : 1,
                                    boxShadow: isLinkedToHoveredMilestone
                                      ? '0 0 22px rgba(168, 85, 247, 0.85)'
                                      : hasMilestoneEmit
                                      ? '0 0 14px rgba(168, 85, 247, 0.3)'
                                      : hoveredEncounterId === enc.id
                                      ? `0 0 16px ${questColor}66`
                                      : encStatus === 'in_progress'
                                      ? '0 0 10px rgba(245, 158, 11, 0.25)'
                                      : 'var(--shadow-sm)'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 800, background: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-gold)', padding: '1px 5px', borderRadius: '4px' }}>
                                      #{orderNum}
                                    </span>
                                    <span style={{ fontSize: '0.58rem', padding: '1px 4px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 700, background: encType === 'combat' ? 'rgba(239, 68, 68, 0.15)' : encType === 'social' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: encType === 'combat' ? '#f87171' : encType === 'social' ? '#60a5fa' : '#34d399' }}>
                                      {encType}
                                    </span>
                                  </div>

                                  <div style={{ fontWeight: 700, fontSize: '0.78rem', marginTop: '2px', lineHeight: 1.2, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={enc.title}>
                                    {enc.title}
                                  </div>

                                  {hasMilestoneEmit && (
                                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#c084fc', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                      <span>✦ Milestone Emitter</span>
                                    </div>
                                  )}

                                  {/* Attached Entity Chips (Locations, Monsters, Loot, NPCs) */}
                                  {(attached.locations.length > 0 || attached.monsters.length > 0 || attached.items.length > 0 || attached.npcs.length > 0) && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
                                      {attached.locations.slice(0, 2).map((loc) => (
                                        <span key={loc.id} style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '3px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                          <MapPin size={9} /> {loc.title}
                                        </span>
                                      ))}
                                      {attached.monsters.slice(0, 2).map((m) => (
                                        <span key={m.id} style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '3px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                          <Skull size={9} /> {m.title}
                                        </span>
                                      ))}
                                      {attached.items.slice(0, 2).map((it) => (
                                        <span key={it.id} style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '3px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                          <Package size={9} /> {it.title}
                                        </span>
                                      ))}
                                      {attached.npcs.slice(0, 2).map((n) => (
                                        <span key={n.id} style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '3px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                          <Users size={9} /> {n.title}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {(isStagingCol || isOpenRow) && (
                                    <div
                                      style={{
                                        display: 'flex',
                                        gap: '4px',
                                        marginTop: '6px',
                                        paddingTop: '6px',
                                        borderTop: '1px dashed var(--border-subtle)'
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {isStagingCol && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const targetSess = sessions[0] || displayColumns.find((c) => c.id !== 'unscheduled-staging');
                                            if (targetSess) handleAssignEncounterToSession(enc.id, targetSess.id);
                                          }}
                                          className="btn btn-secondary"
                                          style={{ fontSize: '0.64rem', padding: '2px 6px', gap: '3px', flex: 1 }}
                                          title="Stage to next session"
                                        >
                                          <ArrowRight size={10} /> To Session 1
                                        </button>
                                      )}

                                      {isOpenRow && quests.length > 0 && (
                                        <select
                                          onChange={(e) => {
                                            if (e.target.value) handleAssignEncounterToQuest(enc.id, e.target.value);
                                          }}
                                          defaultValue=""
                                          style={{
                                            fontSize: '0.64rem',
                                            padding: '2px 4px',
                                            background: 'var(--bg-surface)',
                                            color: 'var(--text-secondary)',
                                            border: '1px solid var(--border-subtle)',
                                            borderRadius: '4px',
                                            maxWidth: '110px'
                                          }}
                                        >
                                          <option value="" disabled>Link Quest...</option>
                                          {quests.map((q) => (
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
