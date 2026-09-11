import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Compass,
  FileText,
  Layers,
  MapPin,
  Plus,
  Share2,
  Sparkles,
  Swords,
  Users,
} from 'lucide-react';
import { createCampaign, getCampaigns, getGraph, getHierarchy } from './api';
import { CoDMPanel } from './components/CoDMPanel';
import { GraphView } from './components/GraphView';
import { HierarchyPlanner } from './components/HierarchyPlanner';
import { IngestionHub } from './components/IngestionHub';
import { MapStudio } from './components/MapStudio';
import { Navbar } from './components/Navbar';
import { NodeBrowser } from './components/NodeBrowser';
import { NodeDrawer } from './components/NodeDrawer';
import { PlayerPortal } from './components/PlayerPortal';
import { SettingsModal } from './components/SettingsModal';
import { StatBlockLab } from './components/StatBlockLab';
import { Campaign, GraphData, HierarchyItem, NodeItem } from './types';

export type DMTab = 'hierarchy' | 'graph' | 'nodes' | 'ingestion' | 'statblock' | 'map';

export function App() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  // State Persistence: initialize from localStorage
  const [activeCampaignId, setActiveCampaignId] = useState<string>(() => {
    return localStorage.getItem('dnd_active_campaign_id') || 'default-campaign';
  });
  const [isPlayerMode, setIsPlayerMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('dnd_player_mode');
    if (saved !== null) return saved === 'true';
    return window.location.pathname.includes('/player');
  });

  // DM Workspace Tabs: hierarchy | graph | nodes | ingestion | statblock | map
  const [activeTab, setActiveTab] = useState<DMTab>(() => {
    const saved = localStorage.getItem('dnd_active_tab') as DMTab;
    if (saved && ['hierarchy', 'graph', 'nodes', 'ingestion', 'statblock', 'map'].includes(saved)) {
      return saved;
    }
    return 'hierarchy';
  });

  // Sync to localStorage on change
  useEffect(() => {
    if (activeCampaignId) {
      localStorage.setItem('dnd_active_campaign_id', activeCampaignId);
    }
  }, [activeCampaignId]);

  useEffect(() => {
    localStorage.setItem('dnd_player_mode', String(isPlayerMode));
  }, [isPlayerMode]);

  useEffect(() => {
    localStorage.setItem('dnd_active_tab', activeTab);
  }, [activeTab]);

  // Co-DM Studio width (docked split-pane)
  const [coDmWidth, setCoDmWidth] = useState<number>(440);

  // Campaign Data
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [hierarchy, setHierarchy] = useState<HierarchyItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Drawers
  const [isAgentOpen, setIsAgentOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<NodeItem | null>(null);
  const [focusedCoDMNode, setFocusedCoDMNode] = useState<NodeItem | null>(null);

  const loadData = async (cid?: string) => {
    const targetCid = cid || activeCampaignId;
    try {
      setLoading(true);
      const [cList, g, h] = await Promise.all([
        getCampaigns(),
        getGraph(targetCid, false),
        getHierarchy(targetCid, false),
      ]);
      setCampaigns(cList);
      if (cList.length > 0) {
        const found = cList.find((c) => c.id === targetCid) || cList[0];
        setActiveCampaignId(found.id);
      }
      setGraphData(g);
      setHierarchy(h);
    } catch (err) {
      console.error('Failed to load campaign data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeCampaignId]);

  const handleSelectCampaign = (id: string) => {
    setActiveCampaignId(id);
    loadData(id);
  };

  const handleCreateCampaign = async () => {
    const name = window.prompt('Enter new campaign name:');
    if (!name?.trim()) return;
    const setting = window.prompt('Setting (e.g. Forgotten Realms, Eberron, Homebrew):', 'D&D 5e');
    try {
      const created = await createCampaign({ name: name.trim(), setting: setting?.trim() || 'D&D 5e' });
      setActiveCampaignId(created.id);
      loadData(created.id);
    } catch (err) {
      alert('Failed to create campaign: ' + err);
    }
  };

  const handleFocusCoDM = (node: NodeItem) => {
    setFocusedCoDMNode(node);
    setIsAgentOpen(true);
  };

  const bestiaryCreatures = graphData.nodes.filter((n) => n.type === 'monster' || n.type === 'npc');
  const locations = graphData.nodes.filter((n) => n.type === 'location');
  const maps = graphData.nodes.filter((n) => n.type === 'map' || n.data_json?.map_url);
  const sessions = graphData.nodes.filter((n) => n.type === 'session');

  const [ingestionInitialCategory, setIngestionInitialCategory] = useState<'book' | 'monster' | 'character' | 'session'>('book');
  const [ingestionTargetSessionId, setIngestionTargetSessionId] = useState<string | undefined>(undefined);

  const handleOpenTranscriptIngestion = (sessionNodeId?: string) => {
    setIngestionInitialCategory('session');
    setIngestionTargetSessionId(sessionNodeId);
    setActiveTab('ingestion');
  };

  const handleOpenBookDecomposition = () => {
    setIngestionInitialCategory('book');
    setIngestionTargetSessionId(undefined);
    setActiveTab('ingestion');
  };

  return (
    <div style={{ height: '100vh', maxHeight: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
      {/* Top Navigation */}
      <Navbar
        campaigns={campaigns}
        activeCampaignId={activeCampaignId}
        onSelectCampaign={handleSelectCampaign}
        onCreateCampaign={handleCreateCampaign}
        onRefreshCampaigns={() => loadData()}
        isPlayerMode={isPlayerMode}
        onTogglePlayerMode={() => setIsPlayerMode(!isPlayerMode)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleAgent={() => setIsAgentOpen(!isAgentOpen)}
        isAgentOpen={isAgentOpen}
        onSelectNode={(n) => setSelectedNode(n)}
      />

      {/* Master Split-Pane: Main Workspace + Resizable Docked Co-DM Studio */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', height: 'calc(100vh - 64px)' }}>
        {/* Main Content Area */}
        <main style={{ flex: 1, height: '100%', minHeight: 0, overflowY: 'auto', minWidth: 0, position: 'relative' }}>
          {isPlayerMode ? (
            /* Player Portal View */
            <PlayerPortal campaignId={activeCampaignId} />
          ) : (
            /* DM Master Suite */
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '100%' }}>
              {/* DM Secondary Tab Bar */}
              <div
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface)',
                  padding: '0 24px',
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                  flexShrink: 0,
                }}
              >
                <button
                  onClick={() => setActiveTab('hierarchy')}
                  className={`btn ${activeTab === 'hierarchy' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{
                    borderRadius: '0',
                    borderBottom: activeTab === 'hierarchy' ? '2px solid var(--color-gold)' : '2px solid transparent',
                    padding: '12px 16px',
                    fontSize: '0.85rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Calendar size={16} /> Arc &amp; Timeline Planner
                </button>

                <button
                  onClick={() => setActiveTab('graph')}
                  className={`btn ${activeTab === 'graph' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{
                    borderRadius: '0',
                    borderBottom: activeTab === 'graph' ? '2px solid var(--color-gold)' : '2px solid transparent',
                    padding: '12px 16px',
                    fontSize: '0.85rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Share2 size={16} /> Entity Knowledge Web
                </button>

                <button
                  onClick={() => setActiveTab('nodes')}
                  className={`btn ${activeTab === 'nodes' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{
                    borderRadius: '0',
                    borderBottom: activeTab === 'nodes' ? '2px solid var(--color-gold)' : '2px solid transparent',
                    padding: '12px 16px',
                    fontSize: '0.85rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Layers size={16} /> Node Codex ({graphData.nodes.length})
                </button>

                <button
                  onClick={() => {
                    setIngestionTargetSessionId(undefined);
                    setActiveTab('ingestion');
                  }}
                  className={`btn ${activeTab === 'ingestion' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{
                    borderRadius: '0',
                    borderBottom: activeTab === 'ingestion' ? '2px solid var(--color-gold)' : '2px solid transparent',
                    padding: '12px 16px',
                    fontSize: '0.85rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <BookOpen size={16} /> 📖 Ingestion &amp; Co-DM Hub
                </button>

                <button
                  onClick={() => setActiveTab('statblock')}
                  className={`btn ${activeTab === 'statblock' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{
                    borderRadius: '0',
                    borderBottom: activeTab === 'statblock' ? '2px solid var(--color-gold)' : '2px solid transparent',
                    padding: '12px 16px',
                    fontSize: '0.85rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Swords size={16} /> NPCs &amp; Bestiary ({bestiaryCreatures.length})
                </button>

                <button
                  onClick={() => setActiveTab('map')}
                  className={`btn ${activeTab === 'map' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{
                    borderRadius: '0',
                    borderBottom: activeTab === 'map' ? '2px solid var(--color-gold)' : '2px solid transparent',
                    padding: '12px 16px',
                    fontSize: '0.85rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Compass size={16} /> Maps &amp; Handouts ({maps.length})
                </button>
              </div>

              {/* Active Workspace View */}
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {activeTab === 'hierarchy' && (
                  <HierarchyPlanner
                    hierarchy={hierarchy}
                    campaignId={activeCampaignId}
                    onRefresh={loadData}
                    onSelectNode={(n) => setSelectedNode(n)}
                    onFocusCoDM={handleFocusCoDM}
                    onNavigateToIngestion={handleOpenBookDecomposition}
                    onNavigateToTranscript={handleOpenTranscriptIngestion}
                  />
                )}

                {activeTab === 'graph' && (
                  <GraphView
                    graphData={graphData}
                    campaignId={activeCampaignId}
                    onRefresh={loadData}
                    onSelectNode={(n) => setSelectedNode(n)}
                    onSwitchToBrowser={() => setActiveTab('nodes')}
                  />
                )}

                {activeTab === 'nodes' && (
                  <NodeBrowser
                    nodes={graphData.nodes}
                    campaignId={activeCampaignId}
                    onRefresh={loadData}
                    onSelectNode={(n) => setSelectedNode(n)}
                    onFocusCoDM={handleFocusCoDM}
                  />
                )}

                {activeTab === 'ingestion' && (
                  <IngestionHub
                    campaignId={activeCampaignId}
                    onRefresh={loadData}
                    onNavigateTab={(tab) => setActiveTab(tab as any)}
                    initialCategory={ingestionInitialCategory}
                    initialSessionNodeId={ingestionTargetSessionId}
                    sessions={sessions}
                  />
                )}

                {activeTab === 'statblock' && (
                  <StatBlockLab
                    monsters={bestiaryCreatures}
                    campaignId={activeCampaignId}
                    onRefresh={loadData}
                    onFocusCoDM={handleFocusCoDM}
                  />
                )}

                {activeTab === 'map' && (
                  <MapStudio
                    locations={locations}
                    maps={maps}
                    campaignId={activeCampaignId}
                    onRefresh={loadData}
                    onSelectNode={(n) => setSelectedNode(n)}
                    onFocusCoDM={handleFocusCoDM}
                  />
                )}
              </div>
            </div>
          )}
        </main>

        {/* Resizable Docked Co-DM Studio Pane */}
        {isAgentOpen && (
          <CoDMPanel
            isOpen={isAgentOpen}
            onClose={() => setIsAgentOpen(false)}
            campaignId={activeCampaignId}
            focusedNode={focusedCoDMNode}
            onNodeCreated={loadData}
            width={coDmWidth}
            onWidthChange={setCoDmWidth}
          />
        )}
      </div>

      {/* Node Inspector & Editor Slide-over */}
      <NodeDrawer
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        onRefresh={loadData}
        onFocusCoDM={handleFocusCoDM}
        isAgentOpen={isAgentOpen}
        coDmWidth={coDmWidth}
      />

      {/* Settings Modal (Gemini API Key, Models, LAN info) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsSaved={loadData}
      />
    </div>
  );
}

export default App;
