import React, { useEffect, useRef, useState } from 'react';
import {
  Compass,
  Eye,
  EyeOff,
  Image as ImageIcon,
  MapPin,
  Maximize2,
  Minimize2,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { createNode, deleteNode, updateNode, uploadFile } from '../api';
import { NodeItem } from '../types';

interface MapStudioProps {
  locations: NodeItem[];
  maps: NodeItem[];
  campaignId: string;
  onRefresh: () => void;
  onSelectNode: (node: NodeItem) => void;
  onFocusCoDM: (node: NodeItem) => void;
}

interface MapPinData {
  id: string;
  nodeId: string;
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  label: string;
  revealed: boolean;
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

  // Pin placement mode
  const [isPlacingPin, setIsPlacingPin] = useState(false);
  const [selectedLocationForPin, setSelectedLocationForPin] = useState<string>('');

  // Zoom & Pan
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-select first map if none selected
  useEffect(() => {
    if (maps.length > 0 && (!selectedMapId || !maps.some((m) => m.id === selectedMapId))) {
      setSelectedMapId(maps[0].id);
    }
  }, [maps, selectedMapId]);

  const activeMap = maps.find((m) => m.id === selectedMapId) || maps[0] || null;
  const mapImage = activeMap?.data_json?.map_url || '';
  const pins: MapPinData[] = activeMap?.data_json?.pins || [];

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
      setSelectedMapId(created.id);
    } catch (err: any) {
      alert('Failed to upload and save map: ' + err.message);
    }
  };

  const handleMapClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPlacingPin || !selectedLocationForPin || !activeMap) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    const loc = locations.find((l) => l.id === selectedLocationForPin);
    const newPin: MapPinData = {
      id: `pin-${Date.now()}`,
      nodeId: selectedLocationForPin,
      x: Number(xPct.toFixed(2)),
      y: Number(yPct.toFixed(2)),
      label: loc?.title || 'Location Pin',
      revealed: loc?.revealed_to_players || false,
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
      setSelectedLocationForPin('');
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

      // Also toggle underlying node if found
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

  return (
    <div style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto' }}>
      {/* Header & Main Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Compass size={22} style={{ color: 'var(--color-gold)' }} /> Interactive World &amp; Battle Maps
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Upload tactical dungeon grids or regional maps, place persistent location pins, and manage player fog-of-war.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Upload size={15} /> Upload New Map Image
            <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>

          {/* Place Pin Dropdown */}
          {activeMap && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--bg-surface)',
                padding: '4px 8px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <select
                value={selectedLocationForPin}
                onChange={(e) => {
                  setSelectedLocationForPin(e.target.value);
                  setIsPlacingPin(Boolean(e.target.value));
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none' }}
              >
                <option value="" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Place Pin on Map...</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                    {loc.title}
                  </option>
                ))}
              </select>
              {isPlacingPin && (
                <span style={{ fontSize: '0.72rem', color: 'var(--color-gold)', fontWeight: 600 }}>
                  Click map to drop!
                </span>
              )}
            </div>
          )}

          <button onClick={() => setScale((s) => Math.min(s + 0.2, 2.5))} className="btn btn-ghost" title="Zoom In">
            <Maximize2 size={16} />
          </button>
          <button onClick={() => setScale((s) => Math.max(s - 0.2, 0.5))} className="btn btn-ghost" title="Zoom Out">
            <Minimize2 size={16} />
          </button>
          <button onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }} className="btn btn-ghost" title="Reset View">
            <RotateCcw size={16} />
          </button>
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
          marginBottom: '16px',
        }}
      >
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-gold)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ImageIcon size={15} /> Campaign Maps ({maps.length}):
        </span>

        {maps.length === 0 ? (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            No maps uploaded yet. Click &quot;Upload New Map Image&quot; above to add your first battle map!
          </span>
        ) : (
          maps.map((m) => {
            const isSelected = (activeMap?.id === m.id);
            const pinCount = (m.data_json?.pins || []).length;
            return (
              <div
                key={m.id}
                onClick={() => {
                  setSelectedMapId(m.id);
                  setSelectedPin(null);
                }}
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
                    style={{ width: '24px', height: '24px', borderRadius: '4px', objectFit: 'cover' }}
                  />
                ) : (
                  <Compass size={16} style={{ color: 'var(--color-gold)' }} />
                )}
                <span style={{ fontSize: '0.82rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--text-gold)' : 'var(--text-primary)' }}>
                  {m.title}
                </span>
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

      {/* Map Canvas Area */}
      <div
        ref={mapContainerRef}
        style={{
          position: 'relative',
          width: '100%',
          height: 'calc(100vh - 230px)',
          background: '#090d15',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid var(--border-medium)',
          boxShadow: 'inset 0 0 40px rgba(0,0,0,0.8)',
          cursor: isPlacingPin ? 'crosshair' : 'default',
        }}
        onClick={handleMapClick}
      >
        {mapImage ? (
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              transform: `scale(${scale}) translate(${pan.x}px, ${pan.y}px)`,
              transformOrigin: '0 0',
              transition: 'transform 0.1s ease-out',
            }}
          >
            <img
              src={mapImage}
              alt={activeMap?.title || 'Campaign Map'}
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
              return (
                <div
                  key={pin.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPin(pin);
                    const loc = locations.find((l) => l.id === pin.nodeId);
                    if (loc) onSelectNode(loc);
                  }}
                  style={{
                    position: 'absolute',
                    left: `${pin.x}%`,
                    top: `${pin.y}%`,
                    transform: 'translate(-50%, -100%)',
                    cursor: 'pointer',
                    zIndex: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50% 50% 50% 0',
                      transform: 'rotate(-45deg)',
                      background: pin.revealed
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isSelected
                        ? '0 0 15px rgba(245, 158, 11, 0.8)'
                        : '0 3px 10px rgba(0,0,0,0.6)',
                      border: '2px solid #fff',
                    }}
                  >
                    <MapPin size={16} color="#fff" style={{ transform: 'rotate(45deg)' }} />
                  </div>
                  <div
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      marginTop: '4px',
                    }}
                  >
                    {pin.label}
                  </div>
                </div>
              );
            })}
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
              Select an available map from the gallery above, or upload any battle map or regional map.
            </p>
            <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
              <Upload size={15} /> Upload Map File
              <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
          </div>
        )}

        {/* Selected Pin Info Drawer / Floating Badge */}
        {selectedPin && (
          <div
            className="glass-panel animate-fade-in"
            style={{
              position: 'absolute',
              bottom: '20px',
              right: '20px',
              width: '320px',
              borderRadius: '10px',
              padding: '16px',
              zIndex: 30,
              boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
              border: '1px solid var(--border-medium)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="badge badge-location">Location Pin</span>
              <button
                onClick={() => setSelectedPin(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '4px' }}>{selectedPin.label}</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
              <button
                onClick={() => handleTogglePinReveal(selectedPin)}
                className="btn btn-secondary"
                style={{ flex: 1, fontSize: '0.75rem', padding: '6px' }}
              >
                {selectedPin.revealed ? <Eye size={14} /> : <EyeOff size={14} />}
                {selectedPin.revealed ? 'Revealed' : 'DM Secret'}
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
