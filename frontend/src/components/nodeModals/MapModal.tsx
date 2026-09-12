import React from 'react';
import { Compass, Image, Layers, ExternalLink } from 'lucide-react';
import { NodeItem } from '../../types';

interface MapModalProps {
  node: NodeItem;
  dataJson: Record<string, any>;
  onChangeDataJson: (updated: Record<string, any>) => void;
}

const MAP_SCALES = [
  'Tactical Battlemap (5ft grid)',
  'Dungeon Level Floorplan',
  'Settlement / City Map',
  'Regional Province Map',
  'Continental World Map',
];

export const MapModal: React.FC<MapModalProps> = ({ dataJson, onChangeDataJson }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div
        style={{
          padding: '14px',
          borderRadius: '10px',
          background: 'rgba(99, 102, 241, 0.05)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#818cf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Compass size={15} /> Map Metadata &amp; Scale
        </span>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Map Scale / Grid
            </label>
            <select
              value={dataJson.map_scale || 'Dungeon Level Floorplan'}
              onChange={(e) => onChangeDataJson({ ...dataJson, map_scale: e.target.value })}
              className="input"
              style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
            >
              {MAP_SCALES.map((ms) => (
                <option key={ms} value={ms}>
                  {ms}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Image URL / File Path
            </label>
            <input
              type="text"
              placeholder="e.g. /data/uploads/sunless_citadel_map.png"
              value={dataJson.map_url || dataJson.image_url || ''}
              onChange={(e) => onChangeDataJson({ ...dataJson, map_url: e.target.value })}
              className="input"
              style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
            />
          </div>
        </div>

        {(dataJson.map_url || dataJson.image_url) && (
          <div style={{ marginTop: '6px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-subtle)', maxHeight: '160px' }}>
            <img
              src={dataJson.map_url || dataJson.image_url}
              alt="Map Preview"
              style={{ width: '100%', height: '160px', objectFit: 'cover' }}
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </div>
        )}
      </div>
    </div>
  );
};
