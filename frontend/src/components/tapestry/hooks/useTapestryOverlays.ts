import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { GraphData, NodeItem, EdgeItem } from '../../../types';

export interface PrecedenceLine {
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

export interface MilestoneLine {
  id: string;
  sourceEncounterId: string;
  targetQuestId: string;
  d: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface MilestoneReceiverItem {
  id: string;
  sourceEncounterId: string;
  sourceEncounterTitle: string;
  targetQuestId: string;
  sessionId: string;
  label: string;
  summary?: string;
}

interface UseTapestryOverlaysProps {
  graphData: GraphData;
  nodeMap: Map<string, NodeItem>;
  encounterSessionMap: Map<string, string>;
  encounterPrecedenceEdges: any[];
  collapsedSessionIds: Set<string>;
  collapsedQuestIds: Set<string>;
  collapsedSubQuestParents: Set<string>;
  encounters: NodeItem[];
}

export function useTapestryOverlays({
  graphData,
  nodeMap,
  encounterSessionMap,
  encounterPrecedenceEdges,
  collapsedSessionIds,
  collapsedQuestIds,
  collapsedSubQuestParents,
  encounters,
}: UseTapestryOverlaysProps) {
  const matrixContainerRef = useRef<HTMLDivElement>(null);
  const [precedenceLines, setPrecedenceLines] = useState<PrecedenceLine[]>([]);
  const [milestoneLines, setMilestoneLines] = useState<MilestoneLine[]>([]);
  const [hoveredMilestoneId, setHoveredMilestoneId] = useState<string | null>(null);

  const { milestoneEmitters, milestoneReceivers, allMilestoneLinks } = useMemo(() => {
    const emitters = new Map<string, { targetQuestId: string; label: string; summary?: string }[]>();
    const receivers = new Map<string, MilestoneReceiverItem[]>();
    const links: MilestoneReceiverItem[] = [];

    const naturalNum = (title: string) => {
      const match = title.match(/(?:session|arc|act|quest|part|chapter|encounter|beat)?\s*#?\s*(\d+)/i) || title.match(/\b(\d+)\b/);
      return match ? parseInt(match[1], 10) : 999;
    };

    graphData.edges.forEach((edge: EdgeItem) => {
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

      if (fRect.top > tRect.bottom - 10) {
        x1 = fRect.left + Math.min(36, fRect.width / 2) - mRect.left;
        y1 = fRect.top - mRect.top;
        x2 = tRect.left + 23 - mRect.left;
        y2 = tRect.bottom - mRect.top;
        const dy = Math.max(25, Math.abs(y1 - y2) * 0.45);
        d = `M ${x1} ${y1} C ${x1} ${y1 - dy}, ${x2} ${y2 + dy}, ${x2} ${y2}`;
      } else if (fRect.bottom < tRect.top + 10) {
        x1 = fRect.left + Math.min(36, fRect.width / 2) - mRect.left;
        y1 = fRect.bottom - mRect.top;
        x2 = tRect.left + 23 - mRect.left;
        y2 = tRect.top - mRect.top;
        const dy = Math.max(25, Math.abs(y2 - y1) * 0.45);
        d = `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;
      } else {
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

  return {
    matrixContainerRef,
    precedenceLines,
    milestoneLines,
    hoveredMilestoneId,
    setHoveredMilestoneId,
    milestoneEmitters,
    milestoneReceivers,
    allMilestoneLinks
  };
}
