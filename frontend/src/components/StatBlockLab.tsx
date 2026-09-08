import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  Feather,
  Filter,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  Users,
  X,
} from 'lucide-react';
import { createNode, updateNode, toggleNodeCanon } from '../api';
import { NodeItem } from '../types';
import {
  Alignment,
  AlignmentCategory,
  ALIGNMENTS,
  CreatureRole,
  CREATURE_ROLES,
  CreatureSize,
  CreatureType,
  CREATURE_SIZES,
  CREATURE_TYPES,
  format5eSubtitle,
  getCreatureAlignment,
  getCreatureRole,
  getCreature5eType,
} from '../utils/alignmentAndRoles';
import {
  AlignmentBadge,
  AlignmentMatrixSelector,
  RolePill,
  RoleSelector,
  CreatureTypeSelector,
} from './AlignmentSelector';

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

type RoleFilterOption =
  | 'all'
  | 'npc'
  | 'villain_boss'
  | 'monster'
  | 'beast_pet'
  | 'minion'
  | 'patron';

type AlignmentFilterOption = 'all' | AlignmentCategory | Alignment;

export const StatBlockLab: React.FC<StatBlockLabProps> = ({
  monsters,
  campaignId,
  onRefresh,
  onFocusCoDM,
}) => {
  const [selectedMonsterId, setSelectedMonsterId] = useState<string>(
    monsters[0]?.id || ''
  );

  // Filters state
  const [roleFilter, setRoleFilter] = useState<RoleFilterOption>('all');
  const [alignFilter, setAlignFilter] = useState<AlignmentFilterOption>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Encounter Calculator state
  const [partySize, setPartySize] = useState(4);
  const [partyLevel, setPartyLevel] = useState(2);
  const [encounterRoster, setEncounterRoster] = useState<{ monsterId: string; count: number }[]>([]);

  // Alignment popover state
  const [isAlignmentPickerOpen, setIsAlignmentPickerOpen] = useState(false);
  const alignmentPickerRef = useRef<HTMLDivElement | null>(null);

  // Close alignment picker on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        alignmentPickerRef.current &&
        !alignmentPickerRef.current.contains(e.target as Node)
      ) {
        setIsAlignmentPickerOpen(false);
      }
    };
    if (isAlignmentPickerOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isAlignmentPickerOpen]);

  // Filtered creatures calculation
  const displayedCreatures = monsters.filter((m) => {
    const role = getCreatureRole(m);
    const alignment = getCreatureAlignment(m);
    const alignMeta = ALIGNMENTS[alignment];

    // Role filter
    if (roleFilter !== 'all') {
      if (roleFilter === 'villain_boss') {
        if (role !== 'villain' && role !== 'boss') return false;
      } else if (roleFilter === 'beast_pet') {
        if (role !== 'beast' && role !== 'companion') return false;
      } else if (role !== roleFilter) {
        return false;
      }
    }

    // Alignment filter
    if (alignFilter !== 'all') {
      if (alignFilter === 'good' || alignFilter === 'neutral' || alignFilter === 'evil' || alignFilter === 'unaligned' || alignFilter === 'any') {
        if (alignMeta.category !== alignFilter) return false;
      } else if (alignment !== alignFilter) {
        return false;
      }
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = m.title.toLowerCase().includes(q);
      const matchSub = (m.subtitle || '').toLowerCase().includes(q);
      const matchRole = role.toLowerCase().includes(q);
      const matchAlign = (alignMeta?.label || '').toLowerCase().includes(q);
      if (!matchTitle && !matchSub && !matchRole && !matchAlign) return false;
    }

    return true;
  });

  // Selected Monster/NPC state
  const monster =
    monsters.find((m) => m.id === selectedMonsterId) ||
    displayedCreatures[0] ||
    monsters[0];

  // Structured form state
  const [mTitle, setMTitle] = useState(monster?.title || '');
  const [mSubtitle, setMSubtitle] = useState(monster?.subtitle || 'Medium Aberration, Neutral Evil');
  const [mRole, setMRole] = useState<CreatureRole>('monster');
  const [mAlignment, setMAlignment] = useState<Alignment>('neutral_evil');
  const [mSize, setMSize] = useState<CreatureSize>('Medium');
  const [mType, setMType] = useState<CreatureType>('Aberration');
  const [mTag, setMTag] = useState('');
  const [mCr, setMCr] = useState(monster?.data_json?.cr || '1');
  const [mAc, setMAc] = useState(monster?.data_json?.ac || 13);
  const [mHp, setMHp] = useState(monster?.data_json?.hp || 22);
  const [mSpeed, setMSpeed] = useState(monster?.data_json?.speed || '30 ft.');
  const [mAbilities, setMAbilities] = useState(
    monster?.data_json?.abilities || { str: 10, dex: 12, con: 12, int: 10, wis: 10, cha: 10 }
  );
  const [mContent, setMContent] = useState(monster?.content_markdown || '');

  // Update form fields when selected monster changes
  useEffect(() => {
    if (monster) {
      setMTitle(monster.title);
      setMSubtitle(monster.subtitle || '');
      const parsedRole = getCreatureRole(monster);
      const parsedAlign = getCreatureAlignment(monster);
      const typeInfo = getCreature5eType(monster);

      setMRole(parsedRole);
      setMAlignment(parsedAlign);
      setMSize(typeInfo.size);
      setMType(typeInfo.type);
      setMTag(typeInfo.tag || '');

      setMCr(monster.data_json?.cr || '1');
      setMAc(monster.data_json?.ac || 13);
      setMHp(monster.data_json?.hp || 22);
      setMSpeed(monster.data_json?.speed || '30 ft.');
      setMAbilities(monster.data_json?.abilities || { str: 10, dex: 12, con: 12, int: 10, wis: 10, cha: 10 });
      setMContent(monster.content_markdown || '');
    }
  }, [monster?.id]);

  // Synchronize 5e Subtitle when size, type, tag, or alignment changes
  const handleUpdate5eClassification = (
    newSize: CreatureSize,
    newType: CreatureType,
    newAlign: Alignment,
    newTag: string,
    newRole?: CreatureRole
  ) => {
    setMSize(newSize);
    setMType(newType);
    setMAlignment(newAlign);
    setMTag(newTag);
    if (newRole) setMRole(newRole);

    const generatedSubtitle = format5eSubtitle(newSize, newType, newAlign, newTag);
    setMSubtitle(generatedSubtitle);
  };

  const handleSaveMonster = async () => {
    if (!monster) return;
    try {
      const data = {
        ...(monster.data_json || {}),
        role: mRole,
        alignment: mAlignment,
        creature_size: mSize,
        creature_type: mType,
        creature_tag: mTag || undefined,
        cr: mCr,
        xp: CR_XP_MAP[mCr] || 200,
        ac: Number(mAc),
        hp: Number(mHp),
        speed: mSpeed,
        abilities: mAbilities,
      };

      const finalSubtitle = mSubtitle.trim() || format5eSubtitle(mSize, mType, mAlignment, mTag);

      await updateNode(monster.id, {
        title: mTitle,
        subtitle: finalSubtitle,
        content_markdown: mContent,
        data_json: data,
      });
      alert('Stat block & 5e classification saved successfully!');
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Failed to save stat block changes.');
    }
  };

  const handleCreateNewCreature = async (creatureRole: CreatureRole = 'monster') => {
    try {
      const isNpc = creatureRole === 'npc' || creatureRole === 'companion' || creatureRole === 'patron';
      const defaultAlign: Alignment = isNpc ? 'neutral_good' : creatureRole === 'beast' ? 'unaligned' : 'neutral_evil';
      const defaultSize: CreatureSize = 'Medium';
      const defaultType: CreatureType = isNpc ? 'Humanoid' : creatureRole === 'beast' ? 'Beast' : 'Monstrosity';

      const created = await createNode({
        campaign_id: campaignId,
        type: isNpc ? 'npc' : 'monster',
        title: isNpc ? 'New Named NPC' : 'New Homebrew Creature',
        subtitle: format5eSubtitle(defaultSize, defaultType, defaultAlign),
        content_markdown: isNpc
          ? '### Role & Personality\n- **Traits**: Calm, observant.\n- **Ideal**: Protect the realm.\n- **Flaw**: Secretive about their past.\n\n### Actions\n- **Rapier**: +4 to hit, 1d8+2 piercing damage.'
          : '### Traits\n- **Keen Senses**: Advantage on Perception checks relying on smell.\n\n### Actions\n- **Multiattack**: Makes two attacks.\n- **Claw**: +4 to hit, reach 5 ft., 1d6+2 slashing damage.',
        data_json: {
          role: creatureRole,
          alignment: defaultAlign,
          creature_size: defaultSize,
          creature_type: defaultType,
          cr: '1',
          xp: 200,
          ac: 12,
          hp: 18,
          speed: '30 ft.',
          abilities: { str: 12, dex: 12, con: 12, int: 10, wis: 12, cha: 10 },
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
  let hasSoloBoss = false;
  let minionCount = 0;

  for (const item of encounterRoster) {
    const mon = monsters.find((m) => m.id === item.monsterId);
    const cr = mon?.data_json?.cr || '1';
    const xp = CR_XP_MAP[cr] || 200;
    const role = mon ? getCreatureRole(mon) : 'monster';

    totalRawXp += xp * item.count;
    totalMonsters += item.count;

    if (role === 'boss') {
      if (item.count === 1 && encounterRoster.length === 1 && partySize >= 4) {
        hasSoloBoss = true;
      }
    }
    if (role === 'minion') {
      minionCount += item.count;
    }
  }

  // 5e Multiplier based on number of monsters
  let multiplier = 1;
  if (totalMonsters === 2) multiplier = 1.5;
  else if (totalMonsters >= 3 && totalMonsters <= 6) multiplier = 2;
  else if (totalMonsters >= 7 && totalMonsters <= 10) multiplier = 2.5;
  else if (totalMonsters > 10) multiplier = 3;

  const adjustedXp = Math.round(totalRawXp * multiplier);

  let difficultyRating = 'Trivial';
  let diffColor = 'var(--diff-trivial-text)';
  let diffKey = 'trivial';
  if (adjustedXp >= partyDeadly) {
    difficultyRating = 'DEADLY';
    diffColor = 'var(--diff-deadly-text)';
    diffKey = 'deadly';
  } else if (adjustedXp >= partyHard) {
    difficultyRating = 'Hard';
    diffColor = 'var(--diff-hard-text)';
    diffKey = 'hard';
  } else if (adjustedXp >= partyMedium) {
    difficultyRating = 'Medium';
    diffColor = 'var(--diff-medium-text)';
    diffKey = 'medium';
  } else if (adjustedXp >= partyEasy) {
    difficultyRating = 'Easy';
    diffColor = 'var(--diff-easy-text)';
    diffKey = 'easy';
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

  // Role Tab Counts
  const roleTabCounts = {
    all: monsters.length,
    npc: monsters.filter((m) => getCreatureRole(m) === 'npc').length,
    villain_boss: monsters.filter((m) => {
      const r = getCreatureRole(m);
      return r === 'villain' || r === 'boss';
    }).length,
    monster: monsters.filter((m) => getCreatureRole(m) === 'monster').length,
    beast_pet: monsters.filter((m) => {
      const r = getCreatureRole(m);
      return r === 'beast' || r === 'companion';
    }).length,
    minion: monsters.filter((m) => getCreatureRole(m) === 'minion').length,
    patron: monsters.filter((m) => getCreatureRole(m) === 'patron').length,
  };

  return (
    <div
      style={{
        padding: '20px 24px',
        maxWidth: '1380px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: '320px 1fr 340px',
        gap: '20px',
        height: 'calc(100vh - 120px)',
      }}
    >
      {/* Col 1: Creature Library with Role & Alignment Filters */}
      <div
        className="glass-panel"
        style={{
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <h3 style={{ fontSize: '1.02rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Swords size={18} style={{ color: 'var(--color-crimson)' }} /> NPCs &amp; Bestiary
          </h3>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => handleCreateNewCreature('monster')}
              className="btn btn-primary"
              style={{ padding: '3px 7px', fontSize: '0.72rem' }}
              title="Add New Monster Stat Block"
            >
              <Plus size={12} /> Monster
            </button>
            <button
              onClick={() => handleCreateNewCreature('npc')}
              className="btn btn-secondary"
              style={{ padding: '3px 7px', fontSize: '0.72rem' }}
              title="Add New NPC Stat Block"
            >
              <Plus size={12} /> NPC
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', marginBottom: '8px' }}>
          <Search
            size={13}
            style={{
              position: 'absolute',
              left: '9px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            placeholder="Search creatures, alignments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '5px 10px 5px 28px',
              fontSize: '0.75rem',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '6px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px',
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* 2-Tier Role Filter Tabs */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '3px',
            marginBottom: '8px',
            paddingBottom: '8px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {[
            { id: 'all', label: `All (${roleTabCounts.all})` },
            { id: 'npc', label: `🤝 NPCs (${roleTabCounts.npc})` },
            { id: 'villain_boss', label: `👑 Villains & Bosses (${roleTabCounts.villain_boss})` },
            { id: 'monster', label: `🐉 Monsters (${roleTabCounts.monster})` },
            { id: 'beast_pet', label: `🐾 Beasts & Pets (${roleTabCounts.beast_pet})` },
            { id: 'minion', label: `👥 Minions (${roleTabCounts.minion})` },
            { id: 'patron', label: `⚡ Patrons (${roleTabCounts.patron})` },
          ].map((tab) => {
            const isSelected = roleFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setRoleFilter(tab.id as RoleFilterOption)}
                style={{
                  padding: '3px 6px',
                  fontSize: '0.67rem',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  background: isSelected ? 'var(--color-amber-glow)' : 'var(--bg-surface)',
                  border: `1px solid ${isSelected ? 'var(--color-gold)' : 'var(--border-subtle)'}`,
                  color: isSelected ? 'var(--text-gold)' : 'var(--text-secondary)',
                  fontWeight: isSelected ? 700 : 500,
                  transition: 'all 0.1s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Alignment Filter Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginBottom: '8px',
            overflowX: 'auto',
            paddingBottom: '4px',
          }}
        >
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px' }}>
            <Filter size={10} /> Align:
          </span>
          {[
            { id: 'all', label: 'All' },
            { id: 'good', label: 'Good 🕊️' },
            { id: 'neutral', label: 'Neutral ⚖️' },
            { id: 'evil', label: 'Evil 💀' },
            { id: 'unaligned', label: 'Unaligned 🐾' },
          ].map((af) => {
            const isSelected = alignFilter === af.id;
            return (
              <button
                key={af.id}
                onClick={() => setAlignFilter(af.id as AlignmentFilterOption)}
                style={{
                  padding: '2px 5px',
                  fontSize: '0.62rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                  border: `1px solid ${isSelected ? '#38bdf8' : 'var(--border-subtle)'}`,
                  color: isSelected ? '#38bdf8' : 'var(--text-muted)',
                  fontWeight: isSelected ? 700 : 500,
                }}
              >
                {af.label}
              </button>
            );
          })}
        </div>

        {/* Creature List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {displayedCreatures.length === 0 ? (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '24px 10px' }}>
              No creatures match the selected filters.
            </div>
          ) : (
            displayedCreatures.map((m) => {
              const role = getCreatureRole(m);
              const align = getCreatureAlignment(m);
              const isSelected = selectedMonsterId === m.id;

              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMonsterId(m.id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--bg-card-active)' : 'var(--bg-surface)',
                    border: `1px solid ${isSelected ? 'var(--color-gold)' : 'var(--border-subtle)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await toggleNodeCanon(m.id);
                            onRefresh();
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          color: m.is_canon !== false ? 'var(--color-gold)' : 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          flexShrink: 0,
                        }}
                        title={m.is_canon !== false ? 'Canon Lore (Protected)' : 'Working Draft'}
                      >
                        {m.is_canon !== false ? <ShieldCheck size={13} /> : <Feather size={13} />}
                      </button>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '0.84rem',
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {m.title}
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addToEncounter(m.id);
                      }}
                      className="btn btn-secondary"
                      style={{ padding: '2px 6px', fontSize: '0.67rem', flexShrink: 0 }}
                      title="Add to Encounter Roster"
                    >
                      + Fight
                    </button>
                  </div>

                  {/* Badges row: Role Pill + Alignment Badge + CR */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                    <RolePill role={role} size="sm" />
                    <AlignmentBadge alignment={align} size="sm" />
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      CR {m.data_json?.cr || '1'}
                    </span>
                  </div>

                  {/* Subtitle preview */}
                  <div
                    style={{
                      fontSize: '0.7rem',
                      color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {m.subtitle || format5eSubtitle(mSize, mType, align)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Col 2: 5e Stat Block Inspector & Homebrew Editor */}
      <div style={{ overflowY: 'auto', height: '100%', paddingRight: '8px' }}>
        {monster ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSaveMonster} className="btn btn-primary">
                  <Save size={15} /> Save Changes
                </button>
                <button onClick={() => onFocusCoDM(monster)} className="btn btn-secondary">
                  <Sparkles size={15} /> Modify with Co-DM
                </button>
              </div>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await toggleNodeCanon(monster.id);
                    onRefresh();
                  } catch (err) {
                    console.error(err);
                  }
                }}
                className="btn btn-secondary"
                style={{
                  padding: '5px 10px',
                  fontSize: '0.78rem',
                  borderColor: monster.is_canon !== false ? 'var(--color-gold)' : 'var(--border-subtle)',
                  color: monster.is_canon !== false ? 'var(--text-gold)' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                title={monster.is_canon !== false ? 'Canon Lore (Protected)' : 'Working Draft'}
              >
                {monster.is_canon !== false ? <ShieldCheck size={14} /> : <Feather size={14} />}
                {monster.is_canon !== false ? 'Canon Lore' : 'Working Draft'}
              </button>
            </div>

            {/* Authentic 5e Monster Card */}
            <div className="statblock-5e animate-fade-in" style={{ position: 'relative' }}>
              {/* Header */}
              <div className="statblock-header" style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={mTitle}
                  onChange={(e) => setMTitle(e.target.value)}
                  placeholder="Creature / NPC Name"
                  style={{
                    fontFamily: 'Cinzel, serif',
                    fontSize: '1.4rem',
                    fontWeight: 800,
                    color: '#7a2021',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px dashed #7a2021',
                    width: '100%',
                    marginBottom: '8px',
                    outline: 'none',
                  }}
                />

                {/* 5e Classification Control Bar */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    background: 'rgba(255, 255, 255, 0.65)',
                    borderRadius: '8px',
                    border: '1px solid #e7e5e4',
                    marginBottom: '8px',
                  }}
                >
                  {/* Tactical Role Dropdown */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#78716c' }}>Role:</label>
                    <select
                      value={mRole}
                      onChange={(e) => {
                        const newRole = e.target.value as CreatureRole;
                        setMRole(newRole);
                      }}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        border: '1px solid #d6d3d1',
                        background: '#ffffff',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#1c1917',
                        outline: 'none',
                      }}
                    >
                      {(Object.keys(CREATURE_ROLES) as CreatureRole[]).map((r) => (
                        <option key={r} value={r}>
                          {CREATURE_ROLES[r].icon} {CREATURE_ROLES[r].label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 5e Size & Type */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#78716c' }}>Type:</label>
                    <select
                      value={mSize}
                      onChange={(e) =>
                        handleUpdate5eClassification(
                          e.target.value as CreatureSize,
                          mType,
                          mAlignment,
                          mTag
                        )
                      }
                      style={{
                        padding: '3px 6px',
                        borderRadius: '6px',
                        border: '1px solid #d6d3d1',
                        background: '#ffffff',
                        fontSize: '0.75rem',
                        color: '#1c1917',
                      }}
                    >
                      {CREATURE_SIZES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>

                    <select
                      value={mType}
                      onChange={(e) =>
                        handleUpdate5eClassification(
                          mSize,
                          e.target.value as CreatureType,
                          mAlignment,
                          mTag
                        )
                      }
                      style={{
                        padding: '3px 6px',
                        borderRadius: '6px',
                        border: '1px solid #d6d3d1',
                        background: '#ffffff',
                        fontSize: '0.75rem',
                        color: '#1c1917',
                      }}
                    >
                      {CREATURE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      placeholder="Tag (e.g. Druid)"
                      value={mTag}
                      onChange={(e) =>
                        handleUpdate5eClassification(mSize, mType, mAlignment, e.target.value)
                      }
                      style={{
                        width: '85px',
                        padding: '3px 6px',
                        borderRadius: '6px',
                        border: '1px solid #d6d3d1',
                        background: '#ffffff',
                        fontSize: '0.75rem',
                        color: '#1c1917',
                      }}
                    />
                  </div>

                  {/* Interactive Alignment Button / Badge */}
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <div
                      onClick={() => setIsAlignmentPickerOpen(!isAlignmentPickerOpen)}
                      style={{
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title="Click to open 3x3 Alignment Matrix Selector"
                    >
                      <AlignmentBadge alignment={mAlignment} size="md" interactive />
                      <ChevronDown size={14} style={{ color: '#78716c' }} />
                    </div>

                    {/* Popover Alignment Matrix */}
                    {isAlignmentPickerOpen && (
                      <div
                        ref={alignmentPickerRef}
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 8px)',
                          right: 0,
                          zIndex: 200,
                          animation: 'fadeIn 0.15s ease',
                        }}
                      >
                        <AlignmentMatrixSelector
                          value={mAlignment}
                          onChange={(newAlign) => {
                            handleUpdate5eClassification(mSize, mType, newAlign, mTag);
                            setIsAlignmentPickerOpen(false);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Subtitle / 5e Classification Line */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                      borderBottom: '1px dotted #a8a29e',
                      flex: 1,
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const computed = format5eSubtitle(mSize, mType, mAlignment, mTag);
                      setMSubtitle(computed);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '0.68rem',
                      color: '#7a2021',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                    title="Auto-format subtitle based on size, type, and alignment"
                  >
                    Sync
                  </button>
                </div>
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
            Select or create a creature to view its 5e statblock.
          </div>
        )}
      </div>

      {/* Col 3: 5e Encounter Calculator with Boss & Minion Tactics */}
      <div
        className="glass-panel"
        style={{
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        }}
      >
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
              style={{
                width: '100%',
                padding: '6px 8px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Party Level</label>
            <input
              type="number"
              min={1}
              max={20}
              value={partyLevel}
              onChange={(e) => setPartyLevel(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '6px 8px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>

        {/* Action Economy Warning (Solo Boss) */}
        {hasSoloBoss && (
          <div
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#fca5a5',
              fontSize: '0.72rem',
              lineHeight: 1.4,
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '6px',
            }}
          >
            <AlertTriangle size={15} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Action Economy Alert: Solo Boss detected!</strong>
              <div>A party of {partySize} heroes will overwhelm a single boss in 1-2 turns. Use Legendary Actions, Lair Actions, or minion bodyguards to balance combat rounds.</div>
            </div>
          </div>
        )}

        {/* Minion Horde Tag */}
        {minionCount >= 3 && (
          <div
            style={{
              padding: '6px 8px',
              borderRadius: '6px',
              background: 'rgba(100, 116, 139, 0.15)',
              border: '1px solid rgba(100, 116, 139, 0.35)',
              color: '#cbd5e1',
              fontSize: '0.7rem',
              marginBottom: '10px',
            }}
          >
            👥 <strong>Minion Mob ({minionCount} grunts):</strong> Run with shared group initiative or 1-HP rules for brisk combat flow!
          </div>
        )}

        {/* Difficulty Meter */}
        <div
          style={{
            background: 'var(--bg-surface)',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
            marginBottom: '14px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Calculated Difficulty
          </div>
          <div className="diff-meter-banner" style={{ fontSize: '1.5rem', color: diffColor, margin: '6px 0' }}>
            {difficultyRating}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Adjusted XP: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{adjustedXp}</strong> (Raw: <span style={{ fontFamily: 'var(--font-mono)' }}>{totalRawXp}</span> × {multiplier})
          </div>
        </div>

        {/* XP Thresholds */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', textAlign: 'center', marginBottom: '14px' }}>
          <div className={`diff-badge-card diff-easy ${diffKey === 'easy' ? 'diff-active' : ''}`}>
            <div className="diff-badge-title">Easy</div>
            <div className="diff-badge-val">{partyEasy}</div>
          </div>
          <div className={`diff-badge-card diff-medium ${diffKey === 'medium' ? 'diff-active' : ''}`}>
            <div className="diff-badge-title">Med</div>
            <div className="diff-badge-val">{partyMedium}</div>
          </div>
          <div className={`diff-badge-card diff-hard ${diffKey === 'hard' ? 'diff-active' : ''}`}>
            <div className="diff-badge-title">Hard</div>
            <div className="diff-badge-val">{partyHard}</div>
          </div>
          <div className={`diff-badge-card diff-deadly ${diffKey === 'deadly' ? 'diff-active' : ''}`}>
            <div className="diff-badge-title">Deadly</div>
            <div className="diff-badge-val">{partyDeadly}</div>
          </div>
        </div>

        {/* Current Roster */}
        <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>Encounter Combatants:</div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {encounterRoster.length === 0 ? (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
              No monsters added yet. Click <strong>+ Fight</strong> on any creature on the left.
            </div>
          ) : (
            encounterRoster.map((item) => {
              const m = monsters.find((x) => x.id === item.monsterId);
              const r = m ? getCreatureRole(m) : 'monster';
              const a = m ? getCreatureAlignment(m) : 'unaligned';

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
                  <div style={{ overflow: 'hidden', paddingRight: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m?.title || 'Creature'}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>x{item.count}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                      <RolePill role={r} size="sm" />
                      <AlignmentBadge alignment={a} size="sm" />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
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
