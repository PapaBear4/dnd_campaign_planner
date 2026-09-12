import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Compass,
  FileText,
  Lightbulb,
  Maximize2,
  MessageSquare,
  Minimize2,
  Plus,
  Send,
  Sparkles,
  Trash2,
  User,
  Wand2,
  Wrench,
  X,
} from 'lucide-react';
import {
  agentApplyExtracted,
  agentBoxedText,
  agentChat,
  agentCoach,
  agentExtractEntities,
  agentWeaveHook,
  createChatThread,
  createNode,
  deleteChatThread,
  getChatThreads,
  getThreadMessages,
} from '../api';
import { AgentActionTaken, AgentChatMessage, ChatThread, LoopStepTrace, NodeItem } from '../types';
import { MarkdownView } from './MarkdownView';

const ActionReceipt: React.FC<{
  actions?: AgentActionTaken[];
  loopSteps?: LoopStepTrace[];
  scratchpad?: string;
}> = ({ actions = [], loopSteps = [], scratchpad }) => {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<'actions' | 'loop' | 'scratchpad'>('actions');

  if (actions.length === 0 && loopSteps.length === 0 && !scratchpad) return null;

  return (
    <div
      style={{
        marginTop: '8px',
        padding: '8px 10px',
        background: 'var(--bg-card)',
        borderRadius: '6px',
        border: '1px solid var(--border-medium)',
        fontSize: '0.74rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'none',
            border: 'none',
            color: 'var(--color-gold)',
            cursor: 'pointer',
            padding: 0,
            fontWeight: 600,
            textAlign: 'left',
            flex: 1,
          }}
        >
          <Wrench size={12} />
          <span>
            {actions.length} Operation{actions.length !== 1 ? 's' : ''}
            {loopSteps.length > 0 ? ` • ${loopSteps.length} Loop Turn${loopSteps.length !== 1 ? 's' : ''}` : ''}
            {scratchpad ? ' • Plan Saved' : ''}
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: '8px' }}>
          {/* Tabs for operations, loop trace, and scratchpad */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
            <button
              type="button"
              onClick={() => setTab('actions')}
              style={{
                background: tab === 'actions' ? 'var(--bg-surface)' : 'transparent',
                border: 'none',
                color: tab === 'actions' ? 'var(--color-gold)' : 'var(--text-muted)',
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Operations ({actions.length})
            </button>
            {loopSteps.length > 0 && (
              <button
                type="button"
                onClick={() => setTab('loop')}
                style={{
                  background: tab === 'loop' ? 'var(--bg-surface)' : 'transparent',
                  border: 'none',
                  color: tab === 'loop' ? 'var(--color-gold)' : 'var(--text-muted)',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Loop Statement Trace ({loopSteps.length})
              </button>
            )}
            {scratchpad && (
              <button
                type="button"
                onClick={() => setTab('scratchpad')}
                style={{
                  background: tab === 'scratchpad' ? 'var(--bg-surface)' : 'transparent',
                  border: 'none',
                  color: tab === 'scratchpad' ? 'var(--color-gold)' : 'var(--text-muted)',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Scratchpad Plan
              </button>
            )}
          </div>

          {tab === 'actions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {actions.map((act, i) => {
                const isError = act.result?.error || act.result?.success === false;
                return (
                  <div
                    key={i}
                    style={{
                      padding: '6px 8px',
                      background: 'var(--bg-surface)',
                      borderRadius: '4px',
                      border: '1px solid var(--border-subtle)',
                      borderLeft: `3px solid ${isError ? 'var(--color-crimson)' : 'var(--color-emerald)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600, color: isError ? 'var(--color-crimson)' : 'var(--color-emerald)' }}>
                      <CheckCircle size={11} />
                      <span>{act.tool}</span>
                    </div>
                    {act.args && Object.keys(act.args).length > 0 && (
                      <div style={{ color: 'var(--text-secondary)', marginTop: '2px', fontSize: '0.7rem' }}>
                        {Object.entries(act.args)
                          .slice(0, 4)
                          .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                          .join(' | ')}
                      </div>
                    )}
                    {act.result?.message && (
                      <div style={{ color: 'var(--text-secondary)', marginTop: '2px', fontStyle: 'italic' }}>
                        {act.result.message}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'loop' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {loopSteps.map((s, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '6px 8px',
                    background: 'var(--bg-surface)',
                    borderRadius: '4px',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ fontWeight: 600, color: 'var(--color-gold)' }}>
                    {s.summary || `Turn ${s.turn}`}
                  </div>
                  {s.thought && (
                    <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '3px', fontSize: '0.7rem' }}>
                      "{s.thought}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'scratchpad' && scratchpad && (
            <div
              style={{
                padding: '8px 10px',
                background: 'var(--bg-surface)',
                borderRadius: '4px',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              <MarkdownView content={scratchpad} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

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

  // Active Tool Modal states
  const [toolMode, setToolMode] = useState<
    'chat' | 'boxed_text' | 'coach' | 'weave_hook' | 'extract_doc'
  >('chat');

  // Threads state for persistent conversations
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(() => {
    return localStorage.getItem(`dnd_active_thread_${campaignId}`) || null;
  });
  const [isThreadMenuOpen, setIsThreadMenuOpen] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(false);

  // Load threads on mount or campaign change
  const loadThreads = async (preferredThreadId?: string) => {
    if (!campaignId) return;
    setLoadingThreads(true);
    try {
      const threadList = await getChatThreads(campaignId);
      setThreads(threadList);

      let targetId = preferredThreadId || activeThreadId || localStorage.getItem(`dnd_active_thread_${campaignId}`);
      let targetThread = threadList.find((t) => t.id === targetId);

      if (!targetThread && threadList.length > 0) {
        targetThread = threadList[0];
      }

      if (targetThread) {
        setActiveThreadId(targetThread.id);
        localStorage.setItem(`dnd_active_thread_${campaignId}`, targetThread.id);
        const threadMsgs = await getThreadMessages(targetThread.id);
        if (threadMsgs && threadMsgs.length > 0) {
          setMessages(threadMsgs);
        } else {
          setMessages([
            {
              role: 'assistant',
              content:
                'Greetings, Dungeon Master. I am the **Arcane Weaver**, your Co-DM and world architect. How may I assist your campaign prep today? You can brainstorm campaign arcs, generate evocative boxed text, weave player backstory hooks, or ask for pacing & fail-forward coaching.',
            },
          ]);
        }
      } else {
        const newT = await createChatThread(campaignId, 'New Prep Session');
        setThreads([newT]);
        setActiveThreadId(newT.id);
        localStorage.setItem(`dnd_active_thread_${campaignId}`, newT.id);
      }
    } catch (err) {
      console.error('Failed to load chat threads:', err);
    } finally {
      setLoadingThreads(false);
    }
  };

  useEffect(() => {
    loadThreads();
  }, [campaignId]);

  const handleNewThread = async () => {
    try {
      const newT = await createChatThread(campaignId, 'New Prep Session');
      setThreads((prev) => [newT, ...prev]);
      setActiveThreadId(newT.id);
      localStorage.setItem(`dnd_active_thread_${campaignId}`, newT.id);
      setMessages([
        {
          role: 'assistant',
          content:
            'Greetings, Dungeon Master. Starting a fresh prep session thread. What would you like to build or brainstorm today?',
        },
      ]);
      setIsThreadMenuOpen(false);
    } catch (err: any) {
      alert('Failed to start new chat: ' + err.message);
    }
  };

  const handleSelectThread = async (t: ChatThread) => {
    setActiveThreadId(t.id);
    localStorage.setItem(`dnd_active_thread_${campaignId}`, t.id);
    setIsThreadMenuOpen(false);
    try {
      const msgs = await getThreadMessages(t.id);
      if (msgs && msgs.length > 0) {
        setMessages(msgs);
      } else {
        setMessages([
          {
            role: 'assistant',
            content: 'Greetings, Dungeon Master. How may I assist your campaign prep today?',
          },
        ]);
      }
    } catch (err: any) {
      console.error('Failed to load thread messages:', err);
    }
  };

  const handleDeleteThread = async (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation thread?')) return;
    try {
      await deleteChatThread(threadId);
      const remaining = threads.filter((t) => t.id !== threadId);
      setThreads(remaining);
      if (activeThreadId === threadId) {
        if (remaining.length > 0) {
          handleSelectThread(remaining[0]);
        } else {
          handleNewThread();
        }
      }
    } catch (err: any) {
      alert('Failed to delete thread: ' + err.message);
    }
  };

  // Auto-scroll chat independently (within its container only, never scrolling page or main view)
  useEffect(() => {
    if (toolMode === 'chat' && chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, toolMode, loading]);

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
      const res = await agentChat(newMsgs, focusedNode?.id, campaignId, activeThreadId || undefined);
      if (res.thread_id && res.thread_id !== activeThreadId) {
        setActiveThreadId(res.thread_id);
        localStorage.setItem(`dnd_active_thread_${campaignId}`, res.thread_id);
      }
      setMessages([
        ...newMsgs,
        {
          role: 'assistant',
          content: res.reply,
          actions_taken: res.actions_taken,
        },
      ]);
      // Refresh thread list in background to update title and message count
      getChatThreads(campaignId).then((tl) => setThreads(tl)).catch(() => {});

      if (res.actions_taken && res.actions_taken.length > 0) {
        const hasMutations = res.actions_taken.some((a: any) =>
          ['create_node', 'update_node', 'update_node_status', 'delete_node', 'bulk_delete_nodes', 'merge_nodes', 'deduplicate_campaign', 'create_edge', 'delete_edge', 'set_node_canon'].includes(a.tool)
        );
        if (hasMutations && onNodeCreated) {
          onNodeCreated();
        }
      }
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
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-surface)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} style={{ color: 'var(--color-gold)' }} />
          <div>
            <h3 style={{ fontSize: '0.95rem' }}>The Arcane Weaver</h3>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
              Co-DM &amp; Campaign Architect
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* New Chat Button */}
          <button
            onClick={handleNewThread}
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.72rem', gap: '4px' }}
            title="Start a new chat thread"
          >
            <Plus size={13} />
            <span>New Chat</span>
          </button>

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

      {/* Active Thread Bar & History Selector */}
      {toolMode === 'chat' && (
        <div
          style={{
            padding: '6px 12px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
            <MessageSquare size={13} style={{ color: 'var(--color-gold)', flexShrink: 0 }} />
            <button
              onClick={() => setIsThreadMenuOpen(!isThreadMenuOpen)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: 0,
                fontSize: '0.75rem',
                maxWidth: '240px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title="Click to switch conversation thread"
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {threads.find((t) => t.id === activeThreadId)?.title || 'Active Session'}
              </span>
              <ChevronDown size={13} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
            </button>
          </div>

          <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', flexShrink: 0 }}>
            {messages.length} msg{messages.length === 1 ? '' : 's'}
          </div>

          {/* Thread List Dropdown */}
          {isThreadMenuOpen && (
            <div
              className="glass-panel animate-fade-in"
              style={{
                position: 'absolute',
                top: '100%',
                left: '8px',
                right: '8px',
                marginTop: '4px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: '8px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
                zIndex: 90,
                maxHeight: '260px',
                overflowY: 'auto',
                padding: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                  borderBottom: '1px solid var(--border-subtle)',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                }}
              >
                <span>CONVERSATION HISTORY</span>
                <button
                  onClick={handleNewThread}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-gold)',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                  }}
                >
                  + New
                </button>
              </div>

              {threads.length === 0 ? (
                <div style={{ padding: '8px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.75rem' }}>
                  No saved conversations yet
                </div>
              ) : (
                threads.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => handleSelectThread(t)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: t.id === activeThreadId ? 'var(--bg-card-active)' : 'transparent',
                      border: t.id === activeThreadId ? '1px solid var(--border-glow)' : '1px solid transparent',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (t.id !== activeThreadId) e.currentTarget.style.background = 'var(--bg-card)';
                    }}
                    onMouseLeave={(e) => {
                      if (t.id !== activeThreadId) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
                      <div
                        style={{
                          fontWeight: t.id === activeThreadId ? 600 : 400,
                          color: t.id === activeThreadId ? 'var(--color-gold)' : 'var(--text-primary)',
                          fontSize: '0.78rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t.title}
                      </div>
                      <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {new Date(t.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} • {t.message_count || 0} messages
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDeleteThread(e, t.id)}
                      className="btn btn-ghost"
                      style={{ padding: '4px', opacity: 0.6 }}
                      title="Delete thread"
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                    >
                      <Trash2 size={12} style={{ color: '#ef4444' }} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

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
            style={{ width: '100%', padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', marginBottom: '10px' }}
          />

          <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
            Atmosphere &amp; Mood
          </label>
          <input
            type="text"
            value={boxedMood}
            onChange={(e) => setBoxedMood(e.target.value)}
            placeholder="e.g. eerie silence, damp cold, ancient dread"
            style={{ width: '100%', padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', marginBottom: '10px' }}
          />

          <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
            Sensory Details
          </label>
          <input
            type="text"
            value={boxedSensory}
            onChange={(e) => setBoxedSensory(e.target.value)}
            placeholder="e.g. scent of wet moss and copper, dripping water"
            style={{ width: '100%', padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', marginBottom: '16px' }}
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
            style={{ width: '100%', padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', marginBottom: '12px' }}
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
            style={{ width: '100%', padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', marginBottom: '16px' }}
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
            style={{ width: '100%', padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', marginBottom: '10px' }}
          />

          <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
            Key Backstory Details
          </label>
          <textarea
            rows={4}
            value={pcBackstory}
            onChange={(e) => setPcBackstory(e.target.value)}
            placeholder="e.g. Haunted by dreams of a green serpent, seeking her missing twin brother..."
            style={{ width: '100%', padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', marginBottom: '16px' }}
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
            style={{ width: '100%', padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', marginBottom: '12px' }}
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
                    color: 'var(--text-primary)',
                  }}
                >
                  <MarkdownView content={m.content} />

                  {/* Operation Receipt if assistant executed live tools */}
                  {m.actions_taken && m.actions_taken.length > 0 && (
                    <ActionReceipt actions={m.actions_taken} />
                  )}

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
              background: 'var(--bg-surface)',
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
                border: '1px solid var(--border-medium)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
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
