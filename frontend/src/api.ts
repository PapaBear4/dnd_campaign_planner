import {
  AppSettings,
  Campaign,
  ChatThread,
  EdgeItem,
  GraphData,
  HierarchyItem,
  ModelsQueryResponse,
  NodeItem,
  PlayerNote,
  DecompositionJob,
  DecomposeAdventureResponse,
  FeedbackItem,
} from './types';

const BASE_URL = '';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errText = await res.text();
    try {
      const parsed = JSON.parse(errText);
      const msg = parsed.error || parsed.detail || `API Error ${res.status}: ${errText}`;
      const err = new Error(msg);
      (err as any).data = parsed;
      (err as any).status = res.status;
      throw err;
    } catch (e: any) {
      if (e.data) throw e;
      throw new Error(`API Error ${res.status}: ${errText}`);
    }
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

export async function updateCampaign(campaignId: string, data: Partial<Campaign>): Promise<Campaign> {
  const res = await fetch(`${BASE_URL}/api/campaigns/${campaignId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<Campaign>(res);
}

export async function deleteCampaign(campaignId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/campaigns/${campaignId}`, {
    method: 'DELETE',
  });
  return handleResponse<any>(res);
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

export async function getLocationHierarchy(campaignId?: string, playerMode: boolean = false): Promise<HierarchyItem[]> {
  const url = new URL(`${window.location.origin}/api/locations/hierarchy`);
  if (campaignId) url.searchParams.set('campaign_id', campaignId);
  if (playerMode) url.searchParams.set('player_mode', 'true');
  const res = await fetch(url.toString());
  return handleResponse<HierarchyItem[]>(res);
}

export async function createSubLocation(
  campaignId: string,
  parentLocationId: string,
  title: string,
  summary?: string,
  extraData?: Record<string, any>
): Promise<{ node: NodeItem; edge: EdgeItem }> {
  const node = await createNode({
    campaign_id: campaignId,
    type: 'location',
    title: title.trim(),
    summary: summary?.trim() || '',
    data_json: { status: 'planned', ...(extraData || {}) },
  });
  const edge = await createEdge({
    campaign_id: campaignId,
    source_id: parentLocationId,
    target_id: node.id,
    relation_type: 'contains',
    label: 'Contains',
    revealed_to_players: false,
  });
  return { node, edge };
}

export async function createSubQuest(
  campaignId: string,
  parentQuestId: string,
  title: string,
  summary?: string,
  extraData?: Record<string, any>
): Promise<{ node: NodeItem; edge: EdgeItem }> {
  const node = await createNode({
    campaign_id: campaignId,
    type: 'quest',
    title: title.trim(),
    summary: summary?.trim() || '',
    data_json: { status: 'planned', ...(extraData || {}) },
  });
  const edge = await createEdge({
    campaign_id: campaignId,
    source_id: parentQuestId,
    target_id: node.id,
    relation_type: 'contains',
    label: 'Contains',
    revealed_to_players: false,
  });
  return { node, edge };
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

export async function toggleNodeCanon(nodeId: string, isCanon?: boolean): Promise<NodeItem> {
  const query = isCanon !== undefined ? `?is_canon=${isCanon}` : '';
  const res = await fetch(`${BASE_URL}/api/nodes/${nodeId}/toggle-canon${query}`, { method: 'POST' });
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

export async function updateEdge(edgeId: string, data: Partial<EdgeItem>): Promise<EdgeItem> {
  const res = await fetch(`${BASE_URL}/api/edges/${edgeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<EdgeItem>(res);
}

export async function deleteEdge(edgeId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/edges/${edgeId}`, { method: 'DELETE' });
  return handleResponse<any>(res);
}

export async function toggleEdgeReveal(edgeId: string): Promise<EdgeItem> {
  const res = await fetch(`${BASE_URL}/api/edges/${edgeId}/toggle-reveal`, { method: 'POST' });
  return handleResponse<EdgeItem>(res);
}

export async function toggleEdgeCanon(edgeId: string, isCanon?: boolean): Promise<EdgeItem> {
  const query = isCanon !== undefined ? `?is_canon=${isCanon}` : '';
  const res = await fetch(`${BASE_URL}/api/edges/${edgeId}/toggle-canon${query}`, { method: 'POST' });
  return handleResponse<EdgeItem>(res);
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

// --- AI Co-DM Agent & Threads ---
export async function getChatThreads(campaignId: string): Promise<ChatThread[]> {
  const res = await fetch(`${BASE_URL}/api/agent/threads?campaign_id=${encodeURIComponent(campaignId)}`);
  return handleResponse<ChatThread[]>(res);
}

export async function createChatThread(campaignId: string, title?: string): Promise<ChatThread> {
  const res = await fetch(`${BASE_URL}/api/agent/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaign_id: campaignId, title: title || 'New Prep Session' }),
  });
  return handleResponse<ChatThread>(res);
}

export async function getThreadMessages(threadId: string): Promise<any[]> {
  const res = await fetch(`${BASE_URL}/api/agent/threads/${threadId}/messages`);
  return handleResponse<any[]>(res);
}

export async function deleteChatThread(threadId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/agent/threads/${threadId}`, {
    method: 'DELETE',
  });
  return handleResponse<any>(res);
}

export async function agentChat(
  messages: { role: string; content: string }[],
  contextNodeId?: string,
  campaignId?: string,
  threadId?: string
): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      context_node_id: contextNodeId,
      campaign_id: campaignId,
      thread_id: threadId,
    }),
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
  decomposition_mode?: 'comprehensive' | 'campaign_structure' | 'monsters' | 'characters' | 'world_lore' | 'general';
  start_page?: number;
  end_page?: number;
  campaign_id?: string;
  current_nodes?: any[];
  current_edges?: any[];
  conversation_history?: { role: string; content: string }[];
  exhaustive?: boolean;
}): Promise<DecomposeAdventureResponse> {
  const res = await fetch(`${BASE_URL}/api/agent/decompose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<DecomposeAdventureResponse>(res);
}

export async function getDecompositionJob(jobId: string): Promise<DecompositionJob> {
  const res = await fetch(`${BASE_URL}/api/agent/decompose/job/${encodeURIComponent(jobId)}`);
  return handleResponse<DecompositionJob>(res);
}

export async function retryDecompositionJob(jobId: string, step?: number): Promise<DecomposeAdventureResponse> {
  const query = step !== undefined ? `?step=${step}` : '';
  const res = await fetch(`${BASE_URL}/api/agent/decompose/job/${encodeURIComponent(jobId)}/retry${query}`, {
    method: 'POST',
  });
  return handleResponse<DecomposeAdventureResponse>(res);
}

export async function getLatestDecompositionJob(campaignId: string): Promise<DecompositionJob> {
  const res = await fetch(`${BASE_URL}/api/agent/decompose/latest?campaign_id=${encodeURIComponent(campaignId)}`);
  return handleResponse<DecompositionJob>(res);
}

export async function stopDecompositionJob(jobId: string): Promise<DecompositionJob> {
  const res = await fetch(`${BASE_URL}/api/agent/decompose/job/${encodeURIComponent(jobId)}/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return handleResponse<DecompositionJob>(res);
}

export interface RedraftNodeResponse {
  node: any;
  edges: any[];
  summary: string;
  model: string;
  error?: string;
}

export async function agentRedraftNode(data: {
  campaign_id: string;
  node: any;
  directive: string;
  current_edges?: any[];
  matched_node_id?: string;
}): Promise<RedraftNodeResponse> {
  const res = await fetch(`${BASE_URL}/api/agent/redraft-node`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<RedraftNodeResponse>(res);
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
  status_updates?: { node_id: string; title: string; node_type: string; new_status: string; reason: string; node_title?: string }[];
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

// --- Multimodal Map Vision & Pin Alignment ---
export interface ScanMapVisionResponse {
  map_id: string;
  map_title: string;
  vision_notes: string;
  detected_pins: {
    id: string;
    nodeId: string;
    label: string;
    x: number;
    y: number;
    revealed: boolean;
    room_number?: string;
    is_new: boolean;
  }[];
  matched_existing_nodes: {
    pin_id: string;
    node_id: string;
    node_title: string;
    node_type: string;
    label: string;
    x: number;
    y: number;
  }[];
  new_nodes_to_create: {
    temp_id: string;
    type: string;
    title: string;
    summary: string;
    content_markdown?: string;
    data_json?: Record<string, any>;
    is_canon: boolean;
    revealed_to_players: boolean;
  }[];
  suggested_connections: {
    source_id: string;
    target_id: string;
    relation_type: string;
    label: string;
    source_title?: string;
    target_title?: string;
  }[];
  applied: boolean;
  summary: string;
  applied_details?: any;
}

export async function scanMapVision(data: {
  map_id: string;
  campaign_id?: string;
  instruction?: string;
  auto_align_existing?: boolean;
  create_missing_nodes?: boolean;
  connect_passages?: boolean;
  apply_changes?: boolean;
}): Promise<ScanMapVisionResponse> {
  const res = await fetch(`${BASE_URL}/api/agent/map/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<ScanMapVisionResponse>(res);
}

export async function applyMapScan(data: {
  map_id: string;
  campaign_id?: string;
  pins: any[];
  new_nodes?: any[];
  new_edges?: any[];
}): Promise<{
  success: boolean;
  map_id: string;
  pins_count: number;
  new_nodes_created: number;
  new_edges_created: number;
  message: string;
}> {
  const res = await fetch(`${BASE_URL}/api/agent/map/apply-scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<any>(res);
}

export async function placeMapPin(data: {
  map_id: string;
  campaign_id?: string;
  label: string;
  x: number;
  y: number;
  node_id?: string;
  revealed?: boolean;
  target_map_id?: string;
}): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/agent/map/place-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<any>(res);
}

export interface GenerateRunSheetResponse {
  success: boolean;
  session_id: string;
  session_title: string;
  run_sheet_markdown: string;
  previous_session_title: string;
  next_session_title?: string | null;
  beat_count: number;
  saved: boolean;
  model: string;
  error?: string;
}

export async function generateSessionRunSheet(
  sessionId: string,
  data: {
    campaign_id?: string;
    custom_instruction?: string;
    save_to_node?: boolean;
    use_llm?: boolean;
  } = {}
): Promise<GenerateRunSheetResponse> {
  const res = await fetch(`${BASE_URL}/api/agent/session/${sessionId}/generate-run-sheet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<GenerateRunSheetResponse>(res);
}

// --- Feedback & Bug Reporting ---
export async function getFeedbackList(params?: {
  type?: string;
  status?: string;
  campaign_id?: string;
}): Promise<FeedbackItem[]> {
  const query = new URLSearchParams();
  if (params?.type) query.append('type', params.type);
  if (params?.status) query.append('status', params.status);
  if (params?.campaign_id) query.append('campaign_id', params.campaign_id);
  const qs = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`${BASE_URL}/api/feedback${qs}`);
  return handleResponse<FeedbackItem[]>(res);
}

export async function createFeedbackItem(data: {
  campaign_id?: string;
  type: 'bug' | 'feature';
  title: string;
  category?: string;
  priority?: string;
  status?: string;
  description?: string;
  images?: string[];
  context?: Record<string, any>;
}): Promise<FeedbackItem> {
  const res = await fetch(`${BASE_URL}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<FeedbackItem>(res);
}

export async function updateFeedbackItem(
  id: string,
  data: Partial<FeedbackItem>
): Promise<{ status: string; id: string }> {
  const res = await fetch(`${BASE_URL}/api/feedback/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<{ status: string; id: string }>(res);
}

export async function deleteFeedbackItem(id: string): Promise<{ status: string; id: string }> {
  const res = await fetch(`${BASE_URL}/api/feedback/${id}`, {
    method: 'DELETE',
  });
  return handleResponse<{ status: string; id: string }>(res);
}

export async function uploadFeedbackScreenshot(file: File): Promise<{ url: string; filename: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE_URL}/api/feedback/upload-image`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse<{ url: string; filename: string }>(res);
}



