import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  BookOpen,
  Check,
  Compass,
  Download,
  Edit2,
  FileText,
  FolderOpen,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Campaign } from '../types';
import { createCampaign, deleteCampaign, exportCampaign, importCampaign, updateCampaign } from '../api';

interface CampaignManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaigns: Campaign[];
  activeCampaignId: string;
  onSelectCampaign: (id: string) => void;
  onRefreshCampaigns: () => void;
}

export const CampaignManagerModal: React.FC<CampaignManagerModalProps> = ({
  isOpen,
  onClose,
  campaigns,
  activeCampaignId,
  onSelectCampaign,
  onRefreshCampaigns,
}) => {
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSetting, setEditSetting] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // New Campaign Form State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSetting, setNewSetting] = useState('Forgotten Realms');
  const [newDescription, setNewDescription] = useState('');

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartEdit = (c: Campaign) => {
    setEditingCampaignId(c.id);
    setEditName(c.name);
    setEditSetting(c.setting || '');
    setEditDescription(c.description || '');
    setConfirmDeleteId(null);
  };

  const handleSaveEdit = async (campaignId: string) => {
    if (!editName.trim()) return;
    setIsSaving(true);
    try {
      await updateCampaign(campaignId, {
        name: editName.trim(),
        setting: editSetting.trim() || 'Forgotten Realms',
        description: editDescription.trim(),
      });
      setEditingCampaignId(null);
      onRefreshCampaigns();
    } catch (err) {
      alert('Failed to update campaign: ' + err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsSaving(true);
    try {
      const created = await createCampaign({
        name: newName.trim(),
        setting: newSetting.trim() || 'Forgotten Realms',
        description: newDescription.trim(),
      });
      setNewName('');
      setNewDescription('');
      setShowCreateForm(false);
      onRefreshCampaigns();
      onSelectCampaign(created.id);
    } catch (err) {
      alert('Failed to create campaign: ' + err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (campaignId: string) => {
    if (campaigns.length <= 1) {
      alert('You cannot delete your only remaining campaign. Create a new campaign first.');
      return;
    }
    setIsSaving(true);
    try {
      await deleteCampaign(campaignId);
      setConfirmDeleteId(null);
      if (campaignId === activeCampaignId) {
        const remaining = campaigns.filter((c) => c.id !== campaignId);
        if (remaining.length > 0) {
          onSelectCampaign(remaining[0].id);
        }
      }
      onRefreshCampaigns();
    } catch (err) {
      alert('Failed to delete campaign: ' + err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async (campaign: Campaign) => {
    try {
      const bundle = await exportCampaign(campaign.id);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${campaign.name.replace(/\s+/g, '_')}_export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export campaign: ' + err);
    }
  };

  const handleImportFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const res = await importCampaign(json);
        alert(`Successfully imported "${res.name}"!`);
        onRefreshCampaigns();
        if (res.campaign_id) {
          onSelectCampaign(res.campaign_id);
        }
      } catch (err) {
        alert('Failed to import campaign: ' + err);
      }
    };
    input.click();
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 8, 16, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: 'min(86vh, 760px)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '14px',
          border: '1px solid var(--border-medium)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.85)',
          overflow: 'hidden',
          background: 'var(--bg-card)',
          margin: 'auto',
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
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FolderOpen size={20} style={{ color: 'var(--color-gold)' }} />
            <div>
              <h2 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700 }}>Campaign Management</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Switch, rename, customize settings, or remove campaigns.
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Bar */}
        <div
          style={{
            padding: '12px 22px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            background: 'rgba(0,0,0,0.15)',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <strong>{campaigns.length}</strong> total campaign{campaigns.length === 1 ? '' : 's'}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={14} /> New Campaign
            </button>
            <button
              onClick={handleImportFile}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Import Campaign from JSON"
            >
              <Upload size={14} /> Import JSON
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Create Form Drawer */}
          {showCreateForm && (
            <form
              onSubmit={handleCreateNew}
              className="glass-panel animate-fade-in"
              style={{
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid var(--color-gold)',
                background: 'rgba(245, 158, 11, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-gold)' }}>
                Create New Campaign
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Campaign Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tyranny of Dragons"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-medium)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Setting / World
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Forgotten Realms"
                    value={newSetting}
                    onChange={(e) => setNewSetting(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-medium)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Synopsis / Overview (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="High-level premise or themes of the campaign..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    resize: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="btn btn-ghost"
                  style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !newName.trim()}
                  className="btn btn-primary"
                  style={{ padding: '5px 14px', fontSize: '0.8rem' }}
                >
                  {isSaving ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </form>
          )}

          {/* Campaign List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {campaigns.map((c) => {
              const isActive = c.id === activeCampaignId;
              const isEditing = c.id === editingCampaignId;
              const isConfirmingDelete = c.id === confirmDeleteId;

              return (
                <div
                  key={c.id}
                  style={{
                    borderRadius: '10px',
                    border: isActive ? '1px solid var(--color-gold)' : '1px solid var(--border-subtle)',
                    background: isActive ? 'rgba(245, 158, 11, 0.04)' : 'var(--bg-surface)',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Campaign Name</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border-medium)',
                              color: 'var(--text-primary)',
                              fontSize: '0.85rem',
                              marginTop: '2px',
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Setting / World</label>
                          <input
                            type="text"
                            value={editSetting}
                            onChange={(e) => setEditSetting(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border-medium)',
                              color: 'var(--text-primary)',
                              fontSize: '0.85rem',
                              marginTop: '2px',
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Description</label>
                        <textarea
                          rows={2}
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-medium)',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            resize: 'none',
                            marginTop: '2px',
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                        <button
                          onClick={() => setEditingCampaignId(null)}
                          className="btn btn-ghost"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(c.id)}
                          disabled={isSaving || !editName.trim()}
                          className="btn btn-primary"
                          style={{ padding: '4px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Check size={13} /> {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h4 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                            {c.name}
                          </h4>
                          {isActive && (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '12px',
                                background: 'rgba(245, 158, 11, 0.2)',
                                color: 'var(--color-gold)',
                                border: '1px solid var(--color-gold)',
                              }}
                            >
                              Active
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', gap: '12px' }}>
                          <span>🌍 Setting: <strong>{c.setting || 'D&D 5e'}</strong></span>
                          <span>🕒 Updated: {new Date(c.updated_at).toLocaleDateString()}</span>
                        </div>

                        {c.description && (
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.3 }}>
                            {c.description}
                          </p>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        {!isActive && (
                          <button
                            onClick={() => {
                              onSelectCampaign(c.id);
                              onClose();
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                          >
                            Switch to
                          </button>
                        )}

                        <button
                          onClick={() => handleStartEdit(c)}
                          className="btn btn-ghost"
                          title="Rename / Edit Setting"
                          style={{ padding: '6px', color: 'var(--text-secondary)' }}
                        >
                          <Edit2 size={14} />
                        </button>

                        <button
                          onClick={() => handleExport(c)}
                          className="btn btn-ghost"
                          title="Export Campaign JSON"
                          style={{ padding: '6px', color: 'var(--text-secondary)' }}
                        >
                          <Download size={14} />
                        </button>

                        <button
                          onClick={() => setConfirmDeleteId(isConfirmingDelete ? null : c.id)}
                          className="btn btn-ghost"
                          title="Delete Campaign"
                          style={{
                            padding: '6px',
                            color: isConfirmingDelete ? '#ef4444' : 'var(--text-muted)',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}

                  {isConfirmingDelete && (
                    <div
                      className="animate-fade-in"
                      style={{
                        padding: '10px 12px',
                        borderRadius: '6px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#f87171' }}>
                        <AlertTriangle size={15} />
                        <span>Delete "{c.name}" and all its entities? This cannot be undone.</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="btn btn-ghost"
                          style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="btn"
                          style={{
                            fontSize: '0.72rem',
                            padding: '3px 10px',
                            background: '#dc2626',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Yes, Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
