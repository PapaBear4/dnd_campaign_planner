import React from 'react';
import {
  Calendar,
  CheckCircle,
  Clock,
  Flame,
  Layers,
  Sparkles,
  Swords,
  Target,
  Trophy,
  User,
  Users,
} from 'lucide-react';
import { NodeItem, EdgeItem } from '../../types';

interface TimelineModalProps {
  node: NodeItem;
  campaignId: string;
  dataJson: Record<string, any>;
  onChangeDataJson: (updated: Record<string, any>) => void;
  allNodes?: NodeItem[];
  edges?: EdgeItem[];
  onNavigateNode?: (targetNode: NodeItem) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  planned: { label: 'Planned / Upcoming', color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.05)' },
  in_progress: { label: 'In Progress / Active', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  completed: { label: 'Completed / Resolved', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
  abandoned: { label: 'Bypassed / Abandoned', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' },
};

const ENCOUNTER_TYPES = ['Combat', 'Social Roleplay', 'Trap & Hazard', 'Puzzle & Mystery', 'Exploration & Travel'];
const ENCOUNTER_DIFFICULTIES = ['Trivial', 'Easy', 'Medium', 'Hard', 'Deadly'];
const QUEST_TYPES = ['Main Story Quest', 'Character Backstory Quest', 'Faction Mission', 'Bounty / Monster Hunt', 'Side Quest'];

export const TimelineModal: React.FC<TimelineModalProps> = ({
  node,
  dataJson,
  onChangeDataJson,
  allNodes = [],
  edges = [],
  onNavigateNode,
}) => {
  const status = dataJson.status || 'planned';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Narrative Status Selector */}
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
          <Clock size={15} /> Campaign Progress &amp; Narrative Status
        </span>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          {Object.entries(STATUS_CONFIG).map(([stKey, cfg]) => {
            const active = status === stKey;
            return (
              <button
                key={stKey}
                type="button"
                onClick={() => onChangeDataJson({ ...dataJson, status: stKey })}
                style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: active ? 700 : 500,
                  background: active ? cfg.bg : 'rgba(255, 255, 255, 0.04)',
                  border: `1px solid ${active ? cfg.color : 'var(--border-subtle)'}`,
                  color: active ? cfg.color : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'center',
                }}
              >
                {cfg.label.split(' / ')[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Type-Specific Panels */}

      {/* 1. ARC PANEL */}
      {node.type === 'arc' && (
        <div
          style={{
            padding: '14px',
            borderRadius: '10px',
            background: 'rgba(251, 191, 36, 0.05)',
            border: '1px solid rgba(251, 191, 36, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={15} /> Campaign Arc Parameters
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Target Level Range
              </label>
              <input
                type="text"
                placeholder="e.g. Levels 1 - 4"
                value={dataJson.level_range || ''}
                onChange={(e) => onChangeDataJson({ ...dataJson, level_range: e.target.value })}
                className="input"
                style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Main Villain / Antagonist
              </label>
              <input
                type="text"
                placeholder="e.g. Belak the Outcast"
                value={dataJson.villain || ''}
                onChange={(e) => onChangeDataJson({ ...dataJson, villain: e.target.value })}
                className="input"
                style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. QUEST PANEL */}
      {node.type === 'quest' && (
        <div
          style={{
            padding: '14px',
            borderRadius: '10px',
            background: 'rgba(59, 130, 246, 0.05)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Target size={15} /> Quest Blueprint &amp; Stakes
          </span>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Quest Classification
              </label>
              <select
                value={dataJson.quest_type || 'Main Story Quest'}
                onChange={(e) => onChangeDataJson({ ...dataJson, quest_type: e.target.value })}
                className="input"
                style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
              >
                {QUEST_TYPES.map((qt) => (
                  <option key={qt} value={qt}>
                    {qt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Quest Giver / Patron
              </label>
              <input
                type="text"
                placeholder="e.g. Kerowyn Hucrele"
                value={dataJson.quest_giver || ''}
                onChange={(e) => onChangeDataJson({ ...dataJson, quest_giver: e.target.value })}
                className="input"
                style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Rewards / Bounty (Gold, XP, Magic Item, Renown)
            </label>
            <input
              type="text"
              placeholder="e.g. 100 gp each, salvager ring, merchant guild renown"
              value={dataJson.rewards || ''}
              onChange={(e) => onChangeDataJson({ ...dataJson, rewards: e.target.value })}
              className="input"
              style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
            />
          </div>
        </div>
      )}

      {/* 3. SESSION PANEL */}
      {node.type === 'session' && (
        <div
          style={{
            padding: '14px',
            borderRadius: '10px',
            background: 'rgba(14, 165, 233, 0.05)',
            border: '1px solid rgba(14, 165, 233, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={15} /> Session Log &amp; Agenda
          </span>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Session Date (Real or In-World)
              </label>
              <input
                type="text"
                placeholder="e.g. 2026-09-12 or 1492 DR Ches 14"
                value={dataJson.session_date || ''}
                onChange={(e) => onChangeDataJson({ ...dataJson, session_date: e.target.value })}
                className="input"
                style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Planned Beats / Focus
              </label>
              <input
                type="text"
                placeholder="e.g. Infiltrate goblin redoubt, free Meepo"
                value={dataJson.agenda || ''}
                onChange={(e) => onChangeDataJson({ ...dataJson, agenda: e.target.value })}
                className="input"
                style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. ENCOUNTER PANEL */}
      {node.type === 'encounter' && (
        <div
          style={{
            padding: '14px',
            borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Swords size={15} /> Encounter Dynamics &amp; Threat
          </span>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Encounter Type
              </label>
              <select
                value={dataJson.encounter_type || 'Combat'}
                onChange={(e) => onChangeDataJson({ ...dataJson, encounter_type: e.target.value })}
                className="input"
                style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
              >
                {ENCOUNTER_TYPES.map((et) => (
                  <option key={et} value={et}>
                    {et}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Difficulty Rating
              </label>
              <select
                value={dataJson.difficulty || 'Medium'}
                onChange={(e) => onChangeDataJson({ ...dataJson, difficulty: e.target.value })}
                className="input"
                style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
              >
                {ENCOUNTER_DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Hostile Combatants / Hazards Involved
            </label>
            <input
              type="text"
              placeholder="e.g. 4x Kobolds, 1x Dire Rat, Pit Trap DC 13"
              value={dataJson.combatants || ''}
              onChange={(e) => onChangeDataJson({ ...dataJson, combatants: e.target.value })}
              className="input"
              style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
