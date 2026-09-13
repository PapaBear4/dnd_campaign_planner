import React, { useState, useEffect, useRef } from 'react';
import {
  Printer,
  Download,
  Sparkles,
  Zap,
  Save,
  Edit3,
  Eye,
  X,
  Clock,
  BookOpen,
  Swords,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { NodeItem } from '../types';
import { generateSessionRunSheet, updateNode } from '../api';
import MarkdownView from './MarkdownView';

interface RunSheetModalProps {
  sessionNode: NodeItem;
  campaignId: string;
  onClose: () => void;
  onSaveNode?: (updatedNode: NodeItem) => void;
}

export const RunSheetModal: React.FC<RunSheetModalProps> = ({
  sessionNode,
  campaignId,
  onClose,
  onSaveNode,
}) => {
  const [contentMarkdown, setContentMarkdown] = useState<string>(
    sessionNode.content_markdown || ''
  );
  const [viewMode, setViewMode] = useState<'timeline' | 'editor'>('timeline');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatingWithLlm, setGeneratingWithLlm] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [customInstruction, setCustomInstruction] = useState<string>('');
  const [showInstructionInput, setShowInstructionInput] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(
    sessionNode.data_json?.run_sheet?.generated_at || null
  );
  const [previousSessionTitle, setPreviousSessionTitle] = useState<string | null>(
    sessionNode.data_json?.run_sheet?.previous_session_title || null
  );

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Sync state if sessionNode changes
  useEffect(() => {
    setContentMarkdown(sessionNode.content_markdown || '');
    setLastGeneratedAt(sessionNode.data_json?.run_sheet?.generated_at || null);
    setPreviousSessionTitle(sessionNode.data_json?.run_sheet?.previous_session_title || null);
  }, [sessionNode]);

  // Handle Run-Sheet Generation (useLlm=false for instant graph assembly, true for AI embellishment)
  const handleGenerate = async (useLlm: boolean = false) => {
    setIsGenerating(true);
    setGeneratingWithLlm(useLlm);
    setStatusMessage(null);
    try {
      const res = await generateSessionRunSheet(sessionNode.id, {
        campaign_id: campaignId,
        custom_instruction: customInstruction.trim(),
        save_to_node: true,
        use_llm: useLlm,
      });

      if (res.success && res.run_sheet_markdown) {
        setContentMarkdown(res.run_sheet_markdown);
        setLastGeneratedAt(new Date().toISOString());
        if (res.previous_session_title) {
          setPreviousSessionTitle(res.previous_session_title);
        }
        setStatusMessage({
          type: 'success',
          text: `⚡ Run-sheet generated via ${res.model || (useLlm ? 'AI Co-DM' : 'Campaign Graph')} with ${res.beat_count || 0} encounters woven!`,
        });

        // Notify parent of updated node
        if (onSaveNode) {
          const updatedNode: NodeItem = {
            ...sessionNode,
            content_markdown: res.run_sheet_markdown,
            data_json: {
              ...(sessionNode.data_json || {}),
              run_sheet: {
                generated_at: new Date().toISOString(),
                previous_session_title: res.previous_session_title,
                next_session_title: res.next_session_title,
                beat_count: res.beat_count,
                engine: res.model,
              },
            },
          };
          onSaveNode(updatedNode);
        }
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error || 'Failed to generate run-sheet.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Error generating session run-sheet.',
      });
    } finally {
      setIsGenerating(false);
      setGeneratingWithLlm(false);
      setShowInstructionInput(false);
    }
  };

  // Handle Manual Save
  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const updatedDataJson = {
        ...(sessionNode.data_json || {}),
        run_sheet: {
          ...(sessionNode.data_json?.run_sheet || {}),
          updated_at: new Date().toISOString(),
        },
      };

      const updated = await updateNode(sessionNode.id, {
        content_markdown: contentMarkdown,
        data_json: updatedDataJson,
      });

      setStatusMessage({ type: 'success', text: '💾 Run-sheet notes saved to SQLite.' });
      if (onSaveNode) {
        onSaveNode(updated);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to save changes.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Download as Markdown (.md)
  const handleDownload = () => {
    const cleanTitle = sessionNode.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const filename = `${cleanTitle || 'session'}-run-sheet.md`;
    const blob = new Blob([contentMarkdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle Print Preview
  const handlePrint = () => {
    window.print();
  };

  const sessionData = sessionNode.data_json || {};

  return (
    <div
      className="run-sheet-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 8, 15, 0.86)',
        backdropFilter: 'blur(8px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      {/* Print CSS Stylesheet */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .run-sheet-print-container,
          .run-sheet-print-container * {
            visibility: visible !important;
          }
          .run-sheet-print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 20mm !important;
            background: #ffffff !important;
            color: #111827 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Times New Roman", serif !important;
            box-shadow: none !important;
            border: none !important;
            overflow: visible !important;
          }
          .run-sheet-non-printable {
            display: none !important;
          }
          .run-sheet-print-container h1,
          .run-sheet-print-container h2,
          .run-sheet-print-container h3 {
            color: #0f172a !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .run-sheet-print-container table {
            border-collapse: collapse !important;
            width: 100% !important;
            margin: 12px 0 !important;
          }
          .run-sheet-print-container th,
          .run-sheet-print-container td {
            border: 1px solid #cbd5e1 !important;
            padding: 6px 10px !important;
            color: #1e293b !important;
          }
          .run-sheet-print-container th {
            background-color: #f1f5f9 !important;
          }
          .run-sheet-print-container blockquote {
            border-left: 3px solid #6366f1 !important;
            padding: 8px 14px !important;
            margin: 12px 0 !important;
            background: #f8fafc !important;
            color: #334155 !important;
            font-style: italic !important;
          }
          @page {
            size: auto;
            margin: 15mm;
          }
        }
      `}</style>

      <div
        className="glass-panel run-sheet-print-container"
        style={{
          width: '100%',
          maxWidth: '1080px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          background: 'var(--bg-surface, #111726)',
          border: '1px solid var(--border-medium, rgba(255,255,255,0.12))',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)',
          overflow: 'hidden',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header (Non-Printable) */}
        <div
          className="run-sheet-non-printable"
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* Title & Metadata */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--color-gold, #f59e0b)',
                  background: 'rgba(245, 158, 11, 0.12)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <BookOpen size={12} /> Table Run-Sheet Dossier
              </span>
              {sessionData.session_date && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-secondary, #94a3b8)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Calendar size={12} /> {sessionData.session_date}
                </span>
              )}
              {previousSessionTitle && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--color-arcane-blue-text, #38bdf8)',
                    background: 'rgba(56, 189, 248, 0.08)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                  title={`Includes recap of: ${previousSessionTitle}`}
                >
                  Follows: {previousSessionTitle}
                </span>
              )}
            </div>
            <h2 style={{ margin: 0, fontSize: '1.28rem', fontWeight: 800, color: 'var(--text-primary, #f8fafc)' }}>
              {sessionNode.title}
            </h2>
          </div>

          {/* Action Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* View Mode Toggle */}
            <div
              style={{
                display: 'flex',
                background: 'var(--bg-card, rgba(255, 255, 255, 0.05))',
                borderRadius: '8px',
                padding: '2px',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              }}
            >
              <button
                onClick={() => setViewMode('timeline')}
                className="btn btn-ghost"
                style={{
                  padding: '5px 10px',
                  fontSize: '0.76rem',
                  borderRadius: '6px',
                  fontWeight: viewMode === 'timeline' ? 700 : 500,
                  background: viewMode === 'timeline' ? 'var(--color-primary, #4f46e5)' : 'transparent',
                  color: viewMode === 'timeline' ? '#fff' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
                title="View formatted timeline"
              >
                <Eye size={13} /> Timeline View
              </button>
              <button
                onClick={() => setViewMode('editor')}
                className="btn btn-ghost"
                style={{
                  padding: '5px 10px',
                  fontSize: '0.76rem',
                  borderRadius: '6px',
                  fontWeight: viewMode === 'editor' ? 700 : 500,
                  background: viewMode === 'editor' ? 'var(--color-primary, #4f46e5)' : 'transparent',
                  color: viewMode === 'editor' ? '#fff' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
                title="Edit markdown directly"
              >
                <Edit3 size={13} /> Edit Markdown
              </button>
            </div>

            {/* Generate from Graph Button (Instant, Detailed, Zero LLM) */}
            <button
              onClick={() => handleGenerate(false)}
              className="btn btn-primary"
              style={{
                fontSize: '0.78rem',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                borderColor: '#059669',
                color: '#fff',
                fontWeight: 700,
              }}
              disabled={isGenerating}
              title="Instantly generate an author-grade run-sheet directly from your encounters in SQLite without calling LLM"
            >
              <Zap size={14} />
              {isGenerating && !generatingWithLlm ? 'Generating...' : contentMarkdown ? 'Refresh from Graph' : 'Generate from Graph'}
            </button>

            {/* AI Generator / Polish Button */}
            <button
              onClick={() => setShowInstructionInput(!showInstructionInput)}
              className="btn btn-secondary"
              style={{
                fontSize: '0.78rem',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: 'var(--color-gold, #f59e0b)',
                color: 'var(--color-gold, #f59e0b)',
              }}
              disabled={isGenerating}
              title="Optionally polish or customize the run-sheet using the Gemini AI agent"
            >
              <Sparkles size={14} />
              Polish with AI
              {showInstructionInput ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {/* Save Button */}
            <button
              onClick={handleSave}
              className="btn btn-secondary"
              style={{
                fontSize: '0.78rem',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              disabled={isSaving}
            >
              <Save size={14} />
              {isSaving ? 'Saving...' : 'Save'}
            </button>

            {/* Download (.md) Button */}
            <button
              onClick={handleDownload}
              className="btn btn-ghost"
              style={{
                fontSize: '0.78rem',
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
              title="Download run-sheet as Markdown (.md)"
            >
              <Download size={15} /> Download
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="btn btn-ghost"
              style={{
                fontSize: '0.78rem',
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
              title="Print table run-sheet (opens browser print dialog)"
            >
              <Printer size={15} /> Print
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="btn btn-ghost"
              style={{ padding: '6px', color: 'var(--text-muted)' }}
              title="Close Run-Sheet Dossier"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* AI Custom Instruction Drawer (Non-Printable) */}
        {showInstructionInput && (
          <div
            className="run-sheet-non-printable animate-fade-in"
            style={{
              padding: '12px 22px',
              background: 'rgba(245, 158, 11, 0.05)',
              borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-gold, #f59e0b)' }}>
                ✨ Arcane Weaver Co-DM Directive (AI Polish)
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                Engages Gemini to weave creative nuances into the timeline
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="input"
                placeholder="e.g. Focus on stealth mechanics, heighten tavern tension, include personal hook for Calcora..."
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                style={{ flex: 1, fontSize: '0.8rem', padding: '7px 10px' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleGenerate(true);
                }}
              />
              <button
                onClick={() => handleGenerate(true)}
                className="btn btn-primary"
                style={{
                  fontSize: '0.78rem',
                  padding: '7px 14px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#000',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                disabled={isGenerating}
              >
                {isGenerating && generatingWithLlm ? <RefreshCw className="animate-spin" size={14} /> : <Sparkles size={14} />}
                Polish with AI
              </button>
            </div>
          </div>
        )}

        {/* Status Toast Message */}
        {statusMessage && (
          <div
            className="run-sheet-non-printable"
            style={{
              padding: '8px 22px',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background:
                statusMessage.type === 'success'
                  ? 'rgba(34, 197, 94, 0.12)'
                  : 'rgba(239, 68, 68, 0.12)',
              color: statusMessage.type === 'success' ? '#4ade80' : '#f87171',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            {statusMessage.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {statusMessage.text}
          </div>
        )}

        {/* Modal Main Body */}
        <div
          ref={printAreaRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 30px',
            position: 'relative',
          }}
        >
          {isGenerating ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '360px',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  border: '3px solid rgba(245, 158, 11, 0.2)',
                  borderTopColor: 'var(--color-gold, #f59e0b)',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: 'var(--color-gold, #f59e0b)' }}>
                  Weaving Timeline Run-Sheet
                </h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '440px' }}>
                  Auditing preceding session recap, ordering encounters chronologically, tailoring tactical profiles, and structuring boxed text...
                </p>
              </div>
            </div>
          ) : viewMode === 'editor' ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div
                className="run-sheet-non-printable"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                  fontSize: '0.74rem',
                  color: 'var(--text-secondary)',
                }}
              >
                <span>Live Markdown Editor (Directly edits session notes)</span>
                <span>{contentMarkdown.length.toLocaleString()} characters</span>
              </div>
              <textarea
                value={contentMarkdown}
                onChange={(e) => setContentMarkdown(e.target.value)}
                placeholder="# 📜 Run-Sheet: Session Title..."
                style={{
                  width: '100%',
                  minHeight: '520px',
                  flex: 1,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '0.84rem',
                  lineHeight: '1.6',
                  padding: '16px',
                  borderRadius: '10px',
                  background: 'var(--bg-card, rgba(0,0,0,0.3))',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                  color: 'var(--text-primary, #f1f5f9)',
                  resize: 'vertical',
                }}
              />
            </div>
          ) : contentMarkdown ? (
            <div className="run-sheet-rendered-view" style={{ maxWidth: '900px', margin: '0 auto' }}>
              <MarkdownView content={contentMarkdown} />
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: 'var(--text-secondary)',
              }}
            >
              <FileText size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                No Run-Sheet Generated Yet
              </h3>
              <p style={{ margin: '0 auto 20px auto', fontSize: '0.85rem', maxWidth: '500px', lineHeight: 1.5 }}>
                Assemble an author-grade, timeline-centric run-sheet with full encounter details, read-aloud boxed text, and tactical flow directly from your campaign graph without calling an LLM.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleGenerate(false)}
                  className="btn btn-primary"
                  style={{
                    fontSize: '0.85rem',
                    padding: '10px 18px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#fff',
                    fontWeight: 700,
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                  }}
                  disabled={isGenerating}
                >
                  <Zap size={16} /> Generate from Graph (Instant & Detailed)
                </button>
                <button
                  onClick={() => setShowInstructionInput(true)}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.85rem',
                    padding: '10px 18px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderColor: 'var(--color-gold, #f59e0b)',
                    color: 'var(--color-gold, #f59e0b)',
                  }}
                  disabled={isGenerating}
                >
                  <Sparkles size={16} /> Polish with AI (LLM)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Bar (Non-Printable) */}
        <div
          className="run-sheet-non-printable"
          style={{
            padding: '10px 22px',
            borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
            background: 'rgba(0, 0, 0, 0.25)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.72rem',
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Clock size={12} /> Target Duration: ~3.5 – 4.0 Hours
            </span>
            {lastGeneratedAt && (
              <span>
                Generated: {new Date(lastGeneratedAt).toLocaleDateString()} {new Date(lastGeneratedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div>
            <span>💡 Tip: Click <b>Print</b> to preview high-contrast, paper-optimized notes for your DM screen.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RunSheetModal;
