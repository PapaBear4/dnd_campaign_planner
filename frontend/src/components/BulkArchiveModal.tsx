import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Archive,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  FolderArchive,
  RotateCcw,
  Square,
  X,
} from 'lucide-react';
import { bulkUpdateNodeStatus } from '../api';
import { EdgeItem, NodeItem } from '../types';

interface BulkArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: NodeItem[];
  edges: EdgeItem[];
  campaignId: string;
  onRefresh: () => void;
}

export const BulkArchiveModal: React.FC<BulkArchiveModalProps> = ({
  isOpen,
  onClose,
  nodes,
  edges,
  campaignId,
  onRefresh,
}) => {
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [includeDescendants, setIncludeDescendants] = useState(true);
  const [collapsedFactions, setCollapsedFactions] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState('');

  // Child nodes map for cascading
  const childMap = useMemo(() => {
    const map = new Map<string, string[]>();
    edges.forEach((e) => {
      if (e.relation_type === 'contains' || e.relation_type === 'parent_of') {
        const list = map.get(e.source_id) || [];
        list.push(e.target_id);
        map.set(e.source_id, list);
      }
    });
    return map;
  }, [edges]);

  // Recursively collect all descendants
  const getDescendantIds = (nodeId: string): string[] => {
    const collected: string[] = [];
    const stack = [nodeId];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      const children = childMap.get(cur) || [];
      for (const cid of children) {
        if (!collected.includes(cid)) {
          collected.push(cid);
          stack.push(cid);
        }
      }
    }
    return collected;
  };

  // Group quests by faction or source
  const factionGroups = useMemo(() => {
    const questNodes = nodes.filter((n) => n.type === 'quest');
    const groups = new Map<string, NodeItem[]>();

    questNodes.forEach((q) => {
      let faction = q.data_json?.faction;
      if (!faction) {
        // Infer from title if possible
        if (q.title.toLowerCase().includes('harper')) faction = 'The Harpers';
        else if (q.title.toLowerCase().includes('zhentarim')) faction = 'The Zhentarim';
        else if (q.title.toLowerCase().includes("bregan d'aerthe") || q.title.toLowerCase().includes('bregan')) faction = "Bregan D'aerthe";
        else if (q.title.toLowerCase().includes('emerald enclave')) faction = 'The Emerald Enclave';
        else if (q.title.toLowerCase().includes('force grey') || q.title.toLowerCase().includes('gray hand')) faction = 'Force Grey';
        else if (q.title.toLowerCase().includes('order of the gauntlet')) faction = 'Order of the Gauntlet';
        else if (q.title.toLowerCase().includes("lords' alliance") || q.title.toLowerCase().includes('lords alliance')) faction = "The Lords' Alliance";
        else faction = 'Other Quests & Objectives';
      }
      const list = groups.get(faction) || [];
      list.push(q);
      groups.set(faction, list);
    });

    // Sort groups so known factions appear first
    return Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === 'Other Quests & Objectives') return 1;
      if (b[0] === 'Other Quests & Objectives') return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [nodes]);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    setSelectedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleFactionGroup = (faction: string, groupNodes: NodeItem[]) => {
    const groupIds = groupNodes.map((n) => n.id);
    const allSelected = groupIds.every((id) => selectedNodeIds.has(id));
    setSelectedNodeIds((prev) => {
      const next = new Set(prev);
      groupIds.forEach((id) => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  const toggleCollapseFaction = (faction: string) => {
    setCollapsedFactions((prev) => {
      const next = new Set(prev);
      if (next.has(faction)) next.delete(faction);
      else next.add(faction);
      return next;
    });
  };

  const handleSelectAllUnselected = () => {
    // Select all faction quests that are NOT currently 'active' or 'in_progress'
    const toSelect = new Set<string>();
    factionGroups.forEach(([faction, qList]) => {
      if (faction !== 'Other Quests & Objectives') {
        qList.forEach((q) => {
          const st = q.data_json?.status;
          if (st !== 'active' && st !== 'in_progress') {
            toSelect.add(q.id);
          }
        });
      }
    });
    setSelectedNodeIds(toSelect);
  };

  const handleClearSelection = () => {
    setSelectedNodeIds(new Set());
  };

  const handleExecuteStatusUpdate = async (newStatus: 'archived' | 'active' | 'planned') => {
    if (selectedNodeIds.size === 0) return;
    try {
      setIsProcessing(true);
      const allTargetIds = new Set<string>(selectedNodeIds);
      if (includeDescendants) {
        selectedNodeIds.forEach((id) => {
          const desc = getDescendantIds(id);
          desc.forEach((d) => allTargetIds.add(d));
        });
      }

      const idList = Array.from(allTargetIds);
      await bulkUpdateNodeStatus(idList, newStatus);
      await onRefresh();
      setSelectedNodeIds(new Set());
      onClose();
    } catch (err) {
      console.error('Failed to execute bulk status update:', err);
      alert('Failed to update statuses: ' + err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 8, 16, 0.82)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1300,
        padding: '24px',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '90vw',
          maxWidth: '860px',
          maxHeight: '85vh',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(139, 92, 246, 0.15)',
                border: '1px solid rgba(139, 92, 246, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#a78bfa',
              }}
            >
              <FolderArchive size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Bulk Archive Utility
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Clean up workspace clutter by archiving unused adventure sourcebook questlines into the Compendium Vault.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Toolbar & Filter */}
        <div
          style={{
            padding: '12px 20px',
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleSelectAllUnselected}
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '5px 10px' }}
              title="Select all faction missions that are not currently Active"
            >
              Select Unused Faction Quests
            </button>
            {selectedNodeIds.size > 0 && (
              <button
                onClick={handleClearSelection}
                className="btn btn-ghost"
                style={{ fontSize: '0.78rem', padding: '5px 10px' }}
              >
                Clear Selection ({selectedNodeIds.size})
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeDescendants}
                onChange={(e) => setIncludeDescendants(e.target.checked)}
                style={{ accentColor: '#a78bfa', cursor: 'pointer' }}
              />
              Include Contained Sub-Quests &amp; Encounters
            </label>
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter by title..."
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '0.8rem',
                color: 'var(--text-primary)',
                width: '180px',
              }}
            />
          </div>
        </div>

        {/* List Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {factionGroups.map(([faction, groupNodes]) => {
            const filteredNodes = groupNodes.filter(
              (n) => !filterText.trim() || n.title.toLowerCase().includes(filterText.toLowerCase())
            );
            if (filteredNodes.length === 0) return null;

            const isCollapsed = collapsedFactions.has(faction);
            const groupIds = filteredNodes.map((n) => n.id);
            const allSelected = groupIds.every((id) => selectedNodeIds.has(id));
            const someSelected = groupIds.some((id) => selectedNodeIds.has(id));
            const archivedCount = filteredNodes.filter((n) => n.data_json?.status === 'archived').length;

            return (
              <div
                key={faction}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  overflow: 'hidden',
                }}
              >
                {/* Faction Header */}
                <div
                  style={{
                    padding: '10px 14px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderBottom: isCollapsed ? 'none' : '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                  onClick={() => toggleCollapseFaction(faction)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFactionGroup(faction, filteredNodes);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: allSelected ? '#a78bfa' : someSelected ? '#c4b5fd' : 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                      }}
                    >
                      {allSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                    <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                      {faction}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      ({filteredNodes.length} quest{filteredNodes.length === 1 ? '' : 's'}
                      {archivedCount > 0 && ` • ${archivedCount} archived 📦`})
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {/* Quests in Faction */}
                {!isCollapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {filteredNodes.map((q) => {
                      const isChecked = selectedNodeIds.has(q.id);
                      const qStatus = q.data_json?.status || 'planned';
                      const isArchived = qStatus === 'archived';
                      const descCount = (childMap.get(q.id) || []).length;

                      return (
                        <div
                          key={q.id}
                          onClick={() => toggleSelect(q.id)}
                          style={{
                            padding: '8px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                            cursor: 'pointer',
                            background: isChecked ? 'rgba(139, 92, 246, 0.08)' : isArchived ? 'rgba(0, 0, 0, 0.15)' : 'transparent',
                            opacity: isArchived ? 0.65 : 1,
                            transition: 'all 0.1s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                            <span style={{ color: isChecked ? '#a78bfa' : 'var(--text-muted)', display: 'flex' }}>
                              {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                            </span>
                            <div>
                              <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {q.title}
                              </span>
                              {descCount > 0 && (
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                                  ({descCount} nested items)
                                </span>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isArchived ? (
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  background: 'rgba(139, 92, 246, 0.2)',
                                  color: '#c4b5fd',
                                  border: '1px solid rgba(139, 92, 246, 0.4)',
                                  fontWeight: 600,
                                }}
                              >
                                Archived 📦
                              </span>
                            ) : (
                              <span
                                className={`status-pill status-${qStatus === 'in_progress' ? 'inprogress' : qStatus}`}
                                style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                              >
                                {qStatus === 'in_progress' || qStatus === 'active' ? '● Active' : qStatus.toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 20px',
            background: 'var(--bg-surface)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <strong>{selectedNodeIds.size}</strong> item{selectedNodeIds.size === 1 ? '' : 's'} selected
            {includeDescendants && selectedNodeIds.size > 0 && ' (plus contained child items)'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              disabled={selectedNodeIds.size === 0 || isProcessing}
              onClick={() => handleExecuteStatusUpdate('active')}
              className="btn btn-secondary"
              style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RotateCcw size={14} /> Restore to Active
            </button>
            <button
              disabled={selectedNodeIds.size === 0 || isProcessing}
              onClick={() => handleExecuteStatusUpdate('archived')}
              className="btn btn-primary"
              style={{
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#8b5cf6',
                borderColor: '#7c3aed',
              }}
            >
              <Archive size={14} /> Archive Selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
