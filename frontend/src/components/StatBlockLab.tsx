import React, { useState } from 'react';
import {
  Flame,
  Plus,
  Save,
  Shield,
  Sparkles,
  Swords,
  Trash2,
  Users,
  Wand2,
  Zap,
} from 'lucide-react';
import { createNode, updateNode } from '../api';
import { NodeItem } from '../types';

interface StatBlockLabProps {
  monsters: NodeItem[];
  campaignId: string;
  onRefresh: () => void;
  onFocusCoDM: (node: NodeItem) => void;
}

// 5e XP Thresholds per character (Dungeon Master's Guide p. 82)
const XP_THRESHOLDS: Record<number, { easy: number; medium: number; hard: number; deadly: number }> = {
  1: { easy: 25, medium: 50, hard: 75, deadly: 100 },
  2: { easy: 50, medium: 100, hard: 150, deadly: 200 },
  3: { easy: 75, medium: 150, hard: 225, deadly: 400 },
  4: { easy: 125, medium: 250, hard: 375, deadly: 500 },
  5: { easy: 250, medium: 500, hard: 750, deadly: 1100 },
  6: { easy: 300, medium: 600, hard: 900, deadly: 1400 },
  7: { easy: 350, medium: 750, hard: 1100, deadly: 1700 },
  8: { easy: 450, medium: 900, hard: 1400, deadly: 2100 },
  9: { easy: 550, medium: 1100, hard: 1600, deadly: 2400 },
  10: { easy: 600, medium: 1200, hard: 1900, deadly: 2800 },
};

const CR_XP_MAP: Record<string, number> = {
  '0': 10,
  '1/8': 25,
  '1/4': 50,
  '1/2': 100,
  '1': 200,
  '2': 450,
  '3': 700,
  '4': 1100,
  '5': 1800,
  '6': 2300,
  '7': 2900,
  '8': 3900,
  '9': 5000,
  '10': 5900,
};

function getModifier(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export const StatBlockLab: React.FC<StatBlockLabProps> = ({
  monsters,
  campaignId,
  onRefresh,
  onFocusCoDM,
}) => {
  const [selectedMonsterId, setSelectedMonsterId] = useState<string>(
    monsters[0]?.id || ''
  );

  // Encounter Calculator state
  const [partySize, setPartySize] = useState(4);
  const [partyLevel, setPartyLevel] = useState(2);
  const [encounterRoster, setEncounterRoster] = useState<{ monsterId: string; count: number }[]>([]);

  // Selected Monster state
  const monster = monsters.find((m) => m.id === selectedMonsterId) || monsters[0];

  // Editable fields for selected monster
  const [mTitle, setMTitle] = useState(monster?.title || '');
  const [mSubtitle, setMSubtitle] = useState(monster?.subtitle || 'Medium Aberration, Neutral Evil');
  const [mCr, setMCr] = useState(monster?.data_json?.cr || '1');
  const [mAc, setMAc] = useState(monster?.data_json?.ac || 13);
  const [mHp, setMHp] = useState(monster?.data_json?.hp || 22);
  const [mSpeed, setMSpeed] = useState(monster?.data_json?.speed || '30 ft.');
  const [mAbilities, setMAbilities] = useState(
    monster?.data_json?.abilities || { str: 10, dex: 12, con: 12, int: 10, wis: 10, cha: 10 }
  );
  const [mContent, setMContent] = useState(monster?.content_markdown || '');

  // Update form fields when selected monster changes
  React.useEffect(() => {
    if (monster) {
      setMTitle(monster.title);
      setMSubtitle(monster.subtitle || '');
      setMCr(monster.data_json?.cr || '1');
      setMAc(monster.data_json?.ac || 13);
      setMHp(monster.data_json?.hp || 22);
      setMSpeed(monster.data_json?.speed || '30 ft.');
      setMAbilities(monster.data_json?.abilities || { str: 10, dex: 12, con: 12, int: 10, wis: 10, cha: 10 });
      setMContent(monster.content_markdown || '');
    }
  }, [monster?.id]);

  const handleSaveMonster = async () => {
    if (!monster) return;
    try {
      const data = {
        ...(monster.data_json || {}),
        cr: mCr,
        xp: CR_XP_MAP[mCr] || 200,
        ac: Number(mAc),
        hp: Number(mHp),
        speed: mSpeed,
        abilities: mAbilities,
      };
      await updateNode(monster.id, {
        title: mTitle,
        subtitle: mSubtitle,
        content_markdown: mContent,
        data_json: data,
      });
      alert('Stat block saved successfully!');
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateNewMonster = async () => {
    try {
      const created = await createNode({
        campaign_id: campaignId,
        type: 'monster',
        title: 'New Homebrew Creature',
        subtitle: 'Medium Beast, Unaligned',
        content_markdown: '### Actions\n- **Multiattack**: Makes two claw attacks.\n- **Claw**: +4 to hit, 1d6+2 slashing damage.',
        data_json: {
          cr: '1',
          xp: 200,
          ac: 12,
          hp: 18,
          speed: '30 ft.',
          abilities: { str: 14, dex: 12, con: 12, int: 3, wis: 12, cha: 6 },
        },
        revealed_to_players: false,
      });
      onRefresh();
      setSelectedMonsterId(created.id);
    } catch (err) {
      console.error(err);
    }
  };

  // Encounter Math
  const thresholds = XP_THRESHOLDS[partyLevel] || XP_THRESHOLDS[1];
  const partyEasy = thresholds.easy * partySize;
  const partyMedium = thresholds.medium * partySize;
  const partyHard = thresholds.hard * partySize;
  const partyDeadly = thresholds.deadly * partySize;

  let totalRawXp = 0;
  let totalMonsters = 0;
  for (const item of encounterRoster) {
    const mon = monsters.find((m) => m.id === item.monsterId);
    const cr = mon?.data_json?.cr || '1';
    const xp = CR_XP_MAP[cr] || 200;
    totalRawXp += xp * item.count;
    totalMonsters += item.count;
  }

  // 5e Multiplier based on number of monsters
  let multiplier = 1;
  if (totalMonsters === 2) multiplier = 1.5;
  else if (totalMonsters >= 3 && totalMonsters <= 6) multiplier = 2;
  else if (totalMonsters >= 7 && totalMonsters <= 10) multiplier = 2.5;
  else if (totalMonsters > 10) multiplier = 3;

  const adjustedXp = Math.round(totalRawXp * multiplier);

  let difficultyRating = 'Trivial';
  let diffColor = '#94a3b8';
  if (adjustedXp >= partyDeadly) {
    difficultyRating = 'DEADLY';
    diffColor = '#ef4444';
  } else if (adjustedXp >= partyHard) {
    difficultyRating = 'Hard';
    diffColor = '#f97316';
  } else if (adjustedXp >= partyMedium) {
    difficultyRating = 'Medium';
    diffColor = '#eab308';
  } else if (adjustedXp >= partyEasy) {
    difficultyRating = 'Easy';
    diffColor = '#10b981';
  }

  const addToEncounter = (mId: string) => {
    setEncounterRoster((prev) => {
      const exist = prev.find((x) => x.monsterId === mId);
      if (exist) {
        return prev.map((x) => (x.monsterId === mId ? { ...x, count: x.count + 1 } : x));
      }
      return [...prev, { monsterId: mId, count: 1 }];
    });
  };

  const removeFromEncounter = (mId: string) => {
    setEncounterRoster((prev) =>
      prev
        .map((x) => (x.monsterId === mId ? { ...x, count: x.count - 1 } : x))
        .filter((x) => x.count > 0)
    );
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto', display: 'grid', gridTemplateColumns: '280px 1fr 340px', gap: '20px' }}>
      {/* Col 1: Monster Library */}
      <div className="glass-panel" style={{ borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Swords size={18} style={{ color: 'var(--color-crimson)' }} /> Monster Bestiary
          </h3>
          <button onClick={handleCreateNewMonster} className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
            <Plus size={13} /> New
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {monsters.map((m) => (
            <div
              key={m.id}
              onClick={() => setSelectedMonsterId(m.id)}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: selectedMonsterId === m.id ? 'var(--bg-card-active)' : 'var(--bg-surface)',
                border: `1px solid ${selectedMonsterId === m.id ? 'var(--color-gold)' : 'var(--border-subtle)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.86rem', color: '#fff' }}>{m.title}</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>CR {m.data_json?.cr || '1'} • {m.subtitle || 'Monster'}</div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addToEncounter(m.id);
                }}
                className="btn btn-secondary"
                style={{ padding: '3px 7px', fontSize: '0.7rem' }}
                title="Add to Encounter Roster"
              >
                + Fight
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Col 2: 5e Stat Block Inspector & Homebrew Editor */}
      <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 120px)', paddingRight: '8px' }}>
        {monster ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSaveMonster} className="btn btn-primary">
                  <Save size={15} /> Save Monster Changes
                </button>
                <button onClick={() => onFocusCoDM(monster)} className="btn btn-secondary">
                  <Sparkles size={15} /> Modify with Co-DM
                </button>
              </div>
            </div>

            {/* Authentic 5e Monster Card */}
            <div className="statblock-5e animate-fade-in">
              <div className="statblock-header">
                <input
                  type="text"
                  value={mTitle}
                  onChange={(e) => setMTitle(e.target.value)}
                  style={{
                    fontFamily: 'Cinzel, serif',
                    fontSize: '1.4rem',
                    fontWeight: 800,
                    color: '#7a2021',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px dashed #7a2021',
                    width: '100%',
                    marginBottom: '4px',
                    outline: 'none',
                  }}
                />
                <input
                  type="text"
                  value={mSubtitle}
                  onChange={(e) => setMSubtitle(e.target.value)}
                  style={{
                    fontStyle: 'italic',
                    fontSize: '0.85rem',
                    color: '#57534e',
                    background: 'transparent',
                    border: 'none',
                    width: '100%',
                    outline: 'none',
                  }}
                />
              </div>

              <div className="statblock-divider" />

              {/* Core Stats Row */}
              <div style={{ fontSize: '0.88rem', lineHeight: 1.8 }}>
                <div>
                  <strong style={{ color: '#7a2021' }}>Armor Class:</strong>{' '}
                  <input
                    type="number"
                    value={mAc}
                    onChange={(e) => setMAc(Number(e.target.value))}
                    style={{ width: '55px', padding: '2px 4px', border: '1px solid #d6d3d1', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <strong style={{ color: '#7a2021' }}>Hit Points:</strong>{' '}
                  <input
                    type="number"
                    value={mHp}
                    onChange={(e) => setMHp(Number(e.target.value))}
                    style={{ width: '65px', padding: '2px 4px', border: '1px solid #d6d3d1', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <strong style={{ color: '#7a2021' }}>Speed:</strong>{' '}
                  <input
                    type="text"
                    value={mSpeed}
                    onChange={(e) => setMSpeed(e.target.value)}
                    style={{ width: '140px', padding: '2px 4px', border: '1px solid #d6d3d1', borderRadius: '4px' }}
                  />
                </div>
              </div>

              <div className="statblock-divider" />

              {/* Ability Scores */}
              <div className="statblock-attributes">
                {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((attr) => (
                  <div key={attr}>
                    <div className="statblock-attr-name">{attr.toUpperCase()}</div>
                    <input
                      type="number"
                      value={mAbilities[attr] || 10}
                      onChange={(e) =>
                        setMAbilities({ ...mAbilities, [attr]: Number(e.target.value) })
                      }
                      style={{
                        width: '38px',
                        textAlign: 'center',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        border: '1px solid #d6d3d1',
                        borderRadius: '4px',
                        margin: '2px 0',
                      }}
                    />
                    <div style={{ fontSize: '0.75rem', color: '#78716c' }}>
                      {getModifier(mAbilities[attr] || 10)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="statblock-divider" />

              <div style={{ fontSize: '0.88rem', lineHeight: 1.8, marginBottom: '10px' }}>
                <div>
                  <strong style={{ color: '#7a2021' }}>Challenge Rating:</strong>{' '}
                  <select
                    value={mCr}
                    onChange={(e) => setMCr(e.target.value)}
                    style={{ padding: '2px 6px', border: '1px solid #d6d3d1', borderRadius: '4px' }}
                  >
                    {Object.keys(CR_XP_MAP).map((cr) => (
                      <option key={cr} value={cr}>
                        CR {cr} ({CR_XP_MAP[cr]} XP)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="statblock-divider" />

              {/* Actions & Markdown Abilities */}
              <div style={{ marginTop: '10px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#7a2021', marginBottom: '4px' }}>
                  Traits, Actions &amp; Special Attacks (Markdown)
                </label>
                <textarea
                  rows={8}
                  value={mContent}
                  onChange={(e) => setMContent(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.85rem',
                    lineHeight: 1.6,
                    border: '1px solid #d6d3d1',
                    borderRadius: '4px',
                    background: '#fff',
                    color: '#1c1917',
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', borderRadius: '12px' }}>
            Select or create a monster to view its 5e statblock.
          </div>
        )}
      </div>

      {/* Col 3: 5e Encounter Calculator */}
      <div className="glass-panel" style={{ borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
        <h3 style={{ fontSize: '1.05rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={18} style={{ color: 'var(--color-arcane-cyan)' }} /> Encounter Budget
        </h3>

        {/* Party Config */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Party Size</label>
            <input
              type="number"
              min={1}
              max={10}
              value={partySize}
              onChange={(e) => setPartySize(Number(e.target.value))}
              style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Party Level</label>
            <input
              type="number"
              min={1}
              max={10}
              value={partyLevel}
              onChange={(e) => setPartyLevel(Number(e.target.value))}
              style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff' }}
            />
          </div>
        </div>

        {/* Difficulty Meter */}
        <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Calculated Difficulty
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: diffColor, margin: '4px 0' }}>
            {difficultyRating}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Adjusted XP: <strong>{adjustedXp}</strong> (Raw: {totalRawXp} × {multiplier})
          </div>
        </div>

        {/* XP Thresholds */}
        <div style={{ fontSize: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '14px' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '6px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <div style={{ color: '#34d399', fontWeight: 600 }}>Easy</div>
            <div>{partyEasy}</div>
          </div>
          <div style={{ background: 'rgba(234, 179, 8, 0.1)', padding: '6px', borderRadius: '4px', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
            <div style={{ color: '#facc15', fontWeight: 600 }}>Med</div>
            <div>{partyMedium}</div>
          </div>
          <div style={{ background: 'rgba(249, 115, 22, 0.1)', padding: '6px', borderRadius: '4px', border: '1px solid rgba(249, 115, 22, 0.2)' }}>
            <div style={{ color: '#fb923c', fontWeight: 600 }}>Hard</div>
            <div>{partyHard}</div>
          </div>
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '6px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <div style={{ color: '#f87171', fontWeight: 600 }}>Deadly</div>
            <div>{partyDeadly}</div>
          </div>
        </div>

        {/* Current Roster */}
        <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>Encounter Combatants:</div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {encounterRoster.length === 0 ? (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
              No monsters added yet. Click <strong>+ Fight</strong> on any monster on the left.
            </div>
          ) : (
            encounterRoster.map((item) => {
              const m = monsters.find((x) => x.id === item.monsterId);
              return (
                <div
                  key={item.monsterId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    background: 'var(--bg-surface)',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600 }}>{m?.title || 'Creature'}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>x{item.count}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => addToEncounter(item.monsterId)} className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: '0.7rem' }}>
                      +
                    </button>
                    <button onClick={() => removeFromEncounter(item.monsterId)} className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: '0.7rem' }}>
                      -
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
