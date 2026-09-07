from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field

NodeType = Literal[
    "campaign",
    "arc",
    "quest",
    "session",
    "encounter",
    "pc",
    "npc",
    "monster",
    "location",
    "faction",
    "item",
    "clue",
    "map",
    "lore",
]

RelationType = Literal[
    "contains",
    "precedes",
    "located_at",
    "allied_with",
    "hostile_to",
    "gives_quest",
    "rewards",
    "frequents",
    "knows_secret",
    "involved_in",
    "member_of",
    "parent_of",
    "associated_with",
    "worships",
    "created_by",
    "recorded_in",
    "custom",
]

# --- Campaign Models ---
class CampaignBase(BaseModel):
    name: str
    description: Optional[str] = ""
    setting: Optional[str] = "Forgotten Realms"

class CampaignCreate(CampaignBase):
    pass

class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    setting: Optional[str] = None

class CampaignResponse(CampaignBase):
    id: str
    created_at: str
    updated_at: str

# --- Node Models ---
class NodeBase(BaseModel):
    type: NodeType
    title: str
    subtitle: Optional[str] = ""
    summary: Optional[str] = ""
    content_markdown: Optional[str] = ""
    data_json: Optional[Dict[str, Any]] = Field(default_factory=dict)
    revealed_to_players: Optional[bool] = False
    tags: Optional[List[str]] = Field(default_factory=list)
    sort_order: Optional[int] = 0

class NodeCreate(NodeBase):
    campaign_id: Optional[str] = None

class NodeUpdate(BaseModel):
    type: Optional[NodeType] = None
    title: Optional[str] = None
    subtitle: Optional[str] = None
    summary: Optional[str] = None
    content_markdown: Optional[str] = None
    data_json: Optional[Dict[str, Any]] = None
    revealed_to_players: Optional[bool] = None
    tags: Optional[List[str]] = None
    sort_order: Optional[int] = None

class NodeResponse(NodeBase):
    id: str
    campaign_id: str
    created_at: str
    updated_at: str

# --- Edge Models ---
class EdgeBase(BaseModel):
    source_id: str
    target_id: str
    relation_type: str
    label: Optional[str] = ""
    metadata_json: Optional[Dict[str, Any]] = Field(default_factory=dict)
    revealed_to_players: Optional[bool] = False

class EdgeCreate(EdgeBase):
    campaign_id: Optional[str] = None

class EdgeUpdate(BaseModel):
    relation_type: Optional[str] = None
    label: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None
    revealed_to_players: Optional[bool] = None

class EdgeResponse(EdgeBase):
    id: str
    campaign_id: str
    created_at: str

# --- Graph Models ---
class GraphResponse(BaseModel):
    nodes: List[NodeResponse]
    edges: List[EdgeResponse]

class HierarchyItem(BaseModel):
    node: NodeResponse
    children: List["HierarchyItem"] = Field(default_factory=list)

# --- Player Notes ---
class PlayerNoteBase(BaseModel):
    node_id: Optional[str] = None
    author_name: str
    title: str
    content: str

class PlayerNoteCreate(PlayerNoteBase):
    campaign_id: Optional[str] = None

class PlayerNoteUpdate(BaseModel):
    node_id: Optional[str] = None
    author_name: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None

class PlayerNoteResponse(PlayerNoteBase):
    id: str
    campaign_id: str
    created_at: str
    updated_at: str

# --- Settings ---
class SettingsResponse(BaseModel):
    gemini_api_key_configured: bool
    gemini_model: str
    active_campaign_id: str

class SettingsUpdate(BaseModel):
    gemini_api_key: Optional[str] = None
    gemini_model: Optional[str] = None
    active_campaign_id: Optional[str] = None

class ModelInfo(BaseModel):
    id: str
    display_name: str
    description: Optional[str] = ""
    input_token_limit: Optional[int] = None
    output_token_limit: Optional[int] = None

class ModelsListResponse(BaseModel):
    models: List[ModelInfo]
    error: Optional[str] = None
    source: str = "api"

class ModelQueryRequest(BaseModel):
    api_key: Optional[str] = None

# --- AI Co-DM Models ---
class AgentChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str

class AgentChatRequest(BaseModel):
    messages: List[AgentChatMessage]
    context_node_id: Optional[str] = None
    campaign_id: Optional[str] = None

class BoxedTextRequest(BaseModel):
    location_title: str
    mood: Optional[str] = "mysterious, dangerous, ancient"
    sensory_details: Optional[str] = "damp stone, flickering torchlight, distant echoing drip"
    dm_notes: Optional[str] = ""

class CoachAdviceRequest(BaseModel):
    situation: str
    challenge_type: Literal["pacing", "fail_forward", "three_clue_rule", "encounter_balance", "player_agency", "general"]
    campaign_id: Optional[str] = None

class WeaveHookRequest(BaseModel):
    pc_name: str
    pc_backstory: str
    target_node_id: Optional[str] = None
    campaign_id: Optional[str] = None

class DocumentExtractRequest(BaseModel):
    text_content: str
    campaign_id: Optional[str] = None
    target_arc_id: Optional[str] = None

class DecomposeAdventureRequest(BaseModel):
    filename: Optional[str] = None
    text_content: Optional[str] = None
    start_page: Optional[int] = 1
    end_page: Optional[int] = 30
    instruction: Optional[str] = ""
    decomposition_mode: Optional[str] = "campaign_structure" # "campaign_structure", "monsters", "pc_sheets", "npcs_factions", "encounters", "custom"
    campaign_id: Optional[str] = None
    current_nodes: Optional[List[Dict[str, Any]]] = None
    current_edges: Optional[List[Dict[str, Any]]] = None
    conversation_history: Optional[List[AgentChatMessage]] = None

class SessionAdaptRequest(BaseModel):
    campaign_id: Optional[str] = None
    session_node_id: Optional[str] = None
    transcript_text: str
    instruction: Optional[str] = ""
    generate_player_recap: Optional[bool] = True
    current_adaptation: Optional[Dict[str, Any]] = None
    conversation_history: Optional[List[AgentChatMessage]] = None

class ApplySessionAdaptationRequest(BaseModel):
    campaign_id: str
    status_updates: Optional[List[Dict[str, Any]]] = []
    node_updates: Optional[List[Dict[str, Any]]] = []
    new_nodes: Optional[List[Dict[str, Any]]] = []
    new_edges: Optional[List[Dict[str, Any]]] = []
    next_session_node: Optional[Dict[str, Any]] = None
    parent_quest_id: Optional[str] = None
    player_note: Optional[Dict[str, Any]] = None



