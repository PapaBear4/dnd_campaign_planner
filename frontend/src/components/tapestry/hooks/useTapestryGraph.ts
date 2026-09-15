import { useMemo } from 'react';
import { GraphData, NodeItem, EdgeItem } from '../../../types';

export function useTapestryGraph(graphData: GraphData) {
  // 1. Filter Nodes by Type
  const { arcs, sessions, quests, encounters, nodeMap } = useMemo(() => {
    const map = new Map<string, NodeItem>();
    graphData.nodes.forEach((n: NodeItem) => map.set(n.id, n));

    const naturalNum = (title: string) => {
      const match = title.match(/(?:session|arc|act|quest|part|chapter|encounter|beat)?\s*#?\s*(\d+)/i) || title.match(/\b(\d+)\b/);
      return match ? parseInt(match[1], 10) : 999;
    };

    const arcList = graphData.nodes
      .filter((n: NodeItem) => n.type === 'arc')
      .sort((a: NodeItem, b: NodeItem) => (a.sort_order || 0) - (b.sort_order || 0) || naturalNum(a.title) - naturalNum(b.title));

    const sessionList = graphData.nodes
      .filter((n: NodeItem) => n.type === 'session')
      .sort((a: NodeItem, b: NodeItem) => (a.sort_order || 0) - (b.sort_order || 0) || naturalNum(a.title) - naturalNum(b.title));

    const questList = graphData.nodes
      .filter((n: NodeItem) => n.type === 'quest')
      .sort((a: NodeItem, b: NodeItem) => (a.sort_order || 0) - (b.sort_order || 0));

    const encounterList = graphData.nodes
      .filter((n: NodeItem) => n.type === 'encounter')
      .sort((a: NodeItem, b: NodeItem) => (a.sort_order || 0) - (b.sort_order || 0) || naturalNum(a.title) - naturalNum(b.title));

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

  // Unassigned encounters
  const unassignedSessionEncounters = useMemo(() => {
    return encounters.filter((e: NodeItem) => !encounterSessionMap.get(e.id));
  }, [encounters, encounterSessionMap]);

  const unassignedQuestEncounters = useMemo(() => {
    return encounters.filter((e: NodeItem) => !encounterQuestMap.get(e.id));
  }, [encounters, encounterQuestMap]);

  // Precedence edges between encounters (Encounter -> precedes -> Encounter)
  const encounterPrecedenceEdges = useMemo(() => {
    return graphData.edges.filter(
      (e: EdgeItem) =>
        e.relation_type === 'precedes' &&
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
