import { NodeItem } from '../types';

export type Alignment =
  | 'lawful_good'
  | 'neutral_good'
  | 'chaotic_good'
  | 'lawful_neutral'
  | 'true_neutral'
  | 'chaotic_neutral'
  | 'lawful_evil'
  | 'neutral_evil'
  | 'chaotic_evil'
  | 'unaligned'
  | 'any';

export type AlignmentCategory = 'good' | 'neutral' | 'evil' | 'unaligned' | 'any';

export interface AlignmentMeta {
  id: Alignment;
  label: string;
  abbr: string;
  icon: string;
  category: AlignmentCategory;
  tagline: string;
  description: string;
  color: string;
  textColor: string;
  bgGlow: string;
  border: string;
}

export const ALIGNMENTS: Record<Alignment, AlignmentMeta> = {
  lawful_good: {
    id: 'lawful_good',
    label: 'Lawful Good',
    abbr: 'LG',
    icon: '🛡️',
    category: 'good',
    tagline: 'Honor & Altruism',
    description: 'Acts as a good person is expected or required to act, combining commitment to oppose evil with discipline to fight relentlessly.',
    color: '#38bdf8',
    textColor: '#e0f2fe',
    bgGlow: 'rgba(56, 189, 248, 0.16)',
    border: 'rgba(56, 189, 248, 0.45)',
  },
  neutral_good: {
    id: 'neutral_good',
    label: 'Neutral Good',
    abbr: 'NG',
    icon: '🕊️',
    category: 'good',
    tagline: 'Doing What is Right',
    description: 'Does the best that a good person can do, devoted to helping others without bias for or against order.',
    color: '#38bdf8',
    textColor: '#e0f2fe',
    bgGlow: 'rgba(56, 189, 248, 0.16)',
    border: 'rgba(56, 189, 248, 0.45)',
  },
  chaotic_good: {
    id: 'chaotic_good',
    label: 'Chaotic Good',
    abbr: 'CG',
    icon: '🌟',
    category: 'good',
    tagline: 'Free-Spirited Benevolence',
    description: 'Acts as their conscience directs with little regard for what others expect; values kindness and liberty above all.',
    color: '#f59e0b',
    textColor: '#fef3c7',
    bgGlow: 'rgba(245, 158, 11, 0.16)',
    border: 'rgba(245, 158, 11, 0.45)',
  },
  lawful_neutral: {
    id: 'lawful_neutral',
    label: 'Lawful Neutral',
    abbr: 'LN',
    icon: '⚖️',
    category: 'neutral',
    tagline: 'Tradition, Code & Law',
    description: 'Acts in accordance with law, tradition, or personal codes. Order and organization are paramount.',
    color: '#94a3b8',
    textColor: '#f1f5f9',
    bgGlow: 'rgba(148, 163, 184, 0.15)',
    border: 'rgba(148, 163, 184, 0.4)',
  },
  true_neutral: {
    id: 'true_neutral',
    label: 'True Neutral',
    abbr: 'TN',
    icon: '🌀',
    category: 'neutral',
    tagline: 'Balance & Self-Preservation',
    description: 'Prefers to steer clear of moral questions and does not take sides, doing what seems best at the moment.',
    color: '#94a3b8',
    textColor: '#f1f5f9',
    bgGlow: 'rgba(148, 163, 184, 0.15)',
    border: 'rgba(148, 163, 184, 0.4)',
  },
  chaotic_neutral: {
    id: 'chaotic_neutral',
    label: 'Chaotic Neutral',
    abbr: 'CN',
    icon: '🎲',
    category: 'neutral',
    tagline: 'Individualist, Unpredictable',
    description: 'Follows whims, holding personal freedom above all else without striving to protect others or cause pain.',
    color: '#cbd5e1',
    textColor: '#ffffff',
    bgGlow: 'rgba(203, 213, 225, 0.15)',
    border: 'rgba(203, 213, 225, 0.4)',
  },
  lawful_evil: {
    id: 'lawful_evil',
    label: 'Lawful Evil',
    abbr: 'LE',
    icon: '📜',
    category: 'evil',
    tagline: 'Tyrants, Schemers, Devils',
    description: 'Methodically takes what they want within the limits of a code of tradition, loyalty, or order, exploiting fine print.',
    color: '#ef4444',
    textColor: '#fee2e2',
    bgGlow: 'rgba(239, 68, 68, 0.18)',
    border: 'rgba(239, 68, 68, 0.5)',
  },
  neutral_evil: {
    id: 'neutral_evil',
    label: 'Neutral Evil',
    abbr: 'NE',
    icon: '🗡️',
    category: 'evil',
    tagline: 'Pure Self-Interest, Malice',
    description: 'Does whatever they can get away with, devoid of honor or compassion; pure unadulterated selfishness.',
    color: '#ef4444',
    textColor: '#fee2e2',
    bgGlow: 'rgba(239, 68, 68, 0.18)',
    border: 'rgba(239, 68, 68, 0.5)',
  },
  chaotic_evil: {
    id: 'chaotic_evil',
    label: 'Chaotic Evil',
    abbr: 'CE',
    icon: '💀',
    category: 'evil',
    tagline: 'Carnage, Demons, Destruction',
    description: 'Acts with arbitrary violence, spurred by their greed, hatred, or bloodlust; hot-tempered and brutally cruel.',
    color: '#a855f7',
    textColor: '#f3e8ff',
    bgGlow: 'rgba(168, 85, 247, 0.18)',
    border: 'rgba(168, 85, 247, 0.5)',
  },
  unaligned: {
    id: 'unaligned',
    label: 'Unaligned',
    abbr: 'UN',
    icon: '🐾',
    category: 'unaligned',
    tagline: 'Instinctual, Beasts & Automatons',
    description: 'Lacks moral capacity or judgment; acts purely on predatory instinct, primal fear, or programmed command.',
    color: '#78716c',
    textColor: '#e7e5e4',
    bgGlow: 'rgba(120, 113, 108, 0.18)',
    border: 'rgba(120, 113, 108, 0.45)',
  },
  any: {
    id: 'any',
    label: 'Any Alignment',
    abbr: 'ANY',
    icon: '🎭',
    category: 'any',
    tagline: 'Variable / Adaptable',
    description: 'Stat block adaptable to commoners, guards, mercenaries, or cultists of any moral conviction.',
    color: '#a78bfa',
    textColor: '#ede9fe',
    bgGlow: 'rgba(167, 139, 250, 0.18)',
    border: 'rgba(167, 139, 250, 0.45)',
  },
};

export const ALIGNMENT_MATRIX: Alignment[][] = [
  ['lawful_good', 'neutral_good', 'chaotic_good'],
  ['lawful_neutral', 'true_neutral', 'chaotic_neutral'],
  ['lawful_evil', 'neutral_evil', 'chaotic_evil'],
];

export const SPECIAL_ALIGNMENTS: Alignment[] = ['unaligned', 'any'];

// ---------------------------------------------------------------------------
// Creature Roles
// ---------------------------------------------------------------------------
export type CreatureRole =
  | 'npc'
  | 'companion'
  | 'villain'
  | 'boss'
  | 'monster'
  | 'beast'
  | 'minion'
  | 'patron';

export interface CreatureRoleMeta {
  id: CreatureRole;
  label: string;
  icon: string;
  color: string;
  textColor: string;
  bgGlow: string;
  border: string;
  description: string;
  encounterAdvice?: string;
}

export const CREATURE_ROLES: Record<CreatureRole, CreatureRoleMeta> = {
  npc: {
    id: 'npc',
    label: 'Townsfolk / NPC',
    icon: '🤝',
    color: '#a855f7',
    textColor: '#f3e8ff',
    bgGlow: 'rgba(168, 85, 247, 0.15)',
    border: 'rgba(168, 85, 247, 0.4)',
    description: 'Shopkeepers, magistrates, quest givers, and local denizens of the world.',
  },
  companion: {
    id: 'companion',
    label: 'Party Companion / Sidekick',
    icon: '🐕',
    color: '#10b981',
    textColor: '#d1fae5',
    bgGlow: 'rgba(16, 185, 129, 0.15)',
    border: 'rgba(16, 185, 129, 0.4)',
    description: 'Allies, adopted mascots, hired mercenaries, familiars, or mounts traveling with the party.',
    encounterAdvice: 'Fights on the player side or provides non-combat assistance.',
  },
  villain: {
    id: 'villain',
    label: 'Villain / Antagonist',
    icon: '👑',
    color: '#f43f5e',
    textColor: '#ffe4e6',
    bgGlow: 'rgba(244, 63, 94, 0.18)',
    border: 'rgba(244, 63, 94, 0.45)',
    description: 'Major plot schemers, corrupt lords, rival commanders, and recurring nemeses.',
  },
  boss: {
    id: 'boss',
    label: 'Legendary Boss',
    icon: '💀',
    color: '#dc2626',
    textColor: '#fee2e2',
    bgGlow: 'rgba(220, 38, 38, 0.22)',
    border: 'rgba(220, 38, 38, 0.55)',
    description: 'Climactic encounter anchors: dragons, lich lords, demon princes, or grove guardians.',
    encounterAdvice: '⚠️ Action Economy Alert: Solo bosses need Legendary Actions, Lair Actions, or minion bodyguards to challenge a full party!',
  },
  monster: {
    id: 'monster',
    label: 'Monster / Threat',
    icon: '🐉',
    color: '#ea580c',
    textColor: '#ffedd5',
    bgGlow: 'rgba(234, 88, 12, 0.15)',
    border: 'rgba(234, 88, 12, 0.4)',
    description: 'Standard dungeon denizens, aberrations, undead, and tactical combat threats.',
  },
  beast: {
    id: 'beast',
    label: 'Beast / Wildlife',
    icon: '🐾',
    color: '#84cc16',
    textColor: '#ecfccb',
    bgGlow: 'rgba(132, 204, 22, 0.15)',
    border: 'rgba(132, 204, 22, 0.4)',
    description: 'Dire wolves, giant spiders, mounts, predators, and ambient flora/fauna.',
  },
  minion: {
    id: 'minion',
    label: 'Minion / Grunt',
    icon: '👥',
    color: '#64748b',
    textColor: '#f1f5f9',
    bgGlow: 'rgba(100, 116, 139, 0.15)',
    border: 'rgba(100, 116, 139, 0.4)',
    description: 'Kobold swarms, skeleton archers, cultist lackeys, and fodder meant to fight in groups.',
    encounterAdvice: 'Minions run best in groups of 3-8 with shared initiative or simplified 1-HP rules.',
  },
  patron: {
    id: 'patron',
    label: 'Patron / Cosmic Entity',
    icon: '⚡',
    color: '#eab308',
    textColor: '#fef9c3',
    bgGlow: 'rgba(234, 179, 8, 0.18)',
    border: 'rgba(234, 179, 8, 0.45)',
    description: 'Archfey, fiendish patrons, celestial guardians, gods, or enigmatic primordial powers.',
    encounterAdvice: 'Interacts through dreams, boons, bargains, and omens rather than standard combat rounds.',
  },
};

// ---------------------------------------------------------------------------
// 5e Sizes & Types
// ---------------------------------------------------------------------------
export type CreatureSize = 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';

export const CREATURE_SIZES: CreatureSize[] = [
  'Tiny',
  'Small',
  'Medium',
  'Large',
  'Huge',
  'Gargantuan',
];

export type CreatureType =
  | 'Humanoid'
  | 'Beast'
  | 'Undead'
  | 'Fiend'
  | 'Dragon'
  | 'Aberration'
  | 'Construct'
  | 'Monstrosity'
  | 'Celestial'
  | 'Fey'
  | 'Elemental'
  | 'Plant'
  | 'Ooze'
  | 'Giant';

export const CREATURE_TYPES: CreatureType[] = [
  'Humanoid',
  'Beast',
  'Undead',
  'Fiend',
  'Dragon',
  'Aberration',
  'Construct',
  'Monstrosity',
  'Celestial',
  'Fey',
  'Elemental',
  'Plant',
  'Ooze',
  'Giant',
];

// ---------------------------------------------------------------------------
// Parsing and Formatting Helpers
// ---------------------------------------------------------------------------

export function parseAlignmentFromText(text?: string): Alignment | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase().trim();

  if (lower.includes('lawful good') || lower.includes('(lg)')) return 'lawful_good';
  if (lower.includes('neutral good') || lower.includes('(ng)')) return 'neutral_good';
  if (lower.includes('chaotic good') || lower.includes('(cg)')) return 'chaotic_good';

  if (lower.includes('lawful neutral') || lower.includes('(ln)')) return 'lawful_neutral';
  if (lower.includes('true neutral') || lower.includes('neutral') && !lower.includes('evil') && !lower.includes('good')) {
    if (lower.includes('true neutral') || lower.includes(', neutral') || lower.includes(' neutral')) return 'true_neutral';
  }
  if (lower.includes('chaotic neutral') || lower.includes('(cn)')) return 'chaotic_neutral';

  if (lower.includes('lawful evil') || lower.includes('(le)')) return 'lawful_evil';
  if (lower.includes('neutral evil') || lower.includes('(ne)')) return 'neutral_evil';
  if (lower.includes('chaotic evil') || lower.includes('(ce)')) return 'chaotic_evil';

  if (lower.includes('unaligned')) return 'unaligned';
  if (lower.includes('any alignment') || lower.includes('any evil') || lower.includes('any good') || lower.includes('any non-')) return 'any';

  return undefined;
}

export function parseRoleFromText(title?: string, subtitle?: string, type?: string): CreatureRole {
  const combined = `${title || ''} ${subtitle || ''}`.toLowerCase();

  if (combined.includes('boss') || combined.includes('dragon wyrmling') || combined.includes('wyrmling') || combined.includes('ancient') || combined.includes('lich') || combined.includes('warlord')) {
    return 'boss';
  }
  if (combined.includes('villain') || combined.includes('outcast') || combined.includes('cult leader') || combined.includes('overseer')) {
    return 'villain';
  }
  if (combined.includes('pet') || combined.includes('companion') || combined.includes('sidekick') || combined.includes('familiar') || combined.includes('meepo')) {
    return 'companion';
  }
  if (combined.includes('minion') || combined.includes('grunt') || combined.includes('skirmisher') || combined.includes('blight') || combined.includes('giant rat') || combined.includes('lackey')) {
    return 'minion';
  }
  if (combined.includes('patron') || combined.includes('deity') || combined.includes('archfey')) {
    return 'patron';
  }
  if (combined.includes('beast') || combined.includes('wolf') || combined.includes('spider') || combined.includes('wildlife')) {
    return 'beast';
  }
  if (type === 'npc') return 'npc';
  return 'monster';
}

export function parseSizeAndTypeFromText(subtitle?: string): { size: CreatureSize; type: CreatureType; tag?: string } {
  let size: CreatureSize = 'Medium';
  let type: CreatureType = 'Humanoid';
  let tag: string | undefined = undefined;

  if (!subtitle) return { size, type };

  for (const s of CREATURE_SIZES) {
    if (new RegExp(`\\b${s}\\b`, 'i').test(subtitle)) {
      size = s;
      break;
    }
  }

  for (const t of CREATURE_TYPES) {
    if (new RegExp(`\\b${t}\\b`, 'i').test(subtitle)) {
      type = t;
      break;
    }
  }

  // Extract tag in parentheses e.g. Medium Humanoid (Druid)
  const parenMatch = subtitle.match(/\(([^)]+)\)/);
  if (parenMatch && !parenMatch[1].toLowerCase().includes('cr')) {
    tag = parenMatch[1].trim();
  }

  return { size, type, tag };
}

export function getCreatureAlignment(node: NodeItem): Alignment {
  if (node.data_json?.alignment) {
    const raw = node.data_json.alignment;
    if (ALIGNMENTS[raw as Alignment]) return raw as Alignment;
    const parsed = parseAlignmentFromText(raw);
    if (parsed) return parsed;
  }
  const fromSubtitle = parseAlignmentFromText(node.subtitle);
  if (fromSubtitle) return fromSubtitle;
  return node.type === 'npc' ? 'any' : 'unaligned';
}

export function getCreatureRole(node: NodeItem): CreatureRole {
  if (node.data_json?.role && CREATURE_ROLES[node.data_json.role as CreatureRole]) {
    return node.data_json.role as CreatureRole;
  }
  return parseRoleFromText(node.title, node.subtitle, node.type);
}

export function getCreature5eType(node: NodeItem): { size: CreatureSize; type: CreatureType; tag?: string } {
  const data = node.data_json || {};
  if (data.creature_size && data.creature_type) {
    return {
      size: data.creature_size as CreatureSize,
      type: data.creature_type as CreatureType,
      tag: data.creature_tag,
    };
  }
  return parseSizeAndTypeFromText(node.subtitle);
}

export function format5eSubtitle(
  size: CreatureSize,
  type: CreatureType,
  alignment: Alignment,
  tag?: string
): string {
  const alignLabel = ALIGNMENTS[alignment]?.label || 'Any Alignment';
  const tagPart = tag ? ` (${tag})` : '';
  return `${size} ${type}${tagPart}, ${alignLabel}`;
}
