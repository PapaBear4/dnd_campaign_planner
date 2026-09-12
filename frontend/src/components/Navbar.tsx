import React, { useState } from 'react';
import {
  BookOpen,
  Compass,
  Download,
  Edit2,
  Eye,
  FolderOpen,
  Moon,
  Palette,
  Plus,
  RotateCw,
  Scroll,
  Search,
  Settings,
  Sparkles,
  Sun,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import { Campaign, NodeItem } from '../types';
import { exportCampaign, importCampaign, searchNodes, updateCampaign } from '../api';
import { CampaignManagerModal } from './CampaignManagerModal';

export type AppTheme = 'obsidian' | 'sunlight' | 'parchment' | 'underdark';

const THEMES: { id: AppTheme; label: string; icon: string; desc: string; bg: string; border: string }[] = [
  { id: 'obsidian', label: 'Obsidian', icon: '🌑', desc: 'Dark Fantasy', bg: '#0f1420', border: '#f59e0b' },
  { id: 'sunlight', label: 'Sunlight', icon: '☀️', desc: 'Crisp Light Mode', bg: '#ffffff', border: '#d97706' },
  { id: 'parchment', label: 'Parchment', icon: '📜', desc: 'Classic D&D Tome', bg: '#f7f3e8', border: '#b45309' },
  { id: 'underdark', label: 'Underdark', icon: '🌌', desc: 'Bioluminescent Void', bg: '#0b1120', border: '#06b6d4' },
];

interface NavbarProps {
  campaigns: Campaign[];
  activeCampaignId: string;
  onSelectCampaign: (id: string) => void;
  onCreateCampaign: () => void;
  onRefreshCampaigns: () => void;
  isRefreshing?: boolean;
  isPlayerMode: boolean;
  onTogglePlayerMode: () => void;
  onOpenSettings: () => void;
  onToggleAgent: () => void;
  isAgentOpen: boolean;
  onSelectNode?: (node: NodeItem) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  campaigns,
  activeCampaignId,
  onSelectCampaign,
  onCreateCampaign,
  onRefreshCampaigns,
  isRefreshing = false,
  isPlayerMode,
  onTogglePlayerMode,
  onOpenSettings,
  onToggleAgent,
  isAgentOpen,
  onSelectNode,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NodeItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [theme, setTheme] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('dnd_app_theme') as AppTheme;
    if (saved && ['obsidian', 'sunlight', 'parchment', 'underdark'].includes(saved)) {
      document.documentElement.setAttribute('data-theme', saved);
      return saved;
    }
    return 'obsidian';
  });
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

  const handleSelectTheme = (newTheme: AppTheme) => {
    setTheme(newTheme);
    localStorage.setItem('dnd_app_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    setIsThemeMenuOpen(false);
  };

  const activeCampaign = campaigns.find((c) => c.id === activeCampaignId);
  const [isCampaignManagerOpen, setIsCampaignManagerOpen] = useState(false);

  const handleQuickRename = async () => {
    if (!activeCampaign) return;
    const newName = window.prompt(`Rename campaign "${activeCampaign.name}":`, activeCampaign.name);
    if (!newName || !newName.trim() || newName.trim() === activeCampaign.name) return;
    try {
      await updateCampaign(activeCampaign.id, { name: newName.trim() });
      onRefreshCampaigns();
    } catch (err) {
      alert('Failed to rename campaign: ' + err);
    }
  };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchNodes(q, activeCampaignId, isPlayerMode);
      setSearchResults(results);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExport = async () => {
    if (!activeCampaignId) return;
    try {
      const bundle = await exportCampaign(activeCampaignId);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeCampaign?.name.replace(/\s+/g, '_') || 'campaign'}_export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export campaign: ' + err);
    }
  };

  const handleImport = () => {
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
        window.location.reload();
      } catch (err) {
        alert('Failed to import campaign: ' + err);
      }
    };
    input.click();
  };

  return (
    <header className="glass-panel" style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      borderBottom: '1px solid var(--border-subtle)',
      padding: '10px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px'
    }}>
      {/* Brand & Campaign Picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(245, 158, 11, 0.4)',
            color: '#0a0d14'
          }}>
            <BookOpen size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.2rem', lineHeight: 1.1, fontWeight: 800 }}>ArcaneWeaver</h1>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-gold)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
              D&amp;D 5e Co-DM Studio
            </span>
          </div>
        </div>

        {/* Campaign Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-surface)', padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <BookOpen size={16} style={{ color: 'var(--color-gold)' }} />
          <select
            value={activeCampaignId}
            onChange={(e) => onSelectCampaign(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id} style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleQuickRename}
            title="Rename Active Campaign"
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', padding: '2px' }}
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={onCreateCampaign}
            title="Create New Campaign"
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', padding: '2px' }}
          >
            <Plus size={15} />
          </button>
          <button
            onClick={() => setIsCampaignManagerOpen(true)}
            title="Manage All Campaigns (CRUD, Rename, Delete, Switch)"
            style={{ background: 'none', border: 'none', color: 'var(--color-gold)', cursor: 'pointer', display: 'flex', padding: '2px' }}
          >
            <FolderOpen size={14} />
          </button>
        </div>
      </div>

      {/* Global Search Bar with FTS5 Results Popover */}
      <div style={{ position: 'relative', flex: '1', maxWidth: '380px' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder={isPlayerMode ? "Search revealed lore..." : "FTS5 Search campaign, NPCs, statblocks, secrets..."}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              borderRadius: '8px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
          {searchQuery && (
            <button
              onClick={() => handleSearch('')}
              style={{ position: 'absolute', right: '10px', top: '9px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {isSearching && searchResults.length > 0 && (
          <div className="glass-panel animate-fade-in" style={{
            position: 'absolute',
            top: '42px',
            left: 0,
            right: 0,
            maxHeight: '320px',
            overflowY: 'auto',
            borderRadius: '8px',
            padding: '8px',
            boxShadow: '0 12px 30px rgba(0,0,0,0.8)',
            zIndex: 200,
            border: '1px solid var(--border-medium)'
          }}>
            {searchResults.map((node) => (
              <div
                key={node.id}
                onClick={() => {
                  if (onSelectNode) onSelectNode(node);
                  setIsSearching(false);
                }}
                style={{
                  padding: '8px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{node.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{node.summary?.slice(0, 70)}</div>
                </div>
                <span className={`badge badge-${node.type}`}>{node.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right Controls: Mode Toggle, Agent, Export/Import, Settings */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Mode Switcher Button */}
        <button
          onClick={onTogglePlayerMode}
          className="btn"
          style={{
            background: isPlayerMode ? 'rgba(16, 185, 129, 0.15)' : 'var(--color-arcane-blue-bg)',
            border: isPlayerMode ? '1px solid #10b981' : '1px solid var(--color-arcane-blue-border)',
            color: isPlayerMode ? (theme === 'parchment' || theme === 'sunlight' ? '#065f46' : '#34d399') : 'var(--color-arcane-blue-text)',
            fontWeight: 600,
            padding: '6px 14px'
          }}
          title="Toggle between DM Master Suite and Player Portal"
        >
          {isPlayerMode ? (
            <>
              <UserCheck size={16} /> Player Portal View
            </>
          ) : (
            <>
              <Eye size={16} /> DM Master Suite
            </>
          )}
        </button>

        {/* Co-DM AI Toggle */}
        <button
          onClick={onToggleAgent}
          className={`btn ${isAgentOpen ? 'btn-primary' : 'btn-secondary'} pulse-gold`}
          style={{ padding: '6px 14px' }}
          title="Open Co-DM AI Assistant"
        >
          <Sparkles size={16} />
          <span>Co-DM</span>
        </button>

        {/* Refresh Campaign Data Button */}
        <button
          onClick={onRefreshCampaigns}
          className="btn btn-ghost"
          style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title={isRefreshing ? 'Refreshing campaign data...' : 'Refresh Campaign Data (Sync Graph & Hierarchy)'}
          disabled={isRefreshing}
          aria-label="Refresh Campaign Data"
        >
          <RotateCw
            size={18}
            className={isRefreshing ? 'spin' : ''}
            style={{
              color: isRefreshing ? 'var(--color-gold)' : 'var(--text-secondary)',
              transition: 'color 0.2s',
            }}
          />
        </button>

        {/* Export & Import (DM Only) */}
        {!isPlayerMode && (
          <>
            <button onClick={handleExport} className="btn btn-ghost" title="Export Campaign JSON" style={{ padding: '8px' }}>
              <Download size={18} />
            </button>
            <button onClick={handleImport} className="btn btn-ghost" title="Import Campaign JSON" style={{ padding: '8px' }}>
              <Upload size={18} />
            </button>
          </>
        )}

        {/* Theme Picker Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
            className="btn btn-ghost"
            title={`Current Theme: ${theme.toUpperCase()} (Click to change)`}
            style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            {theme === 'sunlight' ? (
              <Sun size={18} style={{ color: '#d97706' }} />
            ) : theme === 'parchment' ? (
              <Scroll size={18} style={{ color: '#b45309' }} />
            ) : theme === 'underdark' ? (
              <Palette size={18} style={{ color: '#06b6d4' }} />
            ) : (
              <Moon size={18} style={{ color: '#f59e0b' }} />
            )}
          </button>

          {isThemeMenuOpen && (
            <div
              className="glass-panel animate-fade-in"
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                width: '220px',
                borderRadius: '10px',
                padding: '8px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
              }}
            >
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', padding: '4px 8px', letterSpacing: '0.05em' }}>
                THEMES &amp; APPEARANCE
              </div>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleSelectTheme(t.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: theme === t.id ? `1px solid ${t.border}` : '1px solid transparent',
                    background: theme === t.id ? 'var(--bg-card-hover)' : 'transparent',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (theme !== t.id) e.currentTarget.style.background = 'var(--bg-card)';
                  }}
                  onMouseLeave={(e) => {
                    if (theme !== t.id) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>{t.icon}</span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600 }}>{t.label}</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{t.desc}</span>
                  </div>
                  {theme === t.id && (
                    <span style={{ marginLeft: 'auto', color: 'var(--color-gold)', fontSize: '0.75rem' }}>●</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Settings Modal */}
        <button onClick={onOpenSettings} className="btn btn-ghost" title="Settings &amp; Model Selection" style={{ padding: '8px' }}>
          <Settings size={18} />
        </button>
      </div>

      {/* Campaign Manager Modal */}
      <CampaignManagerModal
        isOpen={isCampaignManagerOpen}
        onClose={() => setIsCampaignManagerOpen(false)}
        campaigns={campaigns}
        activeCampaignId={activeCampaignId}
        onSelectCampaign={onSelectCampaign}
        onRefreshCampaigns={onRefreshCampaigns}
      />
    </header>
  );
};
