import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bug,
  Calendar,
  CheckCircle2,
  Clock,
  Edit2,
  ExternalLink,
  Flame,
  Image as ImageIcon,
  Layers,
  Lightbulb,
  Loader2,
  Maximize2,
  Paperclip,
  Plus,
  RefreshCw,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  createFeedbackItem,
  deleteFeedbackItem,
  getFeedbackList,
  updateFeedbackItem,
  uploadFeedbackScreenshot,
} from '../api';
import { FeedbackItem, FeedbackPriority, FeedbackStatus, FeedbackType } from '../types';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId?: string;
  campaignName?: string;
  activeTab?: string;
}

const CATEGORIES = [
  'General',
  'Campaign Tapestry / Timeline',
  'Ingestion Hub / Vision',
  'Co-DM Agent & Chat',
  'Node Browser & Graph',
  'Stat Block Lab',
  'Map Studio',
  'UI & Appearance',
  'Performance & Sync',
];

const PRIORITIES: { id: FeedbackPriority; label: string; color: string; badgeBg: string }[] = [
  { id: 'low', label: 'Low', color: '#10b981', badgeBg: 'rgba(16, 185, 129, 0.15)' },
  { id: 'medium', label: 'Medium', color: '#3b82f6', badgeBg: 'rgba(59, 130, 246, 0.15)' },
  { id: 'high', label: 'High', color: '#f59e0b', badgeBg: 'rgba(245, 158, 11, 0.15)' },
  { id: 'blocker', label: 'Blocker 🔥', color: '#ef4444', badgeBg: 'rgba(239, 68, 68, 0.2)' },
];

const STATUSES: { id: FeedbackStatus; label: string; color: string }[] = [
  { id: 'open', label: 'Open', color: '#f59e0b' },
  { id: 'in_progress', label: 'In Progress', color: '#3b82f6' },
  { id: 'resolved', label: 'Resolved', color: '#10b981' },
  { id: 'closed', label: 'Closed', color: 'var(--text-muted)' },
];

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  campaignId,
  campaignName,
  activeTab,
}) => {
  const [activeView, setActiveView] = useState<'create' | 'list'>('create');

  // Editing state: if non-null, we are editing an existing item
  const [editingItem, setEditingItem] = useState<FeedbackItem | null>(null);

  // Form State
  const [type, setType] = useState<FeedbackType>('bug');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('General');
  const [priority, setPriority] = useState<FeedbackPriority>('medium');
  const [status, setStatus] = useState<FeedbackStatus>('open');
  const [description, setDescription] = useState('');
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // List State
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'bug' | 'feature'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | FeedbackStatus>('all');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load items when viewing list
  const loadItems = async () => {
    setIsLoadingList(true);
    try {
      const data = await getFeedbackList({
        type: filterType === 'all' ? undefined : filterType,
        status: filterStatus === 'all' ? undefined : filterStatus,
      });
      setItems(data);
    } catch (err) {
      console.error('Failed to load feedback list:', err);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (activeView === 'list') {
        loadItems();
      }
    }
  }, [isOpen, activeView, filterType, filterStatus]);

  // Handle Clipboard Paste of Images (Ctrl+V / Cmd+V)
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      for (let i = 0; i < clipboardItems.length; i++) {
        const item = clipboardItems[i];
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await handleImageUpload(file);
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  const handleImageUpload = async (file: File) => {
    setIsUploadingImage(true);
    try {
      const res = await uploadFeedbackScreenshot(file);
      setAttachedImages((prev) => [...prev, res.url]);
    } catch (err) {
      alert('Failed to upload image: ' + err);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      await handleImageUpload(files[i]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveImage = (index: number) => {
    setAttachedImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const startNewReport = () => {
    setEditingItem(null);
    setType('bug');
    setTitle('');
    setCategory('General');
    setPriority('medium');
    setStatus('open');
    setDescription('');
    setAttachedImages([]);
    setActiveView('create');
  };

  const startEditItem = (item: FeedbackItem) => {
    setEditingItem(item);
    setType(item.type);
    setTitle(item.title);
    setCategory(item.category || 'General');
    setPriority(item.priority || 'medium');
    setStatus(item.status || 'open');
    setDescription(item.description || '');
    setAttachedImages(item.images || []);
    setActiveView('create');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingItem) {
        // Update existing item
        await updateFeedbackItem(editingItem.id, {
          type,
          title: title.trim(),
          category,
          priority,
          status,
          description: description.trim(),
          images: attachedImages,
        });
      } else {
        // Create new item
        const context = {
          campaign_id: campaignId,
          campaign_name: campaignName,
          active_tab: activeTab,
          screen_resolution: `${window.innerWidth}x${window.innerHeight}`,
          user_agent: navigator.userAgent,
          theme: document.documentElement.getAttribute('data-theme') || 'obsidian',
          timestamp: new Date().toISOString(),
        };

        await createFeedbackItem({
          campaign_id: campaignId,
          type,
          title: title.trim(),
          category,
          priority,
          status: 'open',
          description: description.trim(),
          images: attachedImages,
          context,
        });
      }

      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
        setEditingItem(null);
        setActiveView('list');
      }, 1000);
    } catch (err) {
      alert('Failed to save item: ' + err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: FeedbackStatus) => {
    try {
      await updateFeedbackItem(id, { status: newStatus });
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
      );
    } catch (err) {
      alert('Failed to update status: ' + err);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm('Delete this item from the backlog?')) return;
    try {
      await deleteFeedbackItem(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      alert('Failed to delete item: ' + err);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-panel animate-scale-up"
        style={{
          width: '100%',
          maxWidth: '840px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '14px',
          border: '1px solid var(--border-medium)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
          background: 'var(--bg-card)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: type === 'bug' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: type === 'bug' ? '#ef4444' : '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {editingItem ? <Edit2 size={20} /> : type === 'bug' ? <Bug size={20} /> : <Lightbulb size={20} />}
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                {editingItem ? 'Edit Backlog Item' : 'Feedback & Backlog Studio'}
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {editingItem
                  ? `Editing: ${editingItem.title}`
                  : 'Report bugs, suggest features, paste screenshots (Ctrl+V anywhere)'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* View Switcher Tabs */}
            <div
              style={{
                display: 'flex',
                background: 'var(--bg-card)',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <button
                type="button"
                onClick={startNewReport}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: activeView === 'create' && !editingItem ? 'var(--bg-surface)' : 'transparent',
                  color: activeView === 'create' && !editingItem ? 'var(--color-gold)' : 'var(--text-secondary)',
                  boxShadow: activeView === 'create' && !editingItem ? '0 2px 6px rgba(0,0,0,0.3)' : 'none',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Plus size={14} /> New Report
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingItem(null);
                  setActiveView('list');
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: activeView === 'list' ? 'var(--bg-surface)' : 'transparent',
                  color: activeView === 'list' ? 'var(--color-gold)' : 'var(--text-secondary)',
                  boxShadow: activeView === 'list' ? '0 2px 6px rgba(0,0,0,0.3)' : 'none',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Layers size={14} /> Backlog Items ({items.length})
              </button>
            </div>

            <button
              onClick={onClose}
              className="btn btn-ghost"
              style={{ padding: '6px', color: 'var(--text-muted)', display: 'flex' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px' }}>
          {activeView === 'create' ? (
            /* CREATE OR EDIT VIEW */
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {editingItem && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    color: '#60a5fa',
                    fontSize: '0.82rem',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Edit2 size={14} /> You are editing this item. Add notes, adjust status, or paste more screenshots.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItem(null);
                      setActiveView('list');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      textDecoration: 'underline',
                    }}
                  >
                    Cancel Edit
                  </button>
                </div>
              )}

              {/* Type Switcher */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setType('bug')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: type === 'bug' ? '2px solid #ef4444' : '1px solid var(--border-subtle)',
                    background: type === 'bug' ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-surface)',
                    color: type === 'bug' ? '#ef4444' : 'var(--text-secondary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Bug size={18} /> Bug Report
                </button>
                <button
                  type="button"
                  onClick={() => setType('feature')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: type === 'feature' ? '2px solid #f59e0b' : '1px solid var(--border-subtle)',
                    background: type === 'feature' ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-surface)',
                    color: type === 'feature' ? '#f59e0b' : 'var(--text-secondary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Lightbulb size={18} /> Feature Request
                </button>
              </div>

              {/* Title & Controls Row */}
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 280px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={type === 'bug' ? 'e.g. Map pins disappear after refresh...' : 'e.g. Audio soundboard for tavern encounters...'}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                    }}
                  />
                </div>

                <div style={{ width: '160px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ width: '130px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as FeedbackPriority)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      color: PRIORITIES.find((p) => p.id === priority)?.color,
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                {editingItem && (
                  <div style={{ width: '130px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as FeedbackStatus)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        color: STATUSES.find((s) => s.id === status)?.color,
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {STATUSES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Description & Additional Detail */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Description &amp; Details
                </label>
                <textarea
                  rows={5}
                  placeholder={
                    type === 'bug'
                      ? 'What happened? What were you doing before the issue occurred? Any console errors or reproduction steps?'
                      : 'Describe the feature, user goal, requirements, and how you envision it working...'
                  }
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    lineHeight: '1.4',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Paste or Upload Screen Images Zone */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ImageIcon size={15} style={{ color: 'var(--color-gold)' }} /> Screenshots &amp; Attachments
                  </label>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    💡 Tip: Press <b>Ctrl+V</b> / <b>Cmd+V</b> anywhere to paste screenshot
                  </span>
                </div>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      for (let i = 0; i < e.dataTransfer.files.length; i++) {
                        await handleImageUpload(e.dataTransfer.files[i]);
                      }
                    }
                  }}
                  style={{
                    border: '2px dashed var(--border-subtle)',
                    borderRadius: '10px',
                    padding: '18px',
                    textAlign: 'center',
                    background: 'var(--bg-surface)',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-gold)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    {isUploadingImage ? (
                      <>
                        <Loader2 size={24} className="spin" style={{ color: 'var(--color-gold)' }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Uploading image...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={22} style={{ color: 'var(--color-gold)' }} />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Click to browse or drag &amp; drop screenshots here
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          PNG, JPG, WebP supported
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Attached Images Thumbnail Preview */}
                {attachedImages.length > 0 && (
                  <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
                    {attachedImages.map((imgUrl, index) => (
                      <div
                        key={index}
                        style={{
                          position: 'relative',
                          width: '90px',
                          height: '90px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: '1px solid var(--border-medium)',
                          background: '#000',
                        }}
                      >
                        <img
                          src={imgUrl}
                          alt={`Attachment ${index + 1}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                          onClick={() => setPreviewImage(imgUrl)}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            background: 'rgba(0, 0, 0, 0.75)',
                            border: 'none',
                            color: '#ef4444',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                          title="Remove Image"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Context Pill */}
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Sparkles size={14} style={{ color: 'var(--color-gold)' }} />
                <span>
                  Context: Active Campaign <b>{campaignName || 'General'}</b>, Tab <b>{activeTab || 'hierarchy'}</b>, Screen <b>{window.innerWidth}x{window.innerHeight}</b>
                </span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setEditingItem(null);
                    setActiveView('list');
                  }}
                  className="btn btn-ghost"
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !title.trim()}
                  className="btn btn-primary"
                  style={{
                    padding: '8px 20px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: submitSuccess
                      ? '#10b981'
                      : editingItem
                      ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                      : type === 'bug'
                      ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
                      : 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="spin" /> Saving...
                    </>
                  ) : submitSuccess ? (
                    <>
                      <CheckCircle2 size={16} /> Saved!
                    </>
                  ) : editingItem ? (
                    <>
                      <CheckCircle2 size={16} /> Save Changes
                    </>
                  ) : type === 'bug' ? (
                    <>
                      <Bug size={16} /> Submit Bug Report
                    </>
                  ) : (
                    <>
                      <Lightbulb size={16} /> Submit Feature
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* LIST / BACKLOG VIEW */
            <div>
              {/* Filters & Actions Bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as any)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem',
                    }}
                  >
                    <option value="all">All Types</option>
                    <option value="bug">🐞 Bugs Only</option>
                    <option value="feature">💡 Features Only</option>
                  </select>

                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem',
                    }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={startNewReport}
                    className="btn btn-primary"
                    style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plus size={14} /> New Report
                  </button>

                  <button
                    type="button"
                    onClick={loadItems}
                    className="btn btn-ghost"
                    style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <RefreshCw size={14} className={isLoadingList ? 'spin' : ''} /> Refresh
                  </button>
                </div>
              </div>

              {/* Items List */}
              {isLoadingList ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: '10px' }}>
                  <Loader2 size={24} className="spin" style={{ color: 'var(--color-gold)' }} />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading backlog items...</span>
                </div>
              ) : items.length === 0 ? (
                <div
                  style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    border: '1px dashed var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-muted)',
                  }}
                >
                  No items match the filter.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {items.map((item) => {
                    const priorityConfig = PRIORITIES.find((p) => p.id === item.priority) || PRIORITIES[1];
                    const isBug = item.type === 'bug';

                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: '14px 16px',
                          borderRadius: '10px',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          transition: 'border-color 0.15s ease',
                        }}
                      >
                        {/* Item Header */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: isBug ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: isBug ? '#ef4444' : '#f59e0b',
                              }}
                            >
                              {isBug ? <Bug size={12} /> : <Lightbulb size={12} />}
                              {item.type}
                            </span>

                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: priorityConfig.badgeBg,
                                color: priorityConfig.color,
                              }}
                            >
                              {priorityConfig.label}
                            </span>

                            <span
                              style={{
                                fontSize: '0.72rem',
                                color: 'var(--text-muted)',
                                background: 'rgba(255,255,255,0.05)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              {item.category}
                            </span>

                            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                              {item.title}
                            </h3>
                          </div>

                          {/* Item Controls: Edit, Status Dropdown, Delete */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              onClick={() => startEditItem(item)}
                              className="btn btn-ghost"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                fontSize: '0.75rem',
                                color: 'var(--color-gold)',
                                border: '1px solid rgba(245, 158, 11, 0.25)',
                                borderRadius: '6px',
                              }}
                              title="Edit item title, description, attachments, or details"
                            >
                              <Edit2 size={13} /> Edit
                            </button>

                            <select
                              value={item.status}
                              onChange={(e) => handleStatusChange(item.id, e.target.value as FeedbackStatus)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-subtle)',
                                color: STATUSES.find((s) => s.id === item.status)?.color || 'var(--text-primary)',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {STATUSES.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.label}
                                </option>
                              ))}
                            </select>

                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                              }}
                              title="Delete Item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Description */}
                        {item.description ? (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>
                            {item.description}
                          </div>
                        ) : (
                          <div
                            onClick={() => startEditItem(item)}
                            style={{
                              fontSize: '0.8rem',
                              fontStyle: 'italic',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Plus size={12} /> Add description or reproduction details...
                          </div>
                        )}

                        {/* Screenshots Carousel / Thumbnails */}
                        {item.images && item.images.length > 0 && (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                            {item.images.map((img, idx) => (
                              <div
                                key={idx}
                                style={{
                                  width: '60px',
                                  height: '60px',
                                  borderRadius: '6px',
                                  overflow: 'hidden',
                                  border: '1px solid var(--border-medium)',
                                  cursor: 'pointer',
                                }}
                                onClick={() => setPreviewImage(img)}
                                title="Click to expand"
                              >
                                <img src={img} alt="screenshot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Footer context */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          <span>
                            Created {new Date(item.created_at).toLocaleDateString()} at{' '}
                            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {item.updated_at && item.updated_at !== item.created_at && (
                            <span>Updated {new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          )}
                          {item.context?.active_tab && <span>Context: {item.context.active_tab}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Image Preview Lightbox */}
      {previewImage && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setPreviewImage(null)}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img
              src={previewImage}
              alt="Expanded Preview"
              style={{
                maxWidth: '100%',
                maxHeight: '90vh',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.9)',
              }}
            />
            <button
              onClick={() => setPreviewImage(null)}
              style={{
                position: 'absolute',
                top: '-14px',
                right: '-14px',
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
