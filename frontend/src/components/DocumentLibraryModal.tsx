import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Compass,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Loader2,
  Mic,
  Search,
  Shield,
  Sparkles,
  Swords,
  Trash2,
  X,
} from 'lucide-react';
import { deleteUploadedFile, listUploads, UploadedDoc } from '../api';

interface DocumentLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  onSelectDocument: (doc: UploadedDoc) => void;
  onRefreshParent?: () => void;
}

const formatBytes = (bytes: number) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const DocumentLibraryModal: React.FC<DocumentLibraryModalProps> = ({
  isOpen,
  onClose,
  campaignId,
  onSelectDocument,
  onRefreshParent,
}) => {
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const loadDocs = async () => {
    setIsLoading(true);
    try {
      const data = await listUploads(
        campaignId,
        categoryFilter === 'all' ? undefined : categoryFilter,
        searchTerm.trim() || undefined
      );
      setDocs(data);
    } catch (err) {
      console.error('Failed to load uploads:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDocs();
    }
  }, [isOpen, categoryFilter]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      loadDocs();
    }
  };

  const handleDelete = async (e: React.MouseEvent, filename: string, name: string) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${name}" from your Campaign Library?`)) {
      return;
    }
    try {
      await deleteUploadedFile(filename);
      setDocs((prev) => prev.filter((d) => d.filename !== filename));
      onRefreshParent?.();
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'pdf':
        return <BookOpen size={16} style={{ color: 'var(--color-gold)' }} />;
      case 'statblock':
        return <Swords size={16} style={{ color: 'var(--color-crimson)' }} />;
      case 'pc':
        return <Shield size={16} style={{ color: '#3b82f6' }} />;
      case 'transcript':
        return <Mic size={16} style={{ color: '#60a5fa' }} />;
      case 'map':
        return <Compass size={16} style={{ color: '#10b981' }} />;
      default:
        return <FileText size={16} style={{ color: 'var(--text-muted)' }} />;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'pdf':
        return 'Adventure Book';
      case 'statblock':
        return 'Monster Sheet';
      case 'pc':
        return 'PC Sheet';
      case 'transcript':
        return 'Transcript / Notes';
      case 'map':
        return 'Map / Handout';
      default:
        return 'General';
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 8, 14, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '85vh',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-medium)',
          borderRadius: '14px',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(15, 20, 32, 0.8)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FolderOpen size={22} style={{ color: '#60a5fa' }} />
            <div>
              <h3 style={{ fontSize: '1.2rem', color: '#fff', margin: 0 }}>Campaign Document Library</h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0 }}>
                Manage uploaded adventure PDFs, monster sheets, transcripts, and session debriefs.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px', color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Filter Bar & Search */}
        <div
          style={{
            padding: '14px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            flexWrap: 'wrap',
            background: 'rgba(10, 15, 25, 0.4)',
          }}
        >
          {/* Category Filter Pills */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All Files' },
              { id: 'pdf', label: '📖 Books' },
              { id: 'statblock', label: '🐉 Monsters' },
              { id: 'pc', label: '🛡️ Characters' },
              { id: 'transcript', label: '🎙️ Transcripts & Summaries' },
              { id: 'map', label: '🗺️ Maps' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`btn ${categoryFilter === cat.id ? 'btn-primary' : 'btn-ghost'}`}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  borderRadius: '16px',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search documents..."
                style={{
                  padding: '6px 12px 6px 30px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '0.8rem',
                  width: '180px',
                }}
              />
            </div>
            <button onClick={loadDocs} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem' }}>
              Search
            </button>
          </div>
        </div>

        {/* Document List Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', minHeight: '280px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '240px', gap: '8px', color: 'var(--text-muted)' }}>
              <Loader2 size={20} className="animate-spin" />
              <span>Loading documents...</span>
            </div>
          ) : docs.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '240px', color: 'var(--text-muted)', textAlign: 'center', gap: '10px' }}>
              <FolderOpen size={40} style={{ color: 'var(--border-medium)' }} />
              <p style={{ fontSize: '0.9rem', color: '#fff' }}>No uploaded documents found</p>
              <p style={{ fontSize: '0.78rem', maxWidth: '340px' }}>
                {categoryFilter !== 'all'
                  ? `No files found in the "${categoryFilter}" category. Try switching filters or uploading a file.`
                  : 'Upload an adventure PDF, monster stat block, or session transcript to build your campaign library.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => onSelectDocument(doc)}
                  className="glass-panel"
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#60a5fa';
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.background = 'var(--bg-surface)';
                  }}
                >
                  {/* Left info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {getCategoryIcon(doc.category)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {doc.original_name}
                        </span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'rgba(255, 255, 255, 0.08)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {getCategoryLabel(doc.category)}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {formatBytes(doc.file_size)}
                        {doc.page_count > 0 && ` • ${doc.page_count} pages`}
                        {' • '}
                        {new Date(doc.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDocument(doc);
                      }}
                      className="btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                      title="Load this document into the active workspace view"
                    >
                      <Sparkles size={13} /> Load
                    </button>

                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="btn btn-ghost"
                      style={{ padding: '6px', color: 'var(--text-secondary)' }}
                      title="Open/Download file in browser"
                    >
                      <ExternalLink size={15} />
                    </a>

                    <button
                      onClick={(e) => handleDelete(e, doc.filename, doc.original_name)}
                      className="btn btn-ghost"
                      style={{ padding: '6px', color: 'var(--color-crimson)' }}
                      title="Delete from Library"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(15, 20, 32, 0.8)',
          }}
        >
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Total Documents: <strong>{docs.length}</strong>
          </span>
          <button onClick={onClose} className="btn btn-secondary" style={{ fontSize: '0.82rem' }}>
            Close Library
          </button>
        </div>
      </div>
    </div>
  );
};
