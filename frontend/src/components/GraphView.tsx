import React, { useEffect, useRef, useState } from 'react';
import {
  Compass,
  Filter,
  Link,
  Maximize,
  Minimize,
  Plus,
  RotateCcw,
  Search,
  Share2,
  Sparkles,
  User,
  X,
  Zap,
} from 'lucide-react';
import { createEdge, createNode, deleteEdge } from '../api';
import { EdgeItem, GraphData, NodeItem, NodeType } from '../types';

interface GraphViewProps {
  graphData: GraphData;
  campaignId: string;
  onRefresh: () => void;
  onSelectNode: (node: NodeItem) => void;
}

interface SimNode {
  id: string;
  node: NodeItem;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

interface SimEdge {
  id: string;
  source: SimNode;
  target: SimNode;
  relation: string;
  edge: EdgeItem;
}

const TYPE_COLORS: Record<NodeType, string> = {
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
};

function runPhysicsStep(
  nodes: SimNode[],
  edges: SimEdge[],
  cx: number,
  cy: number,
  draggedNode: SimNode | null,
  damping: number = 0.74,
  springK: number = 0.05,
  repulsion: number = 1400
) {
  const springLength = 135;
  // Node repulsion
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x;
      const dy = nodes[j].y - nodes[i].y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < 340) {
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].vx -= fx;
        nodes[i].vy -= fy;
        nodes[j].vx += fx;
        nodes[j].vy += fy;
      }
    }
  }

  // Edge springs
  for (const e of edges) {
    const dx = e.target.x - e.source.x;
    const dy = e.target.y - e.source.y;
    const dist = Math.hypot(dx, dy) || 1;
    const displacement = dist - springLength;
    const force = displacement * springK;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    e.source.vx += fx;
    e.source.vy += fy;
    e.target.vx -= fx;
    e.target.vy -= fy;
  }

  // Velocity, damping & center gravity
  for (const n of nodes) {
    if (n === draggedNode) continue;
    n.vx += (cx - n.x) * 0.0015;
    n.vy += (cy - n.y) * 0.0015;

    n.vx *= damping;
    n.vy *= damping;

    // Fast-snap threshold to prevent eternal floating jitter
    if (Math.abs(n.vx) < 0.01) n.vx = 0;
    if (Math.abs(n.vy) < 0.01) n.vy = 0;

    n.x += n.vx;
    n.y += n.vy;
  }
}

export const GraphView: React.FC<GraphViewProps> = ({
  graphData,
  campaignId,
  onRefresh,
  onSelectNode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Filter state
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    new Set(['npc', 'location', 'monster', 'faction', 'item', 'clue', 'quest', 'pc'])
  );

  // Connect tool state
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [sourceNodeId, setSourceNodeId] = useState('');
  const [targetNodeId, setTargetNodeId] = useState('');
  const [relationType, setRelationType] = useState('located_at');

  // Add Node state
  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [newNodeType, setNewNodeType] = useState<NodeType>('npc');
  const [newNodeTitle, setNewNodeTitle] = useState('');
  const [newNodeSummary, setNewNodeSummary] = useState('');

  // Transform / Camera
  const cameraRef = useRef({ x: 0, y: 0, scale: 1 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const draggedNodeRef = useRef<SimNode | null>(null);
  const hoveredNodeRef = useRef<SimNode | null>(null);

  const nodesRef = useRef<SimNode[]>([]);
  const edgesRef = useRef<SimEdge[]>([]);

  // Toggle filter
  const toggleTypeFilter = (t: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  // Build simulation objects
  useEffect(() => {
    const existingPos = new Map(nodesRef.current.map((n) => [n.id, { x: n.x, y: n.y }]));

    const filteredNodes = graphData.nodes.filter((n) => selectedTypes.has(n.type));
    const filteredIds = new Set(filteredNodes.map((n) => n.id));

    const width = 1000;
    const height = 700;

    const simNodes: SimNode[] = filteredNodes.map((n, i) => {
      const old = existingPos.get(n.id);
      const angle = (i / filteredNodes.length) * 2 * Math.PI;
      const dist = 180 + Math.random() * 120;
      return {
        id: n.id,
        node: n,
        x: old ? old.x : width / 2 + Math.cos(angle) * dist,
        y: old ? old.y : height / 2 + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        radius: n.type === 'location' || n.type === 'faction' ? 24 : 19,
        color: TYPE_COLORS[n.type] || '#f59e0b',
      };
    });

    const nodeMap = new Map(simNodes.map((n) => [n.id, n]));

    const simEdges: SimEdge[] = [];
    for (const e of graphData.edges) {
      const src = nodeMap.get(e.source_id);
      const tgt = nodeMap.get(e.target_id);
      if (src && tgt && filteredIds.has(e.source_id) && filteredIds.has(e.target_id)) {
        simEdges.push({
          id: e.id,
          source: src,
          target: tgt,
          relation: e.relation_type,
          edge: e,
        });
      }
    }

    // Pre-warm the physics simulation with 50 fast ticks so it immediately renders
    // at or near its final resting place instead of slowly wobbling
    for (let step = 0; step < 50; step++) {
      runPhysicsStep(simNodes, simEdges, width / 2, height / 2, null, 0.72, 0.05, 1400);
    }

    nodesRef.current = simNodes;
    edgesRef.current = simEdges;
  }, [graphData, selectedTypes]);

  // Main canvas animation loop with snappy physics
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const updatePhysics = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      runPhysicsStep(nodes, edges, cx, cy, draggedNodeRef.current, 0.74, 0.05, 1400);
    };

    const render = () => {
      updatePhysics();

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();

      // Camera transform
      const cam = cameraRef.current;
      ctx.translate(cam.x, cam.y);
      ctx.scale(cam.scale, cam.scale);

      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const hovered = hoveredNodeRef.current;

      // Draw edges
      for (const e of edges) {
        const isConnectedToHover =
          hovered && (hovered.id === e.source.id || hovered.id === e.target.id);

        ctx.beginPath();
        ctx.moveTo(e.source.x, e.source.y);
        ctx.lineTo(e.target.x, e.target.y);
        ctx.strokeStyle = isConnectedToHover ? '#f59e0b' : 'rgba(100, 116, 139, 0.35)';
        ctx.lineWidth = isConnectedToHover ? 2.5 : 1.2;
        ctx.stroke();

        // Edge label
        const mx = (e.source.x + e.target.x) / 2;
        const my = (e.source.y + e.target.y) / 2;
        ctx.fillStyle = isConnectedToHover ? '#fbbf24' : '#64748b';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(e.relation.replace(/_/g, ' '), mx, my - 4);
      }

      // Draw nodes
      for (const n of nodes) {
        const isHovered = hovered?.id === n.id;

        // Outer glow on hover
        if (isHovered) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 6, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
          ctx.fill();
        }

        // Main node circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = n.node.revealed_to_players ? '#10b981' : '#1e293b';
        ctx.stroke();

        // Node Title
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(n.node.title, n.x, n.y + n.radius + 5);

        // Node Subtitle / Type
        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px Inter, sans-serif';
        ctx.fillText(n.node.subtitle || n.node.type, n.x, n.y + n.radius + 18);
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  // Mouse Interaction (Pan, Zoom, Drag Node, Click)
  const getCanvasCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const cam = cameraRef.current;
    const x = (clientX - rect.left - cam.x) / cam.scale;
    const y = (clientY - rect.top - cam.y) / cam.scale;
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    const clickedNode = nodesRef.current.find((n) => Math.hypot(n.x - x, n.y - y) <= n.radius + 4);

    if (clickedNode) {
      draggedNodeRef.current = clickedNode;
    } else {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX - cameraRef.current.x, y: e.clientY - cameraRef.current.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);

    if (draggedNodeRef.current) {
      draggedNodeRef.current.x = x;
      draggedNodeRef.current.y = y;
      draggedNodeRef.current.vx = 0;
      draggedNodeRef.current.vy = 0;
      return;
    }

    if (isDraggingRef.current) {
      cameraRef.current.x = e.clientX - dragStartRef.current.x;
      cameraRef.current.y = e.clientY - dragStartRef.current.y;
      return;
    }

    // Hover test
    const hovered = nodesRef.current.find((n) => Math.hypot(n.x - x, n.y - y) <= n.radius + 4);
    hoveredNodeRef.current = hovered || null;
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggedNodeRef.current) {
      // If barely moved, consider it a click!
      onSelectNode(draggedNodeRef.current.node);
      draggedNodeRef.current = null;
    }
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(Math.max(cameraRef.current.scale * zoomFactor, 0.4), 2.5);
    cameraRef.current.scale = newScale;
  };

  const handleResetView = () => {
    cameraRef.current = { x: 0, y: 0, scale: 1 };
  };

  const handleCreateConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) {
      alert('Please choose distinct source and target nodes.');
      return;
    }

    try {
      await createEdge({
        campaign_id: campaignId,
        source_id: sourceNodeId,
        target_id: targetNodeId,
        relation_type: relationType,
        label: relationType.replace(/_/g, ' '),
        revealed_to_players: false,
      });
      setShowConnectModal(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateNewNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeTitle.trim()) return;

    try {
      await createNode({
        campaign_id: campaignId,
        type: newNodeType,
        title: newNodeTitle.trim(),
        summary: newNodeSummary.trim(),
        revealed_to_players: false,
      });
      setShowAddNodeModal(false);
      setNewNodeTitle('');
      setNewNodeSummary('');
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 65px)', overflow: 'hidden' }}>
      {/* Top Floating Control Bar */}
      <div
        className="glass-panel"
        style={{
          position: 'absolute',
          top: '16px',
          left: '20px',
          zIndex: 10,
          borderRadius: '10px',
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Share2 size={16} style={{ color: 'var(--color-gold)' }} />
          <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>Campaign Entity Web</span>
        </div>

        <div style={{ height: '18px', width: '1px', background: 'var(--border-subtle)' }} />

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {(['location', 'npc', 'monster', 'faction', 'item', 'clue', 'quest', 'pc'] as NodeType[]).map((t) => (
            <button
              key={t}
              onClick={() => toggleTypeFilter(t)}
              style={{
                background: selectedTypes.has(t) ? TYPE_COLORS[t] + '33' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${selectedTypes.has(t) ? TYPE_COLORS[t] : 'transparent'}`,
                color: selectedTypes.has(t) ? TYPE_COLORS[t] : 'var(--text-muted)',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={{ height: '18px', width: '1px', background: 'var(--border-subtle)' }} />

        {/* Action Buttons */}
        <button onClick={() => setShowAddNodeModal(true)} className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
          <Plus size={13} /> Add Entity
        </button>
        <button onClick={() => setShowConnectModal(true)} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
          <Link size={13} /> Connect
        </button>
        <button onClick={handleResetView} className="btn btn-ghost" title="Reset View" style={{ padding: '6px' }}>
          <RotateCcw size={15} />
        </button>
      </div>

      {/* Main Canvas */}
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight - 65}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isDraggingRef.current ? 'grabbing' : 'grab', background: '#090d16' }}
      />

      {/* Legend at bottom left */}
      <div
        className="glass-panel"
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '20px',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        <span>
          <strong style={{ color: '#10b981' }}>Green Border:</strong> Revealed to Players
        </span>
        <span>
          <strong style={{ color: '#64748b' }}>Dark Border:</strong> DM Secret
        </span>
        <span>• Click node to edit details • Drag to reposition</span>
      </div>

      {/* Connect Nodes Modal */}
      {showConnectModal && (
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
            padding: '20px',
          }}
        >
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '460px', padding: '24px', borderRadius: '14px' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '16px' }}>Create Relationship Edge</h3>
            <form onSubmit={handleCreateConnection}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                  Source Node
                </label>
                <select
                  value={sourceNodeId}
                  onChange={(e) => setSourceNodeId(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff' }}
                >
                  <option value="">Select source...</option>
                  {graphData.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      [{n.type}] {n.title}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                  Relationship Type
                </label>
                <select
                  value={relationType}
                  onChange={(e) => setRelationType(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff' }}
                >
                  <option value="located_at">located_at</option>
                  <option value="frequents">frequents</option>
                  <option value="allied_with">allied_with</option>
                  <option value="hostile_to">hostile_to</option>
                  <option value="gives_quest">gives_quest</option>
                  <option value="rewards">rewards</option>
                  <option value="knows_secret">knows_secret</option>
                  <option value="member_of">member_of</option>
                  <option value="contains">contains</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                  Target Node
                </label>
                <select
                  value={targetNodeId}
                  onChange={(e) => setTargetNodeId(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff' }}
                >
                  <option value="">Select target...</option>
                  {graphData.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      [{n.type}] {n.title}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowConnectModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Entity Modal */}
      {showAddNodeModal && (
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
            padding: '20px',
          }}
        >
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '460px', padding: '24px', borderRadius: '14px' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '16px' }}>Add Entity to Graph</h3>
            <form onSubmit={handleCreateNewNode}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                  Entity Type
                </label>
                <select
                  value={newNodeType}
                  onChange={(e) => setNewNodeType(e.target.value as NodeType)}
                  style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff' }}
                >
                  <option value="npc">NPC</option>
                  <option value="location">Location</option>
                  <option value="monster">Monster</option>
                  <option value="faction">Faction</option>
                  <option value="item">Item</option>
                  <option value="clue">Clue / Secret</option>
                  <option value="pc">Player Character (PC)</option>
                </select>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                  Name / Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Captain Vane, Whispering Cavern"
                  value={newNodeTitle}
                  onChange={(e) => setNewNodeTitle(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                  Summary or Traits
                </label>
                <textarea
                  rows={3}
                  placeholder="Appearance, role, secret motives..."
                  value={newNodeSummary}
                  onChange={(e) => setNewNodeSummary(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowAddNodeModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Entity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
