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

export interface AgentChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  actions_taken?: AgentActionTaken[];
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



