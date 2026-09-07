import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Compass,
  FileText,
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
import { NodeDrawer } from './components/NodeDrawer';
import { PlayerPortal } from './components/PlayerPortal';
import { SettingsModal } from './components/SettingsModal';
import { StatBlockLab } from './components/StatBlockLab';
import { Campaign, GraphData, HierarchyItem, NodeItem } from './types';

export function App() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string>('default-campaign');
  const [isPlayerMode, setIsPlayerMode] = useState<boolean>(false);

  // DM Workspace Tabs: hierarchy | graph | ingestion | statblock | map
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'graph' | 'ingestion' | 'statblock' | 'map'>('hierarchy');

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

  // Check URL path on mount (e.g. /player route)
  useEffect(() => {
    if (window.location.pathname.includes('/player')) {
      setIsPlayerMode(true);
    }
  }, []);

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
      if (cList.length > 0 && !cid) {
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

  const monsters = graphData.nodes.filter((n) => n.type === 'monster');
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
      {/* Top Navigation */}
      <Navbar
        campaigns={campaigns}
        activeCampaignId={activeCampaignId}
        onSelectCampaign={handleSelectCampaign}
        onCreateCampaign={handleCreateCampaign}
        isPlayerMode={isPlayerMode}
        onTogglePlayerMode={() => setIsPlayerMode(!isPlayerMode)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleAgent={() => setIsAgentOpen(!isAgentOpen)}
        isAgentOpen={isAgentOpen}
        onSelectNode={(n) => setSelectedNode(n)}
      />

      {/* Master Split-Pane: Main Workspace + Resizable Docked Co-DM Studio */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: 'calc(100vh - 64px)' }}>
        {/* Main Content Area */}
        <main style={{ flex: 1, overflowY: 'auto', minWidth: 0, position: 'relative' }}>
          {isPlayerMode ? (
            /* Player Portal View */
            <PlayerPortal campaignId={activeCampaignId} />
          ) : (
            /* DM Master Suite */
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
              {/* DM Secondary Tab Bar */}
              <div
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface)',
                  padding: '0 24px',
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
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
                  <Swords size={16} /> 5e Monsters &amp; Encounter Lab ({monsters.length})
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
              <div style={{ flex: 1 }}>
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
                    monsters={monsters}
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
