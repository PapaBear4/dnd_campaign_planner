import { useMemo } from 'react';
import { NodeItem } from '../../../types';

export const LEFT_COL_WIDTH = 280;
export const SESSION_COL_EXPANDED_WIDTH = 680;
export const SESSION_COL_COLLAPSED_WIDTH = 48;
export const COL_GAP = 12;

interface UseTapestryDimensionsProps {
  campaignId: string;
  arcs: NodeItem[];
  sessions: NodeItem[];
  encounters: NodeItem[];
  sessionArcMap: Map<string, string>;
  encounterSessionMap: Map<string, string>;
  encounterQuestMap: Map<string, string>;
  collapsedSessionIds: Set<string>;
  displayQuests: Array<NodeItem & { isSubQuest?: boolean }>;
  milestoneReceivers: Map<string, any[]>;
}

export function useTapestryDimensions({
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
}: UseTapestryDimensionsProps) {
  // Display columns & arc layouts
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
          // Provide at least 1 staging session pillar for this Arc
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

  // Dynamic Session Column Widths:
  const sessionColWidths = useMemo(() => {
    const map = new Map<string, number>();

    displayColumns.forEach((col) => {
      if (collapsedSessionIds.has(col.id)) {
        map.set(col.id, SESSION_COL_COLLAPSED_WIDTH);
        return;
      }

      const isStaging = col.id === 'unscheduled-staging';
      let maxCardsInCol = 0;

      displayQuests.forEach((quest) => {
        const isOpenRow = quest.id === 'open-world-events';
        const matchingEncounters = encounters.filter((e) => {
          const eQuestId = encounterQuestMap.get(e.id);
          const isQuestMatch = isOpenRow ? !eQuestId : eQuestId === quest.id;
          const isSessionMatch = isStaging ? !encounterSessionMap.get(e.id) : encounterSessionMap.get(e.id) === col.id;
          return isQuestMatch && isSessionMatch;
        });

        const cellMilestones = (milestoneReceivers.get(`${quest.id}-${col.id}`) || milestoneReceivers.get(quest.id) || []).filter((ms) => {
          const sourceSessId = encounterSessionMap.get(ms.sourceEncounterId) || ms.sessionId;
          return isStaging ? !sourceSessId : sourceSessId === col.id;
        });

        const totalInCell = matchingEncounters.length + cellMilestones.length;
        if (totalInCell > maxCardsInCol) {
          maxCardsInCol = totalInCell;
        }
      });

      if (isStaging) {
        const unassignedCount = encounters.filter((e) => !encounterSessionMap.get(e.id)).length;
        maxCardsInCol = Math.max(maxCardsInCol, Math.min(3, unassignedCount));
      }

      const MIN_SESSION_WIDTH = 260;

      if (maxCardsInCol <= 0) {
        map.set(col.id, MIN_SESSION_WIDTH);
      } else {
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

  return {
    displayColumns,
    arcLayouts,
    sessionColWidths,
    matrixGridCols,
    canvasWidth,
    getColX
  };
}
