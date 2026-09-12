import React, { useState, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  Calendar,
  Sparkles,
  Swords,
  MapPin,
  Package,
  Shield,
  ShieldCheck,
  Target,
  ChevronRight,
  ChevronDown,
  Plus,
  GitBranch,
  Layers,
  CheckCircle,
  Circle,
  Clock,
  Info,
  Users,
  Eye,
  EyeOff,
  ArrowRight,
  Maximize2,
  X,
  MessageSquare,
  HelpCircle,
  Flame,
  Award,
  BookOpen,
  Compass,
  Star,
  Workflow,
  ChevronsDownUp,
  ChevronsUpDown,
  Mic,
  Feather,
  Trash2,
  GripVertical
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
import { GraphData, NodeItem, EdgeItem, NodeType } from '../types';
import { MarkdownView } from './MarkdownView';

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
  // Top Minimal Ribbon style & collapse state
  const [activeRibbonRiff, setActiveRibbonRiff] = useState<'woven' | 'constellation' | 'transit'>('woven');
  const [isRibbonCollapsed, setIsRibbonCollapsed] = useState<boolean>(false);

  // Modals state
  const [activeEncounterNode, setActiveEncounterNode] = useState<NodeItem | null>(null);
  const [activeQuestNode, setActiveQuestNode] = useState<NodeItem | null>(null);
  const [activeSessionNode, setActiveSessionNode] = useState<NodeItem | null>(null);
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

  // 1. Filter Nodes by Type
  const { arcs, sessions, quests, encounters, nodeMap } = useMemo(() => {
    const map = new Map<string, NodeItem>();
    graphData.nodes.forEach((n) => map.set(n.id, n));

    const naturalNum = (title: string) => {
      const match = title.match(/(?:session|arc|act|quest|part|chapter)\s*(\d+)/i) || title.match(/\b(\d+)\b/);
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
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

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
          (e.source_id === encounterId && nodeMap.get(e.target_id)?.type === 'quest') ||
          (e.target_id === encounterId && nodeMap.get(e.source_id)?.type === 'quest')
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
  const SESSION_COL_WIDTH = 240;
  const COL_GAP = 12;

  const { displayColumns, arcLayouts } = useMemo(() => {
    const unassignedSessions = encounters.filter((e) => !encounterSessionMap.get(e.id));
    const cols: NodeItem[] = [];
    const layouts: { arc: NodeItem; colSpan: number }[] = [];

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
          layouts.push({ arc, colSpan: linkedSessions.length });
        } else {
          // Provide at least 1 staging session pillar for this Arc so each Arc has its own horizontal space!
          const sessNum = aIdx + 1;
          const cleanArcTitle = arc.title.replace(/^(?:arc|act)\s*\d+:\s*/i, '');
          cols.push({
            id: `virtual-session-${sessNum}`,
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
          layouts.push({ arc, colSpan: 1 });
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
    const list = [...orderedQuests];
    // If there are encounters without an assigned quest, add an Open Encounters lane
    if (unassignedQuestEncounters.length > 0) {
      const openRow: NodeItem = {
        id: 'open-world-events',
        campaign_id: campaignId,
        type: 'quest',
        title: 'Open Encounters & World Events',
        summary: `${unassignedQuestEncounters.length} scenes not yet attached to a specific quest line`,
        data_json: { category: 'World Events', status: 'in_progress', is_open_lane: true },
        sort_order: -1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_canon: true,
        revealed_to_players: true,
      };
      return [openRow, ...list];
    }
    return list;
  }, [orderedQuests, unassignedQuestEncounters.length, campaignId]);

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

  // Pixel-perfect canvas dimensions for horizontal scrolling
  const canvasWidth = useMemo(() => {
    return LEFT_COL_WIDTH + displayColumns.length * (SESSION_COL_WIDTH + COL_GAP) + 40;
  }, [displayColumns.length]);

  const getColX = (index: number) => {
    return LEFT_COL_WIDTH + index * (SESSION_COL_WIDTH + COL_GAP) + SESSION_COL_WIDTH / 2;
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

      {/* Main Tapestry Canvas Area with True Horizontal Scroll */}
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
                  gridTemplateColumns: `${LEFT_COL_WIDTH}px repeat(${displayColumns.length}, ${SESSION_COL_WIDTH}px)`,
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
                {displayColumns[0]?.id === 'unscheduled-staging' && (
                  <div
                    style={{
                      gridColumn: 'span 1',
                      background: 'rgba(59, 130, 246, 0.08)',
                      border: '1px dashed rgba(59, 130, 246, 0.35)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase' }}>
                      📥 Intake Pool
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#93c5fd' }}>
                      Unscheduled
                    </span>
                  </div>
                )}

                {/* Render Arc Banners in a SINGLE horizontal non-wrapping row */}
                {arcLayouts.map((item, aIdx) => {
                  return (
                    <div
                      key={item.arc.id}
                      onClick={() => setActiveArcModal(item.arc)}
                      style={{
                        gridColumn: `span ${item.colSpan}`,
                        background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.04) 100%)',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-gold)')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.35)')}
                    >
                      <div>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-gold)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Act {aIdx + 1}
                        </span>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.arc.title}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: '8px', whiteSpace: 'nowrap' }}>
                        {item.colSpan} {item.colSpan === 1 ? 'Column' : 'Columns'}
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
                  gridTemplateColumns: `${LEFT_COL_WIDTH}px repeat(${displayColumns.length}, ${SESSION_COL_WIDTH}px)`,
                  gap: `${COL_GAP}px`,
                  alignItems: 'stretch'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {displayQuests.length} Story Lines
                  </span>
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
                        padding: '8px 10px',
                        cursor: isStaging ? 'default' : 'pointer',
                        boxShadow: isCurrent ? '0 0 14px rgba(245, 158, 11, 0.25)' : 'none',
                        position: 'relative',
                        transition: 'all 0.15s ease'
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
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: isStaging ? '#60a5fa' : isCurrent ? 'var(--color-gold)' : 'var(--text-primary)' }}>
                          {isStaging ? '📥 Prep Staging' : isVirtual ? `Virtual Session ${sess.data_json?.session_number || idx}` : `Session ${idx + (displayColumns[0]?.id === 'unscheduled-staging' ? 0 : 1)}`}
                        </span>
                        {sess.subtitle && (
                          <span style={{ fontSize: '0.68rem', color: isStaging ? '#93c5fd' : 'var(--text-muted)' }}>{sess.subtitle}</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {sess.title}
                      </div>

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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative' }}>
              {displayQuests.map((quest, qIdx) => {
                const isQuestHovered = hoveredQuestId === quest.id;
                const isOpenRow = quest.id === 'open-world-events';
                const questColor = isOpenRow ? '#10b981' : questColors[qIdx % questColors.length];

                return (
                  <div
                    key={quest.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `${LEFT_COL_WIDTH}px repeat(${displayColumns.length}, ${SESSION_COL_WIDTH}px)`,
                      gap: `${COL_GAP}px`,
                      alignItems: 'stretch',
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
                          height: '3px',
                          background: `linear-gradient(90deg, ${questColor}66 0%, ${questColor}22 100%)`,
                          transform: 'translateY(-50%)',
                          zIndex: 0,
                          pointerEvents: 'none'
                        }}
                      />
                    )}

                    {/* LEFT: Quest Header Card */}
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
                        background: isQuestHovered ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                        border: `1px solid ${isQuestHovered ? questColor : 'var(--border-subtle)'}`,
                        borderLeft: `5px solid ${questColor}`,
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
                            {!isOpenRow && (
                              <GripVertical size={13} style={{ color: 'var(--text-muted)', cursor: 'grab', flexShrink: 0 }} />
                            )}
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: questColor, letterSpacing: '0.5px' }}>
                              {quest.data_json?.category || (isOpenRow ? 'World Events' : 'Storyline')}
                            </span>
                          </div>
                          <span className={`status-pill status-${quest.data_json?.status === 'in_progress' ? 'inprogress' : 'planned'}`}>
                            {isOpenRow ? `${unassignedQuestEncounters.length} Scenes` : (quest.data_json?.status || 'Active')}
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
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', paddingTop: '6px', borderTop: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {isOpenRow ? unassignedQuestEncounters.length : encounters.filter((e) => encounterQuestMap.get(e.id) === quest.id).length} Encounters
                        </span>
                        {!isOpenRow && (
                          <span style={{ fontSize: '0.7rem', color: questColor, display: 'flex', alignItems: 'center', gap: '3px' }}>
                            Details <ChevronRight size={11} />
                          </span>
                        )}
                      </div>
                    </div>

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
                            flexDirection: 'column',
                            gap: '8px',
                            alignItems: 'stretch',
                            justifyContent: 'center',
                            background: isCellDragOver
                              ? 'rgba(245, 158, 11, 0.12)'
                              : isCellHighlighted
                              ? 'rgba(255, 255, 255, 0.02)'
                              : 'transparent',
                            borderRadius: '8px',
                            minHeight: '110px',
                            border: isCellDragOver
                              ? '2px dashed var(--color-gold)'
                              : isSessionHovered
                              ? '1px dashed var(--border-subtle)'
                              : '1px solid transparent',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {matchingEncounters.length > 0 ? (
                            matchingEncounters.map((enc) => {
                              const encStatus = enc.data_json?.status || 'planned';
                              const attached = encounterEntitiesMap.get(enc.id) || { locations: [], monsters: [], items: [], npcs: [] };

                              return (
                                <div
                                  key={enc.id}
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
                                  style={{
                                    background: encStatus === 'completed'
                                      ? 'rgba(16, 185, 129, 0.1)'
                                      : encStatus === 'in_progress'
                                      ? 'rgba(245, 158, 11, 0.16)'
                                      : isStagingCol
                                      ? 'rgba(59, 130, 246, 0.08)'
                                      : 'var(--bg-surface)',
                                    border: `1.5px solid ${
                                      encStatus === 'completed'
                                        ? '#10b981'
                                        : encStatus === 'in_progress'
                                        ? 'var(--color-gold)'
                                        : isStagingCol
                                        ? 'rgba(59, 130, 246, 0.35)'
                                        : 'var(--border-medium)'
                                    }`,
                                    borderRadius: '10px',
                                    padding: '10px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    cursor: 'grab',
                                    opacity: draggingEncounterId === enc.id ? 0.35 : 1,
                                    boxShadow: hoveredEncounterId === enc.id
                                      ? `0 0 16px ${questColor}66`
                                      : encStatus === 'in_progress'
                                      ? '0 0 10px rgba(245, 158, 11, 0.25)'
                                      : 'none',
                                    transform: hoveredEncounterId === enc.id ? 'translateY(-2px)' : 'none',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: questColor, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <GripVertical size={11} style={{ color: 'var(--text-muted)', cursor: 'grab', flexShrink: 0 }} />
                                        <Swords size={11} /> Scene
                                      </span>
                                      <span
                                        className={`status-pill ${
                                          encStatus === 'completed'
                                            ? 'status-completed'
                                            : encStatus === 'in_progress'
                                            ? 'status-inprogress'
                                            : 'status-planned'
                                        }`}
                                        style={{ fontSize: '0.62rem', padding: '1px 5px' }}
                                      >
                                        {encStatus === 'completed' ? '✓ Done' : encStatus === 'in_progress' ? 'Active' : 'Plan'}
                                      </span>
                                    </div>

                                    <div style={{ fontWeight: 700, fontSize: '0.78rem', marginTop: '3px', lineHeight: 1.2, color: 'var(--text-primary)' }}>
                                      {enc.title}
                                    </div>

                                    {enc.summary && (
                                      <p style={{ margin: '3px 0 0', fontSize: '0.7rem', color: 'var(--text-secondary)', lineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {enc.summary}
                                      </p>
                                    )}
                                  </div>

                                  {/* Attached Entity Chips (Locations, Monsters, Loot, NPCs) */}
                                  {(attached.locations.length > 0 || attached.monsters.length > 0 || attached.items.length > 0 || attached.npcs.length > 0) && (
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px', paddingTop: '4px', borderTop: '1px solid var(--border-subtle)' }}>
                                      {attached.locations.map((loc) => (
                                        <span key={loc.id} style={{ fontSize: '0.64rem', color: '#34d399', background: 'rgba(16, 185, 129, 0.1)', padding: '1px 4px', borderRadius: '3px' }}>
                                          📍 {loc.title.split(' ')[0]}
                                        </span>
                                      ))}
                                      {attached.monsters.length > 0 && (
                                        <span key="monsters" style={{ fontSize: '0.64rem', color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', padding: '1px 4px', borderRadius: '3px' }}>
                                          👹 {attached.monsters.length}
                                        </span>
                                      )}
                                      {attached.items.length > 0 && (
                                        <span key="items" style={{ fontSize: '0.64rem', color: '#c084fc', background: 'rgba(168, 85, 247, 0.1)', padding: '1px 4px', borderRadius: '3px' }}>
                                          🎁 {attached.items.length}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {/* Fast Weave Controls (if unassigned session or unassigned quest) */}
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

      {/* ========================================================================= */}
      {/* 5. MODAL SUITE                                                           */}
      {/* ========================================================================= */}

      {/* A. ENCOUNTER MODAL */}
      {activeEncounterNode && (
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
          onClick={() => setActiveEncounterNode(null)}
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
                    onClick={(e) => handleToggleReveal(e, activeEncounterNode)}
                    className="btn btn-ghost"
                    style={{ padding: '4px', color: activeEncounterNode.revealed_to_players ? 'var(--color-emerald)' : 'var(--text-muted)' }}
                    title={activeEncounterNode.revealed_to_players ? 'Revealed to Players' : 'Hidden Secret'}
                  >
                    {activeEncounterNode.revealed_to_players ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button
                    onClick={(e) => handleToggleCanon(e, activeEncounterNode)}
                    className="btn btn-ghost"
                    style={{ padding: '4px', color: (activeEncounterNode.is_canon ?? true) ? 'var(--color-gold)' : 'var(--text-muted)' }}
                    title="Canon protection"
                  >
                    {(activeEncounterNode.is_canon ?? true) ? <ShieldCheck size={16} /> : <Feather size={16} />}
                  </button>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    {activeEncounterNode.title}
                  </h2>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => {
                    onSelectNode(activeEncounterNode);
                    setActiveEncounterNode(null);
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '6px 12px', gap: '5px' }}
                  title="Open full entity editor"
                >
                  <Maximize2 size={14} /> Full Edit
                </button>
                <button
                  onClick={() => {
                    onFocusCoDM(activeEncounterNode);
                    setActiveEncounterNode(null);
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '6px 12px', gap: '5px', color: 'var(--color-gold)', borderColor: 'rgba(245, 158, 11, 0.3)' }}
                  title="Brainstorm scene in Co-DM Studio"
                >
                  <Sparkles size={14} /> Brainstorm
                </button>
                <button
                  onClick={() => handleStatusChange(activeEncounterNode, activeEncounterNode.data_json?.status === 'completed' ? 'in_progress' : 'completed')}
                  className={`btn ${activeEncounterNode.data_json?.status === 'completed' ? 'btn-secondary' : 'btn-primary'}`}
                  style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                >
                  {activeEncounterNode.data_json?.status === 'completed' ? 'Mark In Progress' : '✓ Resolve Scene'}
                </button>
                <button
                  onClick={(e) => handleDeleteNode(e, activeEncounterNode.id)}
                  className="btn btn-ghost"
                  style={{ padding: '6px', color: 'var(--color-crimson)' }}
                  title="Delete encounter"
                >
                  <Trash2 size={16} />
                </button>
                <button onClick={() => setActiveEncounterNode(null)} className="btn btn-ghost" style={{ padding: '6px' }}>
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
                {activeEncounterNode.summary && (
                  <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-gold)', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
                      Scene Synopsis
                    </span>
                    <p style={{ fontSize: '0.86rem', color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
                      {activeEncounterNode.summary}
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
                        value={encounterQuestMap.get(activeEncounterNode.id) || ''}
                        onChange={(e) => handleAssignEncounterToQuest(activeEncounterNode.id, e.target.value || null)}
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
                        value={encounterSessionMap.get(activeEncounterNode.id) || ''}
                        onChange={(e) => handleAssignEncounterToSession(activeEncounterNode.id, e.target.value || null)}
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

                {/* Attached Entities (Monsters, Locations, Items, NPCs) */}
                {(() => {
                  const attached = encounterEntitiesMap.get(activeEncounterNode.id) || { locations: [], monsters: [], items: [], npcs: [] };
                  const hasAny = attached.locations.length > 0 || attached.monsters.length > 0 || attached.items.length > 0 || attached.npcs.length > 0;

                  return (
                    <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
                          Attached World Entities
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Click to inspect
                        </span>
                      </div>

                      {!hasAny ? (
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
                                    onClick={() => {
                                      onSelectNode(loc);
                                    }}
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
                                👹 Monsters & NPCs ({attached.monsters.length}):
                              </span>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                {attached.monsters.map((m) => (
                                  <div
                                    key={m.id}
                                    onClick={() => {
                                      onSelectNode(m);
                                    }}
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
                                🎁 Loot & Rewards ({attached.items.length}):
                              </span>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                {attached.items.map((it) => (
                                  <div
                                    key={it.id}
                                    onClick={() => {
                                      onSelectNode(it);
                                    }}
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
                  );
                })()}
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

                {activeEncounterNode.content_markdown ? (
                  <div style={{ background: 'rgba(0, 0, 0, 0.2)', borderRadius: '10px', padding: '20px', border: '1px solid var(--border-subtle)' }}>
                    <MarkdownView content={activeEncounterNode.content_markdown} />
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
                        onSelectNode(activeEncounterNode);
                        setActiveEncounterNode(null);
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
      )}

      {/* B. QUEST MODAL */}
      {activeQuestNode && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(4, 7, 13, 0.82)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '24px'
          }}
          onClick={() => setActiveQuestNode(null)}
        >
          <div
            className="glass-panel animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '580px',
              borderRadius: '16px',
              padding: '26px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--color-gold)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--color-gold)', textTransform: 'uppercase' }}>
                  Quest Line Dossier
                </span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '4px 0' }}>{activeQuestNode.title}</h2>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={(e) => handleDeleteNode(e, activeQuestNode.id)}
                  className="btn btn-ghost"
                  style={{ padding: '6px', color: 'var(--color-crimson)' }}
                  title="Delete quest"
                >
                  <Trash2 size={16} />
                </button>
                <button onClick={() => setActiveQuestNode(null)} className="btn btn-ghost" style={{ padding: '6px' }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {activeQuestNode.summary && (
              <p style={{ margin: '0 0 16px', fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                {activeQuestNode.summary}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => {
                  onSelectNode(activeQuestNode);
                  setActiveQuestNode(null);
                }}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem' }}
              >
                Open Full Codex Drawer
              </button>
              <button
                onClick={() => {
                  onFocusCoDM(activeQuestNode);
                  setActiveQuestNode(null);
                }}
                className="btn btn-primary"
                style={{ fontSize: '0.8rem' }}
              >
                <Sparkles size={14} /> Brainstorm in Co-DM
              </button>
            </div>
          </div>
        </div>
      )}

      {/* C. SESSION MODAL */}
      {activeSessionNode && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(4, 7, 13, 0.82)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '24px'
          }}
          onClick={() => setActiveSessionNode(null)}
        >
          <div
            className="glass-panel animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '540px',
              borderRadius: '16px',
              padding: '26px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--color-gold)', textTransform: 'uppercase' }}>
                  Game Session Dossier
                </span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '4px 0' }}>{activeSessionNode.title}</h2>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={(e) => handleDeleteNode(e, activeSessionNode.id)}
                  className="btn btn-ghost"
                  style={{ padding: '6px', color: 'var(--color-crimson)' }}
                  title="Delete session"
                >
                  <Trash2 size={16} />
                </button>
                <button onClick={() => setActiveSessionNode(null)} className="btn btn-ghost" style={{ padding: '6px' }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {activeSessionNode.summary && (
              <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.5 }}>{activeSessionNode.summary}</p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              {onNavigateToTranscript && (
                <button
                  onClick={() => {
                    onNavigateToTranscript(activeSessionNode.id);
                    setActiveSessionNode(null);
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', color: 'var(--color-arcane-blue-text)', borderColor: 'var(--color-arcane-blue-border)' }}
                >
                  <Mic size={14} /> Ingest Audio Transcript
                </button>
              )}
              <button
                onClick={() => {
                  onSelectNode(activeSessionNode);
                  setActiveSessionNode(null);
                }}
                className="btn btn-primary"
                style={{ fontSize: '0.8rem' }}
              >
                Inspect Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* D. ARC MODAL */}
      {activeArcNode && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(4, 7, 13, 0.82)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '24px'
          }}
          onClick={() => setActiveArcNode(null)}
        >
          <div
            className="glass-panel animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '540px',
              borderRadius: '16px',
              padding: '26px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--color-gold)', textTransform: 'uppercase' }}>
                  Campaign Arc Milestone
                </span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '4px 0' }}>{activeArcNode.title}</h2>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={(e) => handleDeleteNode(e, activeArcNode.id)}
                  className="btn btn-ghost"
                  style={{ padding: '6px', color: 'var(--color-crimson)' }}
                  title="Delete arc"
                >
                  <Trash2 size={16} />
                </button>
                <button onClick={() => setActiveArcNode(null)} className="btn btn-ghost" style={{ padding: '6px' }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {activeArcNode.summary && (
              <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--text-primary)' }}>
                {activeArcNode.summary}
              </p>
            )}
          </div>
        </div>
      )}

      {/* E. ENTITY MODAL (Inspection of attached Monster, Location, Item) */}
      {activeEntityNode && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(4, 7, 13, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: '24px'
          }}
          onClick={() => setActiveEntityNode(null)}
        >
          <div
            className="glass-panel animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '440px',
              borderRadius: '14px',
              padding: '24px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span className={`badge badge-${activeEntityNode.type}`}>{activeEntityNode.type.toUpperCase()}</span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Graph Edge Connection</span>
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 4px' }}>{activeEntityNode.title}</h3>
            {activeEntityNode.subtitle && (
              <p style={{ fontSize: '0.8rem', color: 'var(--color-gold)', margin: '0 0 14px' }}>
                {activeEntityNode.subtitle}
              </p>
            )}

            {activeEntityNode.summary && (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
                {activeEntityNode.summary}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => {
                  onSelectNode(activeEntityNode);
                  setActiveEntityNode(null);
                }}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem' }}
              >
                Inspect in Codex
              </button>
              <button onClick={() => setActiveEntityNode(null)} className="btn btn-primary" style={{ fontSize: '0.8rem' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* F. CREATE NODE MODAL */}
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
            padding: '20px'
          }}
          onClick={() => setShowAddModal(null)}
        >
          <div
            className="glass-panel animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '480px',
              borderRadius: '14px',
              padding: '24px',
              border: '1px solid var(--border-medium)',
              background: 'var(--bg-surface)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.2rem', marginBottom: '4px', textTransform: 'capitalize' }}>
              Add New {showAddModal}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              {showAddModal === 'arc' && 'An overarching milestone act framing several sessions.'}
              {showAddModal === 'quest' && 'A player narrative objective that runs across sessions.'}
              {showAddModal === 'session' && 'A real-world game night with prep notes.'}
              {showAddModal === 'encounter' && 'A specific dramatic beat or combat scene connecting a quest to a session.'}
            </p>

            <form onSubmit={handleCreateNewNode}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                  Title
                </label>
                <input
                  type="text"
                  required
                  placeholder={`Enter ${showAddModal} title...`}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                  Summary / Synopsis
                </label>
                <textarea
                  rows={3}
                  placeholder="Key objectives, DM hooks, or scene description..."
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowAddModal(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create {showAddModal}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
