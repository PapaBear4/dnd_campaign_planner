import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Compass,
  Edit2,
  ExternalLink,
  Eye,
  EyeOff,
  GitBranch,
  Image as ImageIcon,
  Layers,
  Loader2,
  MapPin,
  Maximize2,
  Move,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { applyMapScan, createNode, deleteNode, scanMapVision, ScanMapVisionResponse, updateNode, uploadFile } from '../api';
import { NodeItem } from '../types';

interface MapStudioProps {
  locations: NodeItem[];
  maps: NodeItem[];
  campaignId: string;
  onRefresh: () => void;
  onSelectNode: (node: NodeItem) => void;
  onFocusCoDM: (node: NodeItem) => void;
}

export interface MapPinData {
  id: string;
  nodeId: string;
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  label: string;
  revealed: boolean;
  targetMapId?: string; // Optional linked map ID to launch
}

export const MapStudio: React.FC<MapStudioProps> = ({
  locations,
  maps,
  campaignId,
  onRefresh,
  onSelectNode,
  onFocusCoDM,
}) => {
  // Selected map
  const [selectedMapId, setSelectedMapId] = useState<string>('');
  const [selectedPin, setSelectedPin] = useState<MapPinData | null>(null);

  // Map title editing state
  const [editingMapId, setEditingMapId] = useState<string | null>(null);
  const [editMapTitle, setEditMapTitle] = useState<string>('');

  // Pin placement mode
  const [isPlacingPin, setIsPlacingPin] = useState(false);
  const [pendingPinCoords, setPendingPinCoords] = useState<{ xPct: number; yPct: number } | null>(null);
  const [selectedLocationForPin, setSelectedLocationForPin] = useState<string>('');
  const [selectedTargetMapForPin, setSelectedTargetMapForPin] = useState<string>('');
  const [customPinLabel, setCustomPinLabel] = useState<string>('');
  const [pinIsRevealedInitially, setPinIsRevealedInitially] = useState<boolean>(true);

  // Pin dragging state
  const [draggingPinId, setDraggingPinId] = useState<string | null>(null);

  // Multimodal Map Vision & Pin Alignment state
  const [showVisionModal, setShowVisionModal] = useState(false);
  const [isScanningVision, setIsScanningVision] = useState(false);
  const [isApplyingVision, setIsApplyingVision] = useState(false);
  const [visionInstruction, setVisionInstruction] = useState('');
  const [visionAutoAlign, setVisionAutoAlign] = useState(true);
  const [visionCreateMissing, setVisionCreateMissing] = useState(true);
  const [visionConnectPassages, setVisionConnectPassages] = useState(true);
  const [visionResult, setVisionResult] = useState<ScanMapVisionResponse | null>(null);
  const [selectedVisionPinIds, setSelectedVisionPinIds] = useState<Set<string>>(new Set());
  const [selectedVisionEdgeIndices, setSelectedVisionEdgeIndices] = useState<Set<number>>(new Set());
  const [visionStatusMessage, setVisionStatusMessage] = useState('');

  // Google Maps-Style Pan & Zoom State
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingMap, setIsDraggingMap] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const didDragRef = useRef(false);

  // Auto-select first map if none selected
  useEffect(() => {
    if (maps.length > 0 && (!selectedMapId || !maps.some((m) => m.id === selectedMapId))) {
      setSelectedMapId(maps[0].id);
    }
  }, [maps, selectedMapId]);

  const activeMap = maps.find((m) => m.id === selectedMapId) || maps[0] || null;
  const mapImage = activeMap?.data_json?.map_url || '';
  const pins: MapPinData[] = activeMap?.data_json?.pins || [];

  // Reset pan/zoom when switching maps
  const handleSelectMap = (mapId: string) => {
    setSelectedMapId(mapId);
    setSelectedPin(null);
    setScale(1);
    setPan({ x: 0, y: 0 });
    setIsPlacingPin(false);
    setPendingPinCoords(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const defaultTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    const mapName = window.prompt('Enter a title for this map:', defaultTitle) || defaultTitle;

    try {
      const res = await uploadFile(file, 'map');
      const created = await createNode({
        campaign_id: campaignId,
        type: 'map',
        title: mapName,
        summary: `Battle map / handout: ${mapName}`,
        revealed_to_players: true,
        data_json: {
          map_url: res.url,
          pins: [],
        },
      });
      onRefresh();
      handleSelectMap(created.id);
    } catch (err: any) {
      alert('Failed to upload and save map: ' + err.message);
    }
  };

  // Toggle map reveal status for players
  const handleToggleMapReveal = async (map: NodeItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newRevealed = !map.revealed_to_players;
    try {
      await updateNode(map.id, { revealed_to_players: newRevealed });
      onRefresh();
    } catch (err: any) {
      alert('Failed to update map visibility: ' + err.message);
    }
  };

  // --- Google Maps-like Pan & Zoom Controls ---
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only handle left mouse button
    if (e.button !== 0) return;
    didDragRef.current = false;
    if (isPlacingPin) return;

    setIsDraggingMap(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingPinId && activeMap) {
      // Pin dragging logic with exact container coords
      const rect = mapContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      const imgX = (clientX - pan.x) / scale;
      const imgY = (clientY - pan.y) / scale;
      const xPct = Math.min(Math.max(Number(((imgX / rect.width) * 100).toFixed(2)), 0), 100);
      const yPct = Math.min(Math.max(Number(((imgY / rect.height) * 100).toFixed(2)), 0), 100);

      // Mutate and trigger rerender
      const currentPins = activeMap.data_json?.pins || [];
      const updated = currentPins.map((p: any) => (p.id === draggingPinId ? { ...p, x: xPct, y: yPct } : p));
      if (!activeMap.data_json) activeMap.data_json = {};
      activeMap.data_json.pins = updated;
      // Also update selectedPin if dragged
      setSelectedPin((prev) => (prev && prev.id === draggingPinId ? { ...prev, x: xPct, y: yPct } : prev));
      return;
    }

    if (!isDraggingMap) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      didDragRef.current = true;
    }

    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    });
  };

  const handleMouseUp = async () => {
    if (draggingPinId && activeMap) {
      // Persist pin position
      try {
        await updateNode(activeMap.id, {
          data_json: {
            ...(activeMap.data_json || {}),
            pins: activeMap.data_json?.pins || [],
          },
        });
        onRefresh();
      } catch (err) {
        console.error('Failed to save pin position:', err);
      }
      setDraggingPinId(null);
    }
    setIsDraggingMap(false);
  };

  // Google Maps Smooth Wheel Zoom centered at cursor
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newScale = Math.min(Math.max(scale * zoomFactor, 0.4), 25.0);

    // Anchored pan math: keep the map point under the mouse stationary
    const worldX = (mouseX - pan.x) / scale;
    const worldY = (mouseY - pan.y) / scale;
    const newPanX = mouseX - worldX * newScale;
    const newPanY = mouseY - worldY * newScale;

    setScale(newScale);
    setPan({ x: newPanX, y: newPanY });
  };

  // Double click to zoom in at point
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isPlacingPin) return;
    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newScale = Math.min(scale * 1.5, 25.0);
    const worldX = (mouseX - pan.x) / scale;
    const worldY = (mouseY - pan.y) / scale;
    const newPanX = mouseX - worldX * newScale;
    const newPanY = mouseY - worldY * newScale;

    setScale(newScale);
    setPan({ x: newPanX, y: newPanY });
  };

  // Reset view to center 1.0x
  const handleResetView = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  // Fit view / Zoom to fit all pins
  const handleFitPins = () => {
    if (!pins.length) {
      handleResetView();
      return;
    }
    const minX = Math.min(...pins.map((p) => p.x));
    const maxX = Math.max(...pins.map((p) => p.x));
    const minY = Math.min(...pins.map((p) => p.y));
    const maxY = Math.max(...pins.map((p) => p.y));

    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const midXPct = (minX + maxX) / 2;
    const midYPct = (minY + maxY) / 2;

    const targetScale = 1.3;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const targetWorldX = (midXPct / 100) * rect.width;
    const targetWorldY = (midYPct / 100) * rect.height;

    setScale(targetScale);
    setPan({
      x: centerX - targetWorldX * targetScale,
      y: centerY - targetWorldY * targetScale,
    });
  };

  // --- Pin Creation with Exact Coordinates ---
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPlacingPin || !activeMap) return;
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }

    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Convert screen coordinates through scale & pan back to image percentage
    const imgX = (clientX - pan.x) / scale;
    const imgY = (clientY - pan.y) / scale;
    const xPct = Number(((imgX / rect.width) * 100).toFixed(2));
    const yPct = Number(((imgY / rect.height) * 100).toFixed(2));

    setPendingPinCoords({ xPct, yPct });
  };

  const handleConfirmDropPin = async () => {
    if (!pendingPinCoords || !activeMap) return;

    let targetNodeId = selectedLocationForPin;
    let label = customPinLabel.trim();

    // If no existing location chosen, create a new location node
    if (!targetNodeId && label) {
      try {
        const createdLoc = await createNode({
          campaign_id: campaignId,
          type: 'location',
          title: label,
          summary: `Map Point on ${activeMap.title}`,
          revealed_to_players: pinIsRevealedInitially,
          data_json: { parent_map_id: activeMap.id },
        });
        targetNodeId = createdLoc.id;
      } catch (err: any) {
        alert('Failed to create location node: ' + err.message);
        return;
      }
    } else if (targetNodeId) {
      const existing = locations.find((l) => l.id === targetNodeId);
      if (!label && existing) {
        label = existing.title;
      }
    }

    if (!label) {
      label = 'Map Pin';
    }

    const newPin: MapPinData = {
      id: `pin-${Date.now()}`,
      nodeId: targetNodeId || `loc-${Date.now()}`,
      x: pendingPinCoords.xPct,
      y: pendingPinCoords.yPct,
      label: label,
      revealed: pinIsRevealedInitially,
      targetMapId: selectedTargetMapForPin || undefined,
    };

    const updatedPins = [...pins, newPin];

    try {
      await updateNode(activeMap.id, {
        data_json: {
          ...(activeMap.data_json || {}),
          pins: updatedPins,
        },
      });
      setIsPlacingPin(false);
      setPendingPinCoords(null);
      setSelectedLocationForPin('');
      setSelectedTargetMapForPin('');
      setCustomPinLabel('');
      onRefresh();
    } catch (err: any) {
      alert('Failed to save pin: ' + err.message);
    }
  };

  const handleTogglePinReveal = async (pin: MapPinData) => {
    if (!activeMap) return;
    const updated = !pin.revealed;
    const updatedPins = pins.map((p) => (p.id === pin.id ? { ...p, revealed: updated } : p));

    try {
      await updateNode(activeMap.id, {
        data_json: {
          ...(activeMap.data_json || {}),
          pins: updatedPins,
        },
      });

      // Also toggle underlying location node if found
      const loc = locations.find((l) => l.id === pin.nodeId);
      if (loc) {
        await updateNode(loc.id, { revealed_to_players: updated });
      }

      if (selectedPin && selectedPin.id === pin.id) {
        setSelectedPin({ ...selectedPin, revealed: updated });
      }

      onRefresh();
    } catch (err: any) {
      console.error('Error updating pin:', err);
    }
  };

  const handleUpdatePinTargetMap = async (pinId: string, targetMapId: string) => {
    if (!activeMap) return;
    const updatedPins = pins.map((p) => (p.id === pinId ? { ...p, targetMapId: targetMapId || undefined } : p));
    try {
      await updateNode(activeMap.id, {
        data_json: {
          ...(activeMap.data_json || {}),
          pins: updatedPins,
        },
      });

      if (selectedPin && selectedPin.id === pinId) {
        setSelectedPin({ ...selectedPin, targetMapId: targetMapId || undefined });
      }

      onRefresh();
    } catch (err: any) {
      console.error('Error updating pin target map:', err);
    }
  };

  const handleDeletePin = async (pinId: string) => {
    if (!activeMap) return;
    const updatedPins = pins.filter((p) => p.id !== pinId);
    try {
      await updateNode(activeMap.id, {
        data_json: {
          ...(activeMap.data_json || {}),
          pins: updatedPins,
        },
      });
      setSelectedPin(null);
      onRefresh();
    } catch (err: any) {
      alert('Failed to remove pin: ' + err.message);
    }
  };

  const handleDeleteMap = async (mapId: string, mapTitle: string) => {
    if (window.confirm(`Delete map "${mapTitle}"?`)) {
      try {
        await deleteNode(mapId);
        setSelectedMapId('');
        onRefresh();
      } catch (err: any) {
        alert('Failed to delete map: ' + err.message);
      }
    }
  };

  const handleStartRenameMap = (mapId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingMapId(mapId);
    setEditMapTitle(currentTitle);
  };

  const handleSaveMapTitle = async (mapId: string, e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newTitle = editMapTitle.trim();
    if (!newTitle) {
      setEditingMapId(null);
      return;
    }
    try {
      await updateNode(mapId, { title: newTitle });
      setEditingMapId(null);
      onRefresh();
    } catch (err: any) {
      alert('Failed to rename map: ' + err.message);
    }
  };

  // --- Multimodal Map Vision Handlers ---
  const handleStartVisionScan = async () => {
    if (!activeMap) return;
    setIsScanningVision(true);
    setVisionStatusMessage('Gemini Multimodal Vision is analyzing map geometry and keyed markers...');
    try {
      const res = await scanMapVision({
        map_id: activeMap.id,
        campaign_id: campaignId,
        instruction: visionInstruction.trim(),
        auto_align_existing: visionAutoAlign,
        create_missing_nodes: visionCreateMissing,
        connect_passages: visionConnectPassages,
        apply_changes: false, // Preview mode
      });
      setVisionResult(res);
      // Select all detected pins by default
      const allPinIds = new Set(res.detected_pins.map((p) => p.id));
      setSelectedVisionPinIds(allPinIds);
      // Select all connections by default
      const allEdgeIndices = new Set(res.suggested_connections.map((_, i) => i));
      setSelectedVisionEdgeIndices(allEdgeIndices);
      setVisionStatusMessage('');
    } catch (err: any) {
      alert('Map Vision Scan failed: ' + (err.message || err));
      setVisionStatusMessage('');
    } finally {
      setIsScanningVision(false);
    }
  };

  const handleApplyVisionResults = async () => {
    if (!activeMap || !visionResult) return;
    setIsApplyingVision(true);
    try {
      const approvedPins = visionResult.detected_pins.filter((p) => selectedVisionPinIds.has(p.id));
      const approvedPinNodeIds = new Set(approvedPins.map((p) => p.nodeId));

      const approvedNodes = (visionResult.new_nodes_to_create || []).filter(
        (n) => approvedPinNodeIds.has(n.temp_id)
      );

      const approvedEdges = (visionResult.suggested_connections || []).filter((_, i) =>
        selectedVisionEdgeIndices.has(i)
      );

      await applyMapScan({
        map_id: activeMap.id,
        campaign_id: campaignId,
        pins: approvedPins,
        new_nodes: approvedNodes,
        new_edges: approvedEdges,
      });

      setShowVisionModal(false);
      setVisionResult(null);
      onRefresh();
    } catch (err: any) {
      alert('Failed to apply map scan: ' + (err.message || err));
    } finally {
      setIsApplyingVision(false);
    }
  };

  return (
    <div style={{ padding: '20px 24px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header & Main Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Compass size={22} style={{ color: 'var(--color-gold)' }} /> Interactive World &amp; Battle Maps
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
            Pan and zoom like Google Maps, drop location pins, and manage player visibility &amp; fog of war.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Active Map Reveal Status Toggle */}
          {activeMap && (
            <button
              onClick={(e) => handleToggleMapReveal(activeMap, e)}
              className="btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.78rem',
                padding: '6px 12px',
                background: activeMap.revealed_to_players ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                borderColor: activeMap.revealed_to_players ? '#10b981' : '#f59e0b',
                color: activeMap.revealed_to_players ? '#10b981' : '#f59e0b',
                fontWeight: 600,
              }}
              title={activeMap.revealed_to_players ? 'Click to hide map from players' : 'Click to reveal map to players'}
            >
              {activeMap.revealed_to_players ? <Eye size={15} /> : <EyeOff size={15} />}
              {activeMap.revealed_to_players ? 'Revealed to Players' : 'DM Secret Map'}
            </button>
          )}

          {/* Pin Drop Mode Button */}
          {activeMap && (
            <button
              onClick={() => {
                didDragRef.current = false;
                setIsPlacingPin(!isPlacingPin);
                setPendingPinCoords(null);
              }}
              className={`btn ${isPlacingPin ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                padding: '6px 12px',
                background: isPlacingPin ? 'var(--color-gold)' : undefined,
                color: isPlacingPin ? '#000' : undefined,
              }}
            >
              <MapPin size={15} /> {isPlacingPin ? 'Cancel Pin Mode' : 'Drop Pin on Map'}
            </button>
          )}

          {/* AI Multimodal Vision Scan Button */}
          {activeMap && mapImage && (
            <button
              onClick={() => {
                setShowVisionModal(true);
                setVisionResult(null);
                setVisionStatusMessage('');
              }}
              className="btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                padding: '6px 13px',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(180, 83, 9, 0.4) 100%)',
                border: '1px solid var(--color-gold)',
                color: 'var(--text-gold)',
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)',
                cursor: 'pointer',
              }}
              title="Use Gemini Multimodal Vision to auto-detect keyed rooms and align pins"
            >
              <Sparkles size={15} style={{ color: 'var(--color-gold)' }} />
              Co-DM Vision Scan
            </button>
          )}

          {/* Upload Map Button */}
          <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px' }}>
            <Upload size={15} /> Upload Map File
            <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* Available Maps Library Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          overflowX: 'auto',
          padding: '8px 12px',
          background: 'var(--bg-surface)',
          borderRadius: '10px',
          border: '1px solid var(--border-medium)',
          marginBottom: '12px',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-gold)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ImageIcon size={15} /> Maps Gallery ({maps.length}):
        </span>

        {maps.length === 0 ? (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            No maps uploaded yet. Click &quot;Upload Map File&quot; above to add your first regional or tactical battle map!
          </span>
        ) : (
          maps.map((m) => {
            const isSelected = activeMap?.id === m.id;
            const pinCount = (m.data_json?.pins || []).length;
            const isRevealed = m.revealed_to_players;

            return (
              <div
                key={m.id}
                onClick={() => handleSelectMap(m.id)}
                className="glass-panel"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: isSelected ? '1px solid var(--color-gold)' : '1px solid var(--border-subtle)',
                  background: isSelected ? 'var(--color-amber-glow)' : 'var(--bg-card)',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {m.data_json?.map_url ? (
                  <img
                    src={m.data_json.map_url}
                    alt={m.title}
                    style={{ width: '26px', height: '26px', borderRadius: '4px', objectFit: 'cover' }}
                  />
                ) : (
                  <Compass size={16} style={{ color: 'var(--color-gold)' }} />
                )}

                {editingMapId === m.id ? (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <input
                      type="text"
                      value={editMapTitle}
                      autoFocus
                      onChange={(e) => setEditMapTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveMapTitle(m.id);
                        if (e.key === 'Escape') setEditingMapId(null);
                      }}
                      style={{
                        padding: '2px 6px',
                        fontSize: '0.8rem',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--color-gold)',
                        borderRadius: '4px',
                        color: '#fff',
                        width: '130px',
                      }}
                    />
                    <button
                      onClick={(e) => handleSaveMapTitle(m.id, e)}
                      style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: '2px' }}
                      title="Save name"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingMapId(null);
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                      title="Cancel"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--text-gold)' : 'var(--text-primary)' }}>
                      {m.title}
                    </span>
                    <button
                      onClick={(e) => handleStartRenameMap(m.id, m.title, e)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px',
                        opacity: 0.7,
                      }}
                      title="Rename map"
                    >
                      <Edit2 size={12} />
                    </button>
                  </div>
                )}

                {/* Player Visibility Tag */}
                <button
                  onClick={(e) => handleToggleMapReveal(m, e)}
                  style={{
                    background: isRevealed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    border: `1px solid ${isRevealed ? '#10b981' : '#64748b'}`,
                    color: isRevealed ? '#10b981' : '#94a3b8',
                    borderRadius: '6px',
                    padding: '2px 5px',
                    fontSize: '0.68rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    cursor: 'pointer',
                  }}
                  title={isRevealed ? 'Revealed to players (click to hide)' : 'DM Secret (click to reveal)'}
                >
                  {isRevealed ? <Eye size={11} /> : <EyeOff size={11} />}
                  {isRevealed ? 'Shared' : 'Secret'}
                </button>

                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    background: 'var(--bg-card-active)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  📍 {pinCount}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteMap(m.id, m.title);
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                  title="Delete map"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Pin Placement Guidance Banner */}
      {isPlacingPin && (
        <div
          style={{
            background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.2) 0%, rgba(245, 158, 11, 0.05) 100%)',
            border: '1px solid var(--color-gold)',
            borderRadius: '8px',
            padding: '8px 16px',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.82rem',
            color: 'var(--text-gold)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={16} />
            <span>
              <strong>Pin Mode Active:</strong> Click anywhere on the map image below to place a persistent location pin! You can pan and zoom freely.
            </span>
          </div>
          <button
            onClick={() => {
              setIsPlacingPin(false);
              setPendingPinCoords(null);
            }}
            className="btn btn-ghost"
            style={{ padding: '2px 8px', fontSize: '0.75rem' }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Main Map Viewport */}
      <div
        ref={mapContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onClick={handleMapClick}
        style={{
          position: 'relative',
          flex: 1,
          minHeight: '460px',
          background: '#090d15',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid var(--border-medium)',
          boxShadow: 'inset 0 0 50px rgba(0,0,0,0.85)',
          cursor: isPlacingPin ? 'crosshair' : isDraggingMap ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
      >
        {mapImage ? (
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: '0 0',
              transition: isDraggingMap ? 'none' : 'transform 0.08s ease-out',
            }}
          >
            <img
              src={mapImage}
              alt={activeMap?.title || 'Campaign Map'}
              draggable={false}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                pointerEvents: 'none',
              }}
            />

            {/* Pins */}
            {pins.map((pin) => {
              const isSelected = selectedPin?.id === pin.id;
              // Dynamic pin scale so pins don't blow up in size when zooming in deep on large maps
              const pinScale = Math.max(0.4, Math.min(1.0, 1.2 / Math.sqrt(scale)));
              const pinHeadColor = pin.revealed
                ? 'radial-gradient(circle at 35% 35%, #6ee7b7 0%, #10b981 50%, #047857 100%)'
                : 'radial-gradient(circle at 35% 35%, #fca5a5 0%, #ef4444 50%, #b91c1c 100%)';
              const pinBorder = isSelected ? '1.5px solid #f59e0b' : '0.75px solid #000';
              const glowColor = pin.revealed ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)';

              return (
                <div
                  key={pin.id}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    // Set dragging pin on drag
                    setDraggingPinId(pin.id);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPin(pin);
                  }}
                  style={{
                    position: 'absolute',
                    left: `${pin.x}%`,
                    top: `${pin.y}%`,
                    transform: `translate(-50%, -100%) scale(${pinScale})`,
                    transformOrigin: 'bottom center',
                    cursor: draggingPinId === pin.id ? 'grabbing' : 'grab',
                    zIndex: isSelected ? 28 : 20,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    transition: draggingPinId === pin.id ? 'none' : 'transform 0.15s ease',
                    padding: '8px 12px 0 12px', // Generous hit box for easy grabbing
                  }}
                  title={`${pin.label} (${pin.revealed ? 'Revealed' : 'DM Secret'})`}
                >
                  {/* Label on TOP of the pin so the map location underneath the tip is unobstructed */}
                  <div
                    style={{
                      background: 'rgba(10, 15, 29, 0.92)',
                      backdropFilter: 'blur(6px)',
                      border: `1px solid ${isSelected ? 'var(--color-gold)' : 'rgba(255,255,255,0.18)'}`,
                      borderRadius: '5px',
                      padding: '2px 7px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: isSelected ? 'var(--text-gold)' : '#f8fafc',
                      whiteSpace: 'nowrap',
                      marginBottom: '3px',
                      boxShadow: '0 3px 10px rgba(0,0,0,0.7)',
                      letterSpacing: '0.02em',
                      pointerEvents: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {pin.targetMapId && <span title="Connected to another map">🗺️</span>}
                    <span>{pin.label}</span>
                    {!pin.revealed && <span style={{ color: '#ef4444' }}>🔒</span>}
                  </div>

                  {/* Stick-Pin Head (Spherical Bead with 3D Specular Highlight) */}
                  <div
                    style={{
                      width: '13px',
                      height: '13px',
                      borderRadius: '50%',
                      background: pinHeadColor,
                      border: pinBorder,
                      boxShadow: isSelected
                        ? `0 0 16px rgba(245, 158, 11, 0.9), 0 3px 8px rgba(0,0,0,0.8)`
                        : `0 0 10px ${glowColor}, 0 2px 6px rgba(0,0,0,0.7)`,
                      position: 'relative',
                      zIndex: 2,
                    }}
                  />

                  {/* Stick-Pin Needle Shaft tapering down directly to the exact map point */}
                  <div
                    style={{
                      width: '2.5px',
                      height: '18px',
                      background: 'linear-gradient(to right, #94a3b8, #f8fafc, #64748b)',
                      boxShadow: '1px 1px 3px rgba(0,0,0,0.75)',
                      borderRadius: '1px 1px 0 0',
                      position: 'relative',
                      zIndex: 1,
                    }}
                  />

                  {/* Sharp needle tip at the contact point */}
                  <div
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: '1.5px solid transparent',
                      borderRight: '1.5px solid transparent',
                      borderTop: '5px solid #cbd5e1',
                      zIndex: 1,
                    }}
                  />
                </div>
              );
            })}

            {/* Temporary Placement Marker (Stick-pin style) */}
            {pendingPinCoords && (
              <div
                style={{
                  position: 'absolute',
                  left: `${pendingPinCoords.xPct}%`,
                  top: `${pendingPinCoords.yPct}%`,
                  transform: 'translate(-50%, -100%)',
                  transformOrigin: 'bottom center',
                  zIndex: 29,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  animation: 'bounce 1s infinite alternate',
                }}
              >
                <div
                  style={{
                    background: 'rgba(10, 15, 29, 0.95)',
                    border: '1px solid var(--color-gold)',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: 'var(--text-gold)',
                    marginBottom: '3px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Drop Here
                </div>
                <div
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle at 35% 35%, #fde047 0%, #f59e0b 50%, #b45309 100%)',
                    border: '0.75px solid #000',
                    boxShadow: '0 0 16px #f59e0b',
                    position: 'relative',
                    zIndex: 2,
                  }}
                />
                <div
                  style={{
                    width: '2.5px',
                    height: '18px',
                    background: 'linear-gradient(to right, #94a3b8, #fff, #64748b)',
                    zIndex: 1,
                  }}
                />
                <div
                  style={{
                    width: 0,
                    height: 0,
                    borderLeft: '1.5px solid transparent',
                    borderRight: '1.5px solid transparent',
                    borderTop: '5px solid #cbd5e1',
                    zIndex: 1,
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              gap: '12px',
            }}
          >
            <ImageIcon size={48} style={{ color: 'var(--color-gold)' }} />
            <h3 style={{ fontSize: '1.2rem', color: '#f8fafc' }}>No Map Selected</h3>
            <p style={{ fontSize: '0.85rem', maxWidth: '400px', textAlign: 'center', color: '#cbd5e1' }}>
              Select a battle map from the gallery above or upload a high-resolution regional handout.
            </p>
            <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
              <Upload size={15} /> Upload Map File
              <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
          </div>
        )}

        {/* Floating Google Maps-Style Controls Widget */}
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            right: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            zIndex: 30,
          }}
        >
          {/* Zoom In Button */}
          <button
            onClick={() => {
              const newScale = Math.min(scale * 1.25, 25.0);
              setScale(newScale);
            }}
            className="btn btn-secondary glass-panel"
            style={{ width: '38px', height: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
            title="Zoom In (+)"
          >
            <ZoomIn size={18} />
          </button>

          {/* Current Zoom Level Pill */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(8px)',
              border: '1px solid var(--border-medium)',
              borderRadius: '6px',
              padding: '2px 4px',
              fontSize: '0.68rem',
              fontWeight: 700,
              color: 'var(--text-gold)',
              textAlign: 'center',
            }}
          >
            {Math.round(scale * 100)}%
          </div>

          {/* Zoom Out Button */}
          <button
            onClick={() => {
              const newScale = Math.max(scale * 0.8, 0.4);
              setScale(newScale);
            }}
            className="btn btn-secondary glass-panel"
            style={{ width: '38px', height: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
            title="Zoom Out (-)"
          >
            <ZoomOut size={18} />
          </button>

          {/* Fit View / Center on Pins */}
          <button
            onClick={handleFitPins}
            className="btn btn-secondary glass-panel"
            style={{ width: '38px', height: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
            title="Fit View & Center on Pins"
          >
            <Target size={18} />
          </button>

          {/* Reset View Button */}
          <button
            onClick={handleResetView}
            className="btn btn-secondary glass-panel"
            style={{ width: '38px', height: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
            title="Reset Pan & Zoom"
          >
            <RotateCcw size={17} />
          </button>
        </div>

        {/* Legend / Pan instruction pill at bottom left */}
        <div
          className="glass-panel"
          style={{
            position: 'absolute',
            bottom: '16px',
            left: '20px',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '0.74rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            zIndex: 15,
            pointerEvents: 'none',
          }}
        >
          <span><strong style={{ color: '#10b981' }}>🟢 Green Pin:</strong> Revealed to Players</span>
          <span><strong style={{ color: '#ef4444' }}>🔴 Red Pin:</strong> DM Secret</span>
          <span>• Drag to Pan • Wheel to Zoom • Double-click to Focus</span>
        </div>

        {/* Quick Pin Creation Modal */}
        {pendingPinCoords && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(5, 8, 15, 0.7)',
              backdropFilter: 'blur(4px)',
              zIndex: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
          >
            <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '420px', borderRadius: '12px', padding: '20px', boxShadow: '0 15px 40px rgba(0,0,0,0.8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={18} style={{ color: 'var(--color-gold)' }} /> Add Location Pin
                </h3>
                <button
                  onClick={() => setPendingPinCoords(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Option A: Select Existing Campaign Location */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Attach to Existing Location Node:
                </label>
                <select
                  value={selectedLocationForPin}
                  onChange={(e) => {
                    setSelectedLocationForPin(e.target.value);
                    const loc = locations.find((l) => l.id === e.target.value);
                    if (loc) setCustomPinLabel(loc.title);
                  }}
                  style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.82rem' }}
                >
                  <option value="">-- Create New / Custom Name --</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Option B: Custom Name / New Location */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Pin Label / Landmark Name:
                </label>
                <input
                  type="text"
                  placeholder="e.g., Hidden Treasury, Goblin Watchtower..."
                  value={customPinLabel}
                  onChange={(e) => setCustomPinLabel(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                />
              </div>

              {/* Option C: Link to Sub-Map / Tactical Battle Map */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-gold)', marginBottom: '4px' }}>
                  🗺️ Launch Map on Click (Optional):
                </label>
                <select
                  value={selectedTargetMapForPin}
                  onChange={(e) => setSelectedTargetMapForPin(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.82rem' }}
                >
                  <option value="">-- No Linked Map --</option>
                  {maps
                    .filter((m) => m.id !== activeMap?.id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                </select>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '3px' }}>
                  Clicking this pin in the viewer will allow fast travel / drilling down directly into this map!
                </span>
              </div>

              {/* Initial Player Visibility */}
              <div style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="pinRevealCheck"
                  checked={pinIsRevealedInitially}
                  onChange={(e) => setPinIsRevealedInitially(e.target.checked)}
                  style={{ accentColor: '#10b981', width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="pinRevealCheck" style={{ fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Reveal this pin to players immediately
                </label>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setPendingPinCoords(null)}
                  className="btn btn-ghost"
                  style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDropPin}
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Check size={15} /> Save Pin to Map
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Multimodal Map Vision & Pin Alignment Modal */}
        {showVisionModal && activeMap && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(5, 8, 15, 0.82)',
              backdropFilter: 'blur(8px)',
              zIndex: 45,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
            }}
          >
            <div
              className="glass-panel animate-fade-in"
              style={{
                width: '100%',
                maxWidth: visionResult ? '920px' : '580px',
                maxHeight: '90vh',
                borderRadius: '14px',
                padding: '24px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.9), 0 0 25px rgba(245, 158, 11, 0.15)',
                border: '1px solid var(--border-gold)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                background: 'linear-gradient(180deg, #131b2e 0%, #0c1120 100%)',
              }}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexShrink: 0 }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={20} style={{ color: 'var(--color-gold)' }} /> Multimodal Map Vision &amp; Pin Alignment
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                    Scanning: <strong style={{ color: 'var(--text-gold)' }}>{activeMap.title}</strong>
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowVisionModal(false);
                    setVisionResult(null);
                  }}
                  className="btn btn-ghost"
                  style={{ padding: '6px' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Status banner if analyzing */}
              {isScanningVision && (
                <div
                  style={{
                    padding: '28px 20px',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '50%',
                      border: '3px solid rgba(245, 158, 11, 0.2)',
                      borderTopColor: 'var(--color-gold)',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-gold)' }}>
                    Arcane Vision Scanning Map Geometry...
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '420px' }}>
                    Gemini Multimodal Vision is parsing room numbers, boundary chambers, and corridors. Matching against existing campaign entities...
                  </div>
                </div>
              )}

              {/* Mode A: Pre-Scan Configuration */}
              {!isScanningVision && !visionResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', paddingRight: '4px' }}>
                  <div
                    style={{
                      background: 'rgba(15, 23, 42, 0.65)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                      lineHeight: '1.45',
                    }}
                  >
                    AI vision will inspect your map image, pinpoint keyed room markers (1, 2, 3...), calculate exact (x, y) coordinates, cross-reference existing campaign locations without duplicating entries, and link corridor paths.
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Custom Directive (Optional):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Focus on dungeon areas 1-15, match with goblin encounters..."
                      value={visionInstruction}
                      onChange={(e) => setVisionInstruction(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: '6px',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Alignment &amp; Generation Options:
                    </label>

                    {/* Option 1 */}
                    <div
                      onClick={() => setVisionAutoAlign(!visionAutoAlign)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 14px',
                        background: visionAutoAlign ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${visionAutoAlign ? '#10b981' : 'var(--border-subtle)'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={visionAutoAlign}
                        onChange={() => {}}
                        style={{ accentColor: '#10b981', width: '16px', height: '16px' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc' }}>
                          Auto-Align with Existing Campaign Entities
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          Matches detected numbers &amp; room names against current campaign Locations and Encounters to avoid duplicate nodes.
                        </div>
                      </div>
                    </div>

                    {/* Option 2 */}
                    <div
                      onClick={() => setVisionCreateMissing(!visionCreateMissing)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 14px',
                        background: visionCreateMissing ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${visionCreateMissing ? 'var(--color-gold)' : 'var(--border-subtle)'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={visionCreateMissing}
                        onChange={() => {}}
                        style={{ accentColor: 'var(--color-gold)', width: '16px', height: '16px' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc' }}>
                          Draft Location Nodes for Unindexed Rooms
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          Creates provisional Draft locations (<span style={{ color: 'var(--text-gold)' }}>is_canon=false</span>) for newly discovered rooms with parent hierarchy.
                        </div>
                      </div>
                    </div>

                    {/* Option 3 */}
                    <div
                      onClick={() => setVisionConnectPassages(!visionConnectPassages)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 14px',
                        background: visionConnectPassages ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${visionConnectPassages ? '#3b82f6' : 'var(--border-subtle)'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={visionConnectPassages}
                        onChange={() => {}}
                        style={{ accentColor: '#3b82f6', width: '16px', height: '16px' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc' }}>
                          Auto-Connect Passageways &amp; Corridors (leads_to)
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          Traces hallways, doors, and stairs between adjacent chambers to wire graph edges.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                    <button
                      onClick={() => setShowVisionModal(false)}
                      className="btn btn-ghost"
                      style={{ fontSize: '0.82rem', padding: '7px 16px' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleStartVisionScan}
                      className="btn btn-primary"
                      style={{
                        fontSize: '0.84rem',
                        padding: '7px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
                        boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
                      }}
                    >
                      <Sparkles size={16} /> Start Vision Analysis
                    </button>
                  </div>
                </div>
              )}

              {/* Mode B: Scan Results Preview & Selective Confirmation */}
              {!isScanningVision && visionResult && (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: '14px' }}>
                  {/* Results Summary Bar */}
                  <div
                    style={{
                      background: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid var(--border-gold)',
                      borderRadius: '8px',
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.78rem',
                      color: 'var(--text-primary)',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <span><strong>📍 Total Pins:</strong> {visionResult.detected_pins.length}</span>
                      <span style={{ color: '#10b981' }}><strong>🟢 Matched Existing:</strong> {visionResult.matched_existing_nodes.length}</span>
                      <span style={{ color: 'var(--text-gold)' }}><strong>📝 New Draft Rooms:</strong> {visionResult.new_nodes_to_create.length}</span>
                      <span style={{ color: '#60a5fa' }}><strong>🚪 Passages:</strong> {visionResult.suggested_connections.length}</span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      {selectedVisionPinIds.size} pins selected
                    </span>
                  </div>

                  {/* Split Layout: Map Thumbnail Overlay vs Pin List */}
                  <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
                    {/* Visual Overlay Map Column */}
                    <div
                      style={{
                        width: '340px',
                        height: '100%',
                        background: '#070b14',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        position: 'relative',
                        border: '1px solid var(--border-medium)',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <img
                        src={mapImage}
                        alt="Scan Preview"
                        style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
                      />
                      {/* Render preview pins on thumbnail */}
                      {visionResult.detected_pins.map((p) => {
                        const isSelected = selectedVisionPinIds.has(p.id);
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              const next = new Set(selectedVisionPinIds);
                              if (next.has(p.id)) next.delete(p.id);
                              else next.add(p.id);
                              setSelectedVisionPinIds(next);
                            }}
                            style={{
                              position: 'absolute',
                              left: `${p.x}%`,
                              top: `${p.y}%`,
                              transform: 'translate(-50%, -50%)',
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              background: isSelected
                                ? p.is_new
                                  ? '#f59e0b'
                                  : '#10b981'
                                : '#475569',
                              border: '1.5px solid #000',
                              boxShadow: isSelected
                                ? p.is_new
                                  ? '0 0 8px #f59e0b'
                                  : '0 0 8px #10b981'
                                : 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              color: '#000',
                              cursor: 'pointer',
                              zIndex: 10,
                            }}
                            title={`${p.label} (${p.x}%, ${p.y}%)`}
                          >
                            {p.room_number || '•'}
                          </div>
                        );
                      })}
                    </div>

                    {/* Pin and Connections Checklist Column */}
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', paddingRight: '4px' }}>
                      {/* Pins Header */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Keyed Room Pins ({visionResult.detected_pins.length}):
                          </span>
                          <button
                            onClick={() => {
                              if (selectedVisionPinIds.size === visionResult.detected_pins.length) {
                                setSelectedVisionPinIds(new Set());
                              } else {
                                setSelectedVisionPinIds(new Set(visionResult.detected_pins.map((p) => p.id)));
                              }
                            }}
                            className="btn btn-ghost"
                            style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                          >
                            {selectedVisionPinIds.size === visionResult.detected_pins.length ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {visionResult.detected_pins.map((pin) => {
                            const isSelected = selectedVisionPinIds.has(pin.id);
                            return (
                              <div
                                key={pin.id}
                                onClick={() => {
                                  const next = new Set(selectedVisionPinIds);
                                  if (next.has(pin.id)) next.delete(pin.id);
                                  else next.add(pin.id);
                                  setSelectedVisionPinIds(next);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '7px 10px',
                                  background: isSelected ? 'var(--bg-card-active)' : 'var(--bg-surface)',
                                  border: `1px solid ${isSelected ? (pin.is_new ? 'var(--border-gold)' : 'rgba(16, 185, 129, 0.4)') : 'var(--border-subtle)'}`,
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  style={{
                                    accentColor: pin.is_new ? 'var(--color-gold)' : '#10b981',
                                    width: '15px',
                                    height: '15px',
                                  }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {pin.label}
                                    </span>
                                    {pin.is_new ? (
                                      <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.2)', color: 'var(--text-gold)', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                                        New Draft Room 📝
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                                        Matched Existing 🔒
                                      </span>
                                    )}
                                  </div>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                    Coords: ({pin.x}%, {pin.y}%) {pin.room_number ? `• Room ${pin.room_number}` : ''}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Passages Section */}
                      {visionResult.suggested_connections.length > 0 && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              🚪 Corridor Connections ({visionResult.suggested_connections.length}):
                            </span>
                            <button
                              onClick={() => {
                                if (selectedVisionEdgeIndices.size === visionResult.suggested_connections.length) {
                                  setSelectedVisionEdgeIndices(new Set());
                                } else {
                                  setSelectedVisionEdgeIndices(new Set(visionResult.suggested_connections.map((_, i) => i)));
                                }
                              }}
                              className="btn btn-ghost"
                              style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                            >
                              {selectedVisionEdgeIndices.size === visionResult.suggested_connections.length ? 'Deselect All' : 'Select All'}
                            </button>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {visionResult.suggested_connections.map((conn, idx) => {
                              const isChecked = selectedVisionEdgeIndices.has(idx);
                              return (
                                <div
                                  key={idx}
                                  onClick={() => {
                                    const next = new Set(selectedVisionEdgeIndices);
                                    if (next.has(idx)) next.delete(idx);
                                    else next.add(idx);
                                    setSelectedVisionEdgeIndices(next);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '5px 10px',
                                    background: isChecked ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-surface)',
                                    border: `1px solid ${isChecked ? 'rgba(59, 130, 246, 0.4)' : 'var(--border-subtle)'}`,
                                    borderRadius: '5px',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    color: '#cbd5e1',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {}}
                                    style={{ accentColor: '#3b82f6' }}
                                  />
                                  <span>{conn.source_title || 'Room'}</span>
                                  <ArrowRight size={13} style={{ color: '#60a5fa' }} />
                                  <span>{conn.target_title || 'Room'}</span>
                                  {conn.label && <span style={{ color: 'var(--text-muted)' }}>({conn.label})</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                    <button
                      onClick={() => setVisionResult(null)}
                      className="btn btn-ghost"
                      style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                    >
                      ← Reconfigure Scan
                    </button>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => {
                          setShowVisionModal(false);
                          setVisionResult(null);
                        }}
                        className="btn btn-ghost"
                        style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleApplyVisionResults}
                        disabled={isApplyingVision || selectedVisionPinIds.size === 0}
                        className="btn btn-primary"
                        style={{
                          fontSize: '0.82rem',
                          padding: '7px 18px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                          boxShadow: '0 2px 10px rgba(16, 185, 129, 0.35)',
                        }}
                      >
                        {isApplyingVision ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                        {isApplyingVision ? 'Saving to Map...' : `Apply ${selectedVisionPinIds.size} Pins to Map`}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Selected Pin Info Drawer / Floating Detail Card */}
        {selectedPin && !pendingPinCoords && (
          <div
            className="glass-panel animate-fade-in"
            style={{
              position: 'absolute',
              bottom: '20px',
              left: '20px',
              width: '320px',
              borderRadius: '10px',
              padding: '16px',
              zIndex: 30,
              boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
              border: '1px solid var(--border-medium)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="badge badge-location">Map Pin</span>
              <button
                onClick={() => setSelectedPin(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <h4 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '4px' }}>{selectedPin.label}</h4>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
              Coords: {selectedPin.x}%, {selectedPin.y}% • Drag pin to reposition
            </div>

            {/* Launch Linked Map (Fast travel) */}
            {selectedPin.targetMapId && (
              <div style={{ marginBottom: '10px' }}>
                <button
                  onClick={() => {
                    const targetId = selectedPin.targetMapId;
                    setSelectedPin(null);
                    if (targetId) handleSelectMap(targetId);
                  }}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
                    boxShadow: '0 2px 10px rgba(245, 158, 11, 0.4)',
                  }}
                >
                  <Compass size={16} />
                  <span>
                    Open {maps.find((m) => m.id === selectedPin.targetMapId)?.title || 'Connected Map'}
                  </span>
                </button>
              </div>
            )}

            {/* Connect / Change Target Map */}
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>
                🗺️ Connected Map:
              </label>
              <select
                value={selectedPin.targetMapId || ''}
                onChange={(e) => handleUpdatePinTargetMap(selectedPin.id, e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px 8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '5px',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                }}
              >
                <option value="">-- None (No Map Linked) --</option>
                {maps
                  .filter((m) => m.id !== activeMap?.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
              <button
                onClick={() => handleTogglePinReveal(selectedPin)}
                className="btn btn-secondary"
                style={{
                  flex: 1,
                  fontSize: '0.75rem',
                  padding: '6px',
                  borderColor: selectedPin.revealed ? '#10b981' : '#ef4444',
                  color: selectedPin.revealed ? '#10b981' : '#ef4444',
                }}
              >
                {selectedPin.revealed ? <Eye size={14} /> : <EyeOff size={14} />}
                {selectedPin.revealed ? 'Revealed to Players' : 'DM Secret'}
              </button>
              <button
                onClick={() => handleDeletePin(selectedPin.id)}
                className="btn btn-ghost"
                style={{ padding: '6px', color: 'var(--color-crimson)' }}
                title="Remove Pin"
              >
                <Trash2 size={15} />
              </button>
              <button
                onClick={() => {
                  const loc = locations.find((l) => l.id === selectedPin.nodeId);
                  if (loc) onSelectNode(loc);
                }}
                className="btn btn-secondary"
                style={{ padding: '6px 8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}
                title="Open Location Entity Drawer"
              >
                <ExternalLink size={14} />
              </button>
              <button
                onClick={() => {
                  const loc = locations.find((l) => l.id === selectedPin.nodeId);
                  if (loc) onFocusCoDM(loc);
                }}
                className="btn btn-primary"
                style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                title="Brainstorm Boxed Text with Co-DM"
              >
                <Sparkles size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
