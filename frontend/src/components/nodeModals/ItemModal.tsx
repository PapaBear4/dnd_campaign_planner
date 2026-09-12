import React from 'react';
import { Box, Sparkles, Shield, Tag, Coins } from 'lucide-react';
import { NodeItem } from '../../types';

interface ItemModalProps {
  node: NodeItem;
  dataJson: Record<string, any>;
  onChangeDataJson: (updated: Record<string, any>) => void;
}

const RARITIES = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'];
const ITEM_CATEGORIES = [
  'Weapon',
  'Armor / Shield',
  'Wondrous Item',
  'Ring',
  'Potion / Consumable',
  'Scroll',
  'Wand / Rod / Staff',
  'Adventuring Gear',
  'Treasure / Trade Good',
];

export const ItemModal: React.FC<ItemModalProps> = ({ dataJson, onChangeDataJson }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div
        style={{
          padding: '14px',
          borderRadius: '10px',
          background: 'rgba(249, 115, 22, 0.05)',
          border: '1px solid rgba(249, 115, 22, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fb923c', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Box size={15} /> Item Classification &amp; Rarity
        </span>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Rarity
            </label>
            <select
              value={dataJson.rarity || 'Uncommon'}
              onChange={(e) => onChangeDataJson({ ...dataJson, rarity: e.target.value })}
              className="input"
              style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
            >
              {RARITIES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Category
            </label>
            <select
              value={dataJson.category || 'Wondrous Item'}
              onChange={(e) => onChangeDataJson({ ...dataJson, category: e.target.value })}
              className="input"
              style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
            >
              {ITEM_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Requires Attunement?
            </label>
            <select
              value={dataJson.requires_attunement ? 'yes' : 'no'}
              onChange={(e) => onChangeDataJson({ ...dataJson, requires_attunement: e.target.value === 'yes' })}
              className="input"
              style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
            >
              <option value="no">No Attunement Required</option>
              <option value="yes">Requires Attunement</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Value / Cost (GP)
            </label>
            <input
              type="text"
              placeholder="e.g. 500 gp"
              value={dataJson.value_gp || ''}
              onChange={(e) => onChangeDataJson({ ...dataJson, value_gp: e.target.value })}
              className="input"
              style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
