import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Compass,
  FileText,
  Lightbulb,
  Maximize2,
  Minimize2,
  Plus,
  Send,
  Sparkles,
  User,
  Wand2,
  X,
} from 'lucide-react';
import { agentApplyExtracted, agentBoxedText, agentChat, agentCoach, agentExtractEntities, agentWeaveHook, createNode } from '../api';
import { AgentChatMessage, NodeItem } from '../types';

interface CoDMPanelProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  focusedNode?: NodeItem | null;
  onNodeCreated?: () => void;
  width?: number;
  onWidthChange?: (newWidth: number) => void;
}

export const CoDMPanel: React.FC<CoDMPanelProps> = ({
  isOpen,
  onClose,
  campaignId,
  focusedNode,
  onNodeCreated,
  width,
  onWidthChange,
}) => {
  const [panelWidth, setPanelWidth] = useState(width || 440);
  const isResizingRef = useRef(false);

  useEffect(() => {
    if (width) setPanelWidth(width);
  }, [width]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newW = Math.max(340, Math.min(850, window.innerWidth - moveEvent.clientX));
      setPanelWidth(newW);
      if (onWidthChange) onWidthChange(newW);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<AgentChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Greetings, Dungeon Master. I am the **Arcane Weaver**, your Co-DM and world architect. How may I assist your campaign prep today? You can brainstorm campaign arcs, generate evocative boxed text, weave player backstory hooks, or ask for pacing & fail-forward coaching.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-scroll chat independently
  useEffect(() => {
    if (toolMode === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, toolMode, loading]);

  // Active Tool Modal states
  const [toolMode, setToolMode] = useState<
    'chat' | 'boxed_text' | 'coach' | 'weave_hook' | 'extract_doc'
  >('chat');

  // Boxed Text form
  const [boxedLoc, setBoxedLoc] = useState(focusedNode?.title || '');
  const [boxedMood, setBoxedMood] = useState('mysterious, ominous, ancient');
  const [boxedSensory, setBoxedSensory] = useState('damp stone, flickering torchlight, chilling draft');

  // Coach form
  const [coachSituation, setCoachSituation] = useState('');
  const [coachType, setCoachType] = useState('fail_forward');

  // Weave Hook form
  const [pcName, setPcName] = useState('');
  const [pcBackstory, setPcBackstory] = useState('');

  // Extract text form
  const [extractText, setExtractText] = useState('');
  const [extractedPreview, setExtractedPreview] = useState<{ nodes: any[]; edges: any[] } | null>(null);

  if (!isOpen) return null;

  const handleSendChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    const newMsgs = [...messages, { role: 'user' as const, content: input.trim() }];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);

    try {
      const res = await agentChat(newMsgs, focusedNode?.id, campaignId);
      setMessages([...newMsgs, { role: 'assistant', content: res.reply }]);
    } catch (err: any) {
      setMessages([
        ...newMsgs,
        { role: 'assistant', content: `⚠️ Error contacting agent: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateBoxedText = async () => {
    if (!boxedLoc.trim()) return;
    setLoading(true);
    try {
      const res = await agentBoxedText(boxedLoc, boxedMood, boxedSensory);
      const reply = `### 📜 Read-Aloud Boxed Text: ${boxedLoc}\n\n> "${res.boxed_text}"\n\n**DM Roleplay & Sensory Cues:**\n${res.dm_roleplay_cues}`;
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      setToolMode('chat');
    } catch (err: any) {
      alert('Failed to generate boxed text: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGetCoachAdvice = async () => {
    if (!coachSituation.trim()) return;
    setLoading(true);
    try {
      const res = await agentCoach(coachSituation, coachType, campaignId);
      const reply = `### 🛡️ GM Coach Guidance\n\n**Challenge:** "${coachSituation}"\n\n${res.advice}`;
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      setToolMode('chat');
    } catch (err: any) {
      alert('Failed to get coach advice: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWeaveHook = async () => {
    if (!pcName.trim()) return;
    setLoading(true);
    try {
      const res = await agentWeaveHook(pcName, pcBackstory, focusedNode?.id, campaignId);
      let reply = `### 🪶 Quest Hook: ${res.hook_title}\n\n${res.narrative_hook}\n\n`;
      if (res.suggested_nodes?.length > 0) {
        reply += `**Suggested Graph Nodes:**\n` + res.suggested_nodes.map((n: any) => `- **[${n.type.toUpperCase()}]** ${n.title}: ${n.summary}`).join('\n');
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      setToolMode('chat');
    } catch (err: any) {
      alert('Failed to weave hook: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExtractDocument = async () => {
    if (!extractText.trim()) return;
    setLoading(true);
    try {
      const res = await agentExtractEntities(extractText, campaignId);
      setExtractedPreview({
        nodes: res.extracted_nodes || [],
        edges: res.extracted_edges || [],
      });
    } catch (err: any) {
      alert('Extraction failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyExtracted = async () => {
    if (!extractedPreview) return;
    setLoading(true);
    try {
      await agentApplyExtracted(extractedPreview.nodes, extractedPreview.edges, campaignId);
      alert(`Applied ${extractedPreview.nodes.length} nodes to campaign graph!`);
      setExtractedPreview(null);
      setToolMode('chat');
      if (onNodeCreated) onNodeCreated();
    } catch (err: any) {
      alert('Failed to apply extracted entities: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAddNode = async (type: any, title: string, content: string) => {
    try {
      await createNode({
        campaign_id: campaignId,
        type,
        title,
        content_markdown: content,
        summary: content.slice(0, 150),
        revealed_to_players: false,
      });
      alert(`Node "${title}" created and saved to Campaign Graph!`);
      if (onNodeCreated) onNodeCreated();
    } catch (err: any) {
      alert('Failed to create node: ' + err.message);
    }
  };

  return (
    <aside
      className="glass-panel animate-fade-in"
      style={{
        position: 'relative',
        width: `${panelWidth}px`,
        maxWidth: '85vw',
        height: '100%',
        flexShrink: 0,
        borderLeft: '1px solid var(--border-medium)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
        boxShadow: '-8px 0 25px rgba(0,0,0,0.5)',
      }}
    >
      {/* Draggable Left Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        title="Drag to resize Co-DM Studio"
        style={{
          position: 'absolute',
          left: -4,
          top: 0,
          bottom: 0,
          width: '8px',
          cursor: 'col-resize',
          zIndex: 60,
          transition: 'background 0.2s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(245, 158, 11, 0.4)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      />

      {/* Header */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 20, 32, 0.95)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} style={{ color: 'var(--color-gold)' }} />
          <div>
            <h3 style={{ fontSize: '1rem' }}>The Arcane Weaver</h3>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              Co-DM &amp; Campaign Architect
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => {
              const nextW = panelWidth > 520 ? 420 : 660;
              setPanelWidth(nextW);
              if (onWidthChange) onWidthChange(nextW);
            }}
            className="btn btn-ghost"
            style={{ padding: '6px' }}
            title={panelWidth > 520 ? 'Standard Width' : 'Expand Width'}
          >
            {panelWidth > 520 ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }} title="Close Co-DM">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Quick Action Pills Toolbar */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          background: 'var(--bg-surface)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setToolMode('chat')}
          className={`btn ${toolMode === 'chat' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ padding: '4px 10px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
        >
          <Bot size={13} /> Chat
        </button>
        <button
          onClick={() => setToolMode('boxed_text')}
          className={`btn ${toolMode === 'boxed_text' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ padding: '4px 10px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
        >
          <FileText size={13} /> Boxed Text
        </button>
        <button
          onClick={() => setToolMode('coach')}
          className={`btn ${toolMode === 'coach' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ padding: '4px 10px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
        >
          <Lightbulb size={13} /> GM Coach
        </button>
        <button
          onClick={() => setToolMode('weave_hook')}
          className={`btn ${toolMode === 'weave_hook' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ padding: '4px 10px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
        >
          <Compass size={13} /> PC Hook
        </button>
        <button
          onClick={() => setToolMode('extract_doc')}
          className={`btn ${toolMode === 'extract_doc' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ padding: '4px 10px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
        >
          <Wand2 size={13} /> Parse Text
        </button>
      </div>

      {/* Tool Modal View or Chat View */}
      {toolMode === 'boxed_text' && (
        <div style={{ padding: '16px', overflowY: 'auto', flex: 1, minHeight: 0, overscrollBehavior: 'contain' }} className="codm-chat-scroller">
          <h4 style={{ fontSize: '0.95rem', marginBottom: '10px', color: 'var(--color-gold)' }}>
            📜 Evocative Boxed Text Generator
          </h4>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Creates multi-sensory, read-aloud prose and concise DM roleplay cues for any scene.
          </p>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
            Location or Scene Title
          </label>
          <input
            type="text"
            value={boxedLoc}
            onChange={(e) => setBoxedLoc(e.target.value)}
            placeholder="e.g. The Crypt of the Bleeding Wyrm"
            style={{ width: '100%', padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', marginBottom: '10px' }}
          />

          <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
            Atmosphere &amp; Mood
          </label>
          <input
            type="text"
            value={boxedMood}
            onChange={(e) => setBoxedMood(e.target.value)}
            placeholder="e.g. eerie silence, damp cold, ancient dread"
            style={{ width: '100%', padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', marginBottom: '10px' }}
          />

          <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
            Sensory Details
          </label>
          <input
            type="text"
            value={boxedSensory}
            onChange={(e) => setBoxedSensory(e.target.value)}
            placeholder="e.g. scent of wet moss and copper, dripping water"
            style={{ width: '100%', padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', marginBottom: '16px' }}
          />

          <button onClick={handleGenerateBoxedText} disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
            {loading ? 'Generating...' : 'Generate Read-Aloud Text'}
          </button>
        </div>
      )}

      {toolMode === 'coach' && (
        <div style={{ padding: '16px', overflowY: 'auto', flex: 1, minHeight: 0, overscrollBehavior: 'contain' }} className="codm-chat-scroller">
          <h4 style={{ fontSize: '0.95rem', marginBottom: '10px', color: 'var(--color-gold)' }}>
            🛡️ GM Mentor &amp; Pacing Coach
          </h4>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Stuck or unsure what to do next? Get actionable, table-tested coaching right now.
          </p>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
            Coaching Category
          </label>
          <select
            value={coachType}
            onChange={(e) => setCoachType(e.target.value)}
            style={{ width: '100%', padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', marginBottom: '12px' }}
          >
            <option value="fail_forward">Fail-Forward (Players failed critical check)</option>
            <option value="pacing">Pacing &amp; Urgency (Table is stalling / dragging)</option>
            <option value="three_clue_rule">Three-Clue Rule (Investigation mystery)</option>
            <option value="spotlight">PC Spotlight Balancing</option>
          </select>

          <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
            Current Table Situation
          </label>
          <textarea
            rows={4}
            value={coachSituation}
            onChange={(e) => setCoachSituation(e.target.value)}
            placeholder="Describe what's happening at the table..."
            style={{ width: '100%', padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', marginBottom: '16px' }}
          />

          <button onClick={handleGetCoachAdvice} disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
            {loading ? 'Consulting Coach...' : 'Get Coaching Advice'}
          </button>
        </div>
      )}

      {toolMode === 'weave_hook' && (
        <div style={{ padding: '16px', overflowY: 'auto', flex: 1, minHeight: 0, overscrollBehavior: 'contain' }} className="codm-chat-scroller">
          <h4 style={{ fontSize: '0.95rem', marginBottom: '10px', color: 'var(--color-gold)' }}>
            🪶 PC Backstory Hook Weaver
          </h4>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Tie your player's backstory directly into the active campaign factions or locations.
          </p>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
            Player Character Name
          </label>
          <input
            type="text"
            value={pcName}
            onChange={(e) => setPcName(e.target.value)}
            placeholder="e.g. Sarah the Warlock"
            style={{ width: '100%', padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', marginBottom: '10px' }}
          />

          <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
            Key Backstory Details
          </label>
          <textarea
            rows={4}
            value={pcBackstory}
            onChange={(e) => setPcBackstory(e.target.value)}
            placeholder="e.g. Haunted by dreams of a green serpent, seeking her missing twin brother..."
            style={{ width: '100%', padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', marginBottom: '16px' }}
          />

          <button onClick={handleWeaveHook} disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
            {loading ? 'Weaving Hook...' : 'Weave Narrative Hook'}
          </button>
        </div>
      )}

      {toolMode === 'extract_doc' && (
        <div style={{ padding: '16px', overflowY: 'auto', flex: 1, minHeight: 0, overscrollBehavior: 'contain' }} className="codm-chat-scroller">
          <h4 style={{ fontSize: '0.95rem', marginBottom: '10px', color: 'var(--color-gold)' }}>
            🧙‍♂️ Document &amp; Adventure Text Extractor
          </h4>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Paste adventure book text, homebrew notes, or PDF excerpts. Gemini extracts NPCs, Locations, Quests, and Monsters as graph nodes.
          </p>
          <textarea
            rows={6}
            value={extractText}
            onChange={(e) => setExtractText(e.target.value)}
            placeholder="Paste book excerpt, boxed descriptions, or monster encounters here..."
            style={{ width: '100%', padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', marginBottom: '12px' }}
          />

          <button onClick={handleExtractDocument} disabled={loading} className="btn btn-primary" style={{ width: '100%', marginBottom: '14px' }}>
            {loading ? 'Extracting Entities...' : 'Extract Entities'}
          </button>

          {extractedPreview && (
            <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-medium)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '8px' }}>
                Extracted: {extractedPreview.nodes.length} Nodes, {extractedPreview.edges.length} Edges
              </div>
              <ul style={{ maxHeight: '160px', overflowY: 'auto', paddingLeft: '16px', fontSize: '0.78rem', marginBottom: '12px' }}>
                {extractedPreview.nodes.map((n, i) => (
                  <li key={i} style={{ marginBottom: '4px' }}>
                    <strong style={{ color: 'var(--color-gold)' }}>[{n.type}]</strong> {n.title}
                  </li>
                ))}
              </ul>
              <button onClick={handleApplyExtracted} disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
                Apply All to Campaign Graph
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Chat Stream */}
      {toolMode === 'chat' && (
        <>
          <div
            ref={chatScrollRef}
            className="codm-chat-scroller"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              overscrollBehavior: 'contain',
              scrollBehavior: 'smooth',
            }}
          >
            {messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  gap: '10px',
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '90%',
                }}
              >
                {m.role === 'assistant' && (
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#0a0d14',
                      flexShrink: 0,
                    }}
                  >
                    <Bot size={16} />
                  </div>
                )}
                <div
                  style={{
                    background: m.role === 'user' ? 'var(--bg-card-hover)' : 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontSize: '0.84rem',
                    lineHeight: 1.6,
                    color: '#e2e8f0',
                  }}
                >
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>

                  {/* If assistant suggests a node title, offer Quick Add button */}
                  {m.role === 'assistant' && m.content.includes('###') && (
                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                      <button
                        onClick={() => {
                          const lines = m.content.split('\n');
                          const title = lines[0].replace(/#/g, '').trim() || 'Co-DM Note';
                          handleQuickAddNode('quest', title, m.content);
                        }}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                      >
                        <Plus size={13} /> Save to Graph as Node
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                <Sparkles size={16} className="pulse-gold" />
                <span>The Weaver is consulting the arcane texts...</span>
              </div>
            )}
            <div ref={messagesEndRef} style={{ height: '1px', flexShrink: 0 }} />
          </div>

          {/* Chat Input */}
          <form
            onSubmit={handleSendChat}
            style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              gap: '8px',
              background: 'rgba(15, 20, 32, 0.95)',
              flexShrink: 0,
            }}
          >
            <input
              type="text"
              placeholder="Ask the Co-DM anything about your campaign..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px 14px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
            <button type="submit" disabled={loading || !input.trim()} className="btn btn-primary" style={{ padding: '0 14px' }}>
              <Send size={16} />
            </button>
          </form>
        </>
      )}
    </aside>
  );
};
