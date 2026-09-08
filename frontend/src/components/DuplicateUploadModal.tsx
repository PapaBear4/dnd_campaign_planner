import React from 'react';
import { AlertTriangle, Check, Copy, FileText, RefreshCw, X } from 'lucide-react';
import { UploadedDoc } from '../api';

interface DuplicateUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File;
  existingDoc: UploadedDoc;
  onReuseExisting: () => void;
  onReplaceFile: () => void;
  onUploadAsCopy: () => void;
}

const formatBytes = (bytes: number) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const DuplicateUploadModal: React.FC<DuplicateUploadModalProps> = ({
  isOpen,
  onClose,
  file,
  existingDoc,
  onReuseExisting,
  onReplaceFile,
  onUploadAsCopy,
}) => {
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
        zIndex: 1100,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'var(--bg-card)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          borderRadius: '14px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(245, 158, 11, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle style={{ color: 'var(--color-gold)' }} size={22} />
            <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', margin: 0 }}>Document Already Uploaded</h3>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ padding: '6px', color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
            A document named <strong style={{ color: 'var(--text-primary)' }}>&quot;{file.name}&quot;</strong> has already been uploaded to your Campaign Library.
          </p>

          {/* Existing Document Info Card */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '10px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <FileText size={32} style={{ color: 'var(--color-arcane-blue)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {existingDoc.original_name}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                Size: {formatBytes(existingDoc.file_size)} • Category: {existingDoc.category}
                {existingDoc.page_count > 0 && ` • ${existingDoc.page_count} pages`}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Uploaded: {new Date(existingDoc.created_at).toLocaleDateString()} at {new Date(existingDoc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            What would you like to do with this file?
          </div>

          {/* Action Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Option 1: Reuse Existing */}
            <button
              onClick={onReuseExisting}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                textAlign: 'left',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>⚡ Reuse Existing Document</div>
                <div style={{ fontSize: '0.74rem', opacity: 0.85, marginTop: '2px' }}>
                  Use the previously uploaded file without re-uploading
                </div>
              </div>
              <Check size={18} />
            </button>

            {/* Option 2: Replace Existing File */}
            <button
              onClick={onReplaceFile}
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '8px',
                borderColor: 'rgba(245, 158, 11, 0.4)',
                color: 'var(--color-gold)',
                textAlign: 'left',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>🔄 Replace &amp; Overwrite Existing File</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Update the existing file in the library with this new version
                </div>
              </div>
              <RefreshCw size={16} />
            </button>

            {/* Option 3: Upload as New Copy */}
            <button
              onClick={onUploadAsCopy}
              className="btn btn-ghost"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                textAlign: 'left',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.84rem' }}>📄 Keep Both (Upload as New Copy)</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Store this as a separate file with a unique name
                </div>
              </div>
              <Copy size={16} />
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 22px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'var(--bg-surface)',
          }}
        >
          <button onClick={onClose} className="btn btn-ghost" style={{ fontSize: '0.82rem' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
