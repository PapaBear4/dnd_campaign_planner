import {
  AppSettings,
  Campaign,
  EdgeItem,
  GraphData,
  HierarchyItem,
  ModelsQueryResponse,
  NodeItem,
  PlayerNote,
} from './types';

const BASE_URL = '';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API Error ${res.status}: ${errText}`);
  }
  return res.json();
}

// --- Campaigns ---
export async function getCampaigns(): Promise<Campaign[]> {
  const res = await fetch(`${BASE_URL}/api/campaigns`);
  return handleResponse<Campaign[]>(res);
}

export async function createCampaign(data: Partial<Campaign>): Promise<Campaign> {
  const res = await fetch(`${BASE_URL}/api/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<Campaign>(res);
}

export async function exportCampaign(campaignId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/campaigns/${campaignId}/export`);
  return handleResponse<any>(res);
}

export async function importCampaign(data: any): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/campaigns/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<any>(res);
}

// --- Graph & Hierarchy ---
export async function getGraph(campaignId?: string, playerMode: boolean = false): Promise<GraphData> {
  const url = new URL(`${window.location.origin}/api/graph`);
  if (campaignId) url.searchParams.set('campaign_id', campaignId);
  if (playerMode) url.searchParams.set('player_mode', 'true');
  const res = await fetch(url.toString());
  return handleResponse<GraphData>(res);
}

export async function getHierarchy(campaignId?: string, playerMode: boolean = false): Promise<HierarchyItem[]> {
  const url = new URL(`${window.location.origin}/api/hierarchy`);
  if (campaignId) url.searchParams.set('campaign_id', campaignId);
  if (playerMode) url.searchParams.set('player_mode', 'true');
  const res = await fetch(url.toString());
  return handleResponse<HierarchyItem[]>(res);
}

export async function searchNodes(query: string, campaignId?: string, playerMode: boolean = false): Promise<NodeItem[]> {
  const url = new URL(`${window.location.origin}/api/search`);
  url.searchParams.set('q', query);
  if (campaignId) url.searchParams.set('campaign_id', campaignId);
  if (playerMode) url.searchParams.set('player_mode', 'true');
  const res = await fetch(url.toString());
  return handleResponse<NodeItem[]>(res);
}

// --- Nodes ---
export async function createNode(data: Partial<NodeItem>): Promise<NodeItem> {
  const res = await fetch(`${BASE_URL}/api/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<NodeItem>(res);
}

export async function updateNode(nodeId: string, data: Partial<NodeItem>): Promise<NodeItem> {
  const res = await fetch(`${BASE_URL}/api/nodes/${nodeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<NodeItem>(res);
}

export async function deleteNode(nodeId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/nodes/${nodeId}`, { method: 'DELETE' });
  return handleResponse<any>(res);
}

export async function toggleNodeReveal(nodeId: string): Promise<NodeItem> {
  const res = await fetch(`${BASE_URL}/api/nodes/${nodeId}/toggle-reveal`, { method: 'POST' });
  return handleResponse<NodeItem>(res);
}

// --- Edges ---
export async function createEdge(data: Partial<EdgeItem>): Promise<EdgeItem> {
  const res = await fetch(`${BASE_URL}/api/edges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<EdgeItem>(res);
}

export async function deleteEdge(edgeId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/edges/${edgeId}`, { method: 'DELETE' });
  return handleResponse<any>(res);
}

// --- Player Portal ---
export async function getPlayerGraph(campaignId?: string): Promise<GraphData> {
  const url = new URL(`${window.location.origin}/api/player/graph`);
  if (campaignId) url.searchParams.set('campaign_id', campaignId);
  const res = await fetch(url.toString());
  return handleResponse<GraphData>(res);
}

export async function getPlayerHierarchy(campaignId?: string): Promise<HierarchyItem[]> {
  const url = new URL(`${window.location.origin}/api/player/hierarchy`);
  if (campaignId) url.searchParams.set('campaign_id', campaignId);
  const res = await fetch(url.toString());
  return handleResponse<HierarchyItem[]>(res);
}

export async function getPlayerNotes(campaignId?: string): Promise<PlayerNote[]> {
  const url = new URL(`${window.location.origin}/api/player/notes`);
  if (campaignId) url.searchParams.set('campaign_id', campaignId);
  const res = await fetch(url.toString());
  return handleResponse<PlayerNote[]>(res);
}

export async function createPlayerNote(data: Partial<PlayerNote>): Promise<PlayerNote> {
  const res = await fetch(`${BASE_URL}/api/player/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<PlayerNote>(res);
}

export async function deletePlayerNote(noteId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/player/notes/${noteId}`, { method: 'DELETE' });
  return handleResponse<any>(res);
}

// --- Settings ---
export async function getSettings(): Promise<AppSettings> {
  const res = await fetch(`${BASE_URL}/api/settings`);
  return handleResponse<AppSettings>(res);
}

export async function updateSettings(data: Partial<AppSettings> & { gemini_api_key?: string }): Promise<AppSettings> {
  const res = await fetch(`${BASE_URL}/api/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<AppSettings>(res);
}

export async function queryAvailableModels(apiKey?: string): Promise<ModelsQueryResponse> {
  const res = await fetch(`${BASE_URL}/api/settings/models`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey }),
  });
  return handleResponse<ModelsQueryResponse>(res);
}

// --- AI Co-DM Agent ---
export async function agentChat(messages: { role: string; content: string }[], contextNodeId?: string, campaignId?: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context_node_id: contextNodeId, campaign_id: campaignId }),
  });
  return handleResponse<any>(res);
}

export async function agentBoxedText(locationTitle: string, mood?: string, sensoryDetails?: string, dmNotes?: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/agent/boxed-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location_title: locationTitle, mood, sensory_details: sensoryDetails, dm_notes: dmNotes }),
  });
  return handleResponse<any>(res);
}

export async function agentCoach(situation: string, challengeType: string, campaignId?: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/agent/coach`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ situation, challenge_type: challengeType, campaign_id: campaignId }),
  });
  return handleResponse<any>(res);
}

export async function agentWeaveHook(pcName: string, pcBackstory: string, targetNodeId?: string, campaignId?: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/agent/weave-hook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pc_name: pcName, pc_backstory: pcBackstory, target_node_id: targetNodeId, campaign_id: campaignId }),
  });
  return handleResponse<any>(res);
}

export async function agentExtractEntities(textContent: string, campaignId?: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/agent/extract-entities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text_content: textContent, campaign_id: campaignId }),
  });
  return handleResponse<any>(res);
}

export async function agentApplyExtracted(nodes: any[], edges: any[], campaignId?: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/agent/apply-extracted`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nodes, edges, campaign_id: campaignId }),
  });
  return handleResponse<any>(res);
}

// --- Uploads & PDF ---
export interface UploadedDoc {
  id: string;
  campaign_id: string;
  filename: string;
  original_name: string;
  category: string;
  file_size: number;
  page_count: number;
  file_hash: string;
  url: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export async function listUploads(campaignId?: string, category?: string, search?: string): Promise<UploadedDoc[]> {
  const params = new URLSearchParams();
  if (campaignId) params.append('campaign_id', campaignId);
  if (category) params.append('category', category);
  if (search) params.append('search', search);
  const res = await fetch(`${BASE_URL}/api/uploads?${params.toString()}`);
  return handleResponse<UploadedDoc[]>(res);
}

export async function checkDuplicateUpload(
  filename: string,
  campaignId?: string,
  category?: string
): Promise<{ exists: boolean; existing_file?: UploadedDoc }> {
  const params = new URLSearchParams({ filename });
  if (campaignId) params.append('campaign_id', campaignId);
  if (category) params.append('category', category);
  const res = await fetch(`${BASE_URL}/api/uploads/check-duplicate?${params.toString()}`);
  return handleResponse<{ exists: boolean; existing_file?: UploadedDoc }>(res);
}

export async function uploadFile(
  file: File,
  category: string = 'general',
  campaignId?: string,
  replace: boolean = false
): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);
  if (campaignId) formData.append('campaign_id', campaignId);
  if (replace) formData.append('replace', 'true');
  const res = await fetch(`${BASE_URL}/api/uploads`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse<any>(res);
}

export async function deleteUploadedFile(filename: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/uploads/${filename}`, {
    method: 'DELETE',
  });
  return handleResponse<any>(res);
}

export async function parsePdfDocument(filename: string, maxPages: number = 30): Promise<any> {
  const formData = new FormData();
  formData.append('filename', filename);
  formData.append('max_pages', maxPages.toString());
  const res = await fetch(`${BASE_URL}/api/uploads/parse-pdf`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse<any>(res);
}

export async function agentDecomposeAdventure(data: {
  filename?: string;
  text_content?: string;
  instruction?: string;
  decomposition_mode?: 'campaign_structure' | 'monsters' | 'characters' | 'general';
  start_page?: number;
  end_page?: number;
  campaign_id?: string;
  current_nodes?: any[];
  current_edges?: any[];
  conversation_history?: { role: string; content: string }[];
}): Promise<{
  overview_summary: string;
  extracted_nodes: any[];
  extracted_edges: any[];
  model: string;
}> {
  const res = await fetch(`${BASE_URL}/api/agent/decompose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<any>(res);
}

// --- Session Transcript Adaptation ---
export async function agentAdaptSession(data: {
  session_node_id?: string;
  transcript_text: string;
  user_instruction?: string;
  campaign_id?: string;
  conversation_history?: { role: string; content: string }[];
}): Promise<{
  overview: string;
  status_updates: { node_id: string; title: string; node_type: string; new_status: string; reason: string }[];
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
}> {
  const res = await fetch(`${BASE_URL}/api/agent/adapt-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<any>(res);
}

export async function agentApplySessionAdaptation(data: {
  campaign_id?: string;
  session_node_id?: string;
  status_updates?: { node_id: string; title: string; node_type: string; new_status: string; reason: string }[];
  npc_updates?: { node_id?: string; name: string; disposition: string; state_changes: string; notes: string }[];
  emergent_nodes?: any[];
  emergent_edges?: any[];
  next_session_prep?: {
    title: string;
    description: string;
    suggested_encounters: string[];
    dm_secrets: string;
  };
  player_recap?: string;
}): Promise<{
  success: boolean;
  message: string;
  updated_count: number;
  created_node_count: number;
  created_edge_count: number;
  next_session_id?: string;
  player_note_id?: string;
}> {
  const res = await fetch(`${BASE_URL}/api/agent/apply-session-adaptation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<any>(res);
}


