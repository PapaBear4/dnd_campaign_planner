import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  Check,
  Compass,
  Edit2,
  Eye,
  EyeOff,
  Filter,
  Layers,
  LayoutGrid,
  List,
  MapPin,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Swords,
  Tag,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { createNode, createSubLocation, deleteNode, getLocationHierarchy, toggleNodeReveal } from '../api';
import { NodeItem, NodeType, LoreStatus, HierarchyItem } from '../types';

interface NodeBrowserProps {
  nodes: NodeItem[];
  campaignId: string;
  onRefresh: () => void;
  onSelectNode: (node: NodeItem) => void;
  onFocusCoDM: (node: NodeItem) => void;
}

const TYPE_COLORS: Record<string, string> = {
  campaign: '#f59e0b',
  arc: '#fbbf24',
  quest: '#3b82f6',
  session: '#0ea5e9',
  encounter: '#ef4444',
  pc: '#06b6d4',
  npc: '#a855f7',
  monster: '#dc2626',
  location: '#10b981',
  faction: '#eab308',
  item: '#f97316',
  clue: '#8b5cf6',
  map: '#6366f1',
  lore: '#d97706',
};

const ALL_NODE_TYPES: NodeType[] = [
  'quest',
  'npc',
  'location',
  'monster',
  'faction',
  'item',
  'lore',
  'clue',
  'arc',
  'session',
  'encounter',
  'pc',
  'map',
];

export const NodeBrowser: React.FC<NodeBrowserProps> = ({
  nodes,
  campaignId,
  onRefresh,
  onSelectNode,
  onFocusCoDM,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [loreFilter, setLoreFilter] = useState<'all' | 'fact' | 'suspicion' | 'rumor'>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'revealed' | 'secret'>('all');
  const [sortBy, setSortBy] = useState<'title_asc' | 'title_desc' | 'type' | 'updated'>('title_asc');
  const [viewMode, setViewMode] = useState<'cards' | 'table' | 'location_tree'>('cards');

  // Location Tree Hierarchy State
  const [locationHierarchy, setLocationHierarchy] = useState<HierarchyItem[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [expandedLocations, setExpandedLocations] = useState<Record<string, boolean>>({});
  const [quickAddParentId, setQuickAddParentId] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [quickAddSummary, setQuickAddSummary] = useState('');
  const [isSubmittingSubLocation, setIsSubmittingSubLocation] = useState(false);

  // New Node Quick Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newType, setNewType] = useState<NodeType>('npc');
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [newLoreStatus, setNewLoreStatus] = useState<LoreStatus>('fact');
  const [isCreating, setIsCreating] = useState(false);

  const loadLocationTree = async () => {
    try {
      setLoadingLocations(true);
      const data = await getLocationHierarchy(campaignId);
      setLocationHierarchy(data);
    } catch (err) {
      console.error('Failed to load location hierarchy:', err);
    } finally {
      setLoadingLocations(false);
    }
  };

  React.useEffect(() => {
    if (viewMode === 'location_tree' || selectedType === 'location') {
      loadLocationTree();
    }
  }, [viewMode, selectedType, campaignId, nodes]);

  const toggleLocationExpand = (id: string) => {
    setExpandedLocations((prev) => ({
      ...prev,
      [id]: prev[id] === false ? true : false,
    }));
  };

  const handleQuickAddSubLocation = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault();
    if (!quickAddTitle.trim()) return;
    setIsSubmittingSubLocation(true);
    try {
      await createSubLocation(campaignId, parentId, quickAddTitle.trim(), quickAddSummary.trim());
      setQuickAddTitle('');
      setQuickAddSummary('');
      setQuickAddParentId(null);
      setExpandedLocations((prev) => ({ ...prev, [parentId]: true }));
      onRefresh();
      loadLocationTree();
    } catch (err) {
      alert('Failed to create sub-location: ' + err);
    } finally {
      setIsSubmittingSubLocation(false);
    }
  };

  // Filter & Search Logic
  const filteredNodes = useMemo(() => {
    return nodes
      .filter((n) => {
        // Type filter
        if (selectedType !== 'all' && n.type !== selectedType) return false;

        // Lore / Confidence filter
        if (loreFilter === 'fact') {
          if (n.lore_status && n.lore_status !== 'fact') return false;
          if (n.is_canon === false) return false;
        } else if (loreFilter === 'suspicion') {
          if (n.lore_status !== 'suspicion') return false;
        } else if (loreFilter === 'rumor') {
          if (n.lore_status !== 'rumor') return false;
        }

        // Visibility filter
        if (visibilityFilter === 'revealed' && !n.revealed_to_players) return false;
        if (visibilityFilter === 'secret' && n.revealed_to_players) return false;

        // Text search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = n.title.toLowerCase().includes(q);
          const matchSub = (n.subtitle || '').toLowerCase().includes(q);
          const matchSum = (n.summary || '').toLowerCase().includes(q);
          const matchContent = (n.content_markdown || '').toLowerCase().includes(q);
          const matchTags = (n.tags || []).some((t) => t.toLowerCase().includes(q));
          if (!matchTitle && !matchSub && !matchSum && !matchContent && !matchTags) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'title_asc') return a.title.localeCompare(b.title);
        if (sortBy === 'title_desc') return b.title.localeCompare(a.title);
        if (sortBy === 'type') return a.type.localeCompare(b.type);
        if (sortBy === 'updated') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        return 0;
      });
  }, [nodes, selectedType, loreFilter, visibilityFilter, searchQuery, sortBy]);

  const handleToggleReveal = async (e: React.MouseEvent, node: NodeItem) => {
    e.stopPropagation();
    try {
      await toggleNodeReveal(node.id);
      onRefresh();
    } catch (err) {
      alert('Failed to update reveal status: ' + err);
    }
  };

  const handleDeleteNode = async (e: React.MouseEvent, node: NodeItem) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${node.title}"? This will also remove any relationships attached to it.`)) {
      return;
    }
    try {
      await deleteNode(node.id);
      onRefresh();
    } catch (err) {
      alert('Failed to delete node: ' + err);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setIsCreating(true);
    try {
      const conf = newLoreStatus === 'fact' ? 1.0 : newLoreStatus === 'suspicion' ? 0.75 : 0.4;
      await createNode({
        type: newType,
        title: newTitle.trim(),
        subtitle: newSubtitle.trim(),
        summary: newSummary.trim(),
        lore_status: newLoreStatus,
        confidence: conf,
        is_canon: newLoreStatus === 'fact',
        campaign_id: campaignId,
      });
      setNewTitle('');
      setNewSubtitle('');
      setNewSummary('');
      setShowCreateModal(false);
      onRefresh();
    } catch (err) {
      alert('Failed to create node: ' + err);
    } finally {
      setIsCreating(false);
    }
  };

  const renderLocationTreeItem = (item: HierarchyItem, depth: number = 0) => {
    const { node, children } = item;
    const isExpanded = expandedLocations[node.id] ?? true;
    const isAddingHere = quickAddParentId === node.id;

    return (
      <div key={node.id} style={{ marginLeft: `${depth * 20}px`, marginTop: '8px' }}>
        <div
          onClick={() => onSelectNode(node)}
          className="glass-panel"
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            cursor: 'pointer',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-emerald)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
        >
          {/* Left: Expand/Collapse + Icon + Title & Scale */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
            {children.length > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLocationExpand(node.id);
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '6px',
                  color: isExpanded ? 'var(--color-emerald)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  padding: 0,
                }}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : (
              <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={14} style={{ color: 'var(--color-emerald)', opacity: 0.7 }} />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {node.title}
                </span>
                {node.data_json?.scale && (
                  <span
                    style={{
                      fontSize: '0.66rem',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: 'var(--color-emerald)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    {node.data_json.scale}
                  </span>
                )}
                {children.length > 0 && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    ({children.length} sub-area{children.length > 1 ? 's' : ''})
                  </span>
                )}
              </div>
              {node.summary && (
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
                  {node.summary}
                </span>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => {
                setQuickAddParentId(isAddingHere ? null : node.id);
                setQuickAddTitle('');
                setQuickAddSummary('');
              }}
              className="btn btn-secondary"
              style={{ fontSize: '0.7rem', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Add a nested room / keyed area inside this location"
            >
              <Plus size={12} /> {isAddingHere ? 'Cancel' : '+ Sub-Room'}
            </button>
            <button
              type="button"
              onClick={() => onSelectNode(node)}
              className="btn btn-ghost"
              style={{ fontSize: '0.7rem', padding: '3px 8px', color: 'var(--color-gold)' }}
            >
              Inspect
            </button>
          </div>
        </div>

        {/* Inline Sub-Location Form */}
        {isAddingHere && (
          <form
            onSubmit={(e) => handleQuickAddSubLocation(e, node.id)}
            style={{
              marginTop: '6px',
              marginLeft: '24px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-emerald)' }}>
              Nest New Room inside &quot;{node.title}&quot;
            </div>
            <input
              type="text"
              placeholder="e.g. Area 1: Cave Entrance or Upper Crypt"
              value={quickAddTitle}
              onChange={(e) => setQuickAddTitle(e.target.value)}
              className="input"
              style={{ width: '100%', fontSize: '0.78rem', padding: '5px 8px' }}
              autoFocus
            />
            <input
              type="text"
              placeholder="Quick description of room contents"
              value={quickAddSummary}
              onChange={(e) => setQuickAddSummary(e.target.value)}
              className="input"
              style={{ width: '100%', fontSize: '0.78rem', padding: '5px 8px' }}
            />
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '2px' }}>
              <button
                type="button"
                onClick={() => setQuickAddParentId(null)}
                className="btn btn-ghost"
                style={{ fontSize: '0.7rem', padding: '2px 8px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingSubLocation || !quickAddTitle.trim()}
                className="btn btn-primary"
                style={{ fontSize: '0.7rem', padding: '2px 10px' }}
              >
                {isSubmittingSubLocation ? 'Adding...' : 'Add Room'}
              </button>
            </div>
          </form>
        )}

        {/* Children Render */}
        {isExpanded && children.length > 0 && (
          <div style={{ borderLeft: '1px dashed var(--border-medium)', marginLeft: '12px', paddingLeft: '4px' }}>
            {children.map((child) => renderLocationTreeItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      {/* Top Filter Toolbar */}
      <div
        style={{
          padding: '12px 20px',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          flexShrink: 0,
        }}
      >
        {/* Search Bar & View Mode Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px', maxWidth: '420px' }}>
            <input
              type="text"
              placeholder="Search by name, summary, tags, lore content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                borderRadius: '8px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            />
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '10px', top: '8px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              <option value="title_asc">Sort: Title (A-Z)</option>
              <option value="title_desc">Sort: Title (Z-A)</option>
              <option value="type">Sort: Type</option>
              <option value="updated">Sort: Recently Updated</option>
            </select>

            {/* Visibility Toggle */}
            <select
              value={visibilityFilter}
              onChange={(e: any) => setVisibilityFilter(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              <option value="all">👁️ All Visibility</option>
              <option value="revealed">👁️ Revealed to Players</option>
              <option value="secret">🔒 DM Secrets Only</option>
            </select>

            {/* View Mode Toggle */}
            <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-medium)', overflow: 'hidden' }}>
              <button
                onClick={() => setViewMode('cards')}
                className="btn btn-ghost"
                title="Card Grid View"
                style={{
                  padding: '6px 10px',
                  background: viewMode === 'cards' ? 'var(--color-gold)' : 'transparent',
                  color: viewMode === 'cards' ? '#0a0d14' : 'var(--text-secondary)',
                  borderRadius: 0,
                }}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className="btn btn-ghost"
                title="Compact Table View"
                style={{
                  padding: '6px 10px',
                  background: viewMode === 'table' ? 'var(--color-gold)' : 'transparent',
                  color: viewMode === 'table' ? '#0a0d14' : 'var(--text-secondary)',
                  borderRadius: 0,
                }}
              >
                <List size={15} />
              </button>
              <button
                onClick={() => {
                  setSelectedType('location');
                  setViewMode('location_tree');
                }}
                className="btn btn-ghost"
                title="Nested Dungeon & Location Tree"
                style={{
                  padding: '6px 10px',
                  background: viewMode === 'location_tree' ? 'var(--color-gold)' : 'transparent',
                  color: viewMode === 'location_tree' ? '#0a0d14' : 'var(--text-secondary)',
                  borderRadius: 0,
                }}
              >
                <Compass size={15} />
              </button>
            </div>

            {/* Add Node Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={14} /> New Entity
            </button>
          </div>
        </div>

        {/* Secondary Filter Line: Type Pills & Lore Status Pills */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          {/* Node Type Pills */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => setSelectedType('all')}
              style={{
                background: selectedType === 'all' ? 'var(--color-gold)' : 'var(--bg-card)',
                color: selectedType === 'all' ? '#0a0d14' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                padding: '2px 8px',
                fontSize: '0.72rem',
                fontWeight: selectedType === 'all' ? 700 : 500,
                cursor: 'pointer',
              }}
            >
              All Types ({nodes.length})
            </button>
            {ALL_NODE_TYPES.map((t) => {
              const count = nodes.filter((n) => n.type === t).length;
              if (count === 0 && selectedType !== t) return null;
              const isSel = selectedType === t;
              return (
                <button
                  key={t}
                  onClick={() => setSelectedType(t)}
                  style={{
                    background: isSel ? TYPE_COLORS[t] + '33' : 'var(--bg-card)',
                    color: isSel ? TYPE_COLORS[t] : 'var(--text-secondary)',
                    border: `1px solid ${isSel ? TYPE_COLORS[t] : 'var(--border-subtle)'}`,
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '0.72rem',
                    fontWeight: isSel ? 700 : 500,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {t} ({count})
                </button>
              );
            })}
          </div>

          {/* Lore Status Filter Pills */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginRight: '2px' }}>Lore:</span>
            <button
              onClick={() => setLoreFilter('all')}
              style={{
                background: loreFilter === 'all' ? 'var(--color-gold)' : 'var(--bg-card)',
                color: loreFilter === 'all' ? '#0a0d14' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                padding: '2px 6px',
                fontSize: '0.7rem',
                cursor: 'pointer',
              }}
            >
              All
            </button>
            <button
              onClick={() => setLoreFilter('fact')}
              style={{
                background: loreFilter === 'fact' ? 'rgba(16, 185, 129, 0.25)' : 'var(--bg-card)',
                color: loreFilter === 'fact' ? '#34d399' : 'var(--text-secondary)',
                border: `1px solid ${loreFilter === 'fact' ? '#10b981' : 'var(--border-subtle)'}`,
                borderRadius: '4px',
                padding: '2px 6px',
                fontSize: '0.7rem',
                cursor: 'pointer',
              }}
              title="Verified Canon Truth"
            >
              🔒 Facts
            </button>
            <button
              onClick={() => setLoreFilter('suspicion')}
              style={{
                background: loreFilter === 'suspicion' ? 'rgba(139, 92, 246, 0.25)' : 'var(--bg-card)',
                color: loreFilter === 'suspicion' ? '#c084fc' : 'var(--text-secondary)',
                border: `1px solid ${loreFilter === 'suspicion' ? '#8b5cf6' : 'var(--border-subtle)'}`,
                borderRadius: '4px',
                padding: '2px 6px',
                fontSize: '0.7rem',
                cursor: 'pointer',
              }}
              title="Hypothesis / Working Theory"
            >
              🔍 Suspicions
            </button>
            <button
              onClick={() => setLoreFilter('rumor')}
              style={{
                background: loreFilter === 'rumor' ? 'rgba(245, 158, 11, 0.25)' : 'var(--bg-card)',
                color: loreFilter === 'rumor' ? '#fbbf24' : 'var(--text-secondary)',
                border: `1px solid ${loreFilter === 'rumor' ? '#f59e0b' : 'var(--border-subtle)'}`,
                borderRadius: '4px',
                padding: '2px 6px',
                fontSize: '0.7rem',
                cursor: 'pointer',
              }}
              title="Tavern Gossip & Hearsay"
            >
              🗣️ Rumors
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', minHeight: 0 }}>
        {filteredNodes.length === 0 ? (
          <div
            style={{
              padding: '48px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
            }}
          >
            <Layers size={36} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
            <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', margin: 0 }}>No Entities Match Criteria</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '380px', margin: 0 }}>
              Try adjusting your search terms or filters above, or create a new campaign entity.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedType('all');
                setLoreFilter('all');
                setVisibilityFilter('all');
              }}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', marginTop: '6px' }}
            >
              Clear All Filters
            </button>
          </div>
        ) : viewMode === 'cards' ? (
          /* Cards Grid View */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '14px',
            }}
          >
            {filteredNodes.map((n) => {
              const typeColor = TYPE_COLORS[n.type] || '#f59e0b';
              const isFact = !n.lore_status || n.lore_status === 'fact';
              const isSuspicion = n.lore_status === 'suspicion';
              const isRumor = n.lore_status === 'rumor';

              return (
                <div
                  key={n.id}
                  className="glass-panel"
                  onClick={() => onSelectNode(n)}
                  style={{
                    borderRadius: '10px',
                    border: '1px solid var(--border-subtle)',
                    padding: '14px',
                    background: 'var(--bg-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = typeColor;
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = `0 6px 18px rgba(0,0,0,0.35)`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div>
                    {/* Header line: Type badge & Confidence/Lore badge */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: typeColor + '26',
                          color: typeColor,
                          border: `1px solid ${typeColor}66`,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {n.type}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isFact && (
                          <span
                            title="Canon Fact (100% confidence)"
                            style={{
                              fontSize: '0.68rem',
                              padding: '1px 6px',
                              borderRadius: '10px',
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#34d399',
                              border: '1px solid #10b981',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <ShieldCheck size={11} /> Fact
                          </span>
                        )}
                        {isSuspicion && (
                          <span
                            title="Suspicion / Theory (~75% confidence)"
                            style={{
                              fontSize: '0.68rem',
                              padding: '1px 6px',
                              borderRadius: '10px',
                              background: 'rgba(139, 92, 246, 0.15)',
                              color: '#c084fc',
                              border: '1px solid #8b5cf6',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            🔍 Suspicion
                          </span>
                        )}
                        {isRumor && (
                          <span
                            title="Tavern Rumor / Gossip (~40% confidence)"
                            style={{
                              fontSize: '0.68rem',
                              padding: '1px 6px',
                              borderRadius: '10px',
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: '#fbbf24',
                              border: '1px solid #f59e0b',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            🗣️ Rumor
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title & Subtitle */}
                    <h4 style={{ fontSize: '0.98rem', fontWeight: 700, margin: '0 0 3px 0', color: 'var(--text-primary)' }}>
                      {n.title}
                    </h4>
                    {n.subtitle && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-gold)', fontWeight: 500, marginBottom: '6px' }}>
                        {n.subtitle}
                      </div>
                    )}

                    {/* Summary */}
                    <p
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-secondary)',
                        margin: '4px 0 10px 0',
                        lineHeight: 1.35,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {n.summary || (n.content_markdown ? n.content_markdown.slice(0, 120) + '...' : 'No notes entered.')}
                    </p>
                  </div>

                  {/* Card Footer: Tags & Action Buttons */}
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {(n.tags || []).slice(0, 2).map((t, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: '0.65rem',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: 'var(--bg-surface)',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          #{t}
                        </span>
                      ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        onClick={(e) => handleToggleReveal(e, n)}
                        className="btn btn-ghost"
                        title={n.revealed_to_players ? 'Revealed to Players (Click to Hide)' : 'DM Secret (Click to Reveal)'}
                        style={{ padding: '4px', color: n.revealed_to_players ? '#10b981' : 'var(--text-muted)' }}
                      >
                        {n.revealed_to_players ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onFocusCoDM(n);
                        }}
                        className="btn btn-ghost"
                        title="Chat with Co-DM about this entity"
                        style={{ padding: '4px', color: 'var(--color-gold)' }}
                      >
                        <MessageSquare size={13} />
                      </button>

                      <button
                        onClick={(e) => handleDeleteNode(e, n)}
                        className="btn btn-ghost"
                        title="Delete Entity"
                        style={{ padding: '4px', color: 'var(--text-muted)' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : viewMode === 'location_tree' ? (
          /* Location Tree Hierarchy View */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.82rem',
                color: 'var(--text-secondary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Compass size={15} style={{ color: 'var(--color-gold)' }} />
                <span>
                  Nested Location Explorer &amp; Dungeon Rooms &bull;{' '}
                  <strong style={{ color: 'var(--text-main)' }}>{locationHierarchy.length}</strong> top-level regions/dungeons
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                  onClick={() => {
                    const allMap: Record<string, boolean> = {};
                    const collect = (nodes: HierarchyItem[]) => {
                      for (const n of nodes) {
                        allMap[n.node.id] = true;
                        if (n.children && n.children.length > 0) collect(n.children);
                      }
                    };
                    collect(locationHierarchy);
                    setExpandedLocations(allMap);
                  }}
                >
                  Expand All
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                  onClick={() => setExpandedLocations({})}
                >
                  Collapse All
                </button>
              </div>
            </div>

            {loadingLocations ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Loading nested location structure...
              </div>
            ) : locationHierarchy.length === 0 ? (
              <div
                className="glass-panel"
                style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  borderRadius: '10px',
                }}
              >
                <Compass size={36} style={{ marginBottom: '12px', opacity: 0.3 }} />
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                  No Locations Found
                </div>
                <div style={{ fontSize: '0.82rem', maxWidth: '400px', margin: '0 auto 16px' }}>
                  Create a location (such as a dungeon, town, or continent) to organize rooms, sub-areas, and points of interest.
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setNewType('location');
                    setNewTitle('');
                    setNewSubtitle('Dungeon / Complex');
                    setNewSummary('');
                    setShowCreateModal(true);
                  }}
                >
                  + Add First Location
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {locationHierarchy.map((root) => renderLocationTreeItem(root, 0))}
              </div>
            )}
          </div>
        ) : (
          /* Table View */
          <div
            className="glass-panel"
            style={{
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              overflowX: 'auto',
              background: 'var(--bg-card)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Title &amp; Subtitle</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Lore Status</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Summary</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Visibility</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredNodes.map((n) => {
                  const typeColor = TYPE_COLORS[n.type] || '#f59e0b';
                  const isFact = !n.lore_status || n.lore_status === 'fact';
                  const isSuspicion = n.lore_status === 'suspicion';
                  const isRumor = n.lore_status === 'rumor';

                  return (
                    <tr
                      key={n.id}
                      onClick={() => onSelectNode(n)}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '10px 14px' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background: typeColor + '26',
                            color: typeColor,
                            border: `1px solid ${typeColor}66`,
                            textTransform: 'uppercase',
                          }}
                        >
                          {n.type}
                        </span>
                      </td>

                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{n.title}</div>
                        {n.subtitle && <div style={{ fontSize: '0.72rem', color: 'var(--text-gold)' }}>{n.subtitle}</div>}
                      </td>

                      <td style={{ padding: '10px 14px' }}>
                        {isFact && (
                          <span style={{ fontSize: '0.7rem', color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <ShieldCheck size={12} /> Fact
                          </span>
                        )}
                        {isSuspicion && (
                          <span style={{ fontSize: '0.7rem', color: '#c084fc', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            🔍 Suspicion
                          </span>
                        )}
                        {isRumor && (
                          <span style={{ fontSize: '0.7rem', color: '#fbbf24', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            🗣️ Rumor
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', maxWidth: '300px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {n.summary || n.content_markdown || '—'}
                        </div>
                      </td>

                      <td style={{ padding: '10px 14px' }}>
                        <button
                          onClick={(e) => handleToggleReveal(e, n)}
                          className="btn btn-ghost"
                          style={{ padding: '3px 6px', fontSize: '0.72rem', color: n.revealed_to_players ? '#10b981' : 'var(--text-muted)' }}
                        >
                          {n.revealed_to_players ? '👁️ Revealed' : '🔒 Secret'}
                        </button>
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onFocusCoDM(n);
                            }}
                            className="btn btn-ghost"
                            title="Chat with Co-DM"
                            style={{ padding: '4px', color: 'var(--color-gold)' }}
                          >
                            <MessageSquare size={14} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteNode(e, n)}
                            className="btn btn-ghost"
                            title="Delete"
                            style={{ padding: '4px', color: 'var(--text-muted)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Create Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 16, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <form
            onSubmit={handleCreateSubmit}
            className="glass-panel animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '520px',
              borderRadius: '12px',
              border: '1px solid var(--border-medium)',
              background: 'var(--bg-card)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--color-gold)' }}>
                <Plus size={18} /> Create New Campaign Entity
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Entity Type</label>
                <select
                  value={newType}
                  onChange={(e: any) => setNewType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    textTransform: 'capitalize',
                    marginTop: '2px',
                  }}
                >
                  {ALL_NODE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lore Status / Truth</label>
                <select
                  value={newLoreStatus}
                  onChange={(e: any) => setNewLoreStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    marginTop: '2px',
                  }}
                >
                  <option value="fact">🔒 Fact / Canon (100%)</option>
                  <option value="suspicion">🔍 Suspicion / Theory (75%)</option>
                  <option value="rumor">🗣️ Tavern Rumor (40%)</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Captain Zarr, Sunless Spire, Eye of Vecna"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  marginTop: '2px',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Subtitle / Epithet</label>
              <input
                type="text"
                placeholder="e.g. Goblin Chieftain, Hidden Ruin, Ancient Artifact"
                value={newSubtitle}
                onChange={(e) => setNewSubtitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  marginTop: '2px',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Brief Synopsis</label>
              <textarea
                rows={2}
                placeholder="1-2 sentence overview for the DM..."
                value={newSummary}
                onChange={(e) => setNewSummary(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  resize: 'none',
                  marginTop: '2px',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="btn btn-ghost"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating || !newTitle.trim()}
                className="btn btn-primary"
                style={{ padding: '6px 14px', fontSize: '0.8rem' }}
              >
                {isCreating ? 'Creating...' : 'Create Entity'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
