export type NodeType =
  | 'campaign'
  | 'arc'
  | 'quest'
  | 'session'
  | 'encounter'
  | 'pc'
  | 'npc'
  | 'monster'
  | 'location'
  | 'faction'
  | 'item'
  | 'clue'
  | 'map'
  | 'lore';

export type {
  Alignment,
  AlignmentCategory,
  CreatureRole,
  CreatureSize,
  CreatureType,
} from './utils/alignmentAndRoles';

export type RelationType =
  | 'contains'
  | 'precedes'
  | 'located_at'
  | 'allied_with'
  | 'hostile_to'
  | 'gives_quest'
  | 'rewards'
  | 'frequents'
  | 'knows_secret'
  | 'involved_in'
  | 'member_of'
  | 'parent_of'
  | 'associated_with'
  | 'worships'
  | 'created_by'
  | 'recorded_in'
  | 'custom';

export type LoreStatus = 'fact' | 'suspicion' | 'rumor';

export interface Campaign {
  id: string;
  name: string;
  description: string;
  setting: string;
  created_at: string;
  updated_at: string;
}

export interface NodeItem {
  id: string;
  campaign_id: string;
  type: NodeType;
  title: string;
  subtitle?: string;
  summary?: string;
  content_markdown?: string;
  data_json?: Record<string, any>;
  revealed_to_players: boolean;
  is_canon?: boolean;
  confidence?: number;
  lore_status?: LoreStatus;
  tags?: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface EdgeItem {
  id: string;
  campaign_id: string;
  source_id: string;
  target_id: string;
  relation_type: string;
  label?: string;
  metadata_json?: Record<string, any>;
  revealed_to_players: boolean;
  is_canon?: boolean;
  confidence?: number;
  lore_status?: LoreStatus;
  created_at: string;
}

export interface GraphData {
  nodes: NodeItem[];
  edges: EdgeItem[];
}

export interface HierarchyItem {
  node: NodeItem;
  children: HierarchyItem[];
}

export interface PlayerNote {
  id: string;
  campaign_id: string;
  node_id?: string | null;
  author_name: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  gemini_api_key_configured: boolean;
  gemini_model: string;
  active_campaign_id: string;
}

export interface GeminiModelInfo {
  id: string;
  display_name: string;
  description?: string;
  input_token_limit?: number;
  output_token_limit?: number;
}

export interface ModelsQueryResponse {
  models: GeminiModelInfo[];
  error?: string | null;
  source: string;
}

export interface AgentActionTaken {
  tool: string;
  args: Record<string, any>;
  result: any;
}

export interface LoopStepTrace {
  turn: number;
  thought?: string;
  actions: string[];
  summary?: string;
}

export interface AgentChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  actions_taken?: AgentActionTaken[];
  scratchpad?: string;
  loop_steps?: LoopStepTrace[];
}

export interface ChatThread {
  id: string;
  campaign_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message?: string | null;
}

export type DeconflictMatchStatus = 'new' | 'exact_match' | 'potential_match' | 'conflict';
export type DeconflictAction = 'merge' | 'create' | 'skip' | 'other';

export interface ExtractedDraftNode {
  type: NodeType;
  title: string;
  subtitle?: string;
  summary?: string;
  content_markdown?: string;
  data_json?: Record<string, any>;
  revealed_to_players?: boolean;
  is_canon?: boolean;
  confidence?: number;
  lore_status?: LoreStatus;
  match_status?: DeconflictMatchStatus;
  matched_node_id?: string | null;
  matched_node_title?: string | null;
  match_confidence?: number;
  conflict_reason?: string | null;
  dilemma_explanation?: string | null;
  review_options?: string[];
  needs_statblock?: boolean;
  needs_statblock_prompt?: string;
  base_template_title?: string | null;
  inherited_template?: boolean;
  source_page?: number | null;
  source_doc?: string | null;
  source_section?: string | null;
  custom_directive?: string;
  show_other_input?: boolean;
  merge_notes?: string | null;
  action?: DeconflictAction;
  merge_target_id?: string | null;
}

export interface ExtractedDraftEdge {
  source_title?: string;
  target_title?: string;
  relation_type?: string;
  label?: string;
  metadata_json?: Record<string, any>;
  source_id?: string;
  target_id?: string;
  confidence?: number;
  lore_status?: LoreStatus;
}

export interface DecompositionCluster {
  id?: string;
  cluster_index?: number;
  start_page: number;
  end_page: number;
  worker_name?: string;
  subagent_name?: string;
  num_pages?: number;
  label?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed' | string;
  error?: string | null;
}

export interface SubAgentManifestItem {
  id?: string;
  name: string;
  role: string;
  target?: string;
  assigned_scope?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | string;
  items_found?: number;
  error?: string | null;
}

export interface AgentScratchpad {
  agent_name: string;
  role: string;
  assigned_pages?: string;
  rooms_inventoried?: string[];
  npcs_identified?: string[];
  monsters_spotted?: string[];
  sidebars_captured?: string[];
  traps_secrets?: string[];
  notes?: string[];
  timestamp?: string;
}

export interface DecompositionJob {
  id: string;
  campaign_id: string;
  filename: string;
  page_range: string;
  status: string;
  current_step: number;
  clusters: DecompositionCluster[];
  subagents: SubAgentManifestItem[];
  scratchpads: Record<string, AgentScratchpad>;
  draft_nodes: ExtractedDraftNode[];
  draft_edges: ExtractedDraftEdge[];
  qa_results?: any;
  overview_summary?: string;
  model_name?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface DecomposeAdventureResponse {
  job_id?: string;
  clusters?: DecompositionCluster[];
  subagents?: SubAgentManifestItem[];
  scratchpads?: Record<string, AgentScratchpad>;
  current_step?: number;
  status?: string;
  overview_summary?: string;
  extracted_nodes: any[];
  extracted_edges: any[];
  qa_results?: any;
  model?: string;
  chunks_processed?: number;
  error?: string;
}

