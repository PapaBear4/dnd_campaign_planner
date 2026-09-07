import React, { useState } from 'react';
import {
  BookOpen,
  Compass,
  Download,
  Eye,
  Plus,
  Search,
  Settings,
  Sparkles,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import { Campaign, NodeItem } from '../types';
import { exportCampaign, importCampaign, searchNodes } from '../api';

interface NavbarProps {
  campaigns: Campaign[];
  activeCampaignId: string;
  onSelectCampaign: (id: string) => void;
  onCreateCampaign: () => void;
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

  const activeCampaign = campaigns.find((c) => c.id === activeCampaignId);

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
            <Compass size={24} />
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
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id} style={{ background: '#121722', color: '#fff' }}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={onCreateCampaign}
            title="Create New Campaign"
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}
          >
            <Plus size={16} />
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
              color: '#fff',
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
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#fff' }}>{node.title}</div>
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
            background: isPlayerMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
            border: isPlayerMode ? '1px solid #10b981' : '1px solid #3b82f6',
            color: isPlayerMode ? '#34d399' : '#60a5fa',
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

        {/* Settings Modal */}
        <button onClick={onOpenSettings} className="btn btn-ghost" title="Settings &amp; Model Selection" style={{ padding: '8px' }}>
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
};
