import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Compass,
  FileText,
  Flame,
  GitMerge,
  HelpCircle,
  Layers,
  ListChecks,
  Loader2,
  MessageSquare,
  Mic,
  Plus,
  RefreshCw,
  Scroll,
  Send,
  Shield,
  ShieldCheck,
  Sparkles,
  Split,
  Square,
  Swords,
  Tag,
  Trash2,
  FolderOpen,
  Upload,
  User,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import {
  agentAdaptSession,
  agentApplyExtracted,
  agentApplySessionAdaptation,
  agentDecomposeAdventure,
  agentRedraftNode,
  checkDuplicateUpload,
  createNode,
  deleteUploadedFile,
  getDecompositionJob,
  getLatestDecompositionJob,
  getSettings,
  listUploads,
  parsePdfDocument,
  retryDecompositionJob,
  stopDecompositionJob,
  uploadFile,
  UploadedDoc,
} from '../api';
import { DocumentLibraryModal } from './DocumentLibraryModal';
import { DuplicateUploadModal } from './DuplicateUploadModal';
import { AgentScratchpadModal } from './AgentScratchpadModal';
import { MarkdownView } from './MarkdownView';
import {
  AgentScratchpad,
  DecompositionCluster,
  DecompositionJob,
  ExtractedDraftEdge,
  ExtractedDraftNode,
  NodeItem,
  NodeType,
  SubAgentManifestItem,
} from '../types';

interface IngestionHubProps {
  campaignId: string;
  onRefresh: () => void;
  onNavigateTab: (tab: string) => void;
  initialCategory?: 'book' | 'monster' | 'character' | 'session' | 'lore';
  initialSessionNodeId?: string;
  sessions?: NodeItem[];
}

interface SteeringMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: string;
  nodeCount?: number;
}

// Preset steering options for the adventure decomposer
const bookPresets = [
  { label: 'Comprehensive Chapter', prompt: 'Decompose this entire adventure chapter. Extract all keyed locations, encounters, traps, NPCs, factions, quests, secrets, and treasures. Maintain full epistemic confidence ratings.', mode: 'comprehensive' as const },
  { label: 'Encounters & Roster', prompt: 'Focus on combat and social encounters. Extract enemy groups, monster stats, tactics, environmental hazards, and potential negotiations.', mode: 'monsters' as const },
  { label: 'Quests & Objectives', prompt: 'Focus on campaign progression. Extract main and side quests, milestones, hooks, objectives, NPC patrons, and rewards.', mode: 'campaign_structure' as const },
  { label: 'Keyed Locations & Lore', prompt: 'Focus on worldbuilding and map keys. Extract all numbered/lettered rooms, geographical features, historical lore, and hidden secrets.', mode: 'world_lore' as const },
];

const monsterPresets = [
  { label: 'Monster / Boss Focus', prompt: 'Extract all creatures, monsters, bosses, and stat block references with CR, abilities, and loot.', mode: 'monsters' as const },
  { label: 'Lair & Ecology', prompt: 'Extract creature habitats, environmental effects, lair actions, and regional effects.', mode: 'world_lore' as const },
];

const characterPresets = [
  { label: 'NPC Roster & Dialog', prompt: 'Extract all NPCs, personalities, physical descriptions, roleplay guidance, and voiced quotes.', mode: 'characters' as const },
  { label: 'Factions & Allegiances', prompt: 'Extract all faction leaders, agents, rivalries, and disposition toward the party.', mode: 'campaign_structure' as const },
];

const lorePresets = [
  { label: 'World History & Rumors', prompt: 'Extract ancient history, forgotten pantheons, local legends, and tavern rumors with reliability tags.', mode: 'world_lore' as const },
  { label: 'Magic Items & Artifacts', prompt: 'Extract unique relics, magical items, curses, and identification lore.', mode: 'world_lore' as const },
];

const SAMPLE_VTT_CHAT_TRANSCRIPT = `[00:15:22] DM: The heavy iron door grinds open, revealing a sunken chamber slick with moss. Water drips from the vaulted ceiling into a circular stone well at the center. Two alcoves flank the north wall.
[00:18:45] Elora (Ranger): I hold up my torch and examine the perimeter. Rolling Perception... that's a 17.
[00:19:10] DM: With a 17, Elora, you spot drag marks leading toward the well, and a discarded bronze nursery key resting near the western pillar.
[00:22:30] Torvin (Paladin): I step forward toward the well with my warhammer drawn. "Stay alert, friends."
[00:25:00] DM: As Torvin approaches the well, three Dire Rats scurry out of the northern alcove, chittering aggressively! Roll for initiative!
[00:28:15] Combat Round 1: Torvin smites the lead rat for 14 damage (destroyed). Elora fires two arrows, killing the second rat. The final rat flees into a drainage grate. Combat ends.
[00:34:20] Meepo: "Meepo fails! Calcryx is gone! Dragon stolen by vile goblins! Yusdrayl will feed Meepo to the beasts!"
[00:38:00] Elora: "Wait! We aren't here to hurt you. Who stole your dragon?"
[00:41:15] Meepo: "Goblins! Under chief Durnn! They crept through the dry moat and snatched Calcryx from Meepo's nursery cage!"
[00:44:00] Torvin: Persuasion check... 19! "Meepo, take us to your leader Yusdrayl. We will retrieve your dragon if you grant us safe passage and share what you know of the citadel."
[00:46:30] Meepo: "You speak truth?! Big soft-skins help Meepo?! Meepo takes you to Yusdrayl! But beware, the trap hall has a secret trigger!"
[00:52:10] DM: Meepo hands you an old brass key—the nursery key—and agrees to guide you through Kobold territory safely. You take a short rest in the guard room. We will pick up right outside the throne room of Kobold Queen Yusdrayl next week!`;

const SAMPLE_ACTUAL_PLAY_TRANSCRIPT = `[00:02:15] DM: You descend the treacherous ravine using the old knotted rope. The damp air smells of sulfur and old dust. Before you is the cracked courtyard of the sunken Sunless Citadel.
[00:08:40] Elora (Rogue): I'm checking the cracked masonry for traps. Rolling Investigation... 18!
[00:09:12] DM: You notice a subtle pressure plate wired to a hidden pit trap. You wedge an iron spike into the counterweight to disarm it safely.
[00:15:30] Torvin (Fighter): Let's push through into the vestibule. We keep weapons drawn.
[00:17:00] DM: Three Dire Rats leap out from behind the fallen masonry! Initiative!
[00:24:45] DM: Torvin cuts down the lead rat with a sweeping blow, and Elora's arrow finishes the last one. Combat ends. You take a brief breath.
[00:31:10] Varis (Wizard): There's a wooden door slightly ajar to the north. I hear weeping.
[00:33:00] DM: You open the door. Cowering in the corner in rags is a small reptilian creature with large watery eyes—a Kobold clutching a dragon scale.
[00:34:20] Meepo: "Meepo fails! Calcryx is gone! Dragon stolen by vile goblins! Yusdrayl will feed Meepo to the beasts!"
[00:38:00] Elora: "Wait! We aren't here to hurt you. Who stole your dragon?"
[00:41:15] Meepo: "Goblins! Under chief Durnn! They crept through the dry moat and snatched Calcryx from Meepo's nursery cage!"
[00:44:00] Torvin: Persuasion check... 19! "Meepo, take us to your leader Yusdrayl. We will retrieve your dragon if you grant us safe passage and share what you know of the citadel."
[00:46:30] Meepo: "You speak truth?! Big soft-skins help Meepo?! Meepo takes you to Yusdrayl! But beware, the trap hall has a secret trigger!"
[00:52:10] DM: Meepo hands you an old brass key—the nursery key—and agrees to guide you through Kobold territory safely. You take a short rest in the guard room. We will pick up right outside the throne room of Kobold Queen Yusdrayl next week!`;

const SAMPLE_SESSION_SUMMARY = `Session 1 Debrief & Summary:
- Date: Eleint 14, 1492 DR
- The party carefully climbed down the knotted ropes into the Ashen Plain ravine to reach the sunken fortress.
- Elora discovered a hidden pressure plate pit trap in the courtyard and disabled it with an iron spike.
- Encounter Resolved: 3 Dire Rats attacked from the courtyard rubble. Torvin and Elora eliminated them in 2 rounds.
- Social Interaction: The party discovered Meepo, a weeping kobold dragon-keeper, locked in a side chamber.
- Roleplay Outcome: Meepo explained that goblins under chieftain Durnn stole the kobolds' prized white dragon wyrmling, Calcryx. Torvin rolled a 19 Persuasion check and promised to help rescue the wyrmling.
- Fallout & State Change: Meepo became a friendly guide, giving the party an old brass nursery key and agreeing to lead them safely past the trap hall to Queen Yusdrayl.
- Stopping Point / Cliffhanger: The party completed a short rest in the guard post and stopped right outside the double doors of Queen Yusdrayl's throne chamber.`;

const DECOMP_TIPS = [
  'Multi-Agent Orchestration: Autonomous sub-agents collaborate to cluster visual pages, mine keyed rooms, audit completeness, and de-conflict campaign lore.',
  'Visual Page-Cluster Workers: Sub-agents inspect multi-page visual PDF clusters directly, preserving two-column layouts, keyed map callouts, sidebar insets, and tactical statblocks without text scrambling.',
  'Worker Scratchpad Mining: Extraction agents maintain internal scratchpads to inventory every keyed location, monster group, hidden trap, and NPC alias before constructing graph nodes.',
  'Automated QA Auditor: A dedicated verification sub-agent cross-checks the extracted entity inventory against indexed document text to detect and recover any omitted rooms or encounters.',
  'Domain Deconfliction & Inheritance: Specialists query your SQLite campaign graph to identify lore dilemmas and automatically inherit base 5e monster templates for custom stat variants.',
  'Epistemic Certainty Classification: Every node is tagged as Fact (Canon), Suspicion (Clue/Deduction), or Rumor (Tavern Tale) with precise source page citations for full provenance.',
  'Interactive Dilemma Resolution: When lore ambiguities arise, review cards let you 1-click Merge with existing lore, Create New, Skip, or provide custom instructions via the Other directive.',
];

export const IngestionHub: React.FC<IngestionHubProps> = ({
  campaignId,
  onRefresh,
  onNavigateTab,
  initialCategory = 'book',
  initialSessionNodeId,
  sessions = [],
}) => {
  const [activeCategory, setActiveCategory] = useState<'book' | 'monster' | 'character' | 'session' | 'lore'>(initialCategory);

  // Synchronize if initialCategory or initialSessionNodeId changes from parent
  useEffect(() => {
    if (initialCategory) {
      setActiveCategory(initialCategory);
    }
    if (initialSessionNodeId) {
      setTargetSessionId(initialSessionNodeId);
    }
  }, [initialCategory, initialSessionNodeId]);

  // Document Library & Duplicate Resolution state
  const [showLibraryModal, setShowLibraryModal] = useState<boolean>(false);
  const [libraryDocsCount, setLibraryDocsCount] = useState<number>(0);
  const [duplicateModalData, setDuplicateModalData] = useState<{
    file: File;
    existing: UploadedDoc;
    category: string;
  } | null>(null);

  const refreshLibraryCount = () => {
    listUploads(campaignId)
      .then((docs) => setLibraryDocsCount(docs.length))
      .catch((err) => console.error('Error loading library count:', err));
  };

  useEffect(() => {
    refreshLibraryCount();
    getSettings()
      .then((s) => {
        if (s?.gemini_model) {
          setActiveModel(s.gemini_model);
        }
      })
      .catch((err) => console.error('Error loading settings in IngestionHub:', err));
  }, [campaignId]);

  const [activeModel, setActiveModel] = useState<string>('');

  // ==========================================
  // 1. ADVENTURE DECOMPOSER STATE
  // ==========================================
  const [uploadedFilename, setUploadedFilename] = useState<string>('');
  const [originalName, setOriginalName] = useState<string>('');
  const [totalPages, setTotalPages] = useState<number>(0);
  const [startPage, setStartPage] = useState<number>(1);
  const [endPage, setEndPage] = useState<number>(1);
  const [pastedText, setPastedText] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const [instruction, setInstruction] = useState<string>(
    'Decompose this entire document into all overarching Campaign Arcs, primary Quests, key Sessions, Encounters, named NPCs, monsters, locations, items, and factions.'
  );
  const [decompMode, setDecompMode] = useState<'comprehensive' | 'campaign_structure' | 'monsters' | 'characters' | 'world_lore' | 'general'>('comprehensive');
  const [exhaustiveMode, setExhaustiveMode] = useState<boolean>(true);
  const [chunksProcessed, setChunksProcessed] = useState<number>(0);

  const [isDecomposing, setIsDecomposing] = useState<boolean>(false);
  const [overviewSummary, setOverviewSummary] = useState<string>('');
  const [extractedNodes, setExtractedNodes] = useState<ExtractedDraftNode[]>([]);
  const [extractedEdges, setExtractedEdges] = useState<ExtractedDraftEdge[]>([]);
  const [selectedNodeIndices, setSelectedNodeIndices] = useState<Set<number>>(new Set());
  const [commitStatus, setCommitStatus] = useState<string>('');
  const [commitResult, setCommitResult] = useState<{ created: number; merged: number; edges: number } | null>(null);
  const [deconflictFilter, setDeconflictFilter] = useState<'all' | 'conflict' | 'potential_match' | 'exact_match' | 'new'>('all');

  const [steeringConversation, setSteeringConversation] = useState<SteeringMessage[]>([]);
  const [feedbackInput, setFeedbackInput] = useState<string>('');
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [redraftingNodeIndex, setRedraftingNodeIndex] = useState<number | null>(null);
  const [redraftError, setRedraftError] = useState<{ index: number; message: string } | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Live Decomposition Progress Feedback & Multi-Agent Manifest
  const [decompElapsedSeconds, setDecompElapsedSeconds] = useState<number>(0);
  const [decompTipIndex, setDecompTipIndex] = useState<number>(0);
  const [decompError, setDecompError] = useState<string | null>(null);
  const [decompStep, setDecompStep] = useState<number>(1);
  const [failedStep, setFailedStep] = useState<number | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobClusters, setJobClusters] = useState<DecompositionCluster[]>([]);
  const [jobSubagents, setJobSubagents] = useState<SubAgentManifestItem[]>([]);
  const [jobScratchpads, setJobScratchpads] = useState<Record<string, AgentScratchpad>>({});
  const [showScratchpadModal, setShowScratchpadModal] = useState<boolean>(false);
  const [selectedScratchpadAgent, setSelectedScratchpadAgent] = useState<string>('');
  const [isStopping, setIsStopping] = useState<boolean>(false);

  useEffect(() => {
    let interval: any = null;
    let tipInterval: any = null;
    let pollInterval: any = null;

    if (isDecomposing) {
      setDecompElapsedSeconds(0);
      setDecompError(null);

      interval = setInterval(() => {
        setDecompElapsedSeconds((prev) => prev + 1);
      }, 1000);

      tipInterval = setInterval(() => {
        setDecompTipIndex((prev) => (prev + 1) % DECOMP_TIPS.length);
      }, 4500);

      const pollLiveJob = async () => {
        if (!campaignId) return;
        try {
          const job = await getLatestDecompositionJob(campaignId);
          if (job) {
            if (job.id) setCurrentJobId(job.id);
            if (job.clusters && job.clusters.length > 0) setJobClusters(job.clusters);
            if (job.subagents && job.subagents.length > 0) setJobSubagents(job.subagents);
            if (job.scratchpads && Object.keys(job.scratchpads).length > 0) setJobScratchpads(job.scratchpads);
            if (job.current_step) setDecompStep(job.current_step);
            if (job.status === 'failed') {
              setFailedStep(job.current_step);
              if (job.error_message) setDecompError(job.error_message);
            }
          }
        } catch {
          // ignore poll error
        }
      };

      pollLiveJob();
      pollInterval = setInterval(pollLiveJob, 1500);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (tipInterval) clearInterval(tipInterval);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isDecomposing, campaignId]);

  // Reconnect to latest saved decomposition job for this campaign if available
  useEffect(() => {
    if (campaignId && extractedNodes.length === 0 && !currentJobId) {
      getLatestDecompositionJob(campaignId)
        .then((job) => {
          if (job) {
            setCurrentJobId(job.id);
            if (job.clusters) setJobClusters(job.clusters);
            if (job.subagents) setJobSubagents(job.subagents);
            if (job.scratchpads) setJobScratchpads(job.scratchpads);
            if (job.current_step) setDecompStep(job.current_step);
            if (job.status === 'failed') {
              setFailedStep(job.current_step);
              if (job.error_message) setDecompError(job.error_message);
            }
          }
        })
        .catch(() => {});
    }
  }, [campaignId]);


  // ==========================================
  // 2. SESSION TRANSCRIPT ADAPTATION STATE
  // ==========================================
  const [targetSessionId, setTargetSessionId] = useState<string>(initialSessionNodeId || '');
  const [sessionTranscript, setSessionTranscript] = useState<string>('');
  const [sessionInstruction, setSessionInstruction] = useState<string>(
    'Analyze what happened in this session. Update completed encounters, mark session status, change NPC dispositions/states based on player actions, extract any discovered loot or secrets, and draft the prep hook for the next session.'
  );
  const [isAdaptingSession, setIsAdaptingSession] = useState<boolean>(false);
  const [sessionAdaptationResult, setSessionAdaptationResult] = useState<{
    overview: string;
    status_updates: { node_id: string; title: string; node_type: string; new_status: string; reason: string; node_title?: string }[];
    npc_updates: { node_id?: string; name: string; disposition: string; state_changes: string; notes: string }[];
    emergent_nodes: any[];
    emergent_edges: any[];
    next_session_prep: {
      title: string;
      description: string;
      suggested_encounters: string[];
      dm_secrets: string;
    };
    player_recap: string;
    model: string;
  } | null>(null);

  const [selectedStatusUpdates, setSelectedStatusUpdates] = useState<Set<string>>(new Set());
  const [selectedEmergentNodeIndices, setSelectedEmergentNodeIndices] = useState<Set<number>>(new Set());
  const [applyNextSessionPrep, setApplyNextSessionPrep] = useState<boolean>(true);
  const [applyPlayerRecap, setApplyPlayerRecap] = useState<boolean>(true);
  const [sessionCommitStatus, setSessionCommitStatus] = useState<string>('');
  const [sessionCommitMessage, setSessionCommitMessage] = useState<string>('');

  const [sessionChatHistory, setSessionChatHistory] = useState<SteeringMessage[]>([]);
  const [sessionFeedbackInput, setSessionFeedbackInput] = useState<string>('');
  const [isRefiningSession, setIsRefiningSession] = useState<boolean>(false);
  const sessionChatBottomRef = useRef<HTMLDivElement | null>(null);

  // Preset chips for Decomposer
  const bookPresets = [
    {
      label: 'Everything',
      prompt: 'Decompose this entire document into all overarching Campaign Arcs, primary Quests, key Sessions, Encounters, named NPCs, monsters, locations, items, and factions.',
      mode: 'comprehensive' as const,
    },
    {
      label: 'Arc & Quests',
      prompt: 'Extract narrative campaign structure: main Arcs, primary Quests, key Sessions, and story milestones.',
      mode: 'campaign_structure' as const,
    },
    {
      label: 'Dungeon & Rooms',
      prompt: 'Extract keyed rooms as location nodes, with monster encounter rosters, hazards, and treasure items.',
      mode: 'comprehensive' as const,
    },
    {
      label: 'Factions & Secrets',
      prompt: 'Extract all factions, their leaders, active rivalries, hidden motivations, and rumor table entries as connected nodes.',
      mode: 'general' as const,
    },
    {
      label: 'Section or Pages',
      prompt: 'Focus specifically on the section or chapter titled "[Insert Chapter or Section Title]" (or approx. physical PDF pp. [X-Y] / book page [Z]). Extract all keyed encounters, room descriptions, NPCs, monsters, and treasure within this section.',
      mode: 'comprehensive' as const,
    },
  ];

  const monsterPresets = [
    {
      label: 'All Monsters',
      prompt: 'Extract all monsters and creatures mentioned with full 5e stats: AC, HP, Speed, CR, STR/DEX/CON/INT/WIS/CHA, traits, and actions.',
      mode: 'monsters' as const,
    },
    {
      label: 'Bosses & Villains',
      prompt: 'Extract only legendary creatures, unique named villains, and bosses with full stat blocks, lair actions, and legendary resistances.',
      mode: 'monsters' as const,
    },
    {
      label: 'Section or Pages',
      prompt: 'Extract only monsters appearing in section "[Section Title / Appendix]" (or approx. pp. [X-Y]) with complete 5e stat blocks.',
      mode: 'monsters' as const,
    },
  ];

  const characterPresets = [
    {
      label: 'All Characters',
      prompt: 'Extract player characters including Name, Class, Level, Race, Core Stats, Backstory, Personality Traits, Ideals, Bonds, and Flaws for campaign integration.',
      mode: 'characters' as const,
    },
    {
      label: 'Section or Pages',
      prompt: 'Extract player character sheets and backstories appearing in section "[Section Name / Character Appendix]" (or approx. pp. [X-Y]).',
      mode: 'characters' as const,
    },
  ];

  const lorePresets = [
    {
      label: 'All Lore',
      prompt: 'Extract all deities, pantheons, historical eras, legendary artifacts, holy orders, myths, prophecies, and rumors into linked lore and faction nodes.',
      mode: 'world_lore' as const,
    },
    {
      label: 'Deities & Religions',
      prompt: 'Extract all deities, divine domains, holy orders, cults, and religious sites. Create faction nodes for each order and location nodes for temples and shrines.',
      mode: 'world_lore' as const,
    },
    {
      label: 'History & Wars',
      prompt: 'Extract major historical eras, wars, cataclysms, and legendary figures as lore nodes with timeline edges.',
      mode: 'world_lore' as const,
    },
    {
      label: 'Section or Pages',
      prompt: 'Extract world lore, history, and geographical details specifically from section "[Chapter / Gazetteer Title]" (or approx. pp. [X-Y]).',
      mode: 'world_lore' as const,
    },
  ];

  const decomposerSuggestions = [
    'Split the primary quest into two sequential quests',
    'Add an ambush encounter before the boss room',
    'Make the kobolds open to diplomatic negotiation',
    'Add a secret treasure cache room location with hidden lore',
    'Scale combat encounters down for a 1st-level party',
    'Add a personal quest hook tied to a missing family member',
  ];

  // Preset chips for Session Adaptation
  const sessionPresets = [
    {
      label: 'Full Session Fallout & Pacing',
      prompt: 'Analyze what happened in this session. Update completed encounters, mark session status, change NPC dispositions/states based on player actions, extract any discovered loot or secrets, and draft the prep hook for the next session.',
    },
    {
      label: 'NPC & Faction Allegiance Shift',
      prompt: 'Focus on social interactions: analyze how player roleplay and skill checks shifted NPC attitudes, faction standings, and loyalties. Update NPC notes accordingly.',
    },
    {
      label: 'Emergent Loot, Clues & Discoveries',
      prompt: 'Extract all loot, magical trinkets, rumors, and clues discovered by the players during this session into connected graph nodes.',
    },
    {
      label: 'Next Session Prep & Cliffhanger',
      prompt: 'Analyze where the party stopped, their remaining resources/spell slots, and draft a high-tension opening hook and suggested encounters for Session N+1.',
    },
  ];

  const sessionSteeringSuggestions = [
    'Mark Session 1 as completed and resolve the ravine encounter',
    'Meepo should become an allied follower and guide',
    'The party also discovered an engraved silver dagger with dwarven runes',
    'Yusdrayl is still suspicious of the party',
    'Make the next session prep focus on goblin diplomacy or combat',
    'Shorten the player recap for the party journal',
  ];

  // ==========================================
  // DECOMPOSER & UPLOAD HANDLERS
  // ==========================================
  const performUpload = async (file: File, category: string, replace: boolean = false) => {
    setIsUploading(true);
    try {
      const res = await uploadFile(file, category, campaignId, replace);
      setUploadedFilename(res.filename);
      setOriginalName(res.original_name);
      let parsedPdfText = '';
      if (res.page_count) {
        setTotalPages(res.page_count);
        setEndPage(res.page_count); // Default to full document — DM can narrow range if needed
      }
      if (res.original_name.toLowerCase().endsWith('.pdf')) {
        try {
          const pdfInfo = await parsePdfDocument(res.filename, 100);
          setTotalPages(pdfInfo.total_pages || res.page_count || 1);
          setEndPage(pdfInfo.total_pages || res.page_count || 1);
          parsedPdfText = pdfInfo.combined_text || '';
        } catch {
          // fallback default
        }
      }

      if (category === 'transcript') {
        try {
          if (res.original_name.toLowerCase().endsWith('.pdf') && parsedPdfText) {
            setSessionTranscript(parsedPdfText);
          } else {
            const text = await file.text();
            setSessionTranscript(text);
          }
        } catch {}
      }

      refreshLibraryCount();
    } catch (err: any) {
      alert('File upload failed: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelectDoc = async (doc: UploadedDoc) => {
    setUploadedFilename(doc.filename);
    setOriginalName(doc.original_name);
    if (doc.page_count) {
      setTotalPages(doc.page_count);
      setEndPage(doc.page_count); // Default to full document
    }
    if (doc.category === 'transcript') {
      setActiveCategory('session');
      try {
        if (doc.filename.toLowerCase().endsWith('.pdf') || doc.original_name.toLowerCase().endsWith('.pdf')) {
          const pdfInfo = await parsePdfDocument(doc.filename, 100);
          setSessionTranscript(pdfInfo.combined_text || '');
        } else {
          const resp = await fetch(doc.url);
          const text = await resp.text();
          setSessionTranscript(text);
        }
      } catch {}
    } else if (doc.category === 'pdf') {
      setActiveCategory('book');
    } else if (doc.category === 'statblock') {
      setActiveCategory('monster');
    } else if (doc.category === 'pc') {
      setActiveCategory('character');
    } else if (doc.category === 'lore') {
      setActiveCategory('lore');
    }
    setShowLibraryModal(false);
  };

  const handleReuseExisting = (existing: UploadedDoc) => {
    handleSelectDoc(existing);
    setDuplicateModalData(null);
  };

  const handleReplaceFile = async () => {
    if (!duplicateModalData) return;
    const { file, category } = duplicateModalData;
    setDuplicateModalData(null);
    await performUpload(file, category, true);
  };

  const handleUploadAsCopy = async () => {
    if (!duplicateModalData) return;
    const { file, category } = duplicateModalData;
    setDuplicateModalData(null);
    await performUpload(file, category, false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const category = activeCategory === 'book' ? 'pdf' : activeCategory === 'monster' ? 'statblock' : activeCategory === 'lore' ? 'lore' : 'pc';

    try {
      const dup = await checkDuplicateUpload(file.name, campaignId, category);
      if (dup.exists && dup.existing_file) {
        setDuplicateModalData({ file, existing: dup.existing_file, category });
        e.target.value = '';
        return;
      }
    } catch (err) {
      console.error('Duplicate check error:', err);
    }

    await performUpload(file, category, false);
    e.target.value = '';
  };

  const handleRunDecomposition = async () => {
    if (!uploadedFilename && !pastedText.trim()) {
      alert('Please upload a file or paste text to decompose.');
      return;
    }

    setIsDecomposing(true);
    setCommitStatus('');
    setChunksProcessed(0);
    setDecompError(null);
    setFailedStep(null);
    try {
      const res = await agentDecomposeAdventure({
        filename: uploadedFilename || undefined,
        text_content: pastedText || undefined,
        instruction: instruction.trim(),
        decomposition_mode: activeCategory === 'monster' ? 'monsters' : activeCategory === 'character' ? 'characters' : activeCategory === 'lore' ? 'world_lore' : decompMode,
        start_page: startPage,
        end_page: endPage,
        campaign_id: campaignId,
        exhaustive: exhaustiveMode,
      });

      if (res.job_id) setCurrentJobId(res.job_id);
      if (res.clusters) setJobClusters(res.clusters);
      if (res.subagents) setJobSubagents(res.subagents);
      if (res.scratchpads) setJobScratchpads(res.scratchpads);
      if (res.current_step) setDecompStep(res.current_step);

      if (res.model && res.model !== 'fallback' && res.model !== 'error') {
        setActiveModel(res.model);
      }

      if (res.error) {
        setDecompError(res.error);
        setFailedStep(res.current_step || 4);
      } else {
        setFailedStep(null);
      }

      const rawNodes = res.extracted_nodes || [];
      const edges = res.extracted_edges || [];
      const processedNodes = processIncomingNodes(rawNodes);

      if (rawNodes.length === 0 && !res.error) {
        setDecompError(
          `No entities were extracted from the document. This typically occurs if the selected page range (${startPage}-${endPage}) contains mostly artwork or tables without recognizable narrative text, or if the AI model encountered a temporary timeout. Try focusing on a specific 5-10 page chapter slice or checking your Gemini model in Settings.`
        );
      }

      setOverviewSummary(res.overview_summary || '');
      setExtractedNodes(processedNodes);
      setExtractedEdges(edges);
      setSelectedNodeIndices(new Set(processedNodes.map((_: any, i: number) => i)));
      if (res.chunks_processed) setChunksProcessed(res.chunks_processed);

      if (processedNodes.length > 0) {
        setSteeringConversation([
          {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: res.overview_summary || 'I have decomposed the chapter into draft campaign nodes and relationships with epistemic confidence tags (Facts, Suspicions, Rumors). Review below and reply to steer or refine any elements.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            nodeCount: processedNodes.length,
          },
        ]);
      }
    } catch (err: any) {
      const errData = err.data;
      if (errData?.job_id) setCurrentJobId(errData.job_id);
      if (errData?.clusters) setJobClusters(errData.clusters);
      if (errData?.subagents) setJobSubagents(errData.subagents);
      if (errData?.scratchpads) setJobScratchpads(errData.scratchpads);
      if (errData?.current_step) {
        setDecompStep(errData.current_step);
        setFailedStep(errData.current_step);
      } else {
        setFailedStep(decompStep || 4);
      }
      setDecompError(`Decomposition failed: ${err.message || 'Unknown network or server error'}`);
    } finally {
      setIsDecomposing(false);
    }
  };

  const handleRetryStep = async (stepToRetry?: number) => {
    if (!currentJobId) {
      handleRunDecomposition();
      return;
    }
    const targetStep = stepToRetry || failedStep || decompStep || 4;
    setIsDecomposing(true);
    setCommitStatus('');
    setDecompError(null);
    try {
      const res = await retryDecompositionJob(currentJobId, targetStep);
      if (res.job_id) setCurrentJobId(res.job_id);
      if (res.clusters) setJobClusters(res.clusters);
      if (res.subagents) setJobSubagents(res.subagents);
      if (res.scratchpads) setJobScratchpads(res.scratchpads);
      if (res.current_step) setDecompStep(res.current_step);

      if (res.model && res.model !== 'fallback' && res.model !== 'error') {
        setActiveModel(res.model);
      }

      if (res.error) {
        setDecompError(res.error);
        setFailedStep(res.current_step || targetStep);
      } else {
        setFailedStep(null);
      }

      const rawNodes = res.extracted_nodes || [];
      const edges = res.extracted_edges || [];
      const processedNodes = processIncomingNodes(rawNodes);

      setOverviewSummary(res.overview_summary || '');
      setExtractedNodes(processedNodes);
      setExtractedEdges(edges);
      setSelectedNodeIndices(new Set(processedNodes.map((_: any, i: number) => i)));
      if (res.chunks_processed) setChunksProcessed(res.chunks_processed);

      if (processedNodes.length > 0) {
        setSteeringConversation([
          {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: res.overview_summary || `Successfully resumed pipeline at Step ${targetStep} and completed decomposition.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            nodeCount: processedNodes.length,
          },
        ]);
      }
    } catch (err: any) {
      const errData = err.data;
      if (errData?.job_id) setCurrentJobId(errData.job_id);
      if (errData?.current_step) setFailedStep(errData.current_step);
      setDecompError(`Retry failed: ${err.message || 'Unknown network or server error'}`);
    } finally {
      setIsDecomposing(false);
    }
  };

  const handleEmergencyStop = async () => {
    if (!currentJobId) {
      setIsDecomposing(false);
      return;
    }
    setIsStopping(true);
    try {
      const res = await stopDecompositionJob(currentJobId);
      setIsDecomposing(false);
      if (res) {
        if (res.clusters) setJobClusters(res.clusters);
        if (res.scratchpads) setJobScratchpads(res.scratchpads);
        const rawNodes = (res as any).extracted_nodes || (res as any).draft_nodes || [];
        const edges = (res as any).extracted_edges || (res as any).draft_edges || [];
        const processedNodes = processIncomingNodes(rawNodes);
        setExtractedNodes(processedNodes);
        setExtractedEdges(edges);
        setSelectedNodeIndices(new Set(processedNodes.map((_: any, i: number) => i)));
        setOverviewSummary(
          `🛑 Decomposition paused by DM. Preserved ${processedNodes.length} entities and ${edges.length} relationships extracted across completed slices. You can steer the draft with Co-DM below or restart.`
        );
        setSteeringConversation((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: `🛑 Pipeline halted by DM. Preserved ${processedNodes.length} entities and ${edges.length} relationships across completed slices. What would you like to refine, or should we resume or restart?`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            nodeCount: processedNodes.length,
          },
        ]);
      }
    } catch {
      setIsDecomposing(false);
    } finally {
      setIsStopping(false);
    }
  };

  const processIncomingNodes = (nodes: any[]): ExtractedDraftNode[] => {
    return nodes.map((n) => {
      let defaultAction: 'merge' | 'create' | undefined = n.action;
      if (!defaultAction) {
        if (n.match_status === 'exact_match') {
          defaultAction = 'merge';
        } else if (n.match_status === 'new' || !n.match_status) {
          defaultAction = 'create';
        }
      }
      return {
        ...n,
        action: defaultAction,
        merge_target_id: n.merge_target_id || n.matched_node_id || null,
        lore_status: n.lore_status || 'fact',
        confidence: n.confidence !== undefined ? n.confidence : (n.lore_status === 'rumor' ? 0.4 : n.lore_status === 'suspicion' ? 0.75 : 1.0),
      };
    });
  };

  const handleCycleLoreStatus = (index: number) => {
    setExtractedNodes((prev) => {
      const next = [...prev];
      const cur = next[index].lore_status || 'fact';
      let nextStatus: 'fact' | 'suspicion' | 'rumor' = 'fact';
      let nextConf = 1.0;
      if (cur === 'fact') {
        nextStatus = 'suspicion';
        nextConf = 0.75;
      } else if (cur === 'suspicion') {
        nextStatus = 'rumor';
        nextConf = 0.4;
      } else {
        nextStatus = 'fact';
        nextConf = 1.0;
      }
      next[index] = { ...next[index], lore_status: nextStatus, confidence: nextConf };
      return next;
    });
  };

  const handleSetNodeAction = (index: number, action: 'merge' | 'create' | 'skip' | 'other') => {
    setExtractedNodes((prev) => {
      const next = [...prev];
      if (action === 'skip') {
        setSelectedNodeIndices((prevSel) => {
          const s = new Set(prevSel);
          s.delete(index);
          return s;
        });
      } else {
        setSelectedNodeIndices((prevSel) => {
          const s = new Set(prevSel);
          s.add(index);
          return s;
        });
      }
      next[index] = { ...next[index], action };
      return next;
    });
  };

  const handleToggleOtherInput = (index: number) => {
    setExtractedNodes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], show_other_input: !next[index].show_other_input };
      return next;
    });
  };

  const handleSaveCustomDirective = (index: number, directive: string) => {
    setExtractedNodes((prev) => {
      const next = [...prev];
      const trimmed = directive.trim();
      next[index] = {
        ...next[index],
        custom_directive: trimmed,
        show_other_input: false,
        action: 'other',
        merge_notes: trimmed ? `DM Directive: ${trimmed}` : next[index].merge_notes,
      };
      return next;
    });
  };

  const handleRedraftSingleNode = async (index: number, directiveOverride?: string) => {
    const targetNode = extractedNodes[index];
    if (!targetNode) return;
    const directive = (directiveOverride ?? targetNode.custom_directive ?? '').trim();
    if (!directive) {
      alert('Please enter a steering directive for this node.');
      return;
    }

    setRedraftingNodeIndex(index);
    setRedraftError(null);
    try {
      const res = await agentRedraftNode({
        campaign_id: campaignId,
        node: targetNode,
        directive,
        current_edges: extractedEdges,
        matched_node_id: targetNode.matched_node_id || undefined,
      });

      if (res.error) {
        setRedraftError({ index, message: res.error });
      }

      const updated = res.node || targetNode;
      updated.show_other_input = false;
      updated.custom_directive = undefined;
      const processedUpdated = processIncomingNodes([updated])[0];

      setExtractedNodes((prev) => {
        const next = [...prev];
        next[index] = processedUpdated;
        return next;
      });

      if (res.edges && res.edges.length > 0) {
        setExtractedEdges(res.edges);
      }
    } catch (err: any) {
      console.error('Failed to redraft node:', err);
      setRedraftError({ index, message: err.message || 'Failed to re-draft node' });
    } finally {
      setRedraftingNodeIndex(null);
    }
  };


  const handleSelectAll = (select: boolean) => {
    if (select) {
      setSelectedNodeIndices(new Set(extractedNodes.map((_, i) => i)));
    } else {
      setSelectedNodeIndices(new Set());
    }
  };

  const handleBakeDirectivesLocally = (singleIdx?: number) => {
    setExtractedNodes((prev) =>
      prev.map((n, idx) => {
        if (singleIdx !== undefined && idx !== singleIdx) return n;
        const directive = (n.custom_directive || (n.action === 'other' ? n.merge_notes : '') || '').trim();
        if (!directive) return n;
        const existingContent = (n.content_markdown || '').trim();
        const directiveHeader = `### 🎯 DM Directive\n${directive}`;
        const newContent = existingContent.includes(directive)
          ? existingContent
          : existingContent
          ? `${existingContent}\n\n${directiveHeader}`
          : directiveHeader;
        return {
          ...n,
          content_markdown: newContent,
          summary: n.summary ? `${n.summary} (${directive})` : directive,
          custom_directive: undefined,
          show_other_input: false,
          action: n.action === 'other' ? (n.match_status === 'exact_match' ? 'merge' : 'create') : n.action,
        };
      })
    );
  };

  const handleSendFeedback = async (textOverride?: string) => {
    const feedbackText = (textOverride || feedbackInput).trim();
    if (!feedbackText || isRefining || isDecomposing) return;

    const userMsg: SteeringMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: feedbackText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...steeringConversation, userMsg];
    setSteeringConversation(newHistory);
    setFeedbackInput('');
    setIsRefining(true);

    try {
      const res = await agentDecomposeAdventure({
        filename: uploadedFilename || undefined,
        text_content: pastedText || undefined,
        instruction: feedbackText,
        decomposition_mode: activeCategory === 'monster' ? 'monsters' : activeCategory === 'character' ? 'characters' : activeCategory === 'lore' ? 'world_lore' : decompMode,
        start_page: startPage,
        end_page: endPage,
        campaign_id: campaignId,
        current_nodes: extractedNodes,
        current_edges: extractedEdges,
        conversation_history: newHistory.map((m) => ({ role: m.role, content: m.content })),
        exhaustive: false,
      });

      if (res.error) {
        alert('Co-DM Steering Notice: ' + res.error);
      }

      const updatedRaw = res.extracted_nodes || extractedNodes;
      const updatedEdges = res.extracted_edges || extractedEdges;
      const processedUpdated = processIncomingNodes(updatedRaw);

      setExtractedNodes(processedUpdated);
      setExtractedEdges(updatedEdges);
      setSelectedNodeIndices(new Set(processedUpdated.map((_: any, i: number) => i)));
      setOverviewSummary(res.overview_summary || '');

      const assistantReply: SteeringMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: res.overview_summary || 'Adjusted working draft nodes per your instructions.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        nodeCount: processedUpdated.length,
      };

      setSteeringConversation([...newHistory, assistantReply]);

      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      alert('Failed to steer decomposition: ' + err.message);
    } finally {
      setIsRefining(false);
    }
  };

  const toggleSelectNode = (index: number) => {
    setSelectedNodeIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleCommitToCampaign = async () => {
    const nodesToCommit = extractedNodes.filter((_, i) => selectedNodeIndices.has(i));
    if (nodesToCommit.length === 0) {
      alert('Please select at least one node to commit.');
      return;
    }

    setCommitStatus('committing');
    try {
      const allowedTitles = new Set(nodesToCommit.map((n) => n.title));
      const edgesToCommit = extractedEdges.filter(
        (e) => e.source_title && e.target_title && allowedTitles.has(e.source_title) && allowedTitles.has(e.target_title)
      );

      const res = await agentApplyExtracted(nodesToCommit, edgesToCommit, campaignId);
      setCommitStatus('success');
      setCommitResult({
        created: res.nodes_created || 0,
        merged: res.nodes_merged || 0,
        edges: res.edges_created || 0,
      });
      onRefresh();
    } catch (err: any) {
      alert('Failed to commit to campaign: ' + err.message);
      setCommitStatus('error');
    }
  };

  // ==========================================
  // SESSION TRANSCRIPT ADAPTATION HANDLERS
  // ==========================================
  const handleLoadSampleTranscript = () => {
    setSessionTranscript(SAMPLE_ACTUAL_PLAY_TRANSCRIPT);
    if (sessions && sessions.length > 0 && !targetSessionId) {
      const match = sessions.find(
        (s) => s.title.toLowerCase().includes('session 1') || s.title.toLowerCase().includes('sunless')
      );
      if (match) setTargetSessionId(match.id);
      else setTargetSessionId(sessions[0].id);
    }
  };

  const handleLoadSampleSummary = () => {
    setSessionTranscript(SAMPLE_SESSION_SUMMARY);
    if (sessions && sessions.length > 0 && !targetSessionId) {
      const match = sessions.find(
        (s) => s.title.toLowerCase().includes('session 1') || s.title.toLowerCase().includes('sunless')
      );
      if (match) setTargetSessionId(match.id);
      else setTargetSessionId(sessions[0].id);
    }
  };

  const handleSessionFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const category = 'transcript';

    try {
      const dup = await checkDuplicateUpload(file.name, campaignId, category);
      if (dup.exists && dup.existing_file) {
        setDuplicateModalData({ file, existing: dup.existing_file, category });
        e.target.value = '';
        return;
      }
    } catch (err) {
      console.error('Duplicate check error:', err);
    }

    await performUpload(file, category, false);
    e.target.value = '';
  };

  const handleRunSessionAdaptation = async () => {
    if (!sessionTranscript.trim()) {
      alert('Please paste or upload a session transcript first.');
      return;
    }
    setIsAdaptingSession(true);
    setSessionCommitStatus('');
    try {
      const res = await agentAdaptSession({
        session_node_id: targetSessionId || undefined,
        transcript_text: sessionTranscript,
        user_instruction: sessionInstruction.trim(),
        campaign_id: campaignId,
      });

      setSessionAdaptationResult(res);
      setSelectedStatusUpdates(new Set((res.status_updates || []).map((u, i) => u.node_id || u.node_title || u.title || `status-${i}`)));
      setSelectedEmergentNodeIndices(new Set((res.emergent_nodes || []).map((_, i) => i)));
      setApplyNextSessionPrep(Boolean(res.next_session_prep?.title));
      setApplyPlayerRecap(Boolean(res.player_recap));

      setSessionChatHistory([
        {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content:
            res.overview ||
            'I have analyzed the session transcript against your campaign graph and timeline. Review the proposed status updates, NPC shifts, emergent loot, and Next Session prep below. You can continue our conversation to steer any adjustments.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      alert('Session adaptation failed: ' + err.message);
    } finally {
      setIsAdaptingSession(false);
    }
  };

  const handleSendSessionFeedback = async (textOverride?: string) => {
    const feedbackText = (textOverride || sessionFeedbackInput).trim();
    if (!feedbackText || isRefiningSession || isAdaptingSession) return;

    const userMsg: SteeringMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: feedbackText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...sessionChatHistory, userMsg];
    setSessionChatHistory(newHistory);
    setSessionFeedbackInput('');
    setIsRefiningSession(true);

    try {
      const res = await agentAdaptSession({
        session_node_id: targetSessionId || undefined,
        transcript_text: sessionTranscript,
        user_instruction: feedbackText,
        campaign_id: campaignId,
        conversation_history: newHistory.map((m) => ({ role: m.role, content: m.content })),
      });

      setSessionAdaptationResult(res);
      setSelectedStatusUpdates(new Set((res.status_updates || []).map((u, i) => u.node_id || u.node_title || u.title || `status-${i}`)));
      setSelectedEmergentNodeIndices(new Set((res.emergent_nodes || []).map((_, i) => i)));

      const assistantReply: SteeringMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: res.overview || 'Adjusted the session adaptation fallout per your steering instructions.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setSessionChatHistory([...newHistory, assistantReply]);

      setTimeout(() => {
        sessionChatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      alert('Failed to steer session adaptation: ' + err.message);
    } finally {
      setIsRefiningSession(false);
    }
  };

  const toggleSelectStatusUpdate = (nodeIdOrKey: string) => {
    setSelectedStatusUpdates((prev) => {
      const next = new Set(prev);
      if (next.has(nodeIdOrKey)) next.delete(nodeIdOrKey);
      else next.add(nodeIdOrKey);
      return next;
    });
  };

  const toggleSelectEmergentNode = (index: number) => {
    setSelectedEmergentNodeIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleApplySessionFallout = async () => {
    if (!sessionAdaptationResult) return;

    setSessionCommitStatus('committing');
    try {
      const statusUpdatesToApply = (sessionAdaptationResult.status_updates || []).filter((u, i) => {
        const k = u.node_id || u.node_title || u.title || `status-${i}`;
        return selectedStatusUpdates.has(k) || (u.node_id && selectedStatusUpdates.has(u.node_id));
      });
      const emergentNodesToApply = (sessionAdaptationResult.emergent_nodes || []).filter((_, i) =>
        selectedEmergentNodeIndices.has(i)
      );
      const allowedTitles = new Set(emergentNodesToApply.map((n) => n.title));
      const emergentEdgesToApply = (sessionAdaptationResult.emergent_edges || []).filter(
        (e) => allowedTitles.has(e.source_title) && allowedTitles.has(e.target_title)
      );

      const res = await agentApplySessionAdaptation({
        campaign_id: campaignId,
        session_node_id: targetSessionId || undefined,
        status_updates: statusUpdatesToApply,
        npc_updates: sessionAdaptationResult.npc_updates,
        emergent_nodes: emergentNodesToApply,
        emergent_edges: emergentEdgesToApply,
        next_session_prep: applyNextSessionPrep ? sessionAdaptationResult.next_session_prep : undefined,
        player_recap: applyPlayerRecap ? sessionAdaptationResult.player_recap : undefined,
      });

      setSessionCommitStatus('success');
      setSessionCommitMessage(res.message || 'Successfully applied session adaptation to campaign!');
      onRefresh();
    } catch (err: any) {
      alert('Failed to apply session fallout: ' + err.message);
      setSessionCommitStatus('error');
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1360px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BookOpen style={{ color: 'var(--color-gold)' }} /> Ingestion, Decomposer &amp; Co-DM Adaptation Hub
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Decompose adventure books into campaign arcs, or ingest actual play session transcripts to have the Co-DM dynamically adapt the graph, timeline, NPC dispositions, and next session prep.
          </p>
        </div>
        <button
          onClick={() => {
            refreshLibraryCount();
            setShowLibraryModal(true);
          }}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-arcane-blue-text)', borderColor: 'var(--color-arcane-blue-border)' }}
          title="View and manage all uploaded adventure books, stat sheets, and session logs"
        >
          <FolderOpen size={16} style={{ color: 'var(--color-arcane-blue)' }} />
          📂 Document Library ({libraryDocsCount})
        </button>
      </div>

      {/* Category Selection Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '20px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '12px',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={() => {
            setActiveCategory('book');
            setDecompMode('campaign_structure');
            setInstruction(bookPresets[0].prompt);
          }}
          className={`btn ${activeCategory === 'book' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <BookOpen size={16} /> 📖 Adventure Books &amp; Chapters
        </button>

        <button
          onClick={() => {
            setActiveCategory('monster');
            setDecompMode('monsters');
            setInstruction(monsterPresets[0].prompt);
          }}
          className={`btn ${activeCategory === 'monster' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Swords size={16} /> 🐉 Monster Stat Sheets &amp; Bestiary
        </button>

        <button
          onClick={() => {
            setActiveCategory('character');
            setDecompMode('characters');
            setInstruction(characterPresets[0].prompt);
          }}
          className={`btn ${activeCategory === 'character' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Shield size={16} /> 🛡️ Player Character (PC) Sheets
        </button>

        <button
          onClick={() => {
            setActiveCategory('session');
          }}
          className={`btn ${activeCategory === 'session' ? 'btn-primary' : 'btn-ghost'}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderColor: activeCategory === 'session' ? 'var(--color-arcane-blue-text)' : 'var(--color-arcane-blue-border)',
            color: 'var(--color-arcane-blue-text)',
            background: activeCategory === 'session' ? 'var(--color-arcane-blue-bg)' : 'transparent',
            fontWeight: 600,
          }}
        >
          <Mic size={16} style={{ color: 'var(--color-arcane-blue-text)' }} /> 🎙️ Session Transcripts &amp; Summaries
        </button>

        <button
          onClick={() => {
            setActiveCategory('lore');
            setDecompMode('world_lore');
            setInstruction(lorePresets[0].prompt);
          }}
          className={`btn ${activeCategory === 'lore' ? 'btn-primary' : 'btn-ghost'}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderColor: activeCategory === 'lore' ? 'var(--color-gold)' : 'var(--border-subtle)',
            color: activeCategory === 'lore' ? 'var(--text-gold)' : 'var(--text-primary)',
            background: activeCategory === 'lore' ? 'var(--color-amber-glow)' : 'transparent',
            fontWeight: 600,
          }}
        >
          <Scroll size={16} style={{ color: 'var(--color-gold)' }} /> 📜 World Lore &amp; Setting
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SESSION TRANSCRIPTS & ACTUAL PLAY ADAPTATION VIEW */}
      {/* ========================================================================= */}
      {activeCategory === 'session' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: '24px', alignItems: 'start' }}>
          {/* Left Column: Target Session, Transcript Input & Steering Guidance */}
          {/* Target Session Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div
              className="glass-panel"
              style={{
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid var(--border-medium)',
                background: 'var(--bg-card)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Calendar size={16} style={{ color: 'var(--color-arcane-blue)' }} />
                <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>Target Session in Timeline:</label>
              </div>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Choose which planned session this transcript reflects. The Co-DM will compare events against planned encounters.
              </p>
              <select
                value={targetSessionId}
                onChange={(e) => setTargetSessionId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              >
                <option value="">— Auto-Detect Session from Transcript / General Session —</option>
                {sessions.map((s) => {
                  const status = (s.data_json?.status as string) || 'planned';
                  return (
                    <option key={s.id} value={s.id}>
                      [{status.toUpperCase()}] {s.title}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Transcript Dropzone & Text Area */}
            <div
              className="glass-panel"
              style={{
                padding: '18px',
                borderRadius: '12px',
                border: '2px dashed var(--border-medium)',
                background: 'var(--bg-card)',
                textAlign: 'center',
              }}
            >
              <Mic size={32} style={{ color: 'var(--color-arcane-blue)', margin: '0 auto 8px' }} />
              <h4 style={{ fontSize: '1rem', marginBottom: '4px' }}>Upload Session Audio/VTT Transcript or Text Log</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                Supports VTT, SRT, TXT, MD, PDF, or chat exports from Discord, Roll20, or Foundry.
              </p>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {isUploading ? 'Loading...' : 'Upload Transcript File'}
                  <input
                    type="file"
                    accept=".txt,.md,.vtt,.srt,.json,.pdf"
                    onChange={handleSessionFileUpload}
                    style={{ display: 'none' }}
                  />
                </label>

                <button
                  type="button"
                  onClick={handleLoadSampleTranscript}
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--color-arcane-blue-text)' }}
                  title="Load full Sunless Citadel Session 1 dialogue transcript"
                >
                  <Sparkles size={14} /> Load Dialogue Transcript
                </button>

                <button
                  type="button"
                  onClick={handleLoadSampleSummary}
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}
                  title="Load bulleted Sunless Citadel Session 1 debrief summary"
                >
                  <FileText size={14} /> Load Bulleted Summary
                </button>
              </div>

              <div style={{ marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowLibraryModal(true)}
                  className="btn btn-ghost"
                  style={{ fontSize: '0.74rem', color: 'var(--color-arcane-blue-text)', textDecoration: 'underline', padding: '2px 8px' }}
                >
                  📂 Or choose from Document Library ({libraryDocsCount} files)
                </button>
              </div>

              {originalName && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: 'var(--status-completed-bg)',
                    border: '1px solid var(--status-completed-border)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.8rem',
                    color: 'var(--status-completed-text)',
                  }}
                >
                  <CheckCircle size={15} /> Loaded: <strong>{originalName}</strong>
                </div>
              )}
            </div>

            {/* Paste Raw Transcript Text */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Session Transcript / Actual Play Notes:
                </label>
                {sessionTranscript && (
                  <button
                    onClick={() => setSessionTranscript('')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer' }}
                  >
                    Clear Text
                  </button>
                )}
              </div>
              <textarea
                value={sessionTranscript}
                onChange={(e) => setSessionTranscript(e.target.value)}
                placeholder="Paste raw transcript, timestamps, player actions, combat rolls, or DM debrief..."
                rows={7}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  resize: 'vertical',
                  fontFamily: 'monospace',
                }}
              />
            </div>

            {/* Co-DM Adaptation Guidance */}
            <div
              className="glass-panel"
              style={{
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid var(--border-medium)',
                background: 'var(--bg-card)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Sparkles size={16} style={{ color: 'var(--color-arcane-blue)' }} />
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Co-DM Adaptation Guidance:</label>
              </div>

              {/* Preset chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                {sessionPresets.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSessionInstruction(p.prompt)}
                    className="btn btn-ghost"
                    style={{
                      padding: '3px 8px',
                      fontSize: '0.72rem',
                      borderRadius: '12px',
                      background: sessionInstruction === p.prompt ? 'var(--color-arcane-blue-bg)' : 'var(--bg-surface)',
                      border: `1px solid ${sessionInstruction === p.prompt ? 'var(--color-arcane-blue)' : 'var(--border-medium)'}`,
                      color: sessionInstruction === p.prompt ? 'var(--color-arcane-blue-text)' : 'var(--text-primary)',
                      fontWeight: sessionInstruction === p.prompt ? 700 : 500,
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <textarea
                value={sessionInstruction}
                onChange={(e) => setSessionInstruction(e.target.value)}
                placeholder="Instruct Co-DM on how to adapt the campaign to this session..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  resize: 'vertical',
                  marginBottom: '14px',
                }}
              />

              {/* Run Session Adaptation Button */}
              <button
                onClick={handleRunSessionAdaptation}
                disabled={isAdaptingSession || !sessionTranscript.trim()}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  borderColor: '#3b82f6',
                }}
              >
                {isAdaptingSession ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Analyzing Actual Play &amp; Adapting Campaign...
                  </>
                ) : (
                  <>
                    <Wand2 size={18} />
                    Adapt Graph &amp; Timeline with Co-DM
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Interactive Steering Dialogue & Adaptation Fallout Review */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              className="glass-panel"
              style={{
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid var(--border-medium)',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--bg-card)',
              }}
            >
              {/* Action Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={18} style={{ color: 'var(--color-arcane-blue)' }} />
                    Session Fallout &amp; Campaign Adaptation
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {sessionAdaptationResult
                      ? 'Review status transitions, NPC shifts, emergent loot, and next session prep.'
                      : 'Upload or paste a transcript on the left to adapt your campaign to what actually happened.'}
                  </span>
                </div>

                {sessionAdaptationResult && (
                  <button
                    onClick={handleApplySessionFallout}
                    disabled={sessionCommitStatus === 'committing'}
                    className="btn btn-primary"
                    style={{
                      padding: '8px 16px',
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      borderColor: '#10b981',
                    }}
                  >
                    {sessionCommitStatus === 'committing' ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Check size={14} />
                    )}
                    Apply Session Fallout to Campaign
                  </button>
                )}
              </div>

              {/* Commit Success Banner */}
              {sessionCommitStatus === 'success' && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: 'var(--status-completed-bg)',
                    border: '1px solid var(--status-completed-border)',
                    color: 'var(--status-completed-text)',
                    fontSize: '0.85rem',
                    marginBottom: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>✨ {sessionCommitMessage || 'Successfully adapted campaign graph and timeline to session!'}</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => onNavigateTab('hierarchy')}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                    >
                      View Timeline
                    </button>
                    <button
                      onClick={() => onNavigateTab('graph')}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                    >
                      View Graph
                    </button>
                  </div>
                </div>
              )}

              {/* Conversational Steering & Feedback Loop for Session Adaptation */}
              {sessionAdaptationResult && (
                <div
                  style={{
                    marginBottom: '16px',
                    background: 'var(--bg-surface)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-subtle)',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-arcane-blue-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MessageSquare size={15} /> Co-DM Steering &amp; Refinement Conversation:
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {sessionChatHistory.length} exchanges
                    </span>
                  </div>

                  {/* Chat History Box */}
                  <div
                    style={{
                      maxHeight: '190px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      paddingRight: '4px',
                    }}
                  >
                    {sessionChatHistory.map((msg) => (
                      <div
                        key={msg.id}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          lineHeight: '1.4',
                          background:
                            msg.role === 'user'
                              ? 'var(--color-arcane-blue-bg)'
                              : 'var(--status-completed-bg)',
                          border: `1px solid ${
                            msg.role === 'user'
                              ? 'var(--color-arcane-blue-border)'
                              : 'var(--status-completed-border)'
                          }`,
                          alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                          maxWidth: '92%',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                          <span style={{ fontWeight: 700, color: msg.role === 'user' ? 'var(--color-arcane-blue-text)' : 'var(--status-completed-text)' }}>
                            {msg.role === 'user' ? 'Dungeon Master' : 'Co-DM Assistant'}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{msg.timestamp}</span>
                        </div>
                        <MarkdownView content={msg.content} />
                      </div>
                    ))}
                    <div ref={sessionChatBottomRef} />
                  </div>

                  {/* Quick Feedback Steering Chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                    {sessionSteeringSuggestions.map((sug, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendSessionFeedback(sug)}
                        disabled={isRefiningSession}
                        className="btn btn-ghost"
                        style={{
                          padding: '2px 8px',
                          fontSize: '0.7rem',
                          borderRadius: '10px',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-medium)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        + {sug}
                      </button>
                    ))}
                  </div>

                  {/* Feedback Input Row */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <input
                      type="text"
                      value={sessionFeedbackInput}
                      onChange={(e) => setSessionFeedbackInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendSessionFeedback();
                      }}
                      placeholder="Steer Co-DM (e.g. 'Meepo was actually allied', 'Party missed the secret chest', 'Change next session hook')..."
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-medium)',
                        color: 'var(--text-primary)',
                        fontSize: '0.82rem',
                      }}
                    />
                    <button
                      onClick={() => handleSendSessionFeedback()}
                      disabled={isRefiningSession || !sessionFeedbackInput.trim()}
                      className="btn btn-primary"
                      style={{ padding: '8px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {isRefiningSession ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                      Steer Co-DM
                    </button>
                  </div>
                </div>
              )}

              {/* No Adaptation Results Placeholder */}
              {!sessionAdaptationResult ? (
                <div
                  style={{
                    padding: '40px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    gap: '12px',
                  }}
                >
                  <FileText size={42} style={{ color: 'var(--border-medium)' }} />
                  <h4 style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>No Session Adaptation Run Yet</h4>
                  <p style={{ fontSize: '0.8rem', maxWidth: '420px', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                    1. Select your target session and paste your transcript (or click <strong>Load Sample Session Transcript</strong>).<br />
                    2. Click <strong>Adapt Graph &amp; Timeline with Co-DM</strong>.<br />
                    3. The Co-DM will analyze actual combat and dialogue, mark resolved encounters as completed, adjust NPC attitudes, spawn emergent loot nodes, and plan Session N+1!
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* 1. Status Transitions Checklist */}
                  {sessionAdaptationResult.status_updates && sessionAdaptationResult.status_updates.length > 0 && (
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-arcane-blue-text)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <Clock size={15} /> Timeline Status Updates ({sessionAdaptationResult.status_updates.length}):
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {sessionAdaptationResult.status_updates.map((u, idx) => {
                          const itemKey = u.node_id || u.node_title || u.title || `status-${idx}`;
                          const isChecked = selectedStatusUpdates.has(itemKey) || (u.node_id && selectedStatusUpdates.has(u.node_id));
                          return (
                            <div
                              key={itemKey}
                              onClick={() => toggleSelectStatusUpdate(itemKey)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                background: isChecked ? 'var(--color-arcane-blue-bg)' : 'transparent',
                                border: `1px solid ${isChecked ? 'var(--color-arcane-blue-border)' : 'transparent'}`,
                                cursor: 'pointer',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={Boolean(isChecked)}
                                onChange={() => toggleSelectStatusUpdate(itemKey)}
                                style={{ cursor: 'pointer' }}
                              />
                              <div style={{ flex: 1, fontSize: '0.8rem' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.title}</span>{' '}
                                <span className={`badge badge-${u.node_type}`}>{u.node_type}</span>{' '}
                                <span style={{ color: 'var(--status-completed-text)', fontWeight: 600 }}>➔ {u.new_status.toUpperCase()}</span>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  {u.reason}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 2. NPC & Faction Updates */}
                  {sessionAdaptationResult.npc_updates && sessionAdaptationResult.npc_updates.length > 0 && (
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-gold)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <User size={15} /> NPC Dispositions &amp; State Changes ({sessionAdaptationResult.npc_updates.length}):
                      </span>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px' }}>
                        {sessionAdaptationResult.npc_updates.map((npc, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              background: 'var(--color-amber-glow)',
                              border: '1px solid var(--border-medium)',
                              fontSize: '0.78rem',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{npc.name}</span>
                              <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', background: 'var(--color-amber-glow)', color: 'var(--text-gold)', border: '1px solid var(--border-subtle)' }}>
                                {npc.disposition}
                              </span>
                            </div>
                            <div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>
                              {npc.state_changes}
                            </div>
                            {npc.notes && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                &quot;{npc.notes}&quot;
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 3. Emergent Entities (Loot, Clues, Locations) */}
                  {sessionAdaptationResult.emergent_nodes && sessionAdaptationResult.emergent_nodes.length > 0 && (
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-purple)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <Sparkles size={15} /> Emergent Discoveries &amp; Loot ({sessionAdaptationResult.emergent_nodes.length}):
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {sessionAdaptationResult.emergent_nodes.map((n, idx) => {
                          const isChecked = selectedEmergentNodeIndices.has(idx);
                          return (
                            <div
                              key={idx}
                              onClick={() => toggleSelectEmergentNode(idx)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                background: isChecked ? 'rgba(168, 85, 247, 0.12)' : 'transparent',
                                border: `1px solid ${isChecked ? 'var(--color-purple)' : 'transparent'}`,
                                cursor: 'pointer',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSelectEmergentNode(idx)}
                                style={{ cursor: 'pointer' }}
                              />
                              <div style={{ flex: 1, fontSize: '0.8rem' }}>
                                <span className={`badge badge-${n.type || 'item'}`}>{n.type}</span>{' '}
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{n.title}</span>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  {n.summary || n.content_markdown?.slice(0, 100)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 4. Session N+1 Next Prep Card */}
                  {sessionAdaptationResult.next_session_prep && sessionAdaptationResult.next_session_prep.title && (
                    <div
                      style={{
                        padding: '14px',
                        borderRadius: '8px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-medium)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-arcane-blue-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={16} /> Timeline Next Session Prep (Session N+1 Proposal):
                        </span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={applyNextSessionPrep}
                            onChange={(e) => setApplyNextSessionPrep(e.target.checked)}
                          />
                          Create Session in Timeline
                        </label>
                      </div>
                      <h4 style={{ fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                        {sessionAdaptationResult.next_session_prep.title}
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        {sessionAdaptationResult.next_session_prep.description}
                      </p>
                      {sessionAdaptationResult.next_session_prep.suggested_encounters && sessionAdaptationResult.next_session_prep.suggested_encounters.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                          {sessionAdaptationResult.next_session_prep.suggested_encounters.map((enc, i) => (
                            <span
                              key={i}
                              style={{
                                fontSize: '0.72rem',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                background: 'var(--color-arcane-blue-bg)',
                                color: 'var(--color-arcane-blue-text)',
                                border: '1px solid var(--color-arcane-blue-border)',
                              }}
                            >
                              ⚔️ {enc}
                            </span>
                          ))}
                        </div>
                      )}
                      {sessionAdaptationResult.next_session_prep.dm_secrets && (
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', background: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', padding: '6px 10px', borderRadius: '6px' }}>
                          🔒 <strong>DM Secrets:</strong> {sessionAdaptationResult.next_session_prep.dm_secrets}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 5. Player Portal Journal Recap Card */}
                  {sessionAdaptationResult.player_recap && (
                    <div
                      style={{
                        padding: '14px',
                        borderRadius: '8px',
                        background: 'var(--status-completed-bg)',
                        border: '1px solid var(--status-completed-border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--status-completed-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Scroll size={16} /> Player Portal Journal Recap:
                        </span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={applyPlayerRecap}
                            onChange={(e) => setApplyPlayerRecap(e.target.checked)}
                          />
                          Publish to Player Portal Journal
                        </label>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                        {sessionAdaptationResult.player_recap}
                      </p>
                    </div>
                  )}

                  {/* Convenient Bottom Apply Button */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                    <button
                      onClick={handleApplySessionFallout}
                      disabled={sessionCommitStatus === 'committing'}
                      className="btn btn-primary"
                      style={{
                        padding: '10px 20px',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        borderColor: '#10b981',
                        boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                      }}
                    >
                      {sessionCommitStatus === 'committing' ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Check size={16} />
                      )}
                      Apply Session Fallout to Campaign (Graph &amp; Timeline)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* ADVENTURE BOOKS & STAT SHEETS DECOMPOSER VIEW */
        /* ========================================================================= */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '24px', alignItems: 'start' }}>
          {/* Left Column: Upload, Page Range, and Initial Instructions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* File Dropzone */}
            <div
              className="glass-panel"
              style={{
                padding: '20px',
                borderRadius: '12px',
                border: '2px dashed var(--border-medium)',
                background: 'var(--bg-card)',
                textAlign: 'center',
              }}
            >
              <Upload size={32} style={{ color: 'var(--color-gold)', margin: '0 auto 8px' }} />
              <h4 style={{ fontSize: '1rem', marginBottom: '4px' }}>
                Upload {activeCategory === 'book' ? 'Adventure PDF or Chapter' : activeCategory === 'monster' ? 'Monster Stat Sheet / PDF' : activeCategory === 'lore' ? 'World Lore Document (PDF, TXT)' : 'Character Sheet (PDF, Image, Text)'}
              </h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                Supports PDF, PNG, JPG, or TXT documents.
              </p>

              <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {isUploading ? 'Uploading...' : 'Choose Document File'}
                <input
                  type="file"
                  accept={activeCategory === 'book' ? '.pdf,.txt,.md' : '.pdf,.png,.jpg,.jpeg,.txt,.json'}
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>

              <div style={{ marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowLibraryModal(true)}
                  className="btn btn-ghost"
                  style={{ fontSize: '0.74rem', color: 'var(--color-arcane-blue-text)', textDecoration: 'underline', padding: '2px 8px' }}
                >
                  📂 Or choose from Document Library ({libraryDocsCount} files)
                </button>
              </div>

              {originalName && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'var(--status-completed-bg)',
                    border: '1px solid var(--status-completed-border)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.8rem',
                    color: 'var(--status-completed-text)',
                  }}
                >
                  <CheckCircle size={15} /> Uploaded: <strong>{originalName}</strong>
                  {totalPages > 0 && <span>({totalPages} pages)</span>}
                </div>
              )}
            </div>

            {/* PDF Page Range Selector (for Adventure Books) */}
            {totalPages > 0 && (
              <div
                className="glass-panel"
                style={{
                  padding: '14px 18px',
                  borderRadius: '10px',
                  background: 'var(--bg-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Chapter / Page Range:</span>
                    {totalPages > 0 && startPage === 1 && endPage === totalPages && (
                      <span style={{ fontSize: '0.7rem', background: 'rgba(var(--color-gold-rgb, 212,175,55), 0.15)', color: 'var(--color-gold)', padding: '1px 6px', borderRadius: '8px', fontWeight: 600 }}>
                        Full Document
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {totalPages > 0 && startPage === 1 && endPage === totalPages
                      ? `All ${totalPages} pages selected — narrow range to focus on a specific chapter`
                      : 'Target specific chapter pages (e.g. Chapter 1: Pages 1-25)'}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>From</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={startPage}
                    onChange={(e) => setStartPage(Number(e.target.value))}
                    style={{
                      width: '60px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-medium)',
                      color: 'var(--text-primary)',
                      textAlign: 'center',
                    }}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>to</span>
                  <input
                    type="number"
                    min={startPage}
                    max={totalPages}
                    value={endPage}
                    onChange={(e) => setEndPage(Number(e.target.value))}
                    style={{
                      width: '60px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-medium)',
                      color: 'var(--text-primary)',
                      textAlign: 'center',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Paste Raw Text Alternative */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Or Paste Excerpt / Stat Block Directly:
                </label>
                {pastedText && (
                  <button
                    onClick={() => setPastedText('')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer' }}
                  >
                    Clear
                  </button>
                )}
              </div>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste adventure chapter text, monster stat block, or PC backstory..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Initial Co-DM Instructions & Prompt Chips */}
            <div
              className="glass-panel"
              style={{
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid var(--border-medium)',
                background: 'var(--bg-card)',
              }}
            >
              {/* Exhaustive Scan Toggle - Positioned at top as default behavior */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '11px 14px',
                borderRadius: '8px',
                background: exhaustiveMode ? 'rgba(var(--color-gold-rgb, 212, 175, 55), 0.08)' : 'var(--bg-surface)',
                border: `1px solid ${exhaustiveMode ? 'var(--color-gold)' : 'var(--border-medium)'}`,
                marginBottom: '14px',
                cursor: 'pointer',
              }} onClick={() => setExhaustiveMode(v => !v)}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="exhaustive-scan"
                      checked={exhaustiveMode}
                      onChange={(e) => { e.stopPropagation(); setExhaustiveMode(e.target.checked); }}
                      style={{ accentColor: 'var(--color-gold)', width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <label htmlFor="exhaustive-scan" style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      🔍 Multi-Agent Deep Pipeline (Visual Clustering, Scratchpads &amp; QA Audit)
                      <span style={{ fontSize: '0.72rem', color: exhaustiveMode ? 'var(--color-gold)' : 'var(--text-muted)', fontWeight: 600 }}>
                        {exhaustiveMode ? '(Default: ON)' : '(Fast Single-Pass)'}
                      </span>
                    </label>
                  </div>
                  <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '4px 0 0 24px', lineHeight: 1.4 }}>
                    {exhaustiveMode
                      ? `Enabled by default. Orchestrates sub-agents across visual page clusters, worker scratchpad inventories, an automated QA verification pass, and SQLite lore deconfliction with 5e base template inheritance.${totalPages > 5 ? ` Estimated: ~${Math.ceil(totalPages / 5)} cluster worker passes.` : ''}`
                      : 'Fast single-pass extraction active — rapid overview, but long chapters or complex keyed maps may omit sidebars and statblocks. Re-enable for multi-agent completeness.'}
                  </p>
                </div>
              </div>

              {/* Steering Prompt Header & Suggestions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Sparkles size={16} style={{ color: 'var(--color-gold)' }} />
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Steering Prompt &amp; Focus (Optional):
                </label>
              </div>

              {/* Quick Suggestion Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                {(activeCategory === 'book' ? bookPresets : activeCategory === 'monster' ? monsterPresets : activeCategory === 'lore' ? lorePresets : characterPresets).map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInstruction(p.prompt);
                      setDecompMode(p.mode);
                    }}
                    className="btn btn-ghost"
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.73rem',
                      borderRadius: '12px',
                      background: instruction === p.prompt ? 'var(--color-amber-glow)' : 'var(--bg-surface)',
                      border: `1px solid ${instruction === p.prompt ? 'var(--color-gold)' : 'var(--border-medium)'}`,
                      color: instruction === p.prompt ? 'var(--text-gold)' : 'var(--text-primary)',
                      fontWeight: instruction === p.prompt ? 700 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Optional steering prompt: What specific elements or section should the agent focus on? (e.g. 'Focus on the Red Wizards and their ritual items', 'Extract only beasts and aberrations', or 'Focus on Chapter 3: Sunken Citadel'). Leave default for complete extraction."
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  resize: 'vertical',
                  marginBottom: '14px',
                }}
              />

              {/* Run Decomposition Button */}
              <button
                onClick={handleRunDecomposition}
                disabled={isDecomposing || (!uploadedFilename && !pastedText.trim())}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {isDecomposing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {exhaustiveMode
                      ? `Running Multi-Agent Pipeline (Clusters, Scratchpads & QA)...`
                      : 'Decomposing with Co-DM Architect...'}
                  </>
                ) : (
                  <>
                    <Wand2 size={18} />
                    {exhaustiveMode ? '🔍 Multi-Agent Chapter Decomposition' : 'Fast Decompose with Co-DM'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Interactive Steering Dialogue & Draft Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Main Working Draft Card */}
            <div
              className="glass-panel"
              style={{
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid var(--border-medium)',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--bg-card)',
              }}
            >
              {/* Diagnostic Error Banner with Step Persistence & Granular Retry */}
              {decompError && (
                <div
                  className="glass-panel animate-fade-in"
                  style={{
                    padding: '14px 16px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.5)',
                    marginBottom: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontWeight: 700, fontSize: '0.88rem' }}>
                      <AlertTriangle size={18} />
                      <span>Decomposition Diagnostics &amp; Step Recovery</span>
                    </div>
                    <button
                      onClick={() => setDecompError(null)}
                      className="btn btn-ghost"
                      style={{ padding: '2px 6px', fontSize: '0.72rem', color: '#f87171' }}
                    >
                      Dismiss
                    </button>
                  </div>

                  <p style={{ fontSize: '0.78rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>
                    {decompError}
                  </p>

                  {currentJobId && (
                    <div
                      style={{
                        fontSize: '0.74rem',
                        color: 'var(--text-secondary)',
                        background: 'rgba(0, 0, 0, 0.25)',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        borderLeft: '3px solid #34d399',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '6px',
                      }}
                    >
                      <span>
                        💾 <strong>Work Preserved:</strong> Intermediate drafts from earlier steps are saved in SQLite (Job: <code>{currentJobId.slice(0, 8)}</code>). You can retry only the failed step without restarting from scratch or losing previous cluster extracts.
                      </span>
                      {Object.keys(jobScratchpads).length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowScratchpadModal(true)}
                          className="btn btn-ghost"
                          style={{ fontSize: '0.72rem', padding: '2px 8px', color: 'var(--color-gold)', textDecoration: 'underline' }}
                        >
                          📋 Inspect Scratchpads ({Object.keys(jobScratchpads).length} active)
                        </button>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                    {currentJobId && (
                      <button
                        type="button"
                        onClick={() => handleRetryStep(failedStep || decompStep)}
                        className="btn btn-primary"
                        style={{ fontSize: '0.76rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                      >
                        <RefreshCw size={13} /> Retry Step {failedStep || decompStep}: {
                          (failedStep || decompStep) === 1 ? 'Page Clusters' :
                          (failedStep || decompStep) === 2 ? 'Scratchpad Mining' :
                          (failedStep || decompStep) === 3 ? 'QA Gap Audit' : 'Domain Deconfliction'
                        }
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleRunDecomposition}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.74rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <RefreshCw size={12} /> {currentJobId ? 'Restart Full Scan' : 'Retry Scan'}
                    </button>

                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {activeModel ? (
                        <>Active engine: <code>{activeModel}</code> (configured in Settings).</>
                      ) : (
                        <>Configured engine: <code>gemini-flash-latest</code>.</>
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Live Decomposition Progress Chamber */}
              {isDecomposing && (
                <div
                  className="glass-panel animate-fade-in"
                  style={{
                    padding: '16px 18px',
                    borderRadius: '10px',
                    background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.08) 0%, rgba(17, 24, 39, 0.6) 100%)',
                    border: '1px solid var(--color-gold)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    marginBottom: '16px',
                    boxShadow: '0 0 25px rgba(245, 158, 11, 0.12)',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: '1 1 280px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'rgba(245, 158, 11, 0.18)',
                          border: '1px solid var(--color-gold)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--color-gold)',
                          flexShrink: 0,
                        }}
                      >
                        <Sparkles size={18} className="animate-spin" />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-gold)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          Multi-Agent Co-DM Pipeline Running
                        </h4>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          Orchestrating visual cluster workers, scratchpad extraction, QA audit pass, and SQLite deconfliction...
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
                      <div
                        style={{
                          background: 'rgba(59, 130, 246, 0.15)',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          fontSize: '0.7rem',
                          color: '#93c5fd',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span>🤖 {activeModel || 'gemini-flash-latest'}</span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(0, 0, 0, 0.35)',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          border: '1px solid var(--border-medium)',
                          fontSize: '0.76rem',
                          color: 'var(--color-gold)',
                          fontWeight: 700,
                        }}
                      >
                        <Clock size={12} />
                        <span>{Math.floor(decompElapsedSeconds / 60).toString().padStart(2, '0')}:{(decompElapsedSeconds % 60).toString().padStart(2, '0')}</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleEmergencyStop}
                        disabled={isStopping}
                        className="btn btn-danger"
                        title="Interrupt LLM extraction and preserve all findings mined so far"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: '16px',
                          background: 'rgba(239, 68, 68, 0.2)',
                          border: '1px solid rgba(239, 68, 68, 0.45)',
                          color: '#fca5a5',
                          cursor: isStopping ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s ease',
                          flexShrink: 0,
                        }}
                      >
                        <Square size={10} fill="#ef4444" color="#ef4444" />
                        <span>{isStopping ? 'Stopping...' : 'Emergency Stop'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Stepper Pipeline */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                      gap: '6px',
                      padding: '8px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {[
                      { step: 1, label: '1. Visual Page Clusters', detail: `Rendering pp. ${startPage}-${endPage}` },
                      { step: 2, label: '2. Scratchpad Entity Mining', detail: 'Sub-agent room & NPC extraction' },
                      { step: 3, label: '3. Automated QA Auditor', detail: 'Cross-checking omitted entities' },
                      { step: 4, label: '4. Domain Deconfliction', detail: 'SQLite lore & 5e base templates' },
                    ].map((s) => {
                      const isActive = decompStep === s.step;
                      const isDone = decompStep > s.step;
                      return (
                        <div
                          key={s.step}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            padding: '5px 6px',
                            borderRadius: '6px',
                            background: isActive ? 'rgba(245, 158, 11, 0.15)' : isDone ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                            border: `1px solid ${isActive ? 'var(--color-gold)' : isDone ? '#10b981' : 'transparent'}`,
                            transition: 'all 0.3s ease',
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              color: isActive ? 'var(--color-gold)' : isDone ? '#34d399' : 'var(--text-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {isDone ? '✓' : isActive ? '⏳' : '○'} {s.label}
                          </span>
                          <span
                            style={{
                              fontSize: '0.64rem',
                              color: 'var(--text-muted)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {s.detail}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Page Chunks & Sub-Agents Manifest Block */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      padding: '10px 12px',
                      background: 'rgba(0, 0, 0, 0.35)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      maxWidth: '100%',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                        <Layers size={14} style={{ color: 'var(--color-gold)', flexShrink: 0 }} />
                        <strong style={{ color: 'var(--text-primary)' }}>
                          Document Chunks & Sub-Agents ({jobClusters.length}):
                        </strong>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          (Click any worker to inspect intermediate scratchpad findings)
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowScratchpadModal(true)}
                        className="btn btn-secondary"
                        style={{
                          fontSize: '0.72rem',
                          padding: '4px 10px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          borderColor: 'var(--color-gold)',
                          color: 'var(--color-gold)',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        <ClipboardList size={13} />
                        Open Agent Scratchpad ({Object.keys(jobScratchpads).length || jobClusters.length || 1})
                      </button>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                        alignItems: 'center',
                        width: '100%',
                        maxWidth: '100%',
                      }}
                    >
                      {jobClusters.length > 0 ? (
                        jobClusters.map((c, idx) => {
                          const name = c.subagent_name || c.worker_name || `Worker ${idx + 1}`;
                          const isDone = c.status === 'completed';
                          const isRunning = c.status === 'running';
                          const isFailed = c.status === 'failed';

                          const sp = jobScratchpads[name];
                          const findingsCount = sp
                            ? (sp.rooms_inventoried?.length || 0) +
                              (sp.npcs_identified?.length || 0) +
                              (sp.monsters_spotted?.length || 0) +
                              (sp.sidebars_captured?.length || 0) +
                              (sp.traps_secrets?.length || 0)
                            : 0;

                          return (
                            <button
                              key={c.id || `cluster-${idx}`}
                              type="button"
                              onClick={() => {
                                setSelectedScratchpadAgent(name);
                                setShowScratchpadModal(true);
                              }}
                              title={`Click to inspect ${name} scratchpad (${c.status || 'pending'})`}
                              style={{
                                fontSize: '0.68rem',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background: isDone
                                  ? 'rgba(16, 185, 129, 0.16)'
                                  : isRunning
                                  ? 'rgba(245, 158, 11, 0.22)'
                                  : isFailed
                                  ? 'rgba(239, 68, 68, 0.2)'
                                  : 'rgba(255, 255, 255, 0.05)',
                                color: isDone
                                  ? '#34d399'
                                  : isRunning
                                  ? 'var(--color-gold)'
                                  : isFailed
                                  ? '#f87171'
                                  : 'var(--text-muted)',
                                border: `1px solid ${
                                  isDone
                                    ? 'rgba(16, 185, 129, 0.45)'
                                    : isRunning
                                    ? 'rgba(245, 158, 11, 0.65)'
                                    : isFailed
                                    ? 'rgba(239, 68, 68, 0.5)'
                                    : 'rgba(255, 255, 255, 0.12)'
                                }`,
                                fontWeight: isDone || isRunning ? 700 : 500,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {isDone && <CheckCircle2 size={11} style={{ color: '#34d399' }} />}
                              {isRunning && <Loader2 size={11} className="animate-spin" style={{ color: 'var(--color-gold)' }} />}
                              {isFailed && <AlertCircle size={11} style={{ color: '#f87171' }} />}
                              <span>
                                pp. {c.start_page}–{c.end_page} ({name})
                                {findingsCount > 0 && (
                                  <span
                                    style={{
                                      marginLeft: '4px',
                                      padding: '0 4px',
                                      borderRadius: '8px',
                                      background: 'rgba(16, 185, 129, 0.3)',
                                      color: '#a7f3d0',
                                      fontSize: '0.62rem',
                                    }}
                                  >
                                    {findingsCount}
                                  </span>
                                )}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {startPage && endPage
                            ? `${Math.ceil(((endPage || 30) - (startPage || 1) + 1) / 2)} slices queued (pp. ${startPage}–${endPage})`
                            : 'Auto-slicing (2 pages per cluster)'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Lore Tip Carousel */}
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Scroll size={14} style={{ color: 'var(--color-gold)', flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      <strong style={{ color: 'var(--color-gold)' }}>Lore Tip: </strong>
                      <span>{DECOMP_TIPS[decompTipIndex]}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    <Layers size={18} style={{ color: 'var(--color-gold)' }} />
                    Working Draft: {extractedNodes.length} Nodes, {extractedEdges.length} Edges
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Chat with the Co-DM below to steer and refine before committing.
                    </span>
                    {(jobClusters.length > 0 || Object.keys(jobScratchpads).length > 0) && (
                      <button
                        type="button"
                        onClick={() => setShowScratchpadModal(true)}
                        className="btn btn-ghost"
                        style={{
                          fontSize: '0.72rem',
                          padding: '2px 8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: 'var(--color-gold)',
                          border: '1px solid rgba(245, 158, 11, 0.4)',
                          borderRadius: '12px',
                          background: 'rgba(245, 158, 11, 0.08)',
                        }}
                      >
                        <ClipboardList size={12} />
                        Inspect Sub-Agent Scratchpads ({jobClusters.length} chunks • {jobSubagents.length || Object.keys(jobScratchpads).length} agents)
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {(() => {
                    const directivesCount = extractedNodes.filter((n) => n.custom_directive || (n.action === 'other' && n.merge_notes)).length;
                    if (directivesCount === 0) return null;
                    return (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSendFeedback("Incorporate all card custom directives into the working draft nodes, update stats and text, and clear directive flags.")}
                          disabled={isRefining}
                          className="btn btn-secondary"
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.75rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            borderColor: 'var(--color-gold)',
                            color: 'var(--color-gold)',
                          }}
                          title="Ask Co-DM to rewrite entities incorporating all custom directives"
                        >
                          <Sparkles size={13} className={isRefining ? 'animate-spin' : ''} />
                          {isRefining ? 'Refining...' : `⚡ Co-DM: Incorporate ${directivesCount} Directives`}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleBakeDirectivesLocally()}
                          className="btn btn-ghost"
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.75rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            border: '1px solid var(--border-medium)',
                            color: 'var(--text-secondary)',
                          }}
                          title="Instantly append all custom directives directly into the card text notes without calling the AI"
                        >
                          <CheckCircle2 size={13} style={{ color: '#34d399' }} />
                          Bake into Notes (Instant)
                        </button>
                      </>
                    );
                  })()}

                  {extractedNodes.length > 0 && (
                    <button
                      onClick={handleCommitToCampaign}
                      disabled={commitStatus === 'committing' || selectedNodeIndices.size === 0}
                      className="btn btn-primary"
                      style={{ padding: '7px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {commitStatus === 'committing' ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Check size={14} />
                      )}
                      Apply to Campaign Graph
                    </button>
                  )}
                </div>
              </div>

              {/* Commit Success Banner with Detailed Metrics */}
              {commitStatus === 'success' && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: 'var(--status-completed-bg)',
                    border: '1px solid var(--status-completed-border)',
                    color: 'var(--status-completed-text)',
                    fontSize: '0.85rem',
                    marginBottom: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <span>
                    ✨ Successfully committed to Campaign Graph:
                    {commitResult?.merged ? ` ${commitResult.merged} nodes safely merged (lore & canon preserved),` : ''}
                    {` ${commitResult?.created ?? 0} new nodes created,`}
                    {` ${commitResult?.edges ?? 0} relationships linked.`}
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => onNavigateTab('hierarchy')}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                    >
                      View Timeline
                    </button>
                    <button
                      onClick={() => onNavigateTab('graph')}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                    >
                      View Graph
                    </button>
                  </div>
                </div>
              )}

              {/* Conversational Steering & Feedback Section */}
              {extractedNodes.length > 0 && (
                <div
                  style={{
                    marginBottom: '16px',
                    background: 'var(--bg-surface)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-subtle)',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MessageSquare size={15} /> Co-DM Steering &amp; Refinement Conversation:
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {steeringConversation.length} exchanges
                    </span>
                  </div>

                  {/* Chat History Box */}
                  <div
                    style={{
                      maxHeight: '190px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      paddingRight: '4px',
                    }}
                  >
                    {steeringConversation.map((msg) => (
                      <div
                        key={msg.id}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          lineHeight: '1.4',
                          background:
                            msg.role === 'user'
                              ? 'var(--color-arcane-blue-bg)'
                              : 'var(--color-amber-glow)',
                          border: `1px solid ${
                            msg.role === 'user'
                              ? 'var(--color-arcane-blue-border)'
                              : 'var(--border-medium)'
                          }`,
                          alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                          maxWidth: '92%',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                          <span style={{ fontWeight: 700, color: msg.role === 'user' ? 'var(--color-arcane-blue-text)' : 'var(--color-gold)' }}>
                            {msg.role === 'user' ? 'Dungeon Master' : 'Co-DM Architect'}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{msg.timestamp}</span>
                          {msg.nodeCount !== undefined && (
                            <span
                              style={{
                                marginLeft: 'auto',
                                fontSize: '0.68rem',
                                background: 'var(--color-amber-glow)',
                                color: 'var(--text-gold)',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                border: '1px solid var(--border-subtle)',
                              }}
                            >
                              Draft: {msg.nodeCount} nodes
                            </span>
                          )}
                        </div>
                        <MarkdownView content={msg.content} />
                      </div>
                    ))}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* Quick Feedback Steering Chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                    {decomposerSuggestions.map((sug, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendFeedback(sug)}
                        disabled={isRefining}
                        className="btn btn-ghost"
                        style={{
                          padding: '2px 8px',
                          fontSize: '0.7rem',
                          borderRadius: '10px',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-medium)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        + {sug}
                      </button>
                    ))}
                  </div>

                  {/* Feedback Input Row */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <input
                      type="text"
                      value={feedbackInput}
                      onChange={(e) => setFeedbackInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendFeedback();
                      }}
                      placeholder="Provide feedback to steer nodes (e.g. 'Split Quest 1 into 2 parts', 'Make Yusdrayl an ally', 'Add a secret room')..."
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-medium)',
                        color: 'var(--text-primary)',
                        fontSize: '0.82rem',
                      }}
                    />
                    <button
                      onClick={() => handleSendFeedback()}
                      disabled={isRefining || !feedbackInput.trim()}
                      className="btn btn-primary"
                      style={{ padding: '8px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {isRefining ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                      Steer Co-DM
                    </button>
                  </div>
                </div>
              )}

              {/* Deconfliction Filter Pills & Selection Bar */}
              {extractedNodes.length > 0 && (() => {
                const conflictCount = extractedNodes.filter((n) => n.match_status === 'conflict').length;
                const potentialCount = extractedNodes.filter((n) => n.match_status === 'potential_match').length;
                const exactCount = extractedNodes.filter((n) => n.match_status === 'exact_match').length;
                const newCount = extractedNodes.filter((n) => !n.match_status || n.match_status === 'new').length;

                return (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '10px',
                      flexWrap: 'wrap',
                      gap: '8px',
                      padding: '6px 10px',
                      background: 'var(--bg-surface)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontWeight: 600, marginRight: '2px' }}>
                        Filter:
                      </span>
                      <button
                        type="button"
                        onClick={() => setDeconflictFilter('all')}
                        className="btn"
                        style={{
                          fontSize: '0.72rem',
                          padding: '3px 9px',
                          borderRadius: '12px',
                          background: deconflictFilter === 'all' ? 'var(--color-gold)' : 'var(--bg-card)',
                          color: deconflictFilter === 'all' ? '#111' : 'var(--text-secondary)',
                          fontWeight: deconflictFilter === 'all' ? 700 : 500,
                          border: '1px solid var(--border-medium)',
                        }}
                      >
                        All ({extractedNodes.length})
                      </button>

                      {conflictCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setDeconflictFilter('conflict')}
                          className="btn"
                          style={{
                            fontSize: '0.72rem',
                            padding: '3px 9px',
                            borderRadius: '12px',
                            background: deconflictFilter === 'conflict' ? '#ef4444' : 'rgba(239, 68, 68, 0.15)',
                            color: deconflictFilter === 'conflict' ? '#fff' : '#f87171',
                            fontWeight: 700,
                            border: '1px solid #ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <AlertTriangle size={12} />
                          Conflicts ({conflictCount})
                        </button>
                      )}

                      {potentialCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setDeconflictFilter('potential_match')}
                          className="btn"
                          style={{
                            fontSize: '0.72rem',
                            padding: '3px 9px',
                            borderRadius: '12px',
                            background: deconflictFilter === 'potential_match' ? '#8b5cf6' : 'rgba(139, 92, 246, 0.15)',
                            color: deconflictFilter === 'potential_match' ? '#fff' : '#c084fc',
                            fontWeight: 700,
                            border: '1px solid #8b5cf6',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <HelpCircle size={12} />
                          Potential ({potentialCount})
                        </button>
                      )}

                      {exactCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setDeconflictFilter('exact_match')}
                          className="btn"
                          style={{
                            fontSize: '0.72rem',
                            padding: '3px 9px',
                            borderRadius: '12px',
                            background: deconflictFilter === 'exact_match' ? '#10b981' : 'rgba(16, 185, 129, 0.15)',
                            color: deconflictFilter === 'exact_match' ? '#fff' : '#34d399',
                            fontWeight: 700,
                            border: '1px solid #10b981',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <GitMerge size={12} />
                          Auto-Merges ({exactCount})
                        </button>
                      )}

                      {newCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setDeconflictFilter('new')}
                          className="btn"
                          style={{
                            fontSize: '0.72rem',
                            padding: '3px 9px',
                            borderRadius: '12px',
                            background: deconflictFilter === 'new' ? 'var(--border-medium)' : 'var(--bg-card)',
                            color: deconflictFilter === 'new' ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontWeight: 600,
                            border: '1px solid var(--border-medium)',
                          }}
                        >
                          New ({newCount})
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleSelectAll(selectedNodeIndices.size < extractedNodes.length)}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                      >
                        {selectedNodeIndices.size === extractedNodes.length ? 'Deselect All' : `Select All (${extractedNodes.length})`}
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Extracted Nodes List with Live Deconfliction & Selection Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '440px', overflowY: 'auto' }}>
                {extractedNodes.length === 0 ? (
                  isDecomposing ? (
                    <div
                      style={{
                        height: '240px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                        gap: '12px',
                      }}
                    >
                      <Loader2 size={36} className="animate-spin" style={{ color: 'var(--color-gold)' }} />
                      <p style={{ fontSize: '0.92rem', color: 'var(--text-primary)', fontWeight: 700, margin: 0 }}>
                        Weaving Chapter Draft...
                      </p>
                      <p style={{ fontSize: '0.75rem', maxWidth: '340px', color: 'var(--text-secondary)', margin: 0 }}>
                        Gemini is parsing adventure scenes, encounters, NPCs, and assigning epistemic certainty (Facts, Suspicions, Rumors).
                      </p>
                    </div>
                  ) : (
                    <div
                      style={{
                        height: '240px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                        gap: '8px',
                      }}
                    >
                      <FileText size={36} style={{ color: 'var(--border-medium)' }} />
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>No decomposition results yet.</p>
                      <p style={{ fontSize: '0.75rem', maxWidth: '320px', color: 'var(--text-secondary)' }}>
                        Upload an adventure chapter or stat sheet, choose your instructions, and click <strong>Decompose with Co-DM</strong>.
                      </p>
                    </div>
                  )
                ) : (() => {
                  const filteredList = extractedNodes
                    .map((n, idx) => ({ node: n, originalIdx: idx }))
                    .filter(({ node }) => {
                      if (deconflictFilter === 'conflict') return node.match_status === 'conflict';
                      if (deconflictFilter === 'potential_match') return node.match_status === 'potential_match';
                      if (deconflictFilter === 'exact_match') return node.match_status === 'exact_match';
                      if (deconflictFilter === 'new') return !node.match_status || node.match_status === 'new';
                      return true;
                    });

                  if (filteredList.length === 0) {
                    return (
                      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        No nodes match the "{deconflictFilter}" filter.
                      </div>
                    );
                  }

                  return filteredList.map(({ node: n, originalIdx: idx }) => {
                    const isChecked = selectedNodeIndices.has(idx);
                    const isConflict = n.match_status === 'conflict';
                    const isPotential = n.match_status === 'potential_match';
                    const isExact = n.match_status === 'exact_match';
                    const willMerge = n.action === 'merge' || (!n.action && isExact);

                    return (
                      <div
                        key={idx}
                        className="glass-panel"
                        style={{
                          padding: '12px 14px',
                          borderRadius: '8px',
                          border: `1px solid ${
                            isConflict
                              ? 'rgba(239, 68, 68, 0.45)'
                              : isChecked
                              ? 'var(--color-gold)'
                              : 'var(--border-subtle)'
                          }`,
                          background: isConflict
                            ? 'rgba(239, 68, 68, 0.05)'
                            : isChecked
                            ? 'var(--color-amber-glow)'
                            : 'var(--bg-surface)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {/* Header Row with Checkbox, Titles, and Deconfliction Badge */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectNode(idx)}
                            style={{ marginTop: '4px', cursor: 'pointer' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span className={`badge badge-${n.type || 'quest'}`}>{n.type}</span>
                                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{n.title}</span>
                                {n.subtitle && (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    • {n.subtitle}
                                  </span>
                                )}
                              </div>

                              {/* Status Badges & Lore Confidence */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                {/* Epistemic Lore Status Pill */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCycleLoreStatus(idx);
                                  }}
                                  title="Click to cycle Fact (100%) ➔ Suspicion (75%) ➔ Rumor (40%)"
                                  className="btn btn-ghost"
                                  style={{
                                    padding: '2px 8px',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    borderRadius: '10px',
                                    background:
                                      n.lore_status === 'rumor'
                                        ? 'rgba(236, 72, 153, 0.18)'
                                        : n.lore_status === 'suspicion'
                                        ? 'rgba(245, 158, 11, 0.18)'
                                        : 'rgba(16, 185, 129, 0.18)',
                                    color:
                                      n.lore_status === 'rumor'
                                        ? '#f472b6'
                                        : n.lore_status === 'suspicion'
                                        ? '#fbbf24'
                                        : '#34d399',
                                    border: `1px solid ${
                                      n.lore_status === 'rumor'
                                        ? '#ec4899'
                                        : n.lore_status === 'suspicion'
                                        ? '#f59e0b'
                                        : '#10b981'
                                    }`,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <span>{n.lore_status === 'rumor' ? '🗣️ Rumor' : n.lore_status === 'suspicion' ? '🔍 Suspicion' : '🔒 Fact'}</span>
                                  <span style={{ opacity: 0.8 }}>({Math.round((n.confidence ?? 1.0) * 100)}%)</span>
                                </button>

                                {isExact && (
                                  <span
                                    style={{
                                      fontSize: '0.72rem',
                                      fontWeight: 600,
                                      padding: '2px 8px',
                                      borderRadius: '10px',
                                      background: willMerge ? 'rgba(16, 185, 129, 0.18)' : 'rgba(59, 130, 246, 0.18)',
                                      color: willMerge ? '#34d399' : '#60a5fa',
                                      border: `1px solid ${willMerge ? '#10b981' : '#3b82f6'}`,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                    }}
                                  >
                                    {willMerge ? <GitMerge size={11} /> : <Plus size={11} />}
                                    {willMerge ? `Auto-Merge: "${n.matched_node_title || n.title}"` : 'Creating as Separate Node'}
                                  </span>
                                )}

                                {isConflict && (
                                  <span
                                    style={{
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      padding: '2px 8px',
                                      borderRadius: '10px',
                                      background: 'rgba(239, 68, 68, 0.2)',
                                      color: '#f87171',
                                      border: '1px solid #ef4444',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                    }}
                                  >
                                    <AlertTriangle size={11} />
                                    ⚠️ Lore Conflict: "{n.matched_node_title}"
                                  </span>
                                )}

                                {isPotential && (
                                  <span
                                    style={{
                                      fontSize: '0.72rem',
                                      fontWeight: 600,
                                      padding: '2px 8px',
                                      borderRadius: '10px',
                                      background: 'rgba(139, 92, 246, 0.2)',
                                      color: '#c084fc',
                                      border: '1px solid #8b5cf6',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                    }}
                                  >
                                    <HelpCircle size={11} />
                                    Potential Match ({Math.round((n.match_confidence || 0.8) * 100)}%)
                                  </span>
                                )}

                                {!isExact && !isConflict && !isPotential && (
                                  <span
                                    style={{
                                      fontSize: '0.72rem',
                                      padding: '2px 8px',
                                      borderRadius: '10px',
                                      background: 'var(--bg-card)',
                                      color: 'var(--text-muted)',
                                      border: '1px solid var(--border-subtle)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                    }}
                                  >
                                    <Plus size={11} />
                                    New Entity
                                  </span>
                                )}

                                {/* Source Provenance Badge */}
                                {n.source_page && (
                                  <span
                                    style={{
                                      fontSize: '0.70rem',
                                      padding: '2px 7px',
                                      borderRadius: '10px',
                                      background: 'rgba(59, 130, 246, 0.15)',
                                      color: '#60a5fa',
                                      border: '1px solid rgba(59, 130, 246, 0.3)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                    }}
                                    title={`Extracted from page ${n.source_page}`}
                                  >
                                    📍 Page {n.source_page}
                                  </span>
                                )}

                                {/* Base Template Inherited Badge */}
                                {n.inherited_template && n.base_template_title && (
                                  <span
                                    style={{
                                      fontSize: '0.70rem',
                                      padding: '2px 7px',
                                      borderRadius: '10px',
                                      background: 'rgba(16, 185, 129, 0.15)',
                                      color: '#34d399',
                                      border: '1px solid rgba(16, 185, 129, 0.3)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                    }}
                                    title={`Inherited base 5e statistics from existing campaign node: ${n.base_template_title}`}
                                  >
                                    🧬 Base: {n.base_template_title}
                                  </span>
                                )}

                                {/* Needs Statblock Stub Badge */}
                                {n.needs_statblock && (
                                  <span
                                    style={{
                                      fontSize: '0.70rem',
                                      padding: '2px 7px',
                                      borderRadius: '10px',
                                      background: 'rgba(245, 158, 11, 0.2)',
                                      color: '#fbbf24',
                                      border: '1px solid #f59e0b',
                                      fontWeight: 600,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                    }}
                                  >
                                    📝 Needs Stat Block
                                  </span>
                                )}
                              </div>
                            </div>

                            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 6px' }}>
                              {n.summary || n.content_markdown?.slice(0, 140)}
                            </p>

                            {/* Lossless merge guarantee note for exact matches */}
                            {isExact && willMerge && (
                              <div style={{ fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                                <CheckCircle size={12} />
                                Lossless Auto-Merge: Existing canon notes &amp; stats preserved; imported lore safely appended under a dated section.
                              </div>
                            )}

                            {/* Needs Statblock Stub Alert Box */}
                            {n.needs_statblock && (
                              <div
                                style={{
                                  padding: '7px 11px',
                                  borderRadius: '6px',
                                  background: 'rgba(245, 158, 11, 0.08)',
                                  border: '1px solid rgba(245, 158, 11, 0.3)',
                                  fontSize: '0.75rem',
                                  color: '#fbbf24',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '7px',
                                  marginBottom: '6px',
                                }}
                              >
                                <Sparkles size={13} style={{ flexShrink: 0 }} />
                                <div>
                                  {n.needs_statblock_prompt || `Missing complete 5e statblock for "${n.title}". Created as a stub record ready for manual input or stat block upload.`}
                                </div>
                              </div>
                            )}

                            {/* Conflict Alert Box with Explicit Dilemma Card */}
                            {isConflict && (
                              <div
                                style={{
                                  padding: '8px 12px',
                                  borderRadius: '6px',
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.35)',
                                  fontSize: '0.76rem',
                                  color: 'var(--text-primary)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '4px',
                                  marginBottom: '6px',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171', fontWeight: 700 }}>
                                  <AlertTriangle size={13} />
                                  Flagged for DM Review: Contradiction Detected with Existing Campaign Node
                                </div>
                                <div style={{ color: 'var(--text-primary)', marginTop: '2px', lineHeight: 1.4 }}>
                                  {n.dilemma_explanation || n.conflict_reason || 'Contradictory values detected between existing campaign record and imported document.'}
                                </div>
                                <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)' }}>
                                  Existing Campaign Target: <strong>{n.matched_node_title}</strong> (ID: {n.matched_node_id})
                                </div>
                              </div>
                            )}

                            {/* Conflict Resolved Confirmation Banner */}
                            {n.conflict_resolved && (
                              <div
                                style={{
                                  padding: '8px 12px',
                                  borderRadius: '6px',
                                  background: 'rgba(16, 185, 129, 0.1)',
                                  border: '1px solid rgba(16, 185, 129, 0.35)',
                                  fontSize: '0.76rem',
                                  color: 'var(--text-primary)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  marginBottom: '6px',
                                }}
                              >
                                <Check size={14} style={{ color: '#34d399', flexShrink: 0 }} />
                                <div>
                                  <span style={{ color: '#34d399', fontWeight: 700 }}>✓ Conflict Resolved per Directive: </span>
                                  <span>Stats & lore aligned with canon. Staged for clean merge into <strong>{n.matched_node_title || 'existing node'}</strong>.</span>
                                </div>
                              </div>
                            )}

                            {/* Potential Match Candidate Box with Explicit Dilemma Card */}
                            {isPotential && (
                              <div
                                style={{
                                  padding: '8px 12px',
                                  borderRadius: '6px',
                                  background: 'rgba(139, 92, 246, 0.1)',
                                  border: '1px solid rgba(139, 92, 246, 0.35)',
                                  fontSize: '0.76rem',
                                  color: 'var(--text-primary)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '4px',
                                  marginBottom: '6px',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c084fc', fontWeight: 700 }}>
                                  <HelpCircle size={13} />
                                  Ambiguous Near-Match ({Math.round((n.match_confidence || 0.8) * 100)}% Similarity)
                                </div>
                                <div style={{ color: 'var(--text-primary)', marginTop: '2px', lineHeight: 1.4 }}>
                                  {n.dilemma_explanation || `The agent suspects this entity matches existing node "${n.matched_node_title}". Choose whether to merge or create a distinct record:`}
                                </div>
                              </div>
                            )}

                            {/* Custom Directive Banner */}
                            {n.custom_directive && (
                              <div
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  background: 'rgba(234, 179, 8, 0.12)',
                                  border: '1px solid rgba(234, 179, 8, 0.35)',
                                  fontSize: '0.74rem',
                                  color: 'var(--color-gold)',
                                  marginBottom: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                <span>🎯 <strong>Custom Directive:</strong> "{n.custom_directive}"</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleBakeDirectivesLocally(idx);
                                  }}
                                  className="btn btn-ghost"
                                  style={{
                                    fontSize: '0.68rem',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    marginLeft: 'auto',
                                    border: '1px solid rgba(234, 179, 8, 0.4)',
                                    color: 'var(--color-gold)',
                                    background: 'rgba(234, 179, 8, 0.15)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    cursor: 'pointer',
                                  }}
                                  title="Bake this directive directly into the card text notes now"
                                >
                                  <Check size={11} />
                                  Bake into Note
                                </button>
                              </div>
                            )}

                            {/* Interactive Action Controls (Merge / Create / Skip / Other Buttons) */}
                            {(isConflict || isPotential || isExact) && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                                <span style={{ fontSize: '0.71rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                  Action:
                                </span>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSetNodeAction(idx, 'merge');
                                  }}
                                  className="btn"
                                  style={{
                                    padding: '3px 9px',
                                    fontSize: '0.72rem',
                                    borderRadius: '6px',
                                    background: willMerge
                                      ? 'rgba(16, 185, 129, 0.25)'
                                      : 'var(--bg-surface)',
                                    border: willMerge
                                      ? '1px solid #10b981'
                                      : '1px solid var(--border-medium)',
                                    color: willMerge ? '#34d399' : 'var(--text-secondary)',
                                    fontWeight: willMerge ? 700 : 500,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <GitMerge size={11} />
                                  {isConflict
                                    ? 'Merge & Update'
                                    : isPotential
                                    ? `Confirm Merge with ${n.matched_node_title}`
                                    : `Auto-Merge into ${n.matched_node_title || 'Existing'}`}
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSetNodeAction(idx, 'create');
                                  }}
                                  className="btn"
                                  style={{
                                    padding: '3px 9px',
                                    fontSize: '0.72rem',
                                    borderRadius: '6px',
                                    background: n.action === 'create'
                                      ? 'rgba(59, 130, 246, 0.25)'
                                      : 'var(--bg-surface)',
                                    border: n.action === 'create'
                                      ? '1px solid #3b82f6'
                                      : '1px solid var(--border-medium)',
                                    color: n.action === 'create' ? '#60a5fa' : 'var(--text-secondary)',
                                    fontWeight: n.action === 'create' ? 700 : 500,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <Plus size={11} />
                                  Create as New
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSetNodeAction(idx, 'skip');
                                  }}
                                  className="btn"
                                  title="Skip this entity from being imported"
                                  style={{
                                    padding: '3px 9px',
                                    fontSize: '0.72rem',
                                    borderRadius: '6px',
                                    background: n.action === 'skip' || !isChecked
                                      ? 'rgba(107, 114, 128, 0.25)'
                                      : 'var(--bg-surface)',
                                    border: n.action === 'skip' || !isChecked
                                      ? '1px solid #9ca3af'
                                      : '1px solid var(--border-medium)',
                                    color: n.action === 'skip' || !isChecked ? '#9ca3af' : 'var(--text-muted)',
                                    fontWeight: 500,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <Square size={11} />
                                  Skip
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleOtherInput(idx);
                                  }}
                                  className="btn"
                                  title="Provide custom instructions on how to handle this entity"
                                  style={{
                                    padding: '3px 9px',
                                    fontSize: '0.72rem',
                                    borderRadius: '6px',
                                    background: n.show_other_input || n.custom_directive
                                      ? 'rgba(234, 179, 8, 0.22)'
                                      : 'var(--bg-surface)',
                                    border: n.show_other_input || n.custom_directive
                                      ? '1px solid var(--color-gold)'
                                      : '1px solid var(--border-medium)',
                                    color: n.show_other_input || n.custom_directive ? 'var(--color-gold)' : 'var(--text-secondary)',
                                    fontWeight: n.custom_directive ? 700 : 500,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <MessageSquare size={11} />
                                  Other...
                                </button>
                              </div>
                            )}

                            {/* Inline Other / Custom Instruction Input with Dual Re-Drafting Option */}
                            {n.show_other_input && (
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '8px',
                                  marginTop: '8px',
                                  padding: '10px 12px',
                                  borderRadius: '8px',
                                  background: 'rgba(15, 23, 42, 0.75)',
                                  border: '1px solid var(--color-gold)',
                                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--color-gold)', fontWeight: 600 }}>
                                    <Sparkles size={12} />
                                    <span>Single-Node Steering & Conflict Resolution</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleOtherInput(idx)}
                                    className="btn btn-ghost"
                                    style={{ padding: '2px', color: 'var(--text-muted)', cursor: 'pointer' }}
                                    title="Close steering drawer"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>

                                <input
                                  type="text"
                                  id={`custom-directive-${idx}`}
                                  defaultValue={n.custom_directive || ''}
                                  placeholder='E.g. "Canon stats win: keep CR 5 and Neutral Good. Link to The Yawning Portal..."'
                                  style={{
                                    width: '100%',
                                    padding: '7px 10px',
                                    borderRadius: '6px',
                                    background: 'var(--bg-surface)',
                                    border: '1px solid var(--border-medium)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.78rem',
                                    outline: 'none',
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleRedraftSingleNode(idx, (e.target as HTMLInputElement).value);
                                    }
                                  }}
                                />

                                {redraftError && redraftError.index === idx && (
                                  <div style={{ fontSize: '0.70rem', color: '#f87171' }}>
                                    ⚠️ {redraftError.message}
                                  </div>
                                )}

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
                                  <button
                                    type="button"
                                    className="btn btn-ghost"
                                    style={{
                                      padding: '3px 10px',
                                      fontSize: '0.72rem',
                                      borderRadius: '6px',
                                      color: 'var(--text-secondary)',
                                      cursor: 'pointer',
                                    }}
                                    onClick={() => {
                                      const input = document.getElementById(`custom-directive-${idx}`) as HTMLInputElement;
                                      handleSaveCustomDirective(idx, input?.value || '');
                                    }}
                                    title="Save directive as note without calling AI"
                                  >
                                    Save as Note Only
                                  </button>

                                  <button
                                    type="button"
                                    disabled={redraftingNodeIndex === idx}
                                    className="btn btn-primary"
                                    style={{
                                      padding: '4px 12px',
                                      fontSize: '0.72rem',
                                      borderRadius: '6px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      background: 'var(--color-gold)',
                                      color: '#000',
                                      fontWeight: 700,
                                      cursor: redraftingNodeIndex === idx ? 'not-allowed' : 'pointer',
                                    }}
                                    onClick={() => {
                                      const input = document.getElementById(`custom-directive-${idx}`) as HTMLInputElement;
                                      handleRedraftSingleNode(idx, input?.value || '');
                                    }}
                                    title="Have the AI re-draft this node and immediately re-evaluate conflicts"
                                  >
                                    {redraftingNodeIndex === idx ? (
                                      <>
                                        <Loader2 size={12} className="animate-spin" />
                                        Re-drafting & Checking...
                                      </>
                                    ) : (
                                      <>
                                        <Wand2 size={12} />
                                        Re-draft Node & Re-check
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Extracted Relationships Preview */}
              {extractedEdges.length > 0 && (
                <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Connected Relationships ({extractedEdges.length}):
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                    {extractedEdges.slice(0, 8).map((e, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: '0.7rem',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {e.source_title} ➔ <em>{e.relation_type}</em> ➔ {e.target_title}
                      </span>
                    ))}
                    {extractedEdges.length > 8 && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                        +{extractedEdges.length - 8} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Campaign Document Library Modal */}
      <DocumentLibraryModal
        isOpen={showLibraryModal}
        onClose={() => setShowLibraryModal(false)}
        campaignId={campaignId}
        onSelectDocument={handleSelectDoc}
        onRefreshParent={refreshLibraryCount}
      />

      {/* Duplicate Upload Resolution Modal */}
      {duplicateModalData && (
        <DuplicateUploadModal
          isOpen={Boolean(duplicateModalData)}
          onClose={() => setDuplicateModalData(null)}
          file={duplicateModalData.file}
          existingDoc={duplicateModalData.existing}
          onReuseExisting={() => handleReuseExisting(duplicateModalData.existing)}
          onReplaceFile={handleReplaceFile}
          onUploadAsCopy={handleUploadAsCopy}
        />
      )}

      {/* Sub-Agent Scratchpads & Extraction Manifest Modal */}
      <AgentScratchpadModal
        isOpen={showScratchpadModal}
        onClose={() => setShowScratchpadModal(false)}
        scratchpads={jobScratchpads}
        clusters={jobClusters}
        subagents={jobSubagents}
        currentStep={decompStep}
        status={decompError ? 'failed' : isDecomposing ? 'running' : 'completed'}
        initialAgentName={selectedScratchpadAgent}
      />
    </div>
  );
};
