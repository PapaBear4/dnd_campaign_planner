import React, { useState, useMemo } from 'react';
import {
  Compass,
  MapPin,
  Plus,
  ArrowUpRight,
  Sparkles,
  Shield,
  Layers,
  Eye,
  EyeOff,
  Flame,
  Volume2,
  Users,
  Swords,
  Box,
  Key,
} from 'lucide-react';
import { NodeItem, EdgeItem } from '../../types';
import { createSubLocation, createEdge, deleteEdge } from '../../api';

interface LocationModalProps {
  node: NodeItem;
  campaignId: string;
  dataJson: Record<string, any>;
  onChangeDataJson: (updated: Record<string, any>) => void;
  allNodes?: NodeItem[];
  edges?: EdgeItem[];
  onNavigateNode?: (targetNode: NodeItem) => void;
  onRefresh?: () => void;
  onFocusCoDM?: (node: NodeItem) => void;
}

const LOCATION_SCALES = [
  'World',
  'Continent',
  'Kingdom / Realm',
  'Region / Province',
  'Settlement / City',
  'District / Ward',
  'Dungeon / Stronghold',
  'Dungeon Level / Floor',
  'Keyed Room / Area',
  'Wilderness Landmark',
  'Planar Realm',
];

export const LocationModal: React.FC<LocationModalProps> = ({
  node,
  campaignId,
  dataJson,
  onChangeDataJson,
  allNodes = [],
  edges = [],
  onNavigateNode,
  onRefresh,
  onFocusCoDM,
}) => {
  const [showAddSubModal, setShowAddSubModal] = useState(false);
  const [subTitle, setSubTitle] = useState('');
  const [subSummary, setSubSummary] = useState('');
  const [isSubmittingSub, setIsSubmittingSub] = useState(false);

  // Find parent location
  const parentEdge = useMemo(() => {
    return edges.find(
      (e) =>
        (e.relation_type === 'contains' || e.relation_type === 'parent_of') &&
        e.target_id === node.id
    ) || edges.find((e) => e.relation_type === 'located_at' && e.source_id === node.id);
  }, [edges, node.id]);

  const parentNode = useMemo(() => {
    if (!parentEdge) return null;
    const parentId =
      parentEdge.relation_type === 'located_at'
        ? parentEdge.target_id
        : parentEdge.source_id;
    return allNodes.find((n) => n.id === parentId && n.type === 'location') || null;
  }, [parentEdge, allNodes]);

  // Find child sub-locations (rooms, sub-areas)
  const childLocations = useMemo(() => {
    const childIds = new Set<string>();
    for (const e of edges) {
      if (
        (e.relation_type === 'contains' || e.relation_type === 'parent_of') &&
        e.source_id === node.id
      ) {
        childIds.add(e.target_id);
      } else if (e.relation_type === 'located_at' && e.target_id === node.id) {
        childIds.add(e.source_id);
      }
    }
    return allNodes
      .filter((n) => n.type === 'location' && childIds.has(n.id))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.title.localeCompare(b.title));
  }, [edges, node.id, allNodes]);

  // Find other entities located here (NPCs, monsters, items)
  const containedEntities = useMemo(() => {
    const ids = new Set<string>();
    for (const e of edges) {
      if (
        (e.relation_type === 'contains' || e.relation_type === 'located_at') &&
        (e.source_id === node.id || e.target_id === node.id)
      ) {
        const otherId = e.source_id === node.id ? e.target_id : e.source_id;
        if (otherId !== node.id) ids.add(otherId);
      }
    }
    return allNodes.filter((n) => n.type !== 'location' && ids.has(n.id));
  }, [edges, node.id, allNodes]);

  const candidateParents = useMemo(() => {
    return allNodes.filter((n) => n.type === 'location' && n.id !== node.id);
  }, [allNodes, node.id]);

  const handleSelectParent = async (parentId: string) => {
    try {
      // Remove existing parent edges if any
      if (parentEdge) {
        await deleteEdge(parentEdge.id);
      }
      if (parentId) {
        await createEdge({
          campaign_id: campaignId,
          source_id: parentId,
          target_id: node.id,
          relation_type: 'contains',
          label: 'Contains',
          revealed_to_players: node.revealed_to_players,
        });
      }
      onRefresh?.();
    } catch (err) {
      console.error('Failed to update parent location:', err);
    }
  };

  const handleCreateSubLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subTitle.trim()) return;
    setIsSubmittingSub(true);
    try {
      await createSubLocation(campaignId, node.id, subTitle.trim(), subSummary.trim());
      setSubTitle('');
      setSubSummary('');
      setShowAddSubModal(false);
      onRefresh?.();
    } catch (err) {
      alert('Failed to create sub-location: ' + err);
    } finally {
      setIsSubmittingSub(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Location Taxonomy Scale & Environment */}
      <div
        style={{
          padding: '14px',
          borderRadius: '10px',
          background: 'rgba(16, 185, 129, 0.05)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
              fontSize: '0.82rem',
              fontWeight: 700,
              color: 'var(--color-emerald)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Compass size={16} /> Location Classification &amp; Scale
          </span>
          {dataJson.scale && (
            <span
              style={{
                fontSize: '0.72rem',
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--color-emerald)',
                fontWeight: 700,
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              {dataJson.scale}
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Scale / Topology
            </label>
            <select
              value={dataJson.scale || 'Dungeon / Stronghold'}
              onChange={(e) => onChangeDataJson({ ...dataJson, scale: e.target.value })}
              className="input"
              style={{ width: '100%', fontSize: '0.82rem', padding: '6px 8px' }}
            >
              {LOCATION_SCALES.map((scale) => (
                <option key={scale} value={scale}>
                  {scale}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Environment / Lighting
            </label>
            <input
              type="text"
              placeholder="e.g. Dim torchlight, damp stone, humid"
              value={dataJson.environment || ''}
              onChange={(e) => onChangeDataJson({ ...dataJson, environment: e.target.value })}
              className="input"
              style={{ width: '100%', fontSize: '0.82rem', padding: '6px 8px' }}
            />
          </div>
        </div>
      </div>

      {/* Parent Location Picker & Breadcrumb */}
      <div
        style={{
          padding: '14px',
          borderRadius: '10px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-medium)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={15} /> Parent Location / Dungeon Container
          </span>
          {parentNode && onNavigateNode && (
            <button
              type="button"
              onClick={() => onNavigateNode(parentNode)}
              className="btn btn-ghost"
              style={{ fontSize: '0.72rem', padding: '2px 8px', color: 'var(--color-gold)', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              Jump to {parentNode.title} <ArrowUpRight size={13} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={parentNode ? parentNode.id : ''}
            onChange={(e) => handleSelectParent(e.target.value)}
            className="input"
            style={{ flex: 1, fontSize: '0.82rem', padding: '6px 8px' }}
          >
            <option value="">-- No Parent (Top-level Location / Dungeon Root) --</option>
            {candidateParents.map((cand) => (
              <option key={cand.id} value={cand.id}>
                {cand.title} {cand.subtitle ? `(${cand.subtitle})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Nested Sub-Locations / Keyed Dungeon Rooms */}
      <div
        style={{
          padding: '14px',
          borderRadius: '10px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-medium)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={16} /> Nested Locations / Keyed Areas ({childLocations.length})
          </span>
          <button
            type="button"
            onClick={() => setShowAddSubModal(!showAddSubModal)}
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <Plus size={14} /> Add Room / Area
          </button>
        </div>

        {/* Inline Add Form */}
        {showAddSubModal && (
          <form
            onSubmit={handleCreateSubLocation}
            style={{
              padding: '12px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-emerald)' }}>
              Nest New Room inside &quot;{node.title}&quot;
            </div>
            <input
              type="text"
              placeholder="e.g. Area 1: Cave Entrance or Upper Crypt"
              value={subTitle}
              onChange={(e) => setSubTitle(e.target.value)}
              className="input"
              style={{ width: '100%', fontSize: '0.82rem', padding: '6px 8px' }}
              autoFocus
            />
            <input
              type="text"
              placeholder="Quick summary or description of room contents"
              value={subSummary}
              onChange={(e) => setSubSummary(e.target.value)}
              className="input"
              style={{ width: '100%', fontSize: '0.82rem', padding: '6px 8px' }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setShowAddSubModal(false)}
                className="btn btn-ghost"
                style={{ fontSize: '0.74rem', padding: '4px 8px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingSub || !subTitle.trim()}
                className="btn btn-primary"
                style={{ fontSize: '0.74rem', padding: '4px 12px' }}
              >
                {isSubmittingSub ? 'Adding...' : 'Add Room'}
              </button>
            </div>
          </form>
        )}

        {/* Child Locations List */}
        {childLocations.length === 0 ? (
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
            No nested rooms or sub-areas defined yet. Click &quot;Add Room / Area&quot; above to nest keyed locations in this dungeon.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
            {childLocations.map((child) => (
              <div
                key={child.id}
                onClick={() => onNavigateNode?.(child)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: onNavigateNode ? 'pointer' : 'default',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={14} style={{ color: 'var(--color-emerald)', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {child.title}
                  </span>
                  {child.summary && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                      — {child.summary}
                    </span>
                  )}
                </div>
                {onNavigateNode && (
                  <ArrowUpRight size={14} style={{ color: 'var(--text-secondary)' }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Read-Aloud Boxed Text */}
      <div
        style={{
          padding: '14px',
          borderRadius: '10px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-medium)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Volume2 size={15} /> Read-Aloud Boxed Text (Sensory Prose)
          </span>
          {onFocusCoDM && (
            <button
              type="button"
              onClick={() => onFocusCoDM(node)}
              className="btn btn-ghost"
              style={{ fontSize: '0.72rem', padding: '2px 8px', color: 'var(--color-gold)', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Sparkles size={13} /> Ask Co-DM to Generate
            </button>
          )}
        </div>
        <textarea
          placeholder="Evocative description read aloud to players when entering this area..."
          value={dataJson.boxed_text || ''}
          onChange={(e) => onChangeDataJson({ ...dataJson, boxed_text: e.target.value })}
          className="input"
          style={{ width: '100%', minHeight: '80px', fontSize: '0.8rem', padding: '8px', lineHeight: 1.5, fontStyle: 'italic' }}
        />
      </div>

      {/* Contained NPCs, Monsters, Items */}
      {containedEntities.length > 0 && (
        <div
          style={{
            padding: '14px',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={15} /> Keyed Inhabitants &amp; Treasures ({containedEntities.length})
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {containedEntities.map((ent) => (
              <span
                key={ent.id}
                onClick={() => onNavigateNode?.(ent)}
                style={{
                  fontSize: '0.74rem',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  cursor: onNavigateNode ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <span className={`badge badge-${ent.type}`} style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                  {ent.type}
                </span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{ent.title}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
