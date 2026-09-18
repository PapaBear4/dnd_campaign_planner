import { useMemo } from 'react';
import { GraphData, NodeItem, EdgeItem } from '../../../types';

// Topological sorting helper for encounters
export function sortEncountersTopologically(
  encList: NodeItem[],
  edges: EdgeItem[]
): NodeItem[] {
  if (!encList || encList.length <= 1) return encList;

  const encIdSet = new Set(encList.map((e) => e.id));
  const naturalNum = (title: string) => {
    const match = title.match(/(?:session|arc|act|quest|part|chapter|encounter|beat)?\s*#?\s*(\d+)/i) || title.match(/\b(\d+)\b/);
    return match ? parseInt(match[1], 10) : 999;
  };

  const tieBreaker = (a: NodeItem, b: NodeItem) => {
    if ((a.sort_order || 0) !== (b.sort_order || 0)) {
      return (a.sort_order || 0) - (b.sort_order || 0);
    }
    const numA = naturalNum(a.title);
    const numB = naturalNum(b.title);
    if (numA !== numB) return numA - numB;
    return (a.title || '').localeCompare(b.title || '');
  };

  // Build adjacency list & in-degree for relevant precedence edges
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  encList.forEach((e) => {
    adj.set(e.id, []);
    inDegree.set(e.id, 0);
  });

  edges.forEach((edge) => {
    if (
      (edge.relation_type === 'precedes' || edge.relation_type === 'leads_to') &&
      encIdSet.has(edge.source_id) &&
      encIdSet.has(edge.target_id) &&
      edge.source_id !== edge.target_id
    ) {
      adj.get(edge.source_id)!.push(edge.target_id);
      inDegree.set(edge.target_id, (inDegree.get(edge.target_id) || 0) + 1);
    }
  });

  let available = encList.filter((e) => inDegree.get(e.id) === 0).sort(tieBreaker);
  const result: NodeItem[] = [];

  while (available.length > 0) {
    const current = available.shift()!;
    result.push(current);

    const neighbors = adj.get(current.id) || [];
    for (const neighborId of neighbors) {
      const currentIn = (inDegree.get(neighborId) || 1) - 1;
      inDegree.set(neighborId, currentIn);
      if (currentIn === 0) {
        const neighborNode = encList.find((e) => e.id === neighborId);
        if (neighborNode) {
          available.push(neighborNode);
          available.sort(tieBreaker);
        }
      }
    }
  }

  // Append any cycle / remaining nodes preserving tie-breaker
  if (result.length < encList.length) {
    const resultSet = new Set(result.map((r) => r.id));
    const remaining = encList.filter((e) => !resultSet.has(e.id)).sort(tieBreaker);
    result.push(...remaining);
  }

  return result;
}

export function useTapestryGraph(graphData: GraphData, showArchived: boolean = false) {
  // 1. Filter Nodes by Type
  const { arcs, sessions, quests, encounters, nodeMap } = useMemo(() => {
    const map = new Map<string, NodeItem>();
    graphData.nodes.forEach((n: NodeItem) => map.set(n.id, n));

    const naturalNum = (title: string) => {
      const match = title.match(/(?:session|arc|act|quest|part|chapter|encounter|beat)?\s*#?\s*(\d+)/i) || title.match(/\b(\d+)\b/);
      return match ? parseInt(match[1], 10) : 999;
    };

    const isArchived = (n: NodeItem) => n.data_json?.status === 'archived';

    const arcList = graphData.nodes
      .filter((n: NodeItem) => n.type === 'arc' && (showArchived || !isArchived(n)))
      .sort((a: NodeItem, b: NodeItem) => (a.sort_order || 0) - (b.sort_order || 0) || naturalNum(a.title) - naturalNum(b.title));

    const sessionList = graphData.nodes
      .filter((n: NodeItem) => n.type === 'session' && (showArchived || !isArchived(n)))
      .sort((a: NodeItem, b: NodeItem) => (a.sort_order || 0) - (b.sort_order || 0) || naturalNum(a.title) - naturalNum(b.title));

    const questList = graphData.nodes
      .filter((n: NodeItem) => n.type === 'quest' && (showArchived || !isArchived(n)))
      .sort((a: NodeItem, b: NodeItem) => (a.sort_order || 0) - (b.sort_order || 0));

    const filteredEncounters = graphData.nodes
      .filter((n: NodeItem) => n.type === 'encounter' && (showArchived || !isArchived(n)));

    // Topologically sort encounters globally based on precedence edges
    const encounterList = sortEncountersTopologically(filteredEncounters, graphData.edges);

    return {
      arcs: arcList,
      sessions: sessionList,
      quests: questList,
      encounters: encounterList,
      nodeMap: map
    };
  }, [graphData.nodes, graphData.edges, showArchived]);

  // 2. Build Edge Connections: Encounter -> Session, Encounter -> Quest, Encounter -> Entities
  const { encounterSessionMap, encounterQuestMap, encounterEntitiesMap } = useMemo(() => {
    const encToSession = new Map<string, string>();
    const encToQuest = new Map<string, string>();
    const encToEntities = new Map<string, { locations: NodeItem[]; monsters: NodeItem[]; items: NodeItem[]; npcs: NodeItem[] }>();

    // Seed empty entity lists
    encounters.forEach((e: NodeItem) => {
      encToEntities.set(e.id, { locations: [], monsters: [], items: [], npcs: [] });
      if (e.data_json?.session_id) encToSession.set(e.id, e.data_json.session_id);
      if (e.data_json?.quest_id) encToQuest.set(e.id, e.data_json.quest_id);
    });

    graphData.edges.forEach((edge: EdgeItem) => {
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
    graphData.edges.forEach((edge: EdgeItem) => {
      const source = nodeMap.get(edge.source_id);
      const target = nodeMap.get(edge.target_id);
      if (!source || !target) return;
      if (source.type === 'arc' && target.type === 'session') sToA.set(target.id, source.id);
      else if (source.type === 'session' && target.type === 'arc') sToA.set(source.id, target.id);
    });
    return sToA;
  }, [graphData.edges, nodeMap]);

  // Build Quest Hierarchy (Sub-Quests) & Branches (Prerequisites & Outgoing Forks)
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

    graphData.edges.forEach((edge: EdgeItem) => {
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
        } else if (edge.relation_type === 'precedes' || edge.relation_type === 'leads_to') {
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

  // Unassigned encounters
  const unassignedSessionEncounters = useMemo(() => {
    return encounters.filter((e: NodeItem) => !encounterSessionMap.get(e.id));
  }, [encounters, encounterSessionMap]);

  const unassignedQuestEncounters = useMemo(() => {
    return encounters.filter((e: NodeItem) => !encounterQuestMap.get(e.id));
  }, [encounters, encounterQuestMap]);

  // Precedence / sequence edges between encounters (Encounter -> leads_to/precedes -> Encounter)
  const encounterPrecedenceEdges = useMemo(() => {
    return graphData.edges.filter(
      (e: EdgeItem) =>
        (e.relation_type === 'precedes' || e.relation_type === 'leads_to') &&
        nodeMap.get(e.source_id)?.type === 'encounter' &&
        nodeMap.get(e.target_id)?.type === 'encounter'
    );
  }, [graphData.edges, nodeMap]);

  return {
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
    encounterPrecedenceEdges
  };
}
