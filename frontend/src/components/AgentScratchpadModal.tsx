import React, { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Compass,
  Copy,
  FileText,
  Key,
  Layers,
  Loader2,
  Scroll,
  Shield,
  ShieldAlert,
  Sparkles,
  Swords,
  User,
  Users,
  X,
} from 'lucide-react';
import { AgentScratchpad, DecompositionCluster, SubAgentManifestItem } from '../types';

interface AgentScratchpadModalProps {
  isOpen: boolean;
  onClose: () => void;
  scratchpads: Record<string, AgentScratchpad>;
  clusters?: DecompositionCluster[];
  subagents?: SubAgentManifestItem[];
  currentStep?: number;
  status?: string;
  initialAgentName?: string;
}

export const AgentScratchpadModal: React.FC<AgentScratchpadModalProps> = ({
  isOpen,
  onClose,
  scratchpads = {},
  clusters = [],
  subagents = [],
  currentStep = 1,
  status = 'in_progress',
  initialAgentName,
}) => {
  const safeScratchpads: Record<string, AgentScratchpad> = scratchpads || {};
  const safeSubagents: SubAgentManifestItem[] = subagents || [];
  const safeClusters: DecompositionCluster[] = clusters || [];

  // Determine available agents from scratchpads or subagents manifest
  const agentNames = Array.from(
    new Set([
      ...Object.keys(safeScratchpads),
      ...safeSubagents.map((s) => s?.name).filter((n): n is string => Boolean(n)),
    ])
  );

  if (agentNames.length === 0) {
    agentNames.push('Worker Alpha');
  }

  const [selectedAgent, setSelectedAgent] = useState<string>(() => {
    if (initialAgentName && agentNames.includes(initialAgentName)) return initialAgentName;
    return agentNames[0] || 'Worker Alpha';
  });

  const [copyFeedback, setCopyFeedback] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentScratchpad: AgentScratchpad | undefined =
    safeScratchpads[selectedAgent] ||
    Object.values(safeScratchpads).find(
      (s) =>
        (s?.agent_name && s.agent_name.toLowerCase() === selectedAgent.toLowerCase()) ||
        ((s as any)?.subagent_name && String((s as any).subagent_name).toLowerCase() === selectedAgent.toLowerCase())
    );

  const currentManifestItem: SubAgentManifestItem | undefined = safeSubagents.find(
    (s) => s?.name && s.name.toLowerCase() === selectedAgent.toLowerCase()
  );

  const handleCopyScratchpad = () => {
    try {
      const textToCopy = JSON.stringify(
        {
          subagents: safeSubagents,
          clusters: safeClusters,
          scratchpads: safeScratchpads,
        },
        null,
        2
      );
      navigator.clipboard.writeText(textToCopy);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      // ignore
    }
  };

  const getStatusBadge = (agentStatus?: string) => {
    switch (agentStatus) {
      case 'completed':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.68rem',
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            <CheckCircle2 size={11} /> Done
          </span>
        );
      case 'running':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.68rem',
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: '10px',
              background: 'rgba(245, 158, 11, 0.15)',
              color: 'var(--color-gold)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }}
          >
            <Loader2 size={11} className="animate-spin" /> Active
          </span>
        );
      case 'failed':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.68rem',
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            <AlertTriangle size={11} /> Failed
          </span>
        );
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.68rem',
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: '10px',
              background: 'rgba(156, 163, 175, 0.1)',
              color: 'var(--text-muted)',
              border: '1px solid rgba(156, 163, 175, 0.2)',
            }}
          >
            ○ Pending
          </span>
        );
    }
  };

  const rooms = Array.isArray(currentScratchpad?.rooms_inventoried)
    ? currentScratchpad.rooms_inventoried
    : [];
  const npcs = Array.isArray(currentScratchpad?.npcs_identified)
    ? currentScratchpad.npcs_identified
    : [];
  const monsters = Array.isArray(currentScratchpad?.monsters_spotted)
    ? currentScratchpad.monsters_spotted
    : [];
  const sidebars = Array.isArray(currentScratchpad?.sidebars_captured)
    ? currentScratchpad.sidebars_captured
    : [];
  const traps = Array.isArray(currentScratchpad?.traps_secrets)
    ? currentScratchpad.traps_secrets
    : [];

  const rawNotes: any = currentScratchpad?.notes;
  const notes: string[] = Array.isArray(rawNotes)
    ? rawNotes.map(String)
    : typeof rawNotes === 'string' && rawNotes.trim().length > 0
    ? [rawNotes.trim()]
    : [];

  const totalFindings = rooms.length + npcs.length + monsters.length + sidebars.length + traps.length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 8, 14, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '960px',
          height: '86vh',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-medium)',
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(245, 158, 11, 0.08)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface)',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid var(--color-gold)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-gold)',
              }}
            >
              <ClipboardList size={22} />
            </div>
            <div>
              <h3
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                Sub-Agent Reasoning Chamber &amp; Live Scratchpads
              </h3>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: 0 }}>
                Transparent step-by-step audit logs: see what each visual worker and auditor tracked during decomposition.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleCopyScratchpad}
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Copy complete scratchpad manifest JSON"
            >
              <Copy size={13} />
              <span>{copyFeedback ? 'Copied to Clipboard!' : 'Export Logs'}</span>
            </button>
            <button
              onClick={onClose}
              className="btn btn-ghost"
              style={{ padding: '6px', borderRadius: '8px', color: 'var(--text-muted)' }}
              title="Close Modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Global Cluster Summary Strip */}
        <div
          style={{
            padding: '10px 22px',
            background: 'rgba(0, 0, 0, 0.35)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            fontSize: '0.76rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Layers size={14} style={{ color: 'var(--color-gold)' }} />
              <strong>{clusters.length} Page Chunks Created:</strong>
              <span style={{ color: 'var(--text-primary)' }}>
                {clusters.length > 0
                  ? clusters.map((c) => `[pp. ${c.start_page}-${c.end_page}]`).join(', ')
                  : 'Document text stream'}
              </span>
            </span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Users size={14} style={{ color: '#60a5fa' }} />
              <strong>{agentNames.length} Sub-Agents Dispatched</strong>
            </span>
          </div>

          <div>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '6px',
                background: status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : status === 'failed' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: status === 'completed' ? '#34d399' : status === 'failed' ? '#f87171' : 'var(--color-gold)',
                border: `1px solid ${status === 'completed' ? '#10b981' : status === 'failed' ? '#ef4444' : 'var(--color-gold)'}`,
              }}
            >
              Pipeline Step {currentStep}/4: {currentStep === 1 ? 'Visual Clustering' : currentStep === 2 ? 'Scratchpad Mining' : currentStep === 3 ? 'QA Gap Audit' : 'Domain Deconfliction'}
            </span>
          </div>
        </div>

        {/* Main Body: Two Column (Agent List on Left, Scratchpad on Right) */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Agent Tabs Sidebar */}
          <div
            style={{
              width: '260px',
              borderRight: '1px solid var(--border-subtle)',
              background: 'rgba(0, 0, 0, 0.2)',
              overflowY: 'auto',
              padding: '10px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '4px 8px',
              }}
            >
              Assigned Sub-Agents
            </span>

            {agentNames.map((name) => {
              const manifestItem = safeSubagents.find((s) => s?.name && s.name.toLowerCase() === name.toLowerCase());
              const sp = safeScratchpads[name] || Object.values(safeScratchpads).find(
                (s) => (s as any)?.subagent_name?.toLowerCase?.() === name.toLowerCase()
              );
              const isSelected = selectedAgent.toLowerCase() === name.toLowerCase();
              const agentStatus = manifestItem?.status || (sp ? 'completed' : 'pending');

              const spItemCount = sp
                ? (Array.isArray(sp.rooms_inventoried) ? sp.rooms_inventoried.length : 0) +
                  (Array.isArray(sp.npcs_identified) ? sp.npcs_identified.length : 0) +
                  (Array.isArray(sp.monsters_spotted) ? sp.monsters_spotted.length : 0) +
                  (Array.isArray(sp.sidebars_captured) ? sp.sidebars_captured.length : 0) +
                  (Array.isArray(sp.traps_secrets) ? sp.traps_secrets.length : 0)
                : 0;

              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSelectedAgent(name)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '4px',
                    padding: '9px 10px',
                    borderRadius: '8px',
                    border: `1px solid ${isSelected ? 'var(--color-gold)' : 'transparent'}`,
                    background: isSelected
                      ? 'rgba(245, 158, 11, 0.14)'
                      : 'rgba(255, 255, 255, 0.02)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s ease',
                    width: '100%',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: isSelected ? 700 : 600,
                        color: isSelected ? 'var(--color-gold)' : 'var(--text-primary)',
                      }}
                    >
                      {name}
                    </span>
                    {getStatusBadge(agentStatus)}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      {manifestItem?.target || manifestItem?.role || (sp?.assigned_pages ? `pp. ${sp.assigned_pages}` : 'Pipeline Worker')}
                    </span>
                    {spItemCount > 0 && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          background: 'rgba(245, 158, 11, 0.2)',
                          color: 'var(--color-gold)',
                          padding: '1px 5px',
                          borderRadius: '8px',
                          fontWeight: 700,
                        }}
                      >
                        {spItemCount} items
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Scratchpad View */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              background: 'var(--bg-card)',
            }}
          >
            {/* Selected Agent Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '14px',
                borderBottom: '1px solid var(--border-subtle)',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div>
                <h4
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    color: 'var(--color-gold)',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Sparkles size={18} />
                  {selectedAgent} Scratchpad
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                    Role: <strong>{currentManifestItem?.role || currentScratchpad?.role || 'Adventure Extraction'}</strong>
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>•</span>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                    Scope: <strong>{currentManifestItem?.target || currentScratchpad?.assigned_pages || 'Assigned Segment'}</strong>
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {totalFindings} entities recorded
                </span>
                {getStatusBadge(currentManifestItem?.status || (currentScratchpad ? 'completed' : 'pending'))}
              </div>
            </div>

            {/* If Agent has no scratchpad record yet */}
            {!currentScratchpad && (
              <div
                style={{
                  padding: '32px 20px',
                  textAlign: 'center',
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '10px',
                  border: '1px dashed var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <ClipboardList size={36} style={{ color: 'var(--text-muted)' }} />
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  Scratchpad entries pending for {selectedAgent}
                </strong>
                <p style={{ fontSize: '0.76rem', maxWidth: '440px', margin: 0, lineHeight: 1.5 }}>
                  This agent is queued or currently reading its assigned section. Its room-by-room inventory, NPC checklists, and monster encounters will appear here as soon as this pass completes.
                </p>
              </div>
            )}

            {currentScratchpad && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* 1. Keyed Rooms & Locations */}
                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.25)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-subtle)',
                    padding: '14px 16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '10px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        color: 'var(--color-gold)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Compass size={15} />
                      Keyed Rooms &amp; Locations ({rooms.length})
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Dungeon floorplan &amp; numbered area index
                    </span>
                  </div>

                  {rooms.length === 0 ? (
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No keyed location titles encountered in this chunk.
                    </span>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {rooms.map((room, idx) => (
                        <div
                          key={idx}
                          style={{
                            fontSize: '0.74rem',
                            padding: '4px 9px',
                            borderRadius: '6px',
                            background: 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            color: 'var(--color-gold)',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          <CheckCircle2 size={12} style={{ color: '#34d399' }} />
                          {room}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2 & 3. NPCs and Monsters Side-by-Side */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  {/* NPCs */}
                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      padding: '14px 16px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '10px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: '#60a5fa',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <User size={15} />
                        NPCs &amp; Factions ({npcs.length})
                      </span>
                    </div>

                    {npcs.length === 0 ? (
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No named NPCs recorded in this section.
                      </span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {npcs.map((npc, idx) => (
                          <div
                            key={idx}
                            style={{
                              fontSize: '0.72rem',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: 'rgba(59, 130, 246, 0.1)',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              color: '#93c5fd',
                              fontWeight: 600,
                            }}
                          >
                            {npc}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Monsters */}
                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      padding: '14px 16px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '10px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: 'var(--color-crimson)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Swords size={15} />
                        Monsters &amp; Foes ({monsters.length})
                      </span>
                    </div>

                    {monsters.length === 0 ? (
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No combat stat blocks or encounters noted.
                      </span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {monsters.map((monster, idx) => (
                          <div
                            key={idx}
                            style={{
                              fontSize: '0.72rem',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#fca5a5',
                              fontWeight: 600,
                            }}
                          >
                            {monster}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 4 & 5. Sidebars and Traps Side-by-Side */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  {/* Sidebars & Insets */}
                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      padding: '14px 16px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '10px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: '#a78bfa',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Scroll size={15} />
                        Sidebars &amp; Inset Lore ({sidebars.length})
                      </span>
                    </div>

                    {sidebars.length === 0 ? (
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No inset parchment sidebars or rumor tables.
                      </span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {sidebars.map((sb, idx) => (
                          <div
                            key={idx}
                            style={{
                              fontSize: '0.72rem',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: 'rgba(167, 139, 250, 0.12)',
                              border: '1px solid rgba(167, 139, 250, 0.3)',
                              color: '#c4b5fd',
                              fontWeight: 600,
                            }}
                          >
                            {sb}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Traps & Secrets */}
                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      padding: '14px 16px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '10px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: '#f59e0b',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Key size={15} />
                        Traps, Puzzles &amp; Secrets ({traps.length})
                      </span>
                    </div>

                    {traps.length === 0 ? (
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No hidden mechanisms or secret doors noted.
                      </span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {traps.map((trap, idx) => (
                          <div
                            key={idx}
                            style={{
                              fontSize: '0.72rem',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: 'rgba(245, 158, 11, 0.1)',
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                              color: '#fbbf24',
                              fontWeight: 600,
                            }}
                          >
                            {trap}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 6. Mental Scratchpad & Reasoning Notes */}
                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.25)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-subtle)',
                    padding: '14px 16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '10px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <FileText size={15} style={{ color: 'var(--color-gold)' }} />
                      Agent Stream of Thoughts &amp; Observations
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Sub-agent working memory notes
                    </span>
                  </div>

                  {notes.length === 0 ? (
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No field notes recorded.
                    </span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {notes.map((note, idx) => (
                        <div
                          key={idx}
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            background: 'rgba(255, 255, 255, 0.02)',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            borderLeft: '3px solid var(--color-gold)',
                            lineHeight: 1.4,
                          }}
                        >
                          {note}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 22px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            All scratchpads and draft entities are persisted in SQLite checkpoint table <code>decomposition_jobs</code>.
          </span>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
